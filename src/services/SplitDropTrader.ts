import * as fs from 'fs';
import * as path from 'path';
import { PriceUpdate, Side } from '../types';
import { getTimeRange, formatTimestamp } from '../utils/time';

export class SplitDropTrader {
    private marketId: string;
    private stateFilePath: string;
    private logFilePath: string;
    private positions: { yes: number; no: number };
    private initialInvestment: number;
    private sellThreshold: number;
    private positionSize: number;
    private balance: number;
    private expirationMs: number = 0;
    private updateCount = 0;
    private lastPrices: { yes: number | null, no: number | null } = { yes: null, no: null };
    private preResolutionTimer: NodeJS.Timeout | null = null;
    private resolved: boolean = false;
    private marketRange: string = '??:??-??:??';
    private isSelling: boolean = false;
    private lastPriceUpdate: number = 0;

    constructor(marketId: string, sellThreshold: number = 0.05, positionSize: number = 10) {
        this.marketId = marketId;
        this.sellThreshold = sellThreshold;
        this.positionSize = positionSize;
        // Basis cost is $1.00 per YES+NO pair (Split function logic)
        this.initialInvestment = positionSize;
        this.balance = 0;

        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }

        const suffix = `${(sellThreshold * 100).toFixed(0)}c_${positionSize.toFixed(0)}usd`;
        this.stateFilePath = path.join(logDir, `split_drop_state_${marketId}_${suffix}.json`);
        this.logFilePath = path.join(logDir, `split_drop_results_${marketId}_${suffix}.csv`);

        const loaded = this.loadState();
        this.positions = loaded.positions;
        this.balance = loaded.balance;
        this.resolved = loaded.resolved;
        this.initializeCsv();
    }

    public setExpiration(ms: number) {
        this.expirationMs = ms;
        this.marketRange = getTimeRange(ms);

        // Schedule pre-resolution 1 second before expiration
        const now = Date.now();
        const preResolutionTime = ms - 1000;
        const delay = preResolutionTime - now;

        if (delay > 0 && !this.resolved) {
            console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] Scheduling pre-resolution at ${formatTimestamp(new Date(preResolutionTime))} (in ${(delay / 1000).toFixed(1)}s)`);
            this.preResolutionTimer = setTimeout(() => this.handlePreResolution(), delay);
        } else if (delay <= 0 && !this.resolved) {
            console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] Pre-resolution time already passed, triggering immediately`);
            this.handlePreResolution();
        }
    }

    /**
     * Called 1 second before market resolution.
     * Takes a snapshot of the current prices and determines the winner.
     */
    private handlePreResolution() {
        if (this.resolved) return;

        const yesPrice = this.lastPrices.yes ?? 0.5;
        const noPrice = this.lastPrices.no ?? 0.5;

        console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] === PRE-RESOLUTION SNAPSHOT ===`);
        console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] YES Price: $${yesPrice.toFixed(4)}, NO Price: $${noPrice.toFixed(4)}`);

        // Winner is the side with the highest price
        const winner: Side = yesPrice >= noPrice ? 'YES' : 'NO';

        console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] Winner: ${winner}`);

        // Settle remaining positions
        if (winner === 'YES') {
            if (this.positions.yes > 0) this.settle('YES', 1.00);
            if (this.positions.no > 0) this.settle('NO', 0.00);
        } else {
            if (this.positions.no > 0) this.settle('NO', 1.00);
            if (this.positions.yes > 0) this.settle('YES', 0.00);
        }

        this.resolved = true;
        this.saveState();

        // Calculate final PnL
        const finalPnL = this.balance - this.initialInvestment;
        console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] === FINAL RESULTS ===`);
        console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] Total Balance: $${this.balance.toFixed(4)}`);
        console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] Initial Investment: $${this.initialInvestment.toFixed(4)}`);
        console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] Final PnL: $${finalPnL.toFixed(4)}`);
    }

    private initializeCsv() {
        if (!fs.existsSync(this.logFilePath)) {
            const headers = 'Timestamp,Side,Action,Price,Shares,SaleValue,TotalBalance,EstimatedFinalPnL\n';
            fs.writeFileSync(this.logFilePath, headers);
        }
    }

    private loadState(): { positions: { yes: number; no: number }; balance: number; resolved: boolean } {
        if (fs.existsSync(this.stateFilePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf-8'));
                return {
                    positions: data.positions || { yes: this.positionSize, no: this.positionSize },
                    balance: data.balance || 0,
                    resolved: data.resolved || false
                };
            } catch (e) {
                console.error(`[SplitDrop] Error loading state: ${e}`);
            }
        }
        return {
            positions: { yes: this.positionSize, no: this.positionSize },
            balance: 0,
            resolved: false
        };
    }

    private saveState() {
        const state = {
            positions: this.positions,
            balance: this.balance,
            resolved: this.resolved
        };
        fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
    }

    public handlePriceUpdate(update: PriceUpdate) {
        if (update.type !== 'POLY' || !update.side) return;
        if (this.resolved) return; // Ignore updates after resolution

        const side = update.side;
        const currentPrice = update.price;

        // Update local state with latest prices
        if (side === 'YES') this.lastPrices.yes = currentPrice;
        if (side === 'NO') this.lastPrices.no = currentPrice;
        this.lastPriceUpdate = Date.now();

        this.updateCount++;
        if (this.updateCount % 100 === 0) {
            console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] CLOB Update: ${side} at $${currentPrice.toFixed(4)}`);
        }
    }

    /**
     * Called by the log watcher in splitDrop.ts
     * prob is 0-100
     */
    public handleProbabilityUpdate(prob: number) {
        if (this.resolved || this.isSelling) return;

        const probDecimal = prob / 100;

        // Strategy: Sell when probability is <= 5% (YES) or >= 95% (NO)
        if (probDecimal <= 0.05 && this.positions.yes > 0) {
            const clobBid = this.lastPrices.yes;
            const currentPrice = clobBid ?? 0.05; // Fallback only if no CLOB data received
            console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] PROB TRIGGER: YES Prob hit ${prob}% (<= 5%). CLOB Bid: ${clobBid !== null ? '$' + clobBid.toFixed(4) : 'NULL (using fallback)'}. Selling at $${currentPrice.toFixed(4)}`);
            this.sell('YES', currentPrice, 'ProbTrigger');
        } else if (probDecimal >= 0.95 && this.positions.no > 0) {
            const clobBid = this.lastPrices.no;
            const currentPrice = clobBid ?? 0.05; // Fallback only if no CLOB data received
            console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] PROB TRIGGER: YES Prob hit ${prob}% (>= 95%, so NO <= 5%). CLOB Bid: ${clobBid !== null ? '$' + clobBid.toFixed(4) : 'NULL (using fallback)'}. Selling NO at $${currentPrice.toFixed(4)}`);
            this.sell('NO', currentPrice, 'ProbTrigger');
        }
    }


    private sell(side: Side, price: number, triggerType: string = 'Direct') {
        const shares = side === 'YES' ? this.positions.yes : this.positions.no;
        if (shares <= 0 || this.isSelling) return;

        this.isSelling = true; // Set lock
        try {
            const saleValue = shares * price;
            this.balance += saleValue;

            console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] SELLING ${shares} ${side} at $${price.toFixed(4)} (${triggerType})`);

            if (side === 'YES') this.positions.yes = 0;
            else this.positions.no = 0;

            // ... log trade ...
            const remainingShares = side === 'YES' ? this.positions.no : this.positions.yes;
            const estimatedFinalPnL = this.balance + (remainingShares * 1.0) - this.initialInvestment;

            this.logTrade({
                timestamp: new Date().toISOString(),
                side,
                action: `SELL (${triggerType})`,
                price,
                shares,
                saleValue,
                totalBalance: this.balance,
                estimatedFinalPnL
            });

            this.saveState();
            const remainingSide = side === 'YES' ? 'NO' : 'YES';
            console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] Remaining: ${remainingSide} (${remainingShares} shares) | Balance: $${this.balance.toFixed(4)} | Est. Final PnL: $${estimatedFinalPnL.toFixed(4)}`);
        } finally {
            this.isSelling = false; // Release lock
        }
    }

    private settle(side: Side, price: number) {
        if (this.isSelling) return; // Wait if selling in progress (extremely unlikely)

        const shares = side === 'YES' ? this.positions.yes : this.positions.no;
        if (shares <= 0) return;

        const saleValue = shares * price;
        this.balance += saleValue;

        console.log(`[${formatTimestamp()}] [SplitDrop-${this.marketRange}] SETTLING ${shares} ${side} at $${price.toFixed(4)}`);

        if (side === 'YES') this.positions.yes = 0;
        else this.positions.no = 0;

        const finalPnL = this.balance - this.initialInvestment;

        this.logTrade({
            timestamp: new Date().toISOString(),
            side,
            action: 'SETTLE',
            price,
            shares,
            saleValue,
            totalBalance: this.balance,
            estimatedFinalPnL: finalPnL
        });
    }

    private logTrade(record: any) {
        const line = `${record.timestamp},${record.side},${record.action},${record.price.toFixed(4)},${record.shares},${record.saleValue.toFixed(4)},${record.totalBalance.toFixed(4)},${record.estimatedFinalPnL.toFixed(4)}\n`;
        fs.appendFileSync(this.logFilePath, line);
    }

    public cleanup() {
        if (this.preResolutionTimer) {
            clearTimeout(this.preResolutionTimer);
            this.preResolutionTimer = null;
        }
    }
}

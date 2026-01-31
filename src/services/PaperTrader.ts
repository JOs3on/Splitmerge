import * as fs from 'fs';
import * as path from 'path';
import { TradeSignal } from '../types';

export class PaperTrader {
    private logFilePath: string;

    constructor() {
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }
        this.logFilePath = path.join(logDir, 'strategy_a_trades.csv');
        this.initializeCsv();
    }

    private initializeCsv() {
        if (!fs.existsSync(this.logFilePath)) {
            const headers = 'Timestamp,MarketSlug,Side,BinancePrice,OpenPrice,PolyBestAsk,TriggerDelta,LatencyMs\n';
            fs.writeFileSync(this.logFilePath, headers);
            console.log(`[PaperTrader] Created log file: ${this.logFilePath}`);
        }
    }

    public logTrade(signal: TradeSignal) {
        const timestamp = new Date().toISOString();
        const line = `${timestamp},${signal.marketSlug},${signal.side},${signal.binancePrice.toFixed(2)},${signal.openPrice.toFixed(2)},${signal.polyBestAsk.toFixed(4)},${signal.triggerDelta.toFixed(2)},${signal.latencyMs}\n`;

        fs.appendFileSync(this.logFilePath, line);
        console.log(`[PAPER TRADE] [${signal.side}] Triggered for ${signal.marketSlug} at Binance: $${signal.binancePrice.toFixed(2)} | Poly Ask: $${signal.polyBestAsk.toFixed(4)}`);
    }
}

export const paperTrader = new PaperTrader();

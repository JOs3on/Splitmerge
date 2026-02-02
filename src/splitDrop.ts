import { clobManager } from './sockets/clobManager';
import { SplitDropTrader } from './services/SplitDropTrader';
import { marketCycle } from './services/marketCycle';
import { formatTimestamp } from './utils/time';
import { MARKET_DURATION_MS } from './config/constants';
import * as fs from 'fs';
import * as path from 'path';

const PROB_LOG_PATH = path.join(process.cwd(), 'logs', 'market_probabilities.jsonl');

async function main() {
    const startNow = Date.now();
    console.log(`[${formatTimestamp()}] --- Split & Drop Paper Trading Engine (Probability Triggers) Started ---`);

    const traders: Map<string, SplitDropTrader> = new Map();
    const lastSeen = new Map<string, number>();
    const PRUNE_DELAY_MS = 5 * 60 * 1000; // 5 minutes buffer after market is no longer active/next

    // Probability Log Watcher
    let lastProcessedLineCount = 0;
    if (fs.existsSync(PROB_LOG_PATH)) {
        const content = fs.readFileSync(PROB_LOG_PATH, 'utf-8').trim();
        if (content) {
            lastProcessedLineCount = content.split('\n').length;
        }
    } else {
        // Ensure the directory exists
        const logDir = path.dirname(PROB_LOG_PATH);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        fs.writeFileSync(PROB_LOG_PATH, ''); // Create an empty file if it doesn't exist
    }

    fs.watchFile(PROB_LOG_PATH, { interval: 500 }, (curr, prev) => {
        if (curr.mtime <= prev.mtime) return;

        try {
            const content = fs.readFileSync(PROB_LOG_PATH, 'utf-8').trim();
            const lines = content ? content.split('\n') : [];
            const newLines = lines.slice(lastProcessedLineCount);
            if (newLines.length === 0) return;

            for (const line of newLines) {
                if (!line) continue;
                const update = JSON.parse(line);
                const prob = parseFloat(update.probability);
                const marketTs = update.market_timestamp; // This is the expiration timestamp in seconds

                if (!isNaN(prob)) {
                    // Propagate to all active traders with market timestamp for filtering
                    for (const trader of traders.values()) {
                        trader.handleProbabilityUpdate(prob, marketTs);
                    }
                }
            }
            lastProcessedLineCount = lines.length;
        } catch (e) {
            console.error(`[${formatTimestamp()}] [ProbWatcher] Error reading log: ${e}`);
        }
    });

    clobManager.on('priceUpdate', (update) => {
        if (!update.marketId) return;
        const trader = traders.get(update.marketId);
        if (trader) {
            trader.handlePriceUpdate(update);
        }
    });

    while (true) {
        try {
            await marketCycle.update();

            const activeMarket = marketCycle.getActiveMarket();
            const nextMarket = marketCycle.getNextMarket();

            [activeMarket, nextMarket].forEach(market => {
                if (market) {
                    lastSeen.set(market.marketId, Date.now());
                    if (!traders.has(market.marketId)) {
                        console.log(`[${formatTimestamp()}] [Main] Initializing SplitDropTrader for market: ${market.marketId}`);
                        const trader = new SplitDropTrader(market.marketId, 0.05, 10.0);

                        const expirationSec = parseInt(market.slug?.split('-').pop() || '0');
                        if (expirationSec) {
                            // expirationSec IS the expiration timestamp (NOT start), do NOT add 15 minutes
                            trader.setExpiration(expirationSec * 1000);
                        }

                        traders.set(market.marketId, trader);
                        clobManager.warmupMarket(market.marketId, market.tokenIds);
                    }
                }
            });

            // Pruning with delay
            const now = Date.now();
            for (const [marketId, trader] of traders.entries()) {
                const isCurrent = (activeMarket?.marketId === marketId || nextMarket?.marketId === marketId);

                if (isCurrent) {
                    lastSeen.set(marketId, now);
                } else {
                    const lastMsg = lastSeen.get(marketId) || 0;
                    if (now - lastMsg > PRUNE_DELAY_MS) {
                        console.log(`[${formatTimestamp()}] [Main] Pruning old trader for market: ${marketId}`);
                        traders.delete(marketId);
                        lastSeen.delete(marketId);
                        clobManager.pruneMarket(marketId);
                    }
                }
            }

            if (traders.size > 0) {
                console.log(`[${formatTimestamp()}] [Main] Active Tracking (${traders.size}): ${Array.from(traders.keys()).join(', ')}`);
            }

        } catch (error) {
            console.error('[Main] Discovery loop error:', error);
        }

        await new Promise(resolve => setTimeout(resolve, 30000));
    }
}

main().catch(error => {
    console.error('[Main] Fatal Error:', error);
});

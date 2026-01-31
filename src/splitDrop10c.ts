import { clobManager } from './sockets/clobManager';
import { SplitDropTrader } from './services/SplitDropTrader';
import { marketCycle } from './services/marketCycle';

async function main() {
    const startNow = Date.now();
    console.log(`--- Split & Drop Paper Trading Engine (10c Dynamic) Started at ${new Date(startNow).toISOString()} ---`);

    const traders: Map<string, SplitDropTrader> = new Map();
    const lastSeen = new Map<string, number>();

    const sellThreshold = 0.10;
    const positionSize = 10.0;
    const PRUNE_DELAY_MS = 5 * 60 * 1000;

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
                        console.log(`[Main-10c] Initializing SplitDropTrader for market: ${market.marketId}`);
                        const trader = new SplitDropTrader(market.marketId, sellThreshold, positionSize);

                        const expirationSec = parseInt(market.slug?.split('-').pop() || '0');
                        if (expirationSec) {
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
                        console.log(`[Main-10c] Pruning old trader for market: ${marketId}`);
                        traders.delete(marketId);
                        lastSeen.delete(marketId);
                        clobManager.pruneMarket(marketId);
                    }
                }
            }

            if (traders.size > 0) {
                console.log(`[Main-10c] Active Tracking (${traders.size}): ${Array.from(traders.keys()).join(', ')}`);
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

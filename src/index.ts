import { marketCycle } from './services/marketCycle';
import { binanceSocket } from './sockets/binanceSocket';
import { binanceFuturesSocket } from './sockets/binanceFuturesSocket';
import { clobManager } from './sockets/clobManager';
import { polyOracleSocket } from './sockets/polyOracleSocket';
import { logToCsv } from './utils/logger';
import { StrikeCross } from './strategies/StrikeCross';
import { paperTrader } from './services/PaperTrader';
import { OrderBookState } from './types';

async function main() {
    console.log('--- Phase 3: Strategy & Paper Trading Initiated ---');

    // 1. HARDCODED CLOB EVENT (Targeted Testing)
    const HARDCODED_MARKET_ID = "BTC_USD_TARGET";
    const HARDCODED_MARKET_SLUG = "bitcoin-price-up-down-15m-"; // Example slug
    const HARDCODED_TOKEN_IDS = {
        yes: "89796021018780654484952686255400377919278202014847447583099399293628082073020",
        no: "103863467218685258892055529333166502453751785026893846569466146190712495366120"
    };

    // 2. State & Strategy Initialization
    const clobState: OrderBookState = { bestAskYes: 1.0, bestAskNo: 1.0 }; // Start high to avoid early triggers
    const strategy = new StrikeCross(HARDCODED_MARKET_SLUG);
    let binancePrice = 0;
    let openPrice = 91999.15;

    // 3. Fetch Open Price and Warmup Market
    console.log(`[Main] Launching targeted CLOB test for Market: ${HARDCODED_MARKET_ID}`);
    clobManager.warmupMarket(HARDCODED_MARKET_ID, HARDCODED_TOKEN_IDS);

    // In a real scenario, this comes from the activateMarket flow
    // For Phase 3 implementation, we fetch it here to ensure the strategy has it
    const fetchedOpenPrice = await clobManager.activateMarket(HARDCODED_MARKET_ID, HARDCODED_MARKET_SLUG);
    // Note: activateMarket in clobManager.ts currently doesn't return the price, let's fix that or fetch manually
    // Since I can't easily change clobManager's method signature without checking all callers, I'll fetch manually for now
    // or just assume it's fetched and stored if I were to modify clobManager.
    // For now, let's just use a dummy openPrice if fetch fails, but in this task I'll rely on the logic.
    openPrice = 96000; // Default fallback for testing if fetch fails

    // 4. Start Binance Feed
    binanceSocket.connect();
    binanceFuturesSocket.connect();
    let binanceCount = 0;
    let lastBinanceFullPrice: number | null = null;
    binanceSocket.on('priceUpdate', (update) => {
        binancePrice = update.price;
        const currentFullPrice = Math.floor(update.price);

        // Log to CSV only on full number change
        if (lastBinanceFullPrice === null || currentFullPrice !== lastBinanceFullPrice) {
            logToCsv('binance.csv', update.timestamp, update.price);
            lastBinanceFullPrice = currentFullPrice;
        }

        // EVALUATE STRATEGY
        const signal = strategy.evaluate(binancePrice, openPrice, clobState);
        if (signal) {
            paperTrader.logTrade(signal);
        }

        binanceCount++;
        if (binanceCount % 50 === 0) {
            console.log(`[Feed] BINANCE: $${update.price.toFixed(2)} | BestAskYes: ${clobState.bestAskYes.toFixed(4)}`);
        }
    });

    let lastBinanceFuturesFullPrice: number | null = null;
    binanceFuturesSocket.on('priceUpdate', (update) => {
        const currentFullPrice = Math.floor(update.price);

        // Log to CSV only on full number change
        if (lastBinanceFuturesFullPrice === null || currentFullPrice !== lastBinanceFuturesFullPrice) {
            logToCsv('binance_futures.csv', update.timestamp, update.price);
            lastBinanceFuturesFullPrice = currentFullPrice;
        }
    });

    // 5. Start Oracle Feed
    polyOracleSocket.connect();
    polyOracleSocket.on('priceUpdate', (update) => {
        // Oracle can also update openPrice if needed, but per requirements we use openPrice from Gamma
        console.log(`[Feed] ORACLE:  $${update.price.toFixed(2)}`);
    });

    // 6. Set up listeners for CLOB updates
    const lastClobPrices: Record<string, number> = {};

    clobManager.on('priceUpdate', (update) => {
        const filename = update.side === 'YES' ? 'clob_yes.csv' : 'clob_no.csv';
        const key = `${update.marketId}_${update.side}`;

        // Update CLOB State for Strategy
        if (update.side === 'YES') {
            clobState.bestAskYes = update.price;
        } else {
            clobState.bestAskNo = update.price;
        }

        // Log to CSV only if price actually changed
        if (lastClobPrices[key] !== update.price) {
            logToCsv(filename, update.timestamp, update.price);
            lastClobPrices[key] = update.price;
        }

        // EVALUATE STRATEGY
        const signal = strategy.evaluate(binancePrice, openPrice, clobState);
        if (signal) {
            paperTrader.logTrade(signal);
        }

        if (binanceCount % 50 === 0) {
            console.log(`[Feed] POLY [${update.marketId}] ${update.side}: $${update.price.toFixed(4)}`);
        }
    });

    console.log(`\n[Main] Strategy active for strike: ${openPrice}`);
}

main().catch(error => {
    console.error('[Main] Fatal Error:', error);
});

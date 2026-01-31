import { SplitDropTrader } from '../services/SplitDropTrader';
import { PriceUpdate } from '../types';
import * as fs from 'fs';
import * as path from 'path';

async function runTest() {
    console.log('--- Starting Split & Drop (10c @ $10) Logic Verification Test ---');

    const testMarketId = 'TEST_MARKET_10C';
    const logDir = path.join(process.cwd(), 'logs');

    // Config: 10c threshold, $10 position
    const sellThreshold = 0.10;
    const positionSize = 10.0;
    const suffix = `${(sellThreshold * 100).toFixed(0)}c_${positionSize.toFixed(0)}usd`;

    const stateFile = path.join(logDir, `split_drop_state_${testMarketId}_${suffix}.json`);
    const tradesFile = path.join(logDir, `split_drop_results_${testMarketId}_${suffix}.csv`);

    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    if (fs.existsSync(tradesFile)) fs.unlinkSync(tradesFile);

    const trader = new SplitDropTrader(testMarketId, sellThreshold, positionSize);

    const sendUpdate = (side: 'YES' | 'NO', price: number) => {
        const update: PriceUpdate = {
            type: 'POLY',
            price: price,
            timestamp: Date.now(),
            side: side,
            marketId: testMarketId
        };
        trader.handlePriceUpdate(update);
    };

    // 1. Initial prices
    sendUpdate('YES', 0.50);
    sendUpdate('NO', 0.50);

    // 2. Drop NO to 10c
    console.log('[Test] Dropping NO to 10c...');
    sendUpdate('NO', 0.10);

    // 3. Verify
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    if (data.positions.no === 0 && data.balance === 1.0) { // 10 shares * 0.10 = 1.0
        console.log('[SUCCESS] 10 NO shares sold for $1.00 total.');
    } else {
        console.error('[FAILURE] State/Balance incorrect:', data);
    }

    // 4. Verify CSV exists and has expected content
    if (fs.existsSync(tradesFile)) {
        console.log('[SUCCESS] Results CSV created.');
    } else {
        console.error('[FAILURE] Results CSV not found.');
    }

    console.log('--- Verification Test Completed ---');
}

runTest().catch(console.error);

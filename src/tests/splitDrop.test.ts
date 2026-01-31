import { SplitDropTrader } from '../services/SplitDropTrader';
import { PriceUpdate } from '../types';
import * as fs from 'fs';
import * as path from 'path';

async function runTest() {
    console.log('--- Starting Split & Drop Logic Verification Test ---');

    const testMarketId = 'TEST_MARKET_SPLITDROP';
    const logDir = path.join(process.cwd(), 'logs');
    const suffix = '5c_10usd';
    const stateFile = path.join(logDir, `split_drop_state_${testMarketId}_${suffix}.json`);
    const tradesFile = path.join(logDir, `split_drop_results_${testMarketId}_${suffix}.csv`);

    // Clean up previous test runs
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    if (fs.existsSync(tradesFile)) fs.unlinkSync(tradesFile);

    // Test 1: Direct Trigger - Sell when price hits $0.05
    console.log('\n=== TEST 1: Direct Trigger at $0.05 ===');
    const trader1 = new SplitDropTrader(testMarketId, 0.05, 10.0);

    const sendUpdate = (trader: SplitDropTrader, side: 'YES' | 'NO', price: number) => {
        const update: PriceUpdate = {
            type: 'POLY',
            price: price,
            timestamp: Date.now(),
            side: side,
            marketId: testMarketId
        };
        trader.handlePriceUpdate(update);
    };

    // Initial prices
    sendUpdate(trader1, 'YES', 0.50);
    sendUpdate(trader1, 'NO', 0.50);

    // Drop NO to $0.05 - should trigger sell
    sendUpdate(trader1, 'NO', 0.05);

    const state1 = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    if (state1.positions.no === 0 && state1.positions.yes === 10.0) {
        console.log('[PASS] NO side was sold at $0.05');
    } else {
        console.error('[FAIL] NO side state incorrect:', state1);
    }

    trader1.cleanup();

    // Test 2: Pre-Resolution Settlement
    console.log('\n=== TEST 2: Pre-Resolution Settlement ===');
    const testMarketId2 = 'TEST_MARKET_RESOLUTION';
    const stateFile2 = path.join(logDir, `split_drop_state_${testMarketId2}_${suffix}.json`);
    const tradesFile2 = path.join(logDir, `split_drop_results_${testMarketId2}_${suffix}.csv`);

    if (fs.existsSync(stateFile2)) fs.unlinkSync(stateFile2);
    if (fs.existsSync(tradesFile2)) fs.unlinkSync(tradesFile2);

    const trader2 = new SplitDropTrader(testMarketId2, 0.05, 10.0);

    // Set expiration 2 seconds from now
    const expiration = Date.now() + 2000;
    trader2.setExpiration(expiration);

    // Send price updates showing YES is winning
    const sendUpdate2 = (side: 'YES' | 'NO', price: number) => {
        const update: PriceUpdate = {
            type: 'POLY',
            price: price,
            timestamp: Date.now(),
            side: side,
            marketId: testMarketId2
        };
        trader2.handlePriceUpdate(update);
    };

    sendUpdate2('YES', 0.85);
    sendUpdate2('NO', 0.15);

    // Wait for pre-resolution (1 second before expiration, so ~1 second from now)
    console.log('Waiting for pre-resolution timer...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    const state2 = JSON.parse(fs.readFileSync(stateFile2, 'utf-8'));
    if (state2.resolved === true && state2.positions.yes === 0 && state2.positions.no === 0) {
        console.log('[PASS] Pre-resolution settled both positions');
        console.log(`       Balance: $${state2.balance.toFixed(2)} (expected: $10 from YES winner)`);
    } else {
        console.error('[FAIL] Pre-resolution state incorrect:', state2);
    }

    // Check CSV for correct settlement
    const csvContent = fs.readFileSync(tradesFile2, 'utf-8');
    console.log('\nCSV Content:');
    console.log(csvContent);

    trader2.cleanup();

    // Test 3: Negative PnL scenario (sold at $0.05 but that side won)
    console.log('\n=== TEST 3: Negative PnL Scenario ===');
    const testMarketId3 = 'TEST_MARKET_NEGATIVE_PNL';
    const stateFile3 = path.join(logDir, `split_drop_state_${testMarketId3}_${suffix}.json`);
    const tradesFile3 = path.join(logDir, `split_drop_results_${testMarketId3}_${suffix}.csv`);

    if (fs.existsSync(stateFile3)) fs.unlinkSync(stateFile3);
    if (fs.existsSync(tradesFile3)) fs.unlinkSync(tradesFile3);

    const trader3 = new SplitDropTrader(testMarketId3, 0.05, 10.0);

    const sendUpdate3 = (side: 'YES' | 'NO', price: number) => {
        const update: PriceUpdate = {
            type: 'POLY',
            price: price,
            timestamp: Date.now(),
            side: side,
            marketId: testMarketId3
        };
        trader3.handlePriceUpdate(update);
    };

    // YES drops to $0.05, we sell it
    sendUpdate3('YES', 0.05);

    // Then YES reverses and ends up winning at resolution
    sendUpdate3('YES', 0.90);
    sendUpdate3('NO', 0.10);

    // Set expiration and wait for settlement
    trader3.setExpiration(Date.now() + 2000);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const state3 = JSON.parse(fs.readFileSync(stateFile3, 'utf-8'));
    // We sold YES at $0.05 (got $0.50), but YES won so NO is worth $0
    // Final balance: $0.50 (from YES sale) + $0 (NO worthless) = $0.50
    // PnL: $0.50 - $10 = -$9.50 (negative!)
    console.log(`Final balance: $${state3.balance.toFixed(2)}`);
    if (state3.balance < 10) {
        console.log('[PASS] Negative PnL scenario: sold winning side early');
    } else {
        console.error('[FAIL] Expected negative PnL but got:', state3);
    }

    const csvContent3 = fs.readFileSync(tradesFile3, 'utf-8');
    console.log('\nCSV Content:');
    console.log(csvContent3);

    trader3.cleanup();

    console.log('\n--- All Tests Completed ---');
}

runTest().catch(console.error);

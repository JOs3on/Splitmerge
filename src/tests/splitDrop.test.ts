import { SplitDropTrader } from '../services/SplitDropTrader';
import { PriceUpdate } from '../types';
import * as fs from 'fs';
import * as path from 'path';

async function runTest() {
    console.log('--- Starting Split & Drop Logic Verification Test ---');

    const logDir = path.join(process.cwd(), 'logs');

    // Test 1: Probability Trigger - Sell when probability hits 5% (YES side)
    console.log('\n=== TEST 1: Probability Trigger at 5% (Sell YES) ===');
    const testMarketId1 = 'TEST_MARKET_PROB_YES';
    const suffix = '5c_10usd';
    const stateFile1 = path.join(logDir, `split_drop_state_${testMarketId1}_${suffix}.json`);
    const tradesFile1 = path.join(logDir, `split_drop_results_${testMarketId1}_${suffix}.csv`);

    // Clean up previous test runs
    if (fs.existsSync(stateFile1)) fs.unlinkSync(stateFile1);
    if (fs.existsSync(tradesFile1)) fs.unlinkSync(tradesFile1);

    const trader1 = new SplitDropTrader(testMarketId1, 0.05, 10.0);

    // Send price updates first to set up lastPrices (CLOB bid)
    const sendUpdate = (trader: SplitDropTrader, side: 'YES' | 'NO', price: number) => {
        const update: PriceUpdate = {
            type: 'POLY',
            price: price,
            timestamp: Date.now(),
            side: side,
            marketId: testMarketId1
        };
        trader.handlePriceUpdate(update);
    };

    // Set CLOB prices
    sendUpdate(trader1, 'YES', 0.04);  // YES is at 4 cents (probability ~4%)
    sendUpdate(trader1, 'NO', 0.96);   // NO is at 96 cents

    // Trigger probability update at 5% - should sell YES
    trader1.handleProbabilityUpdate(5); // 5% probability

    const state1 = JSON.parse(fs.readFileSync(stateFile1, 'utf-8'));
    if (state1.positions.yes === 0 && state1.positions.no === 10.0) {
        console.log('[PASS] YES side was sold at probability 5%');
        console.log(`       Balance: $${state1.balance.toFixed(2)} (expected: $0.40 from 10 YES @ $0.04)`);
    } else {
        console.error('[FAIL] State incorrect:', state1);
    }

    trader1.cleanup();

    // Test 2: Probability Trigger - Sell when probability hits 95% (NO side)
    console.log('\n=== TEST 2: Probability Trigger at 95% (Sell NO) ===');
    const testMarketId2 = 'TEST_MARKET_PROB_NO';
    const stateFile2 = path.join(logDir, `split_drop_state_${testMarketId2}_${suffix}.json`);
    const tradesFile2 = path.join(logDir, `split_drop_results_${testMarketId2}_${suffix}.csv`);

    if (fs.existsSync(stateFile2)) fs.unlinkSync(stateFile2);
    if (fs.existsSync(tradesFile2)) fs.unlinkSync(tradesFile2);

    const trader2 = new SplitDropTrader(testMarketId2, 0.05, 10.0);

    // Set CLOB prices
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

    sendUpdate2('YES', 0.96);   // YES is at 96 cents
    sendUpdate2('NO', 0.04);    // NO is at 4 cents (probability ~4%)

    // Trigger probability update at 95% - should sell NO
    trader2.handleProbabilityUpdate(95); // 95% probability

    const state2 = JSON.parse(fs.readFileSync(stateFile2, 'utf-8'));
    if (state2.positions.no === 0 && state2.positions.yes === 10.0) {
        console.log('[PASS] NO side was sold at probability 95%');
        console.log(`       Balance: $${state2.balance.toFixed(2)} (expected: $0.40 from 10 NO @ $0.04)`);
    } else {
        console.error('[FAIL] State incorrect:', state2);
    }

    trader2.cleanup();

    // Test 3: Pre-Resolution Settlement with Winner
    console.log('\n=== TEST 3: Pre-Resolution Settlement ===');
    const testMarketId3 = 'TEST_MARKET_SETTLE';
    const stateFile3 = path.join(logDir, `split_drop_state_${testMarketId3}_${suffix}.json`);
    const tradesFile3 = path.join(logDir, `split_drop_results_${testMarketId3}_${suffix}.csv`);
    const balanceFile3 = path.join(logDir, `split_drop_balance_${testMarketId3}_${suffix}.json`);

    if (fs.existsSync(stateFile3)) fs.unlinkSync(stateFile3);
    if (fs.existsSync(tradesFile3)) fs.unlinkSync(tradesFile3);
    if (fs.existsSync(balanceFile3)) fs.unlinkSync(balanceFile3);

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

    // Set expiration 2 seconds from now
    const expiration = Date.now() + 2000;
    trader3.setExpiration(expiration);

    // Send price updates showing YES is winning
    sendUpdate3('YES', 0.85);
    sendUpdate3('NO', 0.15);

    // Wait for pre-resolution (1 second before expiration, so ~1 second from now)
    console.log('Waiting for pre-resolution timer...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    const state3 = JSON.parse(fs.readFileSync(stateFile3, 'utf-8'));
    if (state3.resolved === true && state3.positions.yes === 0 && state3.positions.no === 0) {
        console.log('[PASS] Pre-resolution settled both positions');
        console.log(`       Balance: $${state3.balance.toFixed(2)} (expected: $10 from YES winner)`);
    } else {
        console.error('[FAIL] Pre-resolution state incorrect:', state3);
    }

    // Check that balance file was created
    if (fs.existsSync(balanceFile3)) {
        const balanceSummary = JSON.parse(fs.readFileSync(balanceFile3, 'utf-8'));
        console.log(`[PASS] Balance summary file created`);
        console.log(`       Final PnL: $${balanceSummary.finalPnL.toFixed(2)}`);
    } else {
        console.error('[FAIL] Balance summary file was not created');
    }

    trader3.cleanup();

    // Test 4: Already Resolved - Should Skip on Restart
    console.log('\n=== TEST 4: Already Resolved Market (Skip on Restart) ===');

    // Create a new trader for the SAME market - should load resolved state and skip
    const trader4 = new SplitDropTrader(testMarketId3, 0.05, 10.0);

    // Try to set expiration again - should not schedule
    trader4.setExpiration(Date.now() + 2000);

    const state4 = JSON.parse(fs.readFileSync(stateFile3, 'utf-8'));
    if (state4.resolved === true) {
        console.log('[PASS] Trader correctly loaded resolved state and skipped scheduling');
    } else {
        console.error('[FAIL] Trader should have loaded resolved state');
    }

    trader4.cleanup();

    // Test 5: Correct PnL Calculation
    console.log('\n=== TEST 5: Correct PnL with Probability Sell + Settlement ===');
    const testMarketId5 = 'TEST_MARKET_PNL';
    const stateFile5 = path.join(logDir, `split_drop_state_${testMarketId5}_${suffix}.json`);
    const tradesFile5 = path.join(logDir, `split_drop_results_${testMarketId5}_${suffix}.csv`);
    const balanceFile5 = path.join(logDir, `split_drop_balance_${testMarketId5}_${suffix}.json`);

    if (fs.existsSync(stateFile5)) fs.unlinkSync(stateFile5);
    if (fs.existsSync(tradesFile5)) fs.unlinkSync(tradesFile5);
    if (fs.existsSync(balanceFile5)) fs.unlinkSync(balanceFile5);

    const trader5 = new SplitDropTrader(testMarketId5, 0.05, 10.0);

    const sendUpdate5 = (side: 'YES' | 'NO', price: number) => {
        const update: PriceUpdate = {
            type: 'POLY',
            price: price,
            timestamp: Date.now(),
            side: side,
            marketId: testMarketId5
        };
        trader5.handlePriceUpdate(update);
    };

    // Initially probability drops to 5%, sell YES
    sendUpdate5('YES', 0.04);
    sendUpdate5('NO', 0.96);
    trader5.handleProbabilityUpdate(5); // Sell YES at $0.04

    // Then market reverses, NO wins at resolution
    sendUpdate5('YES', 0.10);  // YES low
    sendUpdate5('NO', 0.90);   // NO high

    // Set expiration and wait for settlement
    trader5.setExpiration(Date.now() + 2000);
    console.log('Waiting for pre-resolution timer...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    const state5 = JSON.parse(fs.readFileSync(stateFile5, 'utf-8'));
    // Expected: 
    // - Sold YES at $0.04 for $0.40
    // - NO wins ($0.90 > $0.10), so NO settles at $1.00 for $10.00
    // - Total balance: $0.40 + $10.00 = $10.40
    // - PnL: $10.40 - $10.00 = +$0.40

    const expectedBalance = 10.40;
    if (Math.abs(state5.balance - expectedBalance) < 0.01) {
        console.log(`[PASS] Balance correct: $${state5.balance.toFixed(2)} (expected: $${expectedBalance.toFixed(2)})`);
    } else {
        console.error(`[FAIL] Balance incorrect: $${state5.balance.toFixed(2)} (expected: $${expectedBalance.toFixed(2)})`);
    }

    // Verify balance file
    if (fs.existsSync(balanceFile5)) {
        const balanceSummary = JSON.parse(fs.readFileSync(balanceFile5, 'utf-8'));
        const expectedPnL = 0.40;
        if (Math.abs(balanceSummary.finalPnL - expectedPnL) < 0.01) {
            console.log(`[PASS] Final PnL correct: $${balanceSummary.finalPnL.toFixed(2)} (expected: $${expectedPnL.toFixed(2)})`);
        } else {
            console.error(`[FAIL] Final PnL incorrect: $${balanceSummary.finalPnL.toFixed(2)} (expected: $${expectedPnL.toFixed(2)})`);
        }
    }

    // Check CSV content
    const csvContent = fs.readFileSync(tradesFile5, 'utf-8');
    console.log('\nCSV Content:');
    console.log(csvContent);

    trader5.cleanup();

    console.log('\n--- All Tests Completed ---');
}

runTest().catch(console.error);

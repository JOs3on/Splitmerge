import { SplitDropTrader } from '../services/SplitDropTrader';
import { PriceUpdate } from '../types';
import * as fs from 'fs';
import * as path from 'path';

async function testInverseTrigger() {
    console.log('--- Starting Inverse Trigger Verification Test ---');

    const marketId = 'INVERSE_TEST';
    const sellThreshold = 0.05;
    const positionSize = 1;
    const trader = new SplitDropTrader(marketId, sellThreshold, positionSize);

    // Initial state: YES and NO at 0.50
    const updates: PriceUpdate[] = [
        { type: 'POLY', side: 'YES', price: 0.50, timestamp: Date.now(), marketId },
        { type: 'POLY', side: 'NO', price: 0.50, timestamp: Date.now(), marketId }
    ];

    updates.forEach(u => trader.handlePriceUpdate(u));

    // Winner YES jumps to 0.96. Loser NO should be triggered at 0.04.
    console.log('[Test] YES price becomes $0.96 (Winning)...');
    trader.handlePriceUpdate({
        type: 'POLY',
        side: 'YES',
        price: 0.96,
        timestamp: Date.now(),
        marketId
    });

    // Check if NO was sold
    const logPath = path.join(process.cwd(), 'logs', `split_drop_results_${marketId}_5c_1usd.csv`);
    if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf-8');
        if (content.includes('SELL (Inverse)') && content.includes('NO') && content.includes('0.0400')) {
            console.log('[SUCCESS] NO side was sold via INVERSE trigger at $0.04');
        } else {
            console.error('[FAILURE] NO side was NOT sold via INVERSE trigger at expected price.');
            console.log('Log Content:', content);
        }
    } else {
        console.error('[FAILURE] Log file not found.');
    }

    // Cleanup
    const statePath = path.join(process.cwd(), 'logs', `split_drop_state_${marketId}_5c_1usd.json`);
    if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    console.log('--- Inverse Trigger Test Completed ---');
}

testInverseTrigger().catch(console.error);

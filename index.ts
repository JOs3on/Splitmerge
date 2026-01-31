import { BinanceListener } from './binance';
import { PolymarketListener } from './polymarket';

console.log('--- Latency Monitor (Matches Integer Parts) ---');
new BinanceListener().start();
new PolymarketListener().start();
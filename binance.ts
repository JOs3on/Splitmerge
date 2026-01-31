import WebSocket from 'ws';
import { PriceStore } from './state';
import { formatTime, logToCsv } from './utils';

export class BinanceListener {
    // Using aggTrade for speed
    private url: string = 'wss://stream.binance.com:9443/ws/btcusdt@aggTrade';

    // To keep track of the last number we printed
    private lastLoggedInt: number | null = null;

    public start() {
        const ws = new WebSocket(this.url);

        ws.on('open', () => console.log('✅ [Binance] Connected'));

        ws.on('message', (data: WebSocket.Data) => {
            const msg = JSON.parse(data.toString());
            const price = parseFloat(msg.p);
            const tradeTime = msg.T;
            const now = Date.now();

            // 1. ALWAYS store the data (Critical for latency comparison)
            PriceStore.addBinanceTick(price, tradeTime);

            // 2. ONLY log if the integer part (e.g. 85803) has changed
            const currentInt = Math.floor(price);

            if (this.lastLoggedInt !== currentInt) {
                console.log(`[${formatTime(now)}] [BINANCE] $${price.toFixed(2)}`);
                // Log integer only to CSV
                logToCsv('binance.csv', now, currentInt);
                this.lastLoggedInt = currentInt;
            }
        });

        ws.on('error', (err) => console.error('[Binance] Error:', err));
    }
}
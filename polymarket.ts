// polymarket.ts
import WebSocket from 'ws';
import { PriceStore } from './state';
import { formatTime, logToCsv } from './utils';

export class PolymarketListener {
    private url: string = 'wss://ws-live-data.polymarket.com/';
    private eventSlug: string = "btc-updown-15m-1765892700";

    public start() {
        const ws = new WebSocket(this.url);

        ws.on('open', () => {
            console.log('✅ [Polymarket] Connected');
            this.subscribe(ws);
        });

        ws.on('message', (data: WebSocket.Data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.topic === "crypto_prices_chainlink" && msg.type === "update") {
                    this.processUpdate(msg);
                }
            } catch (e) { }
        });
    }

    private subscribe(ws: WebSocket) {
        const payload = {
            action: "subscribe",
            subscriptions: [{
                topic: "crypto_prices_chainlink",
                type: "update",
                filters: JSON.stringify({ symbol: "btc/usd" })
            }]
        };
        ws.send(JSON.stringify(payload));
    }

    private processUpdate(msg: any) {
        if (msg.payload && msg.payload.value) {
            const polyPrice = parseFloat(msg.payload.value);
            const polyPriceInt = Math.floor(polyPrice);
            const now = Date.now();

            // Log to CSV
            logToCsv('polymarket.csv', now, polyPrice);

            const match = PriceStore.findLastBinanceMatch(polyPriceInt);

            if (match) {
                // We found a Binance tick with the same integer price
                const lag = now - match.localTime;

                console.log(
                    `[${formatTime(now)}] [POLY]    $${polyPrice.toFixed(2)} ` +
                    `Matches Binance tick from [${formatTime(match.localTime)}] ` +
                    `($${match.originalPrice.toFixed(2)}) | LAG: ${lag}ms`
                );
            } else {
                console.log(`[${formatTime(now)}] [POLY]    $${polyPrice.toFixed(2)} (No recent Binance match)`);
            }
        }
    }
}
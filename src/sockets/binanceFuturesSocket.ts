import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BINANCE_FUTURES_WS_URL } from '../config/constants';
import { PriceUpdate } from '../types';

export class BinanceFuturesSocket extends EventEmitter {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor() {
        super();
    }

    public connect() {
        console.log(`[Binance Futures] Connecting to ${BINANCE_FUTURES_WS_URL}...`);
        this.ws = new WebSocket(BINANCE_FUTURES_WS_URL);

        this.ws.on('open', () => {
            console.log('[Binance Futures] Connection established.');
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                // Binance Futures aggTrade message format might slightly differ but 'p' and 'T' are standard
                const price = parseFloat(msg.p);
                const timestamp = msg.T;

                const update: PriceUpdate = {
                    type: 'BINANCE_FUTURES' as any, // Ad-hoc type if not in PriceUpdate
                    price: price,
                    timestamp: timestamp
                };

                this.emit('priceUpdate', update);
            } catch (error) {
                console.error('[Binance Futures] Parse Error:', error);
            }
        });

        this.ws.on('error', (err) => {
            console.error('[Binance Futures] WebSocket Error:', err.message);
        });

        this.ws.on('close', () => {
            console.warn('[Binance Futures] Connection closed. Reconnecting in 5s...');
            this.scheduleReconnect();
        });
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    }
}

export const binanceFuturesSocket = new BinanceFuturesSocket();

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BINANCE_WS_URL } from '../config/constants';
import { PriceUpdate } from '../types';

export class BinanceSocket extends EventEmitter {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor() {
        super();
    }

    public connect() {
        console.log(`[Binance] Connecting to ${BINANCE_WS_URL}...`);
        this.ws = new WebSocket(BINANCE_WS_URL);

        this.ws.on('open', () => {
            console.log('[Binance] Connection established.');
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                const price = parseFloat(msg.p);
                const timestamp = msg.T;

                const update: PriceUpdate = {
                    type: 'BINANCE',
                    price: price,
                    timestamp: timestamp
                };

                this.emit('priceUpdate', update);
            } catch (error) {
                console.error('[Binance] Parse Error:', error);
            }
        });

        this.ws.on('error', (err) => {
            console.error('[Binance] WebSocket Error:', err.message);
        });

        this.ws.on('close', () => {
            console.warn('[Binance] Connection closed. Reconnecting in 5s...');
            this.scheduleReconnect();
        });
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    }
}

export const binanceSocket = new BinanceSocket();

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { POLY_ORACLE_WS_URL } from '../config/constants';
import { PriceUpdate } from '../types';

export class PolyOracleSocket extends EventEmitter {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor() {
        super();
    }

    public connect() {
        console.log(`[Oracle] Connecting to ${POLY_ORACLE_WS_URL}...`);
        this.ws = new WebSocket(POLY_ORACLE_WS_URL);

        this.ws.on('open', () => {
            console.log('[Oracle] Connection established. Subscribing to btc/usd...');
            this.subscribe();
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.topic === "crypto_prices_chainlink" && msg.type === "update") {
                    this.processUpdate(msg);
                }
            } catch (error) {
                // Ignore parse errors from non-JSON messages
            }
        });

        this.ws.on('error', (err) => {
            console.error('[Oracle] WebSocket Error:', err.message);
        });

        this.ws.on('close', () => {
            console.warn('[Oracle] Connection closed. Reconnecting in 5s...');
            this.scheduleReconnect();
        });
    }

    private subscribe() {
        const payload = {
            action: "subscribe",
            subscriptions: [{
                topic: "crypto_prices_chainlink",
                type: "update",
                filters: JSON.stringify({ symbol: "btc/usd" })
            }]
        };
        this.ws?.send(JSON.stringify(payload));
    }

    private processUpdate(msg: any) {
        if (msg.payload && msg.payload.value) {
            const price = parseFloat(msg.payload.value);
            const update: PriceUpdate = {
                type: 'ORACLE',
                price: price,
                timestamp: Date.now()
            };
            this.emit('priceUpdate', update);
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
    }
}

export const polyOracleSocket = new PolyOracleSocket();

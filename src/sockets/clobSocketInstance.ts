import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CLOB_WS_URL } from '../config/constants';
import { PriceUpdate, Side, ClobPriceChange, ClobBookUpdate } from '../types';

export class ClobSocketInstance extends EventEmitter {
    private ws: WebSocket | null = null;
    private marketId: string;
    private tokenIds: { yes: string; no: string };
    private books: Map<string, { bid: number; ask: number }> = new Map();
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(marketId: string, tokenIds: { yes: string; no: string }) {
        super();
        this.marketId = marketId;
        this.tokenIds = tokenIds;
    }

    public connect() {
        console.log(`[CLOB-${this.marketId}] Connecting to ${CLOB_WS_URL}...`);
        this.ws = new WebSocket(CLOB_WS_URL);

        this.ws.on('open', () => {
            console.log(`[CLOB-${this.marketId}] WebSocket Opened`);
            this.subscribe();
            this.startPing();
        });

        this.ws.on('message', (data) => {
            const raw = data.toString();
            if (raw === 'PONG') return; // Skip heartbeat

            try {
                const msg = JSON.parse(raw);
                if (Array.isArray(msg)) {
                    msg.forEach(m => this.handleMessage(m));
                } else {
                    this.handleMessage(msg);
                }
            } catch (err) {
                console.error(`[CLOB-${this.marketId}] Parse error:`, err);
            }
        });

        this.ws.on('error', (err) => {
            console.error(`[CLOB-${this.marketId}] Error:`, err.message);
        });

        this.ws.on('close', () => {
            console.warn(`[CLOB-${this.marketId}] WebSocket Closed. Reconnecting in 5s...`);
            this.stopPing();
            setTimeout(() => this.connect(), 5000);
        });
    }

    private subscribe() {
        // Verified plural 'assets_ids' and type 'market' for ws-subscriptions-clob
        const subMsg = {
            type: 'market',
            assets_ids: [this.tokenIds.yes, this.tokenIds.no]
        };
        console.log(`[CLOB-${this.marketId}] Subscribing:`, JSON.stringify(subMsg));
        this.ws?.send(JSON.stringify(subMsg));
    }

    private handleMessage(msg: any) {
        const eventType = msg.event_type || msg.type;

        if (eventType === 'book') {
            const bookUpdate = msg as ClobBookUpdate;
            const assetId = bookUpdate.asset_id;
            const bestBid = bookUpdate.bids.length > 0 ? parseFloat(bookUpdate.bids[0].price) : 0;
            const bestAsk = bookUpdate.asks.length > 0 ? parseFloat(bookUpdate.asks[0].price) : 0;

            this.books.set(assetId, {
                bid: isNaN(bestBid) ? 0 : bestBid,
                ask: isNaN(bestAsk) ? 0 : bestAsk
            });
            const savedBook = this.books.get(assetId);
            if (savedBook) this.emitPrice(assetId, savedBook.bid, savedBook.ask);


        } else if (eventType === 'price_change') {
            const update = msg as ClobPriceChange;
            if (update.price_changes) {
                for (const item of update.price_changes) {
                    const assetId = item.asset_id;
                    const bestBid = parseFloat(item.best_bid);
                    const bestAsk = parseFloat(item.best_ask);

                    this.books.set(assetId, {
                        bid: isNaN(bestBid) ? 0 : bestBid,
                        ask: isNaN(bestAsk) ? 0 : bestAsk
                    });

                    const book = this.books.get(assetId);
                    if (book) {
                        this.emitPrice(assetId, book.bid, book.ask);
                    }
                }
            }
        }
    }

    private calculateMid(assetId: string): number | null {
        const book = this.books.get(assetId);
        if (!book) return null;

        const bid = isNaN(book.bid) ? 0 : book.bid;
        const ask = isNaN(book.ask) ? 0 : book.ask;

        // Thin market handling:
        // If both sides exist, take mid
        if (bid > 0 && ask > 0) return (bid + ask) / 2;
        // If only one side exists (common when a loser drops to 0.05), use that side as the price
        if (bid > 0) return bid;
        if (ask > 0) return ask;

        // If BOTH are 0, but we have a book record, it means the price is essentially 0
        // This is critical for triggering the $0.05 exit at expiration.
        return 0;
    }

    private emitPrice(assetId: string, bid: number, ask: number) {
        let side: Side | undefined;
        if (assetId === this.tokenIds.yes) side = 'YES';
        if (assetId === this.tokenIds.no) side = 'NO';

        if (side) {
            // For selling, we care about BID (what we'd receive)
            // For buying, we care about ASK (what we'd pay)
            // Default to emitting BID since we're selling
            const sellPrice = bid > 0 ? bid : (ask > 0 ? ask * 0.95 : 0); // Fallback with spread

            const update: PriceUpdate = {
                type: 'POLY',
                price: sellPrice,  // This is now the BID (sell) price
                timestamp: Date.now(),
                side: side,
                marketId: this.marketId
            };
            this.emit('priceUpdate', update);
        }
    }

    private startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send('PING');
            }
        }, 20000);
    }

    private stopPing() {
        if (this.pingInterval) clearInterval(this.pingInterval);
    }

    public close() {
        this.stopPing();
        this.ws?.close();
    }
}

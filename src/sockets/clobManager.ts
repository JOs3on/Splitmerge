import { EventEmitter } from 'events';
import { ClobSocketInstance } from './clobSocketInstance';
import { MarketDetails, PriceUpdate } from '../types';
import { gamma } from '../services/gamma';

export class ClobManager extends EventEmitter {
    private instances: Map<string, ClobSocketInstance> = new Map();
    private activeMarketId: string | null = null;

    /**
     * Connects to a new market and begins maintenance.
     */
    public warmupMarket(marketId: string, tokenIds: { yes: string; no: string }) {
        if (this.instances.has(marketId)) return;

        console.log(`[ClobManager] Warming up market: ${marketId}`);
        const instance = new ClobSocketInstance(marketId, tokenIds);

        instance.on('priceUpdate', (update: PriceUpdate) => {
            // Emit globally so index.ts can listen in one place
            this.emit('priceUpdate', update);
        });

        instance.connect();
        this.instances.set(marketId, instance);
    }

    /**
     * Sets a market as active and fetches its official open price.
     */
    public async activateMarket(marketId: string, slug: string) {
        this.activeMarketId = marketId;
        console.log(`[ClobManager] Activating market: ${marketId} (Slug: ${slug})`);

        const openPrice = await gamma.fetchOpenPrice(slug);
        if (openPrice) {
            console.log(`[ClobManager] Market ${marketId} Open Price: ${openPrice}`);
            // Store or broadcast the open price
        } else {
            console.warn(`[ClobManager] Could not fetch Open Price for ${slug}`);
        }
    }

    /**
     * Closes the socket and removes the market from tracking.
     */
    public pruneMarket(marketId: string) {
        const instance = this.instances.get(marketId);
        if (instance) {
            console.log(`[ClobManager] Pruning market: ${marketId}`);
            instance.close();
            this.instances.delete(marketId);
        }
    }

    public getInstance(marketId: string): ClobSocketInstance | undefined {
        return this.instances.get(marketId);
    }
}

export const clobManager = new ClobManager();

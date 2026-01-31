import { MARKET_DURATION_MS, WARMUP_WINDOW_MS } from '../config/constants';
import { getNext15MinExpiration, getMarketSlug, formatTimestamp, getCurrent15MinStart } from '../utils/time';
import { gamma } from './gamma';
import { MarketDetails } from '../types';
import { clobManager } from '../sockets/clobManager';

export class MarketCycle {
    private markets: Map<string, MarketDetails> = new Map();
    private activeSlug: string | null = null;
    private nextSlug: string | null = null;
    private previousMarketId: string | null = null;

    /**
     * Main loop/check to identify active market and handle warmup for next.
     */
    public async update() {
        const now = Date.now();
        const currentStart = getCurrent15MinStart(now);
        const currentExpiration = currentStart + MARKET_DURATION_MS;
        const currentSlug = getMarketSlug(currentStart);

        // Precise logging for rollover timing
        if (this.activeSlug !== currentSlug) {
            console.log(`[${formatTimestamp()}] [MarketCycle] ROLLOVER | New Slug: ${currentSlug}`);
            const details = await this.loadMarket(currentSlug);

            if (details) {
                // Ensure instance exists (especially if we missed warmup)
                clobManager.warmupMarket(details.marketId, details.tokenIds);

                // Activate the new market (fetch open price)
                await clobManager.activateMarket(details.marketId, currentSlug);
            }

            this.activeSlug = currentSlug;
            this.nextSlug = null;
        }

        // 2. Rollover Logic: Warmup if within 2 minutes of expiration
        const timeToExpiration = currentExpiration - now;
        if (timeToExpiration <= WARMUP_WINDOW_MS) {
            const nextExpiration = currentExpiration + MARKET_DURATION_MS;
            const nextSlug = getMarketSlug(nextExpiration);

            if (this.nextSlug !== nextSlug) {
                console.log(`[${formatTimestamp()}] [MarketCycle] Warmup triggered for ${nextSlug}`);
                const nextDetails = await this.loadMarket(nextSlug);
                if (nextDetails) {
                    clobManager.warmupMarket(nextDetails.marketId, nextDetails.tokenIds);
                }
                this.nextSlug = nextSlug;
            }
        }
    }

    private async loadMarket(slug: string): Promise<MarketDetails | null> {
        if (this.markets.has(slug)) return this.markets.get(slug)!;

        const details = await gamma.fetchMarket(slug);
        if (details) {
            this.markets.set(slug, details);
            console.log(`[${formatTimestamp()}] [MarketCycle] Successfully cached market metadata: ${slug}`);
            return details;
        } else {
            console.warn(`[MarketCycle] Failed to fetch metadata for: ${slug}`);
            return null;
        }
    }

    public getActiveMarket(): MarketDetails | undefined {
        return this.activeSlug ? this.markets.get(this.activeSlug) : undefined;
    }

    public getNextMarket(): MarketDetails | undefined {
        return this.nextSlug ? this.markets.get(this.nextSlug) : undefined;
    }
}

export const marketCycle = new MarketCycle();

import axios from 'axios';
import { GAMMA_API_URL } from '../config/constants';
import { GammaEvent, MarketDetails } from '../types';

export class GammaService {
    /**
     * Fetches market details from Gamma API based on the event slug.
     * Maps clobTokenIds to Yes/No outcomes.
     */
    public async fetchMarket(slug: string): Promise<MarketDetails | null> {
        try {
            const url = `${GAMMA_API_URL}/events?slug=${slug}`;
            const response = await axios.get<GammaEvent[]>(url);

            if (!response.data || response.data.length === 0) {
                console.warn(`[Gamma] No event found for slug: ${slug}`);
                return null;
            }

            const event = response.data[0];
            if (!event.markets || event.markets.length === 0) {
                console.warn(`[Gamma] No markets found in event: ${slug}`);
                return null;
            }

            // We expect one primary market for the BTC 15m Up/Down
            const market = event.markets[0];

            // Crucial Parsing: Outcomes and clobTokenIds are JSON strings
            const outcomes: string[] = JSON.parse(market.outcomes);
            const clobTokenIds: string[] = JSON.parse(market.clobTokenIds);

            if (outcomes.length < 2 || clobTokenIds.length < 2) {
                console.error(`[Gamma] Unexpected data format for ${slug}:`, { outcomes, clobTokenIds });
                return null;
            }

            // Map based on order (Usually [Up/Yes, Down/No])
            // Standardizing for the bot
            const yesIndex = outcomes.findIndex(o => o.toLowerCase() === 'up' || o.toLowerCase() === 'yes');
            const noIndex = outcomes.findIndex(o => o.toLowerCase() === 'down' || o.toLowerCase() === 'no');

            if (yesIndex === -1 || noIndex === -1) {
                console.error(`[Gamma] Could not identify Yes/No outcomes for ${slug}:`, outcomes);
                return null;
            }

            return {
                marketId: market.id,
                conditionId: market.conditionId,
                slug: event.slug,
                tokenIds: {
                    yes: clobTokenIds[yesIndex],
                    no: clobTokenIds[noIndex]
                }
            };

        } catch (error: any) {
            console.error(`[Gamma] Error fetching ${slug}:`, error.message);
            return null;
        }
    }

    /**
     * Fetches the official open price (strike price) for a market.
     */
    public async fetchOpenPrice(slug: string): Promise<number | null> {
        try {
            const url = `${GAMMA_API_URL}/events?slug=${slug}`;
            const response = await axios.get<GammaEvent[]>(url);

            if (!response.data || response.data.length === 0) return null;

            const market = response.data[0].markets[0];
            // Usually, the strike price is available in the 'strike_price' field 
            // or derived from metadata in these specific 15m markets.
            // For now, let's look for 'strike_price' or fallback to a custom field.
            const anyMarket = market as any;
            const openPrice = anyMarket.strikePrice || anyMarket.strike_price || 0;

            return parseFloat(openPrice);
        } catch (error: any) {
            console.error(`[Gamma] Error fetching open price for ${slug}:`, error.message);
            return null;
        }
    }
}

export const gamma = new GammaService();

import { BaseStrategy } from './BaseStrategy';
import { OrderBookState, TradeSignal, Side } from '../types';

export class StrikeCross extends BaseStrategy {
    public name = 'StrikeCross';
    private marketSlug: string;

    constructor(marketSlug: string) {
        super();
        this.marketSlug = marketSlug;
    }

    /**
     * Logic: This strategy exploits the high delta when the price is near the Strike (Open) Price.
     */
    public evaluate(
        binancePrice: number,
        openPrice: number,
        clobState: OrderBookState
    ): TradeSignal | null {
        // 1. Zone Check: Is Abs(binancePrice - openPrice) < 150? (We only trade if close to the strike).
        const distanceToStrike = Math.abs(binancePrice - openPrice);
        if (distanceToStrike >= 150) {
            return null;
        }

        // 2. Direction Check:
        // Trigger BUY YES if binancePrice > openPrice + 10 (Binance is winning YES clearly), but clobBestAskYes < 0.55 (Poly is sleeping/cheap).
        if (binancePrice > openPrice + 10 && clobState.bestAskYes < 0.55) {
            return this.createSignal('YES', binancePrice, openPrice, clobState.bestAskYes);
        }

        // Trigger BUY NO if binancePrice < openPrice - 10 (Binance is winning NO clearly), but clobBestAskNo < 0.55 (Poly is sleeping/cheap).
        if (binancePrice < openPrice - 10 && clobState.bestAskNo < 0.55) {
            return this.createSignal('NO', binancePrice, openPrice, clobState.bestAskNo);
        }

        return null;
    }

    private createSignal(side: Side, binancePrice: number, openPrice: number, polyBestAsk: number): TradeSignal {
        return {
            side,
            marketSlug: this.marketSlug,
            binancePrice,
            openPrice,
            polyBestAsk,
            triggerDelta: Math.abs(binancePrice - openPrice),
            latencyMs: 0, // Injected by caller if tracking latency is possible
        };
    }
}

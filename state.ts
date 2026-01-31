// state.ts
export interface PriceTick {
    priceInt: number;      // 85803
    originalPrice: number; // 85803.99
    tradeTime: number;     // Binance server time
    localTime: number;     // When your computer received it
}

export class PriceStore {
    private static history: PriceTick[] = [];

    static addBinanceTick(price: number, tradeTime: number) {
        this.history.push({
            priceInt: Math.floor(price),
            originalPrice: price,
            tradeTime: tradeTime,
            localTime: Date.now()
        });

        // Keep last 2000 ticks to ensure we cover the lag window
        if (this.history.length > 2000) {
            this.history.shift();
        }
    }

    static findLastBinanceMatch(polyPriceInt: number): PriceTick | undefined {
        // Look backwards for the most recent match
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].priceInt === polyPriceInt) {
                return this.history[i];
            }
        }
        return undefined;
    }
}
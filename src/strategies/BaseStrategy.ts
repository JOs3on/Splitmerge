import { OrderBookState, TradeSignal } from '../types';

export abstract class BaseStrategy {
    public abstract name: string;

    /**
     * Evaluates market conditions and returns a trade signal if conditions are met.
     */
    public abstract evaluate(
        binancePrice: number,
        openPrice: number,
        clobState: OrderBookState
    ): TradeSignal | null;
}

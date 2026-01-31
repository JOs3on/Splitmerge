export interface GammaMarket {
    id: string;
    conditionId: string;
    clobTokenIds: string; // JSON string array
    outcomes: string;     // JSON string array
    active: boolean;
    closed: boolean;
}

export interface GammaEvent {
    id: string;
    slug: string;
    markets: GammaMarket[];
}

export interface MarketDetails {
    marketId: string;
    conditionId: string;
    slug?: string;
    tokenIds: {
        yes: string;
        no: string;
    };
    openPrice?: number;
}

export type Side = 'YES' | 'NO';

export interface PriceUpdate {
    type: 'BINANCE' | 'POLY' | 'ORACLE';
    price: number;
    timestamp: number;
    side?: Side; // Only for POLY
    marketId?: string; // Only for POLY
}

export interface OrderBookState {
    bestAskYes: number;
    bestAskNo: number;
}

export interface TradeSignal {
    side: Side;
    marketSlug: string;
    binancePrice: number;
    openPrice: number;
    polyBestAsk: number;
    triggerDelta: number;
    latencyMs: number;
}

// Polymarket CLOB WS Message Types
export interface ClobPriceChangeItem {
    asset_id: string;
    price: string;
    side: 'BUY' | 'SELL';
    best_bid: string;
    best_ask: string;
}

export interface ClobPriceChange {
    event_type: 'price_change';
    market: string;
    price_changes: ClobPriceChangeItem[];
}

export interface ClobBookUpdate {
    event_type: 'book';
    asset_id: string;
    bids: { price: string; size: string }[];
    asks: { price: string; size: string }[];
}

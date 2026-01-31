export const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
export const CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
export const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@aggTrade';
export const BINANCE_FUTURES_WS_URL = 'wss://fstream.binance.com/ws/btcusdt@aggTrade';
export const POLY_ORACLE_WS_URL = 'wss://ws-live-data.polymarket.com/';
export const MARKET_DURATION_MINUTES = 15;
export const MARKET_DURATION_MS = MARKET_DURATION_MINUTES * 60 * 1000;
export const WARMUP_WINDOW_MS = 2 * 60 * 1000; // 2 minutes before rollover

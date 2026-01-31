import { MARKET_DURATION_MS } from '../config/constants';

/**
 * Calculates the next 15-minute interval expiration (Unix timestamp in ms).
 * e.g., if current time is 14:03, returns 14:15.
 */
export const getNext15MinExpiration = (now: number): number => {
    return Math.ceil(now / MARKET_DURATION_MS) * MARKET_DURATION_MS;
};

/**
 * Calculates the current 15-minute interval start (Unix timestamp in ms).
 * e.g., if current time is 14:03, returns 14:00.
 */
export const getCurrent15MinStart = (now: number): number => {
    return Math.floor(now / MARKET_DURATION_MS) * MARKET_DURATION_MS;
};

/**
 * Returns the market slug for a given expiration timestamp.
 * Deterministic format: btc-updown-15m-[TIMESTAMP_SEC]
 * Note: Polymarket slugs usually use seconds version of the timestamp.
 */
export const getMarketSlug = (expirationMs: number): string => {
    const timestampSec = Math.floor(expirationMs / 1000);
    return `btc-updown-15m-${timestampSec}`;
};

/**
 * Returns a string representation of the market time range (e.g., "09:45-10:00")
 */
export const getTimeRange = (expirationMs: number): string => {
    const start = new Date(expirationMs - MARKET_DURATION_MS);
    const end = new Date(expirationMs);

    const pad = (n: number) => n.toString().padStart(2, '0');

    return `${pad(start.getHours())}:${pad(start.getMinutes())}-${pad(end.getHours())}:${pad(end.getMinutes())}`;
};

/**
 * Returns current time as HH:mm:ss
 */
export const formatTimestamp = (date: Date = new Date()): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

import { PriceStore } from './state';
console.log('PriceStore Imported:', PriceStore);
try {
    console.log('Method check:', typeof PriceStore.findLastBinanceMatch);
} catch (e) {
    console.error('Error accessing method:', e);
}

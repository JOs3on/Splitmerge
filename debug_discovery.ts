import { getNext15MinExpiration, getMarketSlug } from './src/utils/time';
import { gamma } from './src/services/gamma';

async function debugDiscovery() {
    const now = Date.now();
    const currentExp = getNext15MinExpiration(now);
    const nextExp = currentExp + 15 * 60 * 1000;

    const currentSlug = getMarketSlug(currentExp);
    const nextSlug = getMarketSlug(nextExp);

    console.log('--- DEBUG INFO ---');
    console.log(`Local Time: ${new Date(now).toISOString()}`);
    console.log(`Current Calc Exp: ${new Date(currentExp).toISOString()} | Slug: ${currentSlug}`);
    console.log(`Next Calc Exp:    ${new Date(nextExp).toISOString()} | Slug: ${nextSlug}`);

    console.log('\n--- GAMMA FETCH ---');
    const currentMeta = await gamma.fetchMarket(currentSlug);
    const nextMeta = await gamma.fetchMarket(nextSlug);

    console.log(`Gamma Current (${currentSlug}):`, currentMeta ? 'FOUND' : 'NOT FOUND');
    if (currentMeta) console.log(`Market ID: ${currentMeta.marketId}`);

    console.log(`Gamma Next (${nextSlug}):`, nextMeta ? 'FOUND' : 'NOT FOUND');
    if (nextMeta) console.log(`Market ID: ${nextMeta.marketId}`);

    const openPrice = await gamma.fetchOpenPrice(currentSlug);
    console.log(`Current Market Open Price: ${openPrice}`);
}

debugDiscovery().catch(console.error);

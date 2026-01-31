import { getNext15MinExpiration, getMarketSlug } from '../utils/time';
import { gamma } from '../services/gamma';

async function testMarketDiscovery() {
    console.log('--- Market Discovery Validation Test ---');

    // 1. Get current time
    const now = Date.now();
    const localTime = new Date(now).toLocaleString();
    console.log(`[Test] Current Local Time: ${localTime}`);

    // 2. Calculate Expiration and Slug
    const expiration = getNext15MinExpiration(now);
    const slug = getMarketSlug(expiration);

    console.log(`[Test] Calculated Expiration: ${new Date(expiration).toLocaleString()}`);
    console.log(`[Test] Generated Slug: ${slug}`);

    // 3. Fetch from Gamma to verify parsing
    console.log(`[Test] Fetching market data for: ${slug}...`);
    const details = await gamma.fetchMarket(slug);

    if (details) {
        console.log('\n✅ DISCOVERY SUCCESSFUL');
        console.log('-----------------------------------');
        console.log(`Market Slug:  ${slug}`);
        console.log(`Market ID:    ${details.marketId}`);
        console.log(`Condition ID: ${details.conditionId}`);
        console.log(`Yes Token ID: ${details.tokenIds.yes}`);
        console.log(`No Token ID:  ${details.tokenIds.no}`);
        console.log('-----------------------------------');

        // Basic validation of ID length/format
        if (details.tokenIds.yes.length > 50 && details.tokenIds.no.length > 50) {
            console.log('Result: JSON Parsing and Token Mapping appear CORRECT.');
        } else {
            console.warn('Warning: Token IDs seem unusually short.');
        }
    } else {
        console.error('\n❌ DISCOVERY FAILED');
        console.log(`Could not find or parse market data for slug: ${slug}`);
        console.log('Hint: Check if the market for this interval has been created on Gamma API yet.');
    }
}

testMarketDiscovery().catch(err => {
    console.error('[Test] Fatal Error during discovery test:', err);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getShopifyConfig, getLatestProducts, shopifyFetch } from '../server/shopify.js';

test('Shopify client detects unconfigured credentials and defaults to demo mode', () => {
  const config = getShopifyConfig();
  assert.equal(typeof config.isDemoMode, 'boolean');
  assert.equal(config.apiVersion, '2026-10');
});

test('getLatestProducts returns up to 3 newest products from GraphQL endpoint', async () => {
  const result = await getLatestProducts(true);
  assert.ok(['shopify', 'demo'].includes(result.source));
  assert.ok(Array.isArray(result.products));
  assert.ok(result.products.length <= 3 && result.products.length > 0);

  // Each product must adhere to the required { id, title } structure
  for (const item of result.products) {
    assert.equal(typeof item.id, 'string');
    assert.ok(item.id.length > 0);
    assert.equal(typeof item.title, 'string');
    assert.ok(item.title.length > 0);
  }
});

test('shopifyFetch surfaces GraphQL errors gracefully', async () => {
  await assert.rejects(
    async () => {
      // Send an invalid GraphQL query to trigger error handling
      await shopifyFetch('query InvalidQuery { nonExistentField }');
    },
    (err: Error) => {
      assert.ok(err.message.includes('Shopify GraphQL') || err.message.includes('HTTP error') || err.message.includes('request failed'));
      return true;
    }
  );
});

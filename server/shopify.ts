/**
 * Shopify Storefront GraphQL API Client
 * Server-only service module for communicating with Shopify's Storefront GraphQL API.
 * Keeps private Storefront Access Tokens securely on the server and provides
 * graceful demo mode fallback when credentials are unconfigured or placeholders.
 */

export interface ShopifyProductNode {
  id: string;
  title: string;
  handle?: string;
  featuredImage?: {
    url: string;
    altText?: string | null;
  } | null;
  priceRange?: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  } | null;
}

export interface ShopifyProductsResponse {
  data?: {
    products?: {
      edges: Array<{
        node: ShopifyProductNode;
      }>;
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export interface ShopifyConfig {
  storeDomain: string;
  storefrontAccessToken: string;
  apiVersion: string;
  isDemoMode: boolean;
}

export interface LatestProductsResult {
  source: 'shopify' | 'demo';
  storeDomain: string;
  products: ShopifyProductNode[];
  fetchedAt: string;
}

const LATEST_PRODUCTS_QUERY = `
  query GetLatestProducts {
    products(first: 3, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
            altText
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`.trim();

// Cache policy: 60-second TTL to avoid duplicate remote requests during catalog navigation
interface CacheEntry {
  data: LatestProductsResult;
  expiresAt: number;
}
let memoryCache: CacheEntry | null = null;

/**
 * Validates and returns Shopify configuration from environment variables.
 * Automatically identifies missing or placeholder credentials to enable safe demo mode.
 */
export function getShopifyConfig(): ShopifyConfig {
  const rawDomain = (process.env.SHOPIFY_STORE_DOMAIN || '').trim();
  const rawToken = (process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || '').trim();
  const apiVersion = (process.env.SHOPIFY_API_VERSION || '2026-10').trim();

  const isPlaceholderDomain = !rawDomain || rawDomain.includes('your-store.myshopify.com') || rawDomain === 'example.myshopify.com';
  const isPlaceholderToken = !rawToken || rawToken.includes('your_storefront_access_token') || rawToken === 'placeholder';

  const isDemoMode = isPlaceholderDomain || isPlaceholderToken;

  return {
    storeDomain: rawDomain,
    storefrontAccessToken: rawToken,
    apiVersion,
    isDemoMode,
  };
}

/**
 * Executes a GraphQL query against either the authenticated Shopify Storefront endpoint
 * or the mock.shop demo endpoint.
 */
export async function shopifyFetch<T = ShopifyProductsResponse>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const config = getShopifyConfig();

  let endpointUrl: string;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (config.isDemoMode) {
    endpointUrl = 'https://mock.shop/api';
  } else {
    // Standard Shopify Storefront API endpoint: https://{store_name}.myshopify.com/api/2026-10/graphql.json
    const domain = config.storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    endpointUrl = `https://${domain}/api/${config.apiVersion}/graphql.json`;
    headers['X-Shopify-Storefront-Access-Token'] = config.storefrontAccessToken;
  }

  let response: Response;
  try {
    response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch (networkError: unknown) {
    const errorMsg = networkError instanceof Error ? networkError.message : 'Network request failed';
    throw new Error(`Shopify Storefront request failed to reach endpoint (${config.isDemoMode ? 'mock.shop' : 'Shopify'}): ${errorMsg}`);
  }

  if (!response.ok) {
    let bodySnippet = '';
    try {
      bodySnippet = await response.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Shopify Storefront API HTTP error ${response.status} (${response.statusText}): ${bodySnippet.slice(0, 200)}`
    );
  }

  const json = (await response.json()) as ShopifyProductsResponse;

  if (json.errors && json.errors.length > 0) {
    const errorDetails = json.errors.map(e => e.message).join('; ');
    throw new Error(`Shopify GraphQL returned errors: ${errorDetails}`);
  }

  return json as unknown as T;
}

/**
 * Retrieves up to three recently created products, sorted by CREATED_AT newest first.
 * Returns a clean mapped array of product nodes.
 */
export async function getLatestProducts(forceRefresh = false): Promise<LatestProductsResult> {
  const now = Date.now();
  if (!forceRefresh && memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.data;
  }

  const config = getShopifyConfig();
  const rawResponse = await shopifyFetch<ShopifyProductsResponse>(LATEST_PRODUCTS_QUERY);

  const edges = rawResponse.data?.products?.edges || [];
  const products: ShopifyProductNode[] = edges.map(edge => edge.node);

  const result: LatestProductsResult = {
    source: config.isDemoMode ? 'demo' : 'shopify',
    storeDomain: config.isDemoMode ? 'mock.shop' : config.storeDomain,
    products,
    fetchedAt: new Date().toISOString(),
  };

  // Cache for 60 seconds
  memoryCache = {
    data: result,
    expiresAt: now + 60_000,
  };

  return result;
}

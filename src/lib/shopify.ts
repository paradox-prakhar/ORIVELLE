/**
 * Frontend client helper for Shopify Storefront API data.
 * Calls the secure backend endpoint without exposing any private Storefront access tokens to the browser.
 */

export interface ShopifyProduct {
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

export interface LatestProductsResponse {
  source: 'shopify' | 'demo';
  storeDomain: string;
  products: ShopifyProduct[];
  fetchedAt: string;
  error?: string;
}

/**
 * Fetches the 3 most recently created products from the secure server endpoint.
 */
export async function fetchLatestProducts(signal?: AbortSignal): Promise<LatestProductsResponse> {
  const response = await fetch('/api/shopify/latest-products', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

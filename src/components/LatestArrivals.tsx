import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { fetchLatestProducts, type ShopifyProduct, type LatestProductsResponse } from '../lib/shopify';
import { Media } from './Media';

export function LatestArrivals() {
  const [data, setData] = useState<LatestProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchLatestProducts(controller.signal)
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const formatPrice = (priceObj?: ShopifyProduct['priceRange']) => {
    if (!priceObj?.minVariantPrice?.amount) return null;
    const amount = parseFloat(priceObj.minVariantPrice.amount);
    const currency = priceObj.minVariantPrice.currencyCode || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <section id="latest-arrivals" className="latest-arrivals-section section-pad" data-ambient>
      <div className="section-heading" data-reveal>
        <div>
          <p className="eyebrow">
            <span className="orange-dot" /> SHOPIFY STOREFRONT GRAPHQL INTEGRATION
          </p>
          <h2>
            Latest Arrivals.<br />
            <em>Newest Atelier Creations.</em>
          </h2>
        </div>
        <div className="arrivals-header-meta">
          {data?.source === 'demo' && (
            <span className="shopify-demo-pill" title="Serving live query from mock.shop public storefront endpoint">
              <Sparkles size={11} /> MOCK.SHOP DEMO MODE
            </span>
          )}
          {data?.source === 'shopify' && (
            <span className="shopify-live-pill" title={`Connected to ${data.storeDomain}`}>
              ● LIVE SHOPIFY STOREFRONT
            </span>
          )}
          <Link className="text-link" to="/shop">
            Explore entire catalogue <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {loading && (
        <div className="arrivals-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="arrivals-skeleton">
              <div className="arrivals-skeleton-img" />
              <div className="arrivals-skeleton-line short" />
              <div className="arrivals-skeleton-line long" />
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="arrivals-error-card">
          <AlertCircle size={22} color="#d99776" />
          <div>
            <h4>Shopify Storefront API Notice</h4>
            <p>{error}</p>
            <small>Verify your SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN in .env.local.</small>
          </div>
          <button
            type="button"
            className="arrivals-retry-btn"
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchLatestProducts()
                .then(setData)
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && data && data.products.length === 0 && (
        <div className="arrivals-empty">
          <p>No recent products found in the connected Shopify catalog.</p>
        </div>
      )}

      {!loading && !error && data && data.products.length > 0 && (
        <div className="arrivals-grid">
          {data.products.slice(0, 3).map((item, index) => {
            const priceLabel = formatPrice(item.priceRange);
            return (
              <div key={item.id} className="arrivals-card" data-reveal>
                <div className="arrivals-img-wrap">
                  {item.featuredImage?.url ? (
                    <Media
                      src={item.featuredImage.url}
                      alt={item.featuredImage.altText || item.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="arrivals-fallback-media">
                      <span className="arrivals-fallback-title">{item.title}</span>
                      <small>Atelier Specimen 0{index + 1}</small>
                    </div>
                  )}
                  <span className="arrivals-rank-badge">NEW DROP #0{index + 1}</span>
                  <span className="arrivals-id-tag" title={item.id}>
                    ID: {item.id.replace('gid://shopify/Product/', '')}
                  </span>
                </div>

                <div className="arrivals-info">
                  <div className="arrivals-title-row">
                    <h3>{item.title}</h3>
                    {priceLabel && <span className="arrivals-price">{priceLabel}</span>}
                  </div>
                  <p className="arrivals-sub">
                    Direct Storefront GraphQL response node · Sorted by CREATED_AT (Newest first)
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

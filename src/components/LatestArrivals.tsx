import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Sparkles, RefreshCw, ShoppingBag } from 'lucide-react';
import { fetchLatestProducts, type ShopifyProduct, type LatestProductsResponse } from '../lib/shopify';
import { Media } from './Media';

interface DisplayArrival {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  link: string;
  imageUrl?: string;
  badge: string;
  sourceLabel: string;
}

const fallbackPieces: DisplayArrival[] = [
  {
    id: 'sculpted-wool-trench',
    title: 'Sculpted Wool Trench',
    subtitle: '100% Virgin Wool Twill · Double-Faced Architectural Cut',
    price: '₹14,500',
    link: '/product/sculpted-wool-trench',
    imageUrl: 'https://images.unsplash.com/photo-1683393092542-74689e4b8367?auto=format&fit=crop&w=1200&q=80',
    badge: 'NEW DROP #01',
    sourceLabel: 'Atelier Creation Specimen 01',
  },
  {
    id: 'tailored-wool-overcoat',
    title: 'Tailored Wool Overcoat',
    subtitle: 'Heavy Italian Worsted Wool · Minimalist Notch Lapels',
    price: '₹16,800',
    link: '/product/tailored-wool-overcoat',
    imageUrl: 'https://images.unsplash.com/photo-1787436025288-874f0696fcca?auto=format&fit=crop&w=1200&q=80',
    badge: 'NEW DROP #02',
    sourceLabel: 'Atelier Creation Specimen 02',
  },
  {
    id: 'spun-cashmere-rib',
    title: 'Spun Cashmere Rib Sweater',
    subtitle: 'Combed Cashmere & Mulberry Silk · Dropped Shoulder Drape',
    price: '₹9,800',
    link: '/product/spun-cashmere-rib',
    imageUrl: 'https://images.unsplash.com/photo-1625795550960-9558411bae05?auto=format&fit=crop&w=1200&q=80',
    badge: 'NEW DROP #03',
    sourceLabel: 'Atelier Creation Specimen 03',
  },
];

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

  const getDisplayedProducts = (): DisplayArrival[] => {
    if (data && data.products && data.products.length > 0) {
      return data.products.slice(0, 3).map((item, index) => {
        const priceLabel = formatPrice(item.priceRange) || '$95 USD';
        return {
          id: item.id,
          title: item.title,
          subtitle: 'Direct Storefront GraphQL response node · Sorted by CREATED_AT',
          price: priceLabel,
          link: `/shop?q=${encodeURIComponent(item.title)}`,
          imageUrl: item.featuredImage?.url,
          badge: `NEW DROP #0${index + 1}`,
          sourceLabel: `ID: ${item.id.replace('gid://shopify/Product/', '')}`,
        };
      });
    }
    return fallbackPieces;
  };

  const items = getDisplayedProducts();

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

      {loading && !data && (
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

      {error && (
        <div className="arrivals-error-pill">
          <span>Connected via local atelier fallback catalogue</span>
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
            <RefreshCw size={11} /> Retry Shopify
          </button>
        </div>
      )}

      <div className="arrivals-grid">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.link}
            className="arrivals-card is-visible"
            title={`Explore ${item.title} — ${item.price}`}
          >
            <div className="arrivals-img-wrap">
              {item.imageUrl ? (
                <Media
                  src={item.imageUrl}
                  alt={item.title}
                  loading="lazy"
                />
              ) : (
                <div className="arrivals-fallback-media">
                  <span className="arrivals-fallback-title">{item.title}</span>
                  <small>{item.sourceLabel}</small>
                </div>
              )}
              <span className="arrivals-rank-badge">{item.badge}</span>
              <span className="arrivals-id-tag" title={item.id}>
                {item.sourceLabel}
              </span>
              <span className="arrivals-hover-action">
                <ShoppingBag size={12} />
                <span>Shop Piece</span>
                <ArrowUpRight size={12} />
              </span>
            </div>

            <div className="arrivals-info">
              <div className="arrivals-title-row">
                <h3>{item.title}</h3>
                <span className="arrivals-price">{item.price}</span>
              </div>
              <p className="arrivals-sub">{item.subtitle}</p>
              <div className="arrivals-action-row">
                <span>View in Catalogue</span>
                <ArrowUpRight size={13} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

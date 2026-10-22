import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { Product } from '../commerce/types';
import { Media } from './Media';

const fallbackProducts: Product[] = [
  {
    id: 'product-sandwashed-silk-dress',
    slug: 'sandwashed-silk-dress',
    name: 'Sandwashed Silk Dress',
    description: 'A fluid bias-cut midi dress cut from sandwashed mulberry silk with a soft matte luster.',
    category: 'Dresses',
    price: 1150000,
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1600&q=80',
    images: ['https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1600&q=80'],
    color: 'Desert Stone',
    material: '100% Pure Mulberry Silk',
    care: 'Dry clean only',
    featured: true,
    demo: true,
    variants: [{ id: 'sandwashed-silk-dress-m', sku: 'ORI-SAN-M', size: 'M', color: 'Desert Stone', stock: 12 }],
  },
  {
    id: 'product-relaxed-wool-blazer',
    slug: 'relaxed-wool-blazer',
    name: 'Relaxed Wool Blazer',
    description: 'An unstructured tailored blazer crafted from breathable Belgian wool-linen weave.',
    category: 'Tops',
    price: 1220000,
    image: 'https://images.unsplash.com/photo-1453396450673-3fe83d2db2c4?auto=format&fit=crop&w=1600&q=80',
    images: ['https://images.unsplash.com/photo-1453396450673-3fe83d2db2c4?auto=format&fit=crop&w=1600&q=80'],
    color: 'Slate Ink',
    material: 'Breathable Wool-Linen Blend',
    care: 'Dry clean only',
    featured: true,
    demo: true,
    variants: [{ id: 'relaxed-wool-blazer-m', sku: 'ORI-REL-M', size: 'M', color: 'Slate Ink', stock: 10 }],
  },
  {
    id: 'product-spun-cashmere-rib',
    slug: 'spun-cashmere-rib',
    name: 'Spun Cashmere Rib Sweater',
    description: 'Whisper-soft ribbed knit spun from premium combed cashmere and mulberry silk.',
    category: 'Knitwear',
    price: 980000,
    image: 'https://images.unsplash.com/photo-1625795550960-9558411bae05?auto=format&fit=crop&w=1600&q=80',
    images: ['https://images.unsplash.com/photo-1625795550960-9558411bae05?auto=format&fit=crop&w=1600&q=80'],
    color: 'Ecru Cream',
    material: 'Combed Cashmere & Mulberry Silk',
    care: 'Hand wash cold',
    featured: true,
    demo: true,
    variants: [{ id: 'spun-cashmere-rib-m', sku: 'ORI-SPU-M', size: 'M', color: 'Ecru Cream', stock: 14 }],
  },
  {
    id: 'product-sculpted-wool-trench',
    slug: 'sculpted-wool-trench',
    name: 'Sculpted Wool Trench',
    description: 'An architectural double-faced wool trench with generous raglan sleeves and storm flap.',
    category: 'Outerwear',
    price: 1450000,
    image: 'https://images.unsplash.com/photo-1683393092542-74689e4b8367?auto=format&fit=crop&w=1600&q=80',
    images: ['https://images.unsplash.com/photo-1683393092542-74689e4b8367?auto=format&fit=crop&w=1600&q=80'],
    color: 'Oat Camel',
    material: '100% Virgin Wool Twill',
    care: 'Dry clean only',
    featured: true,
    demo: true,
    variants: [{ id: 'sculpted-wool-trench-m', sku: 'ORI-SCU-M', size: 'M', color: 'Oat Camel', stock: 8 }],
  },
];

const price = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v / 100);

export function Collection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/products?pageSize=4', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then((data) => {
        if (data.items && data.items.length > 0) {
          setProducts(data.items.slice(0, 4));
        } else {
          setProducts(fallbackProducts);
        }
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setProducts(fallbackProducts);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const displayProducts = products.length > 0 ? products : fallbackProducts;

  return (
    <section id="collection" className="collection-section section-pad">
      <div className="section-heading" data-reveal>
        <div>
          <p className="eyebrow">
            <span className="orange-dot" /> THE FIRST EDIT
          </p>
          <h2>
            New season.<br />
            <em>Same quiet confidence.</em>
          </h2>
        </div>
        <Link className="text-link" to="/shop">
          Discover all pieces <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="featured-grid">
        {loading
          ? [1, 2, 3, 4].map((x) => (
              <div className="product-skeleton" key={x} aria-label="Loading collection" />
            ))
          : displayProducts.map((product, i) => (
              <Link to={`/product/${product.slug}`} className="featured-product" key={product.id}>
                <div className={`featured-image featured-image-${i}`}>
                  <Media src={product.image} alt={product.name + ' — illustrative campaign photography'} loading="lazy" />
                  <span className="product-badge">{i === 0 ? 'THE SIGNATURE' : 'COLLECTION 01'}</span>
                  <span className="product-open">
                    <ArrowUpRight size={20} />
                  </span>
                </div>
                <div className="product-caption">
                  <div>
                    <small>{product.category}</small>
                    <h3>{product.name}</h3>
                  </div>
                  <span>{price(product.price)}</span>
                </div>
                <span className="product-material">{product.material}</span>
              </Link>
            ))}
      </div>

      <p className="catalog-note">
        A demonstration collection. Campaign photography is illustrative; final product imagery will be added before launch.
      </p>
    </section>
  );
}

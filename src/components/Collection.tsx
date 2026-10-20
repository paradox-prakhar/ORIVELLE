import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { Product } from '../commerce/types';
import { Media } from './Media';

const price = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v / 100);
export function Collection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/products?pageSize=4', { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error('The collection is temporarily unavailable. Please try the shop again.'); return response.json(); }).then(data => setProducts(data.items.slice(0, 4))).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  return <section id="collection" className="collection-section section-pad">
    <div className="section-heading" data-reveal><div><p className="eyebrow"><span className="orange-dot" /> THE FIRST EDIT</p><h2>New season.<br /><em>Same quiet confidence.</em></h2></div><Link className="text-link" to="/shop">Discover all pieces <ArrowUpRight size={16} /></Link></div>
    <div className="featured-grid">{loading ? [1, 2, 3, 4].map(x => <div className="product-skeleton" key={x} aria-label="Loading collection" />) : error ? <p className="collection-error" role="status">{error} <Link to="/shop">Open the shop →</Link></p> : products.map((product, i) => <Link to={`/product/${product.slug}`} className="featured-product" key={product.id}>
      <div className={`featured-image featured-image-${i}`}><Media src={product.image} alt={product.name + ' — illustrative campaign photography'} loading="lazy" /><span className="product-badge">{i === 0 ? 'THE SIGNATURE' : 'COLLECTION 01'}</span><span className="product-open"><ArrowUpRight size={20} /></span></div>
      <div className="product-caption"><div><small>{product.category}</small><h3>{product.name}</h3></div><span>{price(product.price)}</span></div><span className="product-material">{product.material}</span>
    </Link>)}</div>
    <p className="catalog-note">A demonstration collection. Campaign photography is illustrative; final product imagery will be added before launch.</p>
  </section>;
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { api, errorMessage } from './api';
import { EmptyState, ErrorNotice, ProductCard, ProductSkeletons } from './shared';
import type { Catalog } from './types';

export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [search, setSearch] = useState(params.get('q') || '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = params.toString();
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    api<Catalog>(`/products?${query}`, { signal: controller.signal }).then(setCatalog).catch((e) => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);
  useEffect(() => { setSearch(params.get('q') || ''); }, [params]);
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); next.delete('page'); setParams(next); };
  const page = Number(params.get('page') || 1);
  const active = ['category', 'q', 'maxPrice'].some((key) => params.has(key));
  return <section className="c-page c-shop"><header className="c-page-heading"><span className="c-eyebrow">ORIVELLE / THE CONSIDERED WARDROBE</span><div className="c-heading-row"><h1>Made for<br/><em>your every day.</em></h1><p>Quiet silhouettes. A Korean point of view.<br/>Discover pieces to wear, live in, and return to.</p></div></header><section aria-label="Shop collection"><div className="c-shop-toolbar"><div className="c-category-tabs"><button className={!params.get('category') ? 'active' : ''} onClick={() => change('category', '')}>All pieces</button>{catalog?.categories.map((category) => { const name = typeof category === 'string' ? category : category.name; const value = typeof category === 'string' ? category : category.slug || category.name; return <button key={value} className={params.get('category') === value ? 'active' : ''} onClick={() => change('category', value)}>{name}</button>; })}</div><button className="c-filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><SlidersHorizontal size={15}/> Refine</button></div><div className={`c-shop-filters ${filtersOpen ? 'is-open' : ''}`}><form className="c-search" onSubmit={(e) => { e.preventDefault(); change('q', search.trim()); }}><Search size={17}/><input aria-label="Search the collection" placeholder="Find your next favorite" value={search} onChange={(e) => setSearch(e.target.value)}/><button type="submit" aria-label="Search"><ArrowRight size={18}/></button></form><label>Price<select value={params.get('maxPrice') || ''} onChange={(e) => change('maxPrice', e.target.value)}><option value="">All prices</option><option value="500000">Under ₹5,000</option><option value="1000000">Under ₹10,000</option><option value="1500000">Under ₹15,000</option></select></label><label>Sort by<select value={params.get('sort') || 'newest'} onChange={(e) => change('sort', e.target.value)}><option value="newest">Latest arrivals</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label></div><div className="c-results-line"><span>{loading ? 'Finding your pieces…' : `${catalog?.total ?? 0} considered pieces`}</span>{active && <button onClick={() => setParams({})}>Clear filters<X size={12}/></button>}<span>DEMONSTRATION COLLECTION</span></div>{error ? <ErrorNotice>{error}</ErrorNotice> : loading ? <ProductSkeletons/> : catalog?.items.length ? <><div className="c-product-grid">{catalog.items.map((product, index) => <ProductCard key={product.id} product={product} index={(page - 1) * catalog.pageSize + index}/>)}</div>{catalog.total > catalog.pageSize && <div className="c-pagination"><button aria-label="Previous page" disabled={page === 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next); }}><ArrowLeft size={17}/></button><span>PAGE {page} / {Math.ceil(catalog.total / catalog.pageSize)}</span><button aria-label="Next page" disabled={page >= Math.ceil(catalog.total / catalog.pageSize)} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next); }}><ArrowRight size={17}/></button></div>}</> : <EmptyState title="A fresh start." to="/shop">No pieces match those filters. Try another search or explore the full collection.</EmptyState>}</section><p className="c-demo-note">A demonstration wardrobe. Product information, pricing, imagery, and availability are sample data.</p></section>;
}

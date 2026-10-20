import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Heart, ImageOff, Minus, Plus } from 'lucide-react';
import { errorMessage, money } from './api';
import { useCommerce } from './context';
import type { Cart, Product } from './types';
import { useCommerceReveal } from './useCommerceMotion';

export function ProductImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState('');
  return failedUrl === src ? <div className={`c-image-fallback ${className}`} role="img" aria-label={`${alt}: image unavailable`}><ImageOff size={24}/><span>Image unavailable</span><small>{alt}</small></div> : <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailedUrl(src)}/>;
}
export function ErrorNotice({ children }: { children: ReactNode }) { return <p className="c-error" role="alert">{children}</p>; }
export function Quantity({ value, max, onChange, disabled = false }: { value: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <div className="c-quantity"><button type="button" aria-label="Decrease quantity" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}><Minus size={14}/></button><span aria-label={`Quantity ${value}`}>{value}</span><button type="button" aria-label="Increase quantity" disabled={disabled || value >= Math.min(max,20)} onClick={() => onChange(value + 1)}><Plus size={14}/></button></div>;
}
export function WishlistButton({ product }: { product: Product }) {
  const { wishlist, toggleWishlist, loading } = useCommerce();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const selected = wishlist.some((item) => item.id === product.id);
  return <div className="c-wish-wrap"><button className={`c-wish ${selected ? 'selected' : ''}`} type="button" aria-label={`${selected ? 'Remove' : 'Save'} ${product.name} ${selected ? 'from' : 'to'} wishlist`} aria-pressed={selected} disabled={busy || loading} onClick={async () => { setBusy(true); setError(''); try { await toggleWishlist(product); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}><Heart size={18} fill={selected ? 'currentColor' : 'none'}/></button>{error && <span className="c-wish-error" role="alert">{error}</span>}</div>;
}
export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const available = product.variants.some((variant) => variant.stock > 0);
  const revealRef = useCommerceReveal<HTMLElement>();
  return <article className="c-product-card" ref={revealRef} style={{ '--card-order': index % 4 } as CSSProperties}><div className="c-card-photo"><Link to={`/product/${product.slug}`} aria-label={`View ${product.name}`}><ProductImage src={product.image} alt={product.name}/></Link><span className="c-card-index">{String(index + 1).padStart(2, '0')} / THE ORIVELLE EDIT</span><WishlistButton product={product}/>{!available && <span className="c-stock-tag">Sold out</span>}</div><div className="c-card-description"><div><span className="c-product-category">{product.category}</span><h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3><p>{money(product.price)} {product.compareAtPrice && product.compareAtPrice > product.price ? <del>{money(product.compareAtPrice)}</del> : null}</p></div><Link className="c-product-arrow" to={`/product/${product.slug}`} aria-label={`Choose ${product.name}`}><ArrowUpRight size={20}/></Link></div></article>;
}
export function Summary({ cart, children }: { cart: Cart; children?: ReactNode }) {
  return <div className="c-summary"><div><span>Subtotal</span><span>{money(cart.subtotal)}</span></div>{cart.discount > 0 && <div><span>Offer applied</span><span>−{money(cart.discount)}</span></div>}<div><span>Delivery</span><span>{cart.shipping === 0 ? 'Complimentary' : money(cart.shipping)}</span></div><div><span>Tax</span><span>{money(cart.tax)}</span></div><div className="c-summary-total"><span>Total</span><span>{money(cart.total)}</span></div>{children}</div>;
}
export function EmptyState({ title, children, action = 'Explore the collection', to = '/shop' }: { title: string; children: ReactNode; action?: string; to?: string }) {
  return <div className="c-empty"><span className="c-eyebrow">A LITTLE ROOM FOR SOMETHING GOOD</span><h2>{title}</h2><p>{children}</p><Link className="c-button" to={to}>{action}<ArrowUpRight size={17}/></Link></div>;
}
export function ProductSkeletons() { return <div className="c-product-grid" aria-label="Loading collection" aria-busy="true">{[0,1,2,3].map((key) => <div className="c-skeleton" key={key}><div/><span/><span/></div>)}</div>; }

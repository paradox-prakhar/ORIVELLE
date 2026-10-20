import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ShoppingBag, Trash2, X } from 'lucide-react';
import { errorMessage, money } from './api';
import { useCommerce } from './context';
import { ErrorNotice, ProductImage, Quantity, Summary } from './shared';

export function CouponForm() {
  const { cart, applyCoupon, removeCoupon } = useCommerce();
  const [code, setCode] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const coupon = typeof cart.coupon === 'string' ? cart.coupon : cart.coupon?.code;
  return <div className="c-coupon">{coupon ? <div className="c-applied-coupon"><span>{coupon} applied</span><button disabled={busy} aria-label="Remove discount code" onClick={async () => { setBusy(true); setError(''); try { await removeCoupon(); } catch(e) { setError(errorMessage(e)); } finally { setBusy(false); } }}><X size={15}/></button></div> : <form onSubmit={async (e) => { e.preventDefault(); if (!code.trim()) return; setBusy(true); setError(''); try { await applyCoupon(code.trim()); setCode(''); } catch(e) { setError(errorMessage(e)); } finally { setBusy(false); } }}><input aria-label="Discount code" placeholder="Have a little code?" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30}/><button disabled={busy || !code.trim()} aria-label="Apply discount code" type="submit">{busy ? '…' : <ArrowRight size={17}/>}</button></form>}{error && <ErrorNotice>{error}</ErrorNotice>}</div>;
}
export function CartDrawer() {
  const { cartOpen, closeCart, cart, cartCount, updateQuantity, removeItem, connectionError, config } = useCommerce();
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!cartOpen) return;
    const prior = document.activeElement as HTMLElement | null;
    const original = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const overlay = panel.current?.parentElement;
    const siblings = [...(overlay?.parentElement?.children || [])].filter((item): item is HTMLElement => item instanceof HTMLElement && item !== overlay);
    const priorInert = siblings.map((item) => item.inert);
    siblings.forEach((item) => {item.inert = true;});
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCart();
      if (event.key === 'Tab') {
        const elements = panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]');
        if (!elements?.length) return; const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = original; document.removeEventListener('keydown', keyboard); siblings.forEach((item,index) => {item.inert = priorInert[index];}); if(prior?.isConnected) prior.focus(); };
  }, [cartOpen, closeCart]);
  if (!cartOpen) return null;
  const mutate = async (id: string, action: () => Promise<void>) => { setBusy(id); setError(''); try { await action(); } catch(e) { setError(errorMessage(e)); } finally { setBusy(''); } };
  return <div className="c-cart-overlay" data-lenis-prevent><button className="c-cart-backdrop" onClick={closeCart} aria-label="Close shopping bag" tabIndex={-1}/><aside className="c-cart-panel" role="dialog" aria-modal="true" aria-labelledby="bag-title" ref={panel}><header><div><span className="c-eyebrow">THE PIECES YOU LOVE</span><h2 id="bag-title">Your bag <sup>({cartCount})</sup></h2></div><button className="c-icon-button" onClick={closeCart} aria-label="Close bag"><X size={23}/></button></header>{connectionError && <ErrorNotice>{connectionError}</ErrorNotice>}{cart.items.length ? <><div className="c-cart-items" data-lenis-prevent>{cart.items.map((item) => <article className="c-cart-item" key={item.id}><Link to={`/product/${item.product.slug}`} onClick={closeCart}><ProductImage src={item.product.image} alt={item.product.name}/></Link><div className="c-cart-item-body"><div><Link to={`/product/${item.product.slug}`} onClick={closeCart}>{item.product.name}</Link><p>{item.variant.color || item.product.color} / {item.variant.size}</p><span>{money(item.lineTotal)}</span></div><div className="c-cart-item-actions"><Quantity value={item.quantity} max={item.variant.stock} disabled={Boolean(busy)} onChange={(quantity) => mutate(item.id, () => updateQuantity(item.id, quantity))}/><button className="c-icon-button" aria-label={`Remove ${item.product.name} from bag`} disabled={Boolean(busy)} onClick={() => mutate(item.id, () => removeItem(item.id))}><Trash2 size={15}/></button></div></div></article>)}</div><div className="c-cart-bottom">{error && <ErrorNotice>{error}</ErrorNotice>}{cart.warnings?.map((warning) => <ErrorNotice key={warning}>{warning}</ErrorNotice>)}<p className="c-shipping-message">{cart.shipping === 0 ? 'A small pleasure: your delivery is on us.' : config ? `${money(Math.max(0,config.shipping.freeAbove - cart.subtotal + cart.discount))} away from complimentary delivery.` : 'Delivery is calculated in your order summary.'}</p><CouponForm/><Summary cart={cart}/><Link className="c-button" to="/checkout" onClick={closeCart}>Continue to checkout<ArrowUpRight size={18}/></Link><p className="c-cart-fine">Demonstration store · Cash on delivery · Prices in INR</p></div></> : <div className="c-empty-bag"><ShoppingBag size={36} strokeWidth={1}/><h3>A little space<br/>for something lovely.</h3><p>Your bag is waiting for its first piece.</p><Link className="c-button" to="/shop" onClick={closeCart}>Explore the collection<ArrowUpRight size={17}/></Link></div>}</aside></div>;
}

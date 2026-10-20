import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, post } from './api';
import type { Cart, Product, StoreConfig, User } from './types';

const emptyCart: Cart = { items: [], subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0, coupon: null };
type CommerceState = {
  cart: Cart; cartCount: number; cartOpen: boolean; openCart: () => void; closeCart: () => void;
  user: User | null; loading: boolean; connectionError: string; wishlist: Product[]; config: StoreConfig | null;
  refreshCart: () => Promise<void>; refreshUser: () => Promise<void>; refreshWishlist: () => Promise<void>; refreshConfig: () => Promise<void>;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>; removeItem: (id: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>; removeCoupon: () => Promise<void>;
  toggleWishlist: (product: Product) => Promise<void>; logout: () => Promise<void>;
};
const CommerceContext = createContext<CommerceState | null>(null);
export function CommerceProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [user, setUser] = useState<User | null>(null);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const bootstrap = useRef<Promise<void> | null>(null);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const refreshCart = useCallback(async () => { setCart(await api<Cart>('/cart')); }, []);
  const refreshUser = useCallback(async () => { const result = await api<{ user: User | null }>('/auth/me'); setUser(result.user); }, []);
  const refreshWishlist = useCallback(async () => { const result = await api<{ items: Product[] }>('/wishlist'); setWishlist(result.items); }, []);
  const refreshConfig = useCallback(async () => { setConfig(await api<StoreConfig>('/config')); }, []);
  const openCart = useCallback(() => { setCartOpen(true); Promise.all([refreshCart(), refreshConfig()]).catch(() => setConnectionError('Your bag could not refresh. Please try again.')); }, [refreshCart, refreshConfig]);
  useEffect(() => {
    let active = true;
    // Establish one persisted guest session before parallel reads, including StrictMode.
    bootstrap.current ??= refreshCart().then(async () => { await Promise.all([refreshUser(), refreshWishlist(), refreshConfig()]); });
    bootstrap.current.catch(() => { if (active) setConnectionError('The store could not connect. Please reload to try again.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshCart, refreshUser, refreshWishlist, refreshConfig]);
  const addToCart = async (variantId: string, quantity = 1) => { setCart(await api<Cart>('/cart/items', post({ variantId, quantity }))); };
  const updateQuantity = async (id: string, quantity: number) => { setCart(await api<Cart>(`/cart/items/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })); };
  const removeItem = async (id: string) => { setCart(await api<Cart>(`/cart/items/${id}`, { method: 'DELETE' })); };
  const applyCoupon = async (code: string) => { setCart(await api<Cart>('/cart/coupon', post({ code }))); };
  const removeCoupon = async () => { setCart(await api<Cart>('/cart/coupon', { method: 'DELETE' })); };
  const toggleWishlist = async (product: Product) => {
    if (wishlist.some((item) => item.id === product.id)) await api(`/wishlist/${product.id}`, { method: 'DELETE' });
    else await api('/wishlist', post({ productId: product.id }));
    await refreshWishlist();
  };
  const logout = async () => { await api('/auth/logout', post({})); await Promise.all([refreshUser(), refreshCart(), refreshWishlist()]); };
  return <CommerceContext.Provider value={{ cart, cartCount: cart.items.reduce((sum, item) => sum + item.quantity, 0), cartOpen, openCart, closeCart, user, loading, connectionError, wishlist, config, refreshCart, refreshUser, refreshWishlist, refreshConfig, addToCart, updateQuantity, removeItem, applyCoupon, removeCoupon, toggleWishlist, logout }}>{children}</CommerceContext.Provider>;
}
export function useCommerce() { const value = useContext(CommerceContext); if (!value) throw new Error('useCommerce requires CommerceProvider'); return value; }

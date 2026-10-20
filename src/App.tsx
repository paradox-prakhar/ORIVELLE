import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { CommerceProvider } from './commerce/context';
import { CartDrawer } from './commerce/CartDrawer';
import './commerce/commerce.css';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { CustomCursor } from './components/CustomCursor';
import { useSmoothScroll } from './hooks/useMotion';
import Home from './pages/Home';
import Policy from './pages/Policy';
import { ScrollProgress } from './components/ScrollProgress';

const AdminPage = lazy(() => import('./admin/AdminPage'));
const ShopPage = lazy(() => import('./commerce/ShopPage').then(module => ({ default: module.ShopPage })));
const ProductPage = lazy(() => import('./commerce/ProductPage').then(module => ({ default: module.ProductPage })));
const CheckoutPage = lazy(() => import('./commerce/CheckoutPage').then(module => ({ default: module.CheckoutPage })));
const AccountPage = lazy(() => import('./commerce/AccountPage').then(module => ({ default: module.AccountPage })));
const WishlistPage = lazy(() => import('./commerce/WishlistPage').then(module => ({ default: module.WishlistPage })));
function Site() {
  const location = useLocation();
  const admin = location.pathname.startsWith('/admin');
  const Main = admin ? 'div' : 'main';
  useSmoothScroll();
  useEffect(() => {
    if (location.hash) { const frame = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView()); return () => cancelAnimationFrame(frame); }
    else window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = location.pathname === '/' ? 'ORIVELLE — A different kind of everyday' : `ORIVELLE — ${location.pathname.split('/')[1].replace(/^./, x => x.toUpperCase())}`;
  }, [location.pathname, location.hash]);
  return <><a href="#main-content" className="skip-link">Skip to content</a><div id="top" />{!admin && <><Navigation /><ScrollProgress /></>}<Main id="main-content" className={location.pathname === '/' || admin ? '' : 'inner-page'}><Suspense fallback={<div className="page-loading">Opening the studio…</div>}><Routes><Route path="/" element={<Home />} /><Route path="/shop" element={<ShopPage />} /><Route path="/product/:slug" element={<ProductPage />} /><Route path="/checkout" element={<CheckoutPage />} /><Route path="/account/*" element={<AccountPage />} /><Route path="/wishlist" element={<WishlistPage />} /><Route path="/admin/*" element={<AdminPage />} /><Route path="/policies" element={<Policy />} /><Route path="/policies/:page" element={<Policy />} /><Route path="/policy" element={<Policy />} /><Route path="/policy/:page" element={<Policy />} /><Route path="*" element={<section className="policy-page"><p className="eyebrow">404 / A SMALL DETOUR</p><h1>Let’s find your way back.</h1><Link className="text-link" to="/shop">Explore the collection ↗</Link></section>} /></Routes></Suspense></Main>{!admin && <Footer />}<CartDrawer /><CustomCursor /></>;
}
export default function App() { return <CommerceProvider><Site /></CommerceProvider>; }

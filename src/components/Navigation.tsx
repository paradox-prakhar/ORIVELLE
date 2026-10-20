import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, UserRound, ShoppingBag, Menu, X, ArrowUpRight } from 'lucide-react';
import { useCommerce } from '../commerce/context';

export function Navigation() {
  const { cartCount, openCart } = useCommerce();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => { const scroll = () => ref.current?.classList.toggle('nav-scrolled', window.scrollY > 50); scroll(); window.addEventListener('scroll', scroll, { passive: true }); return () => window.removeEventListener('scroll', scroll); }, []);
  useEffect(() => { setMenu(false); }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const old = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const main = document.getElementById('main-content');
    const footer = document.querySelector('footer');
    if (main) main.inert = true;
    if (footer) footer.inert = true;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenu(false); menuToggle.current?.focus(); }
      if (e.key === 'Tab') {
        const links = [...document.querySelectorAll<HTMLElement>('#mobile-navigation a')];
        const first = menuToggle.current, last = links.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = old; if (main) main.inert = false; if (footer) footer.inert = false; document.removeEventListener('keydown', key); };
  }, [menu]);
  return <>
    <div className="announcement">AUTUMN / WINTER 2026 <span>—</span> THE ATELIER CAPSULE COLLECTION IS NOW AVAILABLE <ArrowUpRight size={10} /></div>
    <header ref={ref} className={`site-nav ${pathname !== '/' || menu ? 'nav-dark' : ''}`}>
      <Link to="/" className="brand" aria-label="Orivelle home"><span className="brand-symbol">◌</span> ORIVELLE<span className="brand-korean">ATELIER</span></Link>
      <nav className="desktop-nav" aria-label="Main navigation"><Link to="/shop">The collection</Link><a href="/#story">Our story</a><a href="/#journal">The journal</a></nav>
      <div className="nav-actions"><Link to="/shop?search=1" aria-label="Search the collection"><Search size={18} strokeWidth={1.3} /></Link><Link className="account-link" to="/account" aria-label="Your account"><UserRound size={18} strokeWidth={1.3} /></Link><button onClick={openCart} className="bag-button" aria-label={`Open shopping bag, ${cartCount} items`}><ShoppingBag size={18} strokeWidth={1.3} /><span>Bag ({cartCount})</span></button><button ref={menuToggle} className="menu-button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="mobile-navigation" aria-label={menu ? 'Close menu' : 'Open menu'}>{menu ? <X size={22} /> : <Menu size={22} />}</button></div>
    </header>
    {menu && <nav id="mobile-navigation" className="mobile-menu" aria-label="Mobile navigation"><span className="eyebrow">THE WORLD OF ORIVELLE</span><Link to="/shop">The collection <ArrowUpRight /></Link><a onClick={() => setMenu(false)} href="/#story">Our story <ArrowUpRight /></a><a onClick={() => setMenu(false)} href="/#journal">The journal <ArrowUpRight /></a><Link to="/account">Your account <ArrowUpRight /></Link><Link to="/wishlist">Saved pieces <ArrowUpRight /></Link><small>ORIVELLE ATELIER · CONSIDERED SILHOUETTES</small></nav>}
  </>;
}

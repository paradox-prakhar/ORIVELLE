import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Boxes, History, LayoutDashboard, LogOut, Menu, Package, RotateCcw, Settings as SettingsIcon, ShieldCheck, ShoppingBag, TicketPercent, Users, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useResource, type User } from './api'
import { useCommerce } from '../commerce/context'
import { ErrorState, Loading } from './components'
import Overview from './Overview'
import Products from './Products'
import Orders from './Orders'
import Inventory from './Inventory'
import Returns from './Returns'
import AuditLog from './AuditLog'
import { Coupons, Customers, Settings } from './StoreManagement'
import './admin.css'

const navigation = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { path: '/admin/customers', label: 'Customers', icon: Users },
  { path: '/admin/coupons', label: 'Discounts', icon: TicketPercent },
  { path: '/admin/returns', label: 'Returns', icon: RotateCcw },
  { path: '/admin/audit', label: 'Audit trail', icon: History },
  { path: '/admin/settings', label: 'Settings', icon: SettingsIcon },
]

export default function AdminPage() {
  const auth = useResource<{ user: User | null }>('/auth/me')
  const location = useLocation()
  const navigate = useNavigate()
  const commerce = useCommerce()
  const sidebar = useRef<HTMLElement>(null)
  const [menu, setMenu] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const path = location.pathname.replace(/\/$/, '')
  const current = navigation.find(item => item.path === path)
  useEffect(() => { setMenu(false) }, [location.pathname])
  useEffect(() => {
    const query = window.matchMedia('(max-width: 850px)')
    const update = () => { setMobile(query.matches); if (!query.matches) setMenu(false) }
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!menu) return
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false) }
    window.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape); focused?.focus() }
  }, [menu])
  async function logout() { setLoggingOut(true); setLogoutError(''); try { await commerce.logout(); navigate('/account') } catch (error) { setLogoutError((error as Error).message) } finally { setLoggingOut(false) } }
  if (auth.loading) return <div className="admin-app ad-access"><Loading /></div>
  if (auth.error) return <div className="admin-app ad-access"><ErrorState message={auth.error} retry={auth.reload} /><Link to="/">Return to the store</Link></div>
  if (!auth.data?.user || auth.data.user.role !== 'admin') return <div className="admin-app ad-access"><Link to="/" className="ad-access-brand">ORIVELLE<span>ATELIER</span></Link><div className="ad-access-card"><ShieldCheck size={32} strokeWidth={1.25} /><p className="ad-eyebrow">THE ORIVELLE ATELIER</p><h1>A space for your store.</h1><p>{auth.data?.user ? 'This account does not have administrator access. Sign in with your store administrator account to continue.' : 'Sign in with your administrator account to care for your collection, customers and orders.'}</p><Link to="/account" className="ad-button">Go to sign in <ArrowUpRight size={16} /></Link><div className="ad-access-note"><strong>Setting up your store?</strong><p>Create your first administrator with the server’s provisioning command and your own credentials. The store does not include a default administrator password.</p></div></div><Link to="/" className="ad-text-button"><ArrowLeft size={15} /> Back to the collection</Link></div>
  const user = auth.data.user
  const screen = path === '/admin' ? <Overview /> : path === '/admin/products' ? <Products /> : path === '/admin/orders' ? <Orders /> : path === '/admin/inventory' ? <Inventory /> : path === '/admin/customers' ? <Customers /> : path === '/admin/coupons' ? <Coupons /> : path === '/admin/returns' ? <Returns /> : path === '/admin/audit' ? <AuditLog /> : path === '/admin/settings' ? <Settings /> : <div className="ad-state"><h1>This page has moved.</h1><Link className="ad-button" to="/admin">Back to overview</Link></div>
  return <div className="admin-app"><a href="#admin-content" className="ad-skip-link">Skip to content</a>{menu && <button className="ad-menu-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)} />}<aside ref={sidebar} className={`ad-sidebar ${menu ? 'ad-sidebar-open' : ''}`} aria-label="Store administration" inert={mobile && !menu}><div className="ad-sidebar-brand"><Link to="/admin">ORIVELLE<span>ATELIER</span></Link><button className="ad-icon-button ad-mobile-only" aria-label="Close navigation" onClick={() => setMenu(false)}><X size={20} /></button></div><div className="ad-store-label"><span className="ad-store-dot" /> THE ATELIER<span>ADMIN</span></div><nav className="ad-nav">{navigation.map(item => <Link to={item.path} key={item.path} className={path === item.path ? 'ad-nav-active' : ''} aria-current={path === item.path ? 'page' : undefined}><item.icon size={18} strokeWidth={1.5} /><span>{item.label}</span>{path === item.path && <span className="ad-nav-dot" />}</Link>)}</nav><div className="ad-sidebar-bottom"><div className="ad-storefront-card"><p>Made with intention.<br />Managed with care.</p><Link to="/">Visit your storefront <ArrowUpRight size={15} /></Link></div><div className="ad-profile"><span className="ad-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>Store administrator</small></div><button className="ad-icon-button" aria-label="Sign out" disabled={loggingOut} onClick={logout}><LogOut size={17} /></button></div>{logoutError && <p className="ad-logout-error" role="alert">{logoutError}</p>}</div></aside><div className="ad-main" inert={mobile && menu}><header className="ad-topbar"><div><button className="ad-icon-button ad-mobile-only" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={21} /></button><span className="ad-breadcrumb">Store <span>/</span> <strong>{current?.label || 'Page'}</strong></span></div><div className="ad-topbar-right"><span className="ad-secure"><ShieldCheck size={14} /> Secure workspace</span><Link to="/" aria-label="Open storefront"><ArrowUpRight size={18} /></Link></div></header><div id="admin-content" className="ad-content" key={path}>{screen}</div><footer className="ad-footer"><span>ORIVELLE / THE ATELIER</span><span>Thoughtfully made. Carefully managed.</span></footer></div></div>
}





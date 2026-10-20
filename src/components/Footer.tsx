import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { MotionControl } from './MotionControl';

export function Footer() {
  return <footer className="site-footer"><div className="footer-top"><div><Link to="/" className="footer-brand">ORIVELLE<span>ATELIER</span></Link><p>Architectural tailoring & noble textiles.<br />Quiet luxury for everyday living.</p></div><div className="footer-links"><div><h3>EXPLORE</h3><Link to="/shop">The collection</Link><a href="/#story">Our story</a><a href="/#journal">The journal</a><Link to="/wishlist">Saved pieces</Link></div><div><h3>HERE TO HELP</h3><Link to="/account">Your account & orders</Link><Link to="/policies/shipping">Shipping & returns</Link><Link to="/policies/care">Care guide</Link><a href="/#questions">Frequently asked questions</a></div><div><h3>THE STUDIO</h3><Link to="/admin">Store administration <ArrowUpRight size={12} /></Link><Link to="/policies/privacy">Privacy notice</Link><Link to="/policies/terms">Terms of use</Link></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ORIVELLE. ALL RIGHTS RESERVED.</span><span>DEMONSTRATION STORE · INDIA / INR ₹</span><MotionControl /><a href="#top">BACK TO TOP ↑</a></div></footer>;
}

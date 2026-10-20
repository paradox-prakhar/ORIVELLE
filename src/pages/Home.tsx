import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, PackageCheck, ScanLine, MoveUpRight, Sprout } from 'lucide-react';
import { Hero } from '../components/Hero';
import { Collection } from '../components/Collection';
import { Editorial } from '../components/Editorial';
import { Journal } from '../components/Journal';
import { Newsletter } from '../components/Newsletter';
import { useReveal } from '../hooks/useMotion';
import { useAmbientMotion } from '../hooks/useAmbientMotion';

export default function Home() {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);
  useAmbientMotion(ref);
  return <div ref={ref} className="home"><Hero /><div data-ambient className="concept-ribbon" aria-label="Jeong connection, Han depth, Meot style, Nunchi awareness"><div className="concept-track">{[0, 1, 2].map(i => <span key={i} aria-hidden={i > 0}><b>정</b> JEONG — CONNECTION <i>✳</i><b>한</b> HAN — DEPTH <i>✳</i><b>멋</b> MEOT — STYLE <i>✳</i><b>눈치</b> NUNCHI — AWARENESS <i>✳</i></span>)}</div></div><Collection /><Editorial /><Journal />
    <section className="values section-pad"><div className="values-heading"><p className="eyebrow">THE DETAILS MAKE THE DIFFERENCE</p><h2>Considered, <em>from the start.</em></h2></div><div className="values-grid">{[
      { icon: ScanLine, title: 'Know your piece', text: 'Fabric, fit, and care details on every product. A little more clarity before you choose.', link: '/shop' },
      { icon: Sprout, title: 'Wear. Care. Repeat.', text: 'Simple ways to look after the pieces you love, season after season.', link: '/policies/care' },
      { icon: PackageCheck, title: 'Every step, in view', text: 'Shipping costs before checkout. Order status in your account. Nothing left to guess.', link: '/policies/shipping' },
      { icon: MoveUpRight, title: 'Space to make it yours', text: 'Save your favourites. Find your size. Build a wardrobe at your own pace.', link: '/wishlist' },
    ].map(({ icon: Icon, title, text, link }, i) => <Link to={link} className="value-item" key={title} data-reveal><div><Icon size={24} strokeWidth={1} /><span>0{i + 1}</span></div><h3>{title}</h3><p>{text}</p><ArrowUpRight size={16} /></Link>)}</div></section>
    <Newsletter /><section id="questions" className="faq section-pad"><div><p className="eyebrow">A LITTLE MORE CLARITY</p><h2>Still have<br /><em>questions?</em></h2><Link className="text-link" to="/account">Your account & orders <ArrowUpRight size={16} /></Link></div><div className="faq-list">{[
      ['Is this a live clothing store?', 'This is a working demonstration store. Products and prices are sample data, and the supplied campaign photograph is illustrative. Cash-on-delivery orders are stored locally for testing; they do not trigger shipping or charge you.'],
      ['How do I find my size?', 'Choose a piece to see its available sizes and stock. This demonstration uses standard XS–XL labels where available; exact garment measurements must be added with the final product catalog.'],
      ['Where do you ship?', 'The demo checkout accepts Indian addresses and six-digit PIN codes. Shipping and tax are calculated on the server and shown before you place an order. See Shipping & returns for the demonstration policy.'],
      ['Can I return or cancel an order?', 'You can cancel an eligible, unshipped demonstration order from your account. Real return windows, shipping timelines, and refund terms must be configured before launch.'],
    ].map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
  </div>;
}

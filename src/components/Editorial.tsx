import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { assets } from '../lib/assets';
import { useCursorTilt } from '../hooks/useMotion';
import { Media } from './Media';

export function Editorial() {
  const container = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null);
  useCursorTilt(container, card);
  return <section id="story" className="editorial">
    <div className="editorial-art" ref={container}><span className="editorial-season">A study in everyday dressing, No. 01</span><div className="editorial-card" ref={card}><Media src={assets.campaign} alt="Maison Veil Dusk Collection — campaign image" loading="lazy" /><span>ORIVELLE / AN EVERYDAY STUDY</span></div><span className="editorial-art-foot">SEOUL, IN SPIRIT.</span></div>
    <div className="editorial-copy" data-reveal><p className="eyebrow">THE ORIVELLE WAY</p><h2>Less noise.<br /><em>More feeling.</em></h2><span className="short-rule" /><p>There’s a feeling between the old and the new. In Seoul’s side streets. In the soft lines of a hanbok. In the unhurried rhythm of a morning by the sea.</p><p>That’s where our collection begins. Considered shapes, easy layers, and pieces that leave room for you.</p><Link to="/shop" className="text-link">Find your everyday <ArrowUpRight size={17} /></Link><span className="editorial-korean" aria-hidden="true">한빛</span></div>
  </section>;
}

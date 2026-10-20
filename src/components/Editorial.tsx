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
    <div className="editorial-art" ref={container}><span className="editorial-season">ATELIER ARCHIVE · SILHOUETTE STUDY NO. 01</span><div className="editorial-card" ref={card}><Media src={assets.campaign} alt="Orivelle Atelier Autumn / Winter Campaign" loading="lazy" /><span>ORIVELLE ATELIER / FORM & TEXTURE</span></div><span className="editorial-art-foot">CRAFTED IN PURSUIT OF LONGEVITY</span></div>
    <div className="editorial-copy" data-reveal><p className="eyebrow">THE ATELIER PHILOSOPHY</p><h2>Less noise.<br /><em>More feeling.</em></h2><span className="short-rule" /><p>True luxury is revealed in the quiet details: the weight of a natural weave, the clean line of a dropped shoulder, and the graceful drape that moves effortlessly with the body.</p><p>Every garment is shaped with architectural restraint and tactile nobility—unrushed pieces designed to form the foundation of an enduring modern wardrobe.</p><Link to="/shop" className="text-link">Explore the collection <ArrowUpRight size={17} /></Link><span className="editorial-korean" aria-hidden="true">衣</span></div>
  </section>;
}

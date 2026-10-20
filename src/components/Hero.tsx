import { useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { assets, campaignBackdrop } from '../lib/assets';
import { useCursorTilt, useParallax } from '../hooks/useMotion';
import { PolaroidStrip } from './PolaroidStrip';
import { Media } from './Media';

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const campaign = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useParallax(ref);
  useCursorTilt(campaign, card);
  const onError = (event: React.SyntheticEvent<HTMLImageElement>) => { event.currentTarget.style.visibility = 'hidden'; setFailed(true); };
  return <section className={`hero ${failed ? 'hero-fallback' : ''}`} ref={ref} style={{'--campaign-backdrop': `url("${campaignBackdrop}")`} as CSSProperties} aria-labelledby="hero-title" data-ambient>
    <div className="hero-sky plane" data-speed="0.12"><img src={assets.sky} alt="Dawn sky over the Korean peninsula" onError={onError} fetchPriority="high" /></div>
    <div className="hero-ridge plane" data-speed="0.24"><img src={assets.ridge} alt="Granite ridges of Seoraksan above a sea of cloud at dawn" onError={onError} fetchPriority="high" /></div>
    <div className="hero-word plane" data-speed="0.38" aria-hidden="true"><span>ORIVELLE</span></div>
    <div className="hero-silhouette plane" data-speed="0.24"><img src={assets.silhouette} alt="" onError={onError} /></div>
    <div className="hero-figure plane" data-speed="0.16"><img src={assets.figure} alt="A woman in hanbok looking out over the valley" onError={onError} /></div>
    <div className="hero-topline"><span><i /> ORIVELLE ATELIER — CONTEMPORARY READY-TO-WEAR</span><span>EDITION NO. 01 — AUTUMN / WINTER 2026</span></div>
    <div className="hero-copy"><p className="eyebrow">ORIVELLE ATELIER · CONTEMPORARY SILHOUETTES</p><h1 id="hero-title"><span className="hero-line"><span>A different kind</span></span><span className="hero-line"><em>of everyday.</em></span></h1><p>Quiet silhouettes. Tactile materiality.<br />Discover a wardrobe crafted with quiet confidence.</p><Link className="light-button" to="/shop">Explore the collection <ArrowUpRight size={16} /></Link></div>
    <div className="hero-campaign" ref={campaign}><div className="hero-campaign-card" ref={card}><Link to="/shop" aria-label="Discover Orivelle collection 01"><Media src={assets.campaign} alt="Orivelle collection inspiration — supplied fashion campaign photograph" fetchPriority="high" /><span className="campaign-card-caption">ORIVELLE / AUTUMN ATELIER STUDY <ArrowUpRight size={13} /></span></Link></div><span className="campaign-side-label">SCULPTED SILHOUETTES · NOBLE FIBRES · TIMELESS EASE</span></div>
    <div className="hero-caption"><span>TAILORING · KNITWEAR · ESSENTIALS</span><p>Architectural lines.<br />Pieces made to live in.</p></div>
    <PolaroidStrip />
    <a className="hero-scroll" href="#collection"><span>SCROLL TO DISCOVER</span><ArrowDown size={17} /></a>
    {failed && <span className="hero-media-note">Landscape layers unavailable · fashion campaign shown</span>}
  </section>;
}

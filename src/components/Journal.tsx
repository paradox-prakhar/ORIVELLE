import { ArrowUpRight, Globe, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Media } from './Media';

export interface RegionalGarment {
  country: string;
  garment: string;
  role: string;
  image: string;
  caption: string;
  badge: string;
  slug: string;
}

export interface RegionalStudy {
  num: string;
  sub: string;
  region: string;
  title: string;
  text: string;
  edit: string;
  category: string;
  garments: [RegionalGarment, RegionalGarment];
}

const studies: RegionalStudy[] = [
  {
    num: '01',
    sub: 'REGIONAL STUDY 01 — EAST ASIA',
    region: 'South Korea & Japan',
    title: 'Hanbok & Kimono',
    text: 'South Korea’s Hanbok (한복) features flowing jeogori and billowed chima skirts designed to celebrate natural body curves and ceremonial ease. In parallel, Japan’s Kimono (着物) and Obi showcase straight-line geometry, noble woven silks, and centuries of meditative artisanal textile discipline.',
    edit: 'Explore fluid silhouettes & dresses',
    category: 'Dresses',
    garments: [
      {
        country: 'South Korea',
        garment: 'Hanbok (한복)',
        role: 'Traditional Korean Hanbok silk dress with flowing chima silhouette',
        image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
        caption: 'SOUTH KOREA / HANBOK SILK DRAPE',
        badge: 'SOUTH KOREA',
        slug: 'korean-hanbok-silk-dress',
      },
      {
        country: 'Japan',
        garment: 'Kimono & Obi (着物)',
        role: 'Traditional Japanese hand-woven silk Kimono and ceremonial Obi',
        image: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
        caption: 'JAPAN / CEREMONIAL WOVEN KIMONO',
        badge: 'JAPAN',
        slug: 'ceremonial-woven-kimono',
      },
    ],
  },
  {
    num: '02',
    sub: 'REGIONAL STUDY 02 — SOUTH ASIA & NORTH AFRICA',
    region: 'India & Morocco',
    title: 'Sari & Djellaba',
    text: 'India’s handloom Mulberry silk Sari (साड़ी) spans six to nine continuous yards of unstitched silk woven with metallic zari, worn across wedding rituals and daily elegance. Morocco’s hooded Djellaba (جلابة) and silk caftans provide breathable, protective volume tailored for Atlas Mountain winds and Mediterranean breezes.',
    edit: 'Discover noble weaves & tops',
    category: 'Tops',
    garments: [
      {
        country: 'India',
        garment: 'Banarasi & Kanjeevaram Sari (साड़ी)',
        role: 'Authentic Indian handloom silk sari with gold zari borders',
        image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
        caption: 'INDIA / HANDLOOM ZARI SILK SARI',
        badge: 'INDIA',
        slug: 'banarasi-zari-silk-sari',
      },
      {
        country: 'Morocco',
        garment: 'Djellaba & Caftan (جلابة)',
        role: 'Moroccan hooded wool and linen djellaba with artisan braided trim',
        image: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
        caption: 'MOROCCO / ATLAS DESERT DJELLABA',
        badge: 'MOROCCO',
        slug: 'moroccan-artisan-djellaba',
      },
    ],
  },
  {
    num: '03',
    sub: 'REGIONAL STUDY 03 — EUROPE & UK',
    region: 'Scotland & France',
    title: 'Highland Tartan & Haute Couture',
    text: 'Scotland’s resilient worsted wool Tartan kilts and heavy tweed doublets were engineered to withstand rugged Atlantic coastal mists while denoting ancestral clan pride. Across the Channel, Parisian Haute Couture elevated architectural shoulder canvassing, razor-sharp lapels, and timeless monochrome luxury.',
    edit: 'Curate tailored outerwear & knitwear',
    category: 'Outerwear',
    garments: [
      {
        country: 'Scotland (UK)',
        garment: 'Highland Worsted Wool Tartan',
        role: 'Scottish highland pleated tartan kilt woven from pure heritage wool',
        image: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
        caption: 'SCOTLAND / HIGHLAND CLAN TARTAN',
        badge: 'SCOTLAND, UK',
        slug: 'highland-worsted-wool-tartan',
      },
      {
        country: 'France',
        garment: 'Parisian Haute Couture Tailoring',
        role: 'French architectural bespoke tailored eveningwear in fine wool crepe',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
        caption: 'FRANCE / PARISIAN ATELIER COUTURE',
        badge: 'FRANCE',
        slug: 'parisian-couture-blazer',
      },
    ],
  },
];

export function Journal() {
  return (
    <section id="journal" className="journal section-pad">
      <div className="section-heading" data-reveal>
        <div>
          <p className="eyebrow"><span className="orange-dot" /> ATELIER FIELD NOTES · GLOBAL SARTORIAL ARCHIVE</p>
          <h2>World Attire &amp;<br /><em>Regional Cloth Heritage.</em></h2>
        </div>
        <div className="journal-header-right">
          <p className="section-aside">
            A study of iconic garments from different regions of the world—<br />
            celebrating the fabrics, lineages, and cultures that wear them.
          </p>
          <Link to="/shop" className="text-link journal-header-link">
            Explore entire heritage archive <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      <div className="journal-grid">
        {studies.map((study) => (
          <article key={study.title} className="journal-story" data-reveal>
            <div className="journal-photos">
              {study.garments.map((g) => (
                <figure key={g.country} className="journal-polaroid" title={`Click to follow up and shop ${g.garment}`}>
                  <Link to={`/product/${g.slug}`} className="journal-polaroid-link" aria-label={`View and shop ${g.garment} from ${g.country}`}>
                    <div className="journal-polaroid-img-wrap">
                      <Media src={g.image} alt={`${g.garment} from ${g.country} — ${g.role}`} loading="lazy" />
                      <span className="journal-country-badge">{g.badge}</span>
                      <span className="journal-shop-pill">
                        Follow Up Piece <ArrowUpRight size={10} />
                      </span>
                    </div>
                    <figcaption>{g.caption}</figcaption>
                  </Link>
                </figure>
              ))}
            </div>

            <div className="journal-number">
              <span>{study.num}</span>
              <span>{study.sub}</span>
            </div>

            <div className="journal-region-tag">
              <Globe size={13} />
              <span>{study.region}</span>
            </div>

            <h3>{study.title}</h3>
            <p>{study.text}</p>

            <div className="journal-heritage-followup">
              <span className="journal-followup-lead">
                <Sparkles size={11} /> FOLLOW UP &amp; SHOP HERITAGE PIECES:
              </span>
              <div className="journal-garment-pills">
                {study.garments.map((g) => (
                  <Link
                    key={g.slug}
                    to={`/product/${g.slug}`}
                    className="journal-garment-pill"
                    title={`Follow up ${g.garment} (${g.country})`}
                  >
                    <span className="journal-pill-badge">{g.badge}</span>
                    <span className="journal-pill-title">{g.garment}</span>
                    <ArrowUpRight size={13} className="journal-pill-arrow" />
                  </Link>
                ))}
              </div>
            </div>

            <Link to={`/shop?category=${encodeURIComponent(study.category)}`} className="text-link">
              {study.edit} <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

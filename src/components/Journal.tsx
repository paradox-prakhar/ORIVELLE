import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assets } from '../lib/assets';
import { Media } from './Media';

const stories = [
  { title: 'Seoul', sub: 'THE ENERGY OF CONTRAST', text: 'Palace courtyards at opening hour, the print shops of Euljiro, a late bowl of noodles under signage older than we are. One dawn hike up Inwangsan.', edit: 'Structure, softened. Meet the city edit.', category: 'Outerwear' },
  { title: 'Jeonju & Gyeongju', sub: 'A SLOWER KIND OF BEAUTY', text: 'A night on a heated floor in a hanok, bibimbap where it was invented, then the Silla tombs and stone pagodas of Gyeongju under falling blossom.', edit: 'Easy layers, made for a slower pace.', category: 'Knitwear' },
  { title: 'Busan', sub: 'WHERE THE CITY EXHALES', text: 'Jagalchi market at 6am, the painted terraces of Gamcheon, a temple built on the rocks above the sea, and two unplanned days that are yours.', edit: 'Room to move. Discover everyday essentials.', category: 'Essentials' },
];
export function Journal() {
  return <section id="journal" className="journal section-pad"><div className="section-heading" data-reveal><div><p className="eyebrow"><span className="orange-dot" /> FIELD NOTES FROM KOREA</p><h2>Somewhere between<br /><em>a place and a feeling.</em></h2></div><p className="section-aside">The places behind the pieces.<br />A journey from north to south.</p></div>
    <div className="journal-grid">{stories.map((story, i) => <article key={story.title} className="journal-story" data-reveal><div className="journal-photos"><figure><Media src={assets.cities[i * 2].url} alt={assets.cities[i * 2].role} loading="lazy" /><figcaption>35° — 37° N / SOUTH KOREA</figcaption></figure><figure><Media src={assets.cities[i * 2 + 1].url} alt={assets.cities[i * 2 + 1].role} loading="lazy" /><figcaption>ORIVELLE FIELD NOTES / 0{i + 1}</figcaption></figure></div><div className="journal-number"><span>0{i + 1}</span><span>{story.sub}</span></div><h3>{story.title}</h3><p>{story.text}</p><Link to={`/shop?category=${encodeURIComponent(story.category)}`} className="text-link">{story.edit} <ArrowUpRight size={16} /></Link></article>)}</div>
  </section>;
}

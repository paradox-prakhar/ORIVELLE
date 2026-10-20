import { Media } from './Media';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

import { clothingPieces, type ClothingPiece } from '../lib/assets';

function Polaroid({ piece, index }: { piece: ClothingPiece; index: number }) {
  return (
    <Link
      to={`/product/${piece.slug}`}
      className="polaroid"
      aria-label={`${piece.tag}: ${piece.title}. ${piece.fabric}. ${piece.description}`}
    >
      <span className="polaroid-frame">
        <Media src={piece.image} alt={`${piece.title} — illustrative campaign photograph`} loading="lazy" />
        <span className="polaroid-tag">{piece.tag}</span>
        <span className="polaroid-view" aria-hidden="true">
          <ArrowUpRight size={11} strokeWidth={2.4} />
        </span>
      </span>
      <span className="polaroid-caption">
        <span>{piece.title}</span>
        <span>0{index + 1}</span>
      </span>
      <span className="polaroid-fabric">{piece.fabric}</span>
      <p className="polaroid-desc">{piece.description}</p>
    </Link>
  );
}

export function PolaroidStrip() {
  return (
    <div className="polaroid-window" data-lenis-prevent>
      <div className="polaroid-strip" data-speed="0.4" data-axis="x">
        {clothingPieces.map((piece, i) => (
          <Polaroid key={piece.id} piece={piece} index={i} />
        ))}
      </div>
    </div>
  );
}

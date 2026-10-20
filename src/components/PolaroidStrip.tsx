import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { assets } from '../lib/assets';

const moments = ['Palace mornings', 'After hours, Seoul', 'A little colour', 'At the same table', 'Busan, by night'];
function Polaroid({ src, label, index }: { src: string; label: string; index: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const pause = () => { video.pause(); playingRef.current = false; setPlaying(false); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) pause();
      else if (!motion.matches && !document.hidden && !video.dataset.primed) {
        video.dataset.primed = 'true';
        // Decode the first frame, then remain still until a real interaction.
        video.play().then(() => { if (!playingRef.current) video.pause(); }).catch(() => {});
      }
    });
    const visibility = () => { if (document.hidden) pause(); };
    observer.observe(video); document.addEventListener('visibilitychange', visibility); motion.addEventListener('change', pause);
    return () => { video.pause(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', pause); };
  }, []);
  const play = () => { if (failed || document.hidden) return; playingRef.current = true; ref.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); };
  const pause = () => { playingRef.current = false; ref.current?.pause(); setPlaying(false); };
  return <button className="polaroid" onPointerEnter={e => { if (e.pointerType === 'mouse' && !matchMedia('(prefers-reduced-motion: reduce)').matches) play(); }} onPointerLeave={e => { if (e.pointerType === 'mouse') pause(); }} onBlur={pause} onClick={() => playing ? pause() : play()} aria-label={`${playing ? 'Pause' : 'Play'} ${label} film`} aria-pressed={playing}>
    <span className="polaroid-frame"><video ref={ref} src={src} muted loop playsInline preload="metadata" onError={() => setFailed(true)} aria-label={label} />{failed && <span className="video-error">Film unavailable</span>}<span className="polaroid-play">{playing ? <Pause size={12} /> : <Play size={12} />}</span></span>
    <span className="polaroid-caption"><span>{label}</span><span>0{index + 1}</span></span>
  </button>;
}
export function PolaroidStrip() {
  return <div className="polaroid-window" data-lenis-prevent><div className="polaroid-strip" data-speed="0.4" data-axis="x">{assets.videos.map((src, i) => <Polaroid key={src} src={src} label={moments[i]} index={i} />)}</div></div>;
}

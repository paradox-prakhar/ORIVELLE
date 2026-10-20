import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cursor = ref.current;
    if (!cursor) return;
    const media = matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
    let x = -100, y = -100, tx = -100, ty = -100, raf = 0, visible = false;
    const frame = () => { x += (tx - x) * .18; y += (ty - y) * .18; cursor.style.transform = `translate3d(${x}px,${y}px,0)`; if (Math.abs(tx - x) + Math.abs(ty - y) > .1) raf = requestAnimationFrame(frame); else raf = 0; };
    const move = (event: PointerEvent) => {
      if (!media.matches || document.hidden || document.documentElement.dataset.motion === 'off') return;
      tx = event.clientX; ty = event.clientY;
      if (!visible) { x = tx; y = ty; visible = true; cursor.style.opacity = '1'; }
      cursor.classList.toggle('is-hovering', !!(event.target as Element)?.closest('a,button,input,select,textarea,summary'));
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const hide = () => { cursor.style.opacity = '0'; visible = false; cancelAnimationFrame(raf); raf = 0; };
    document.addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', hide); document.addEventListener('visibilitychange', hide); media.addEventListener('change', hide); window.addEventListener('orivelle-motion', hide);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', hide); document.removeEventListener('visibilitychange', hide); media.removeEventListener('change', hide); window.removeEventListener('orivelle-motion', hide); };
  }, []);
  return <div className="custom-cursor" ref={ref} aria-hidden="true"><span /></div>;
}

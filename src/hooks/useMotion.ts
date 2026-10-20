import { useEffect, type RefObject } from 'react';
import Lenis from 'lenis';

function motionPaused() { return document.documentElement.dataset.motion === 'off'; }

export function useSmoothScroll() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lenis: Lenis | undefined;
    let frame = 0;
    const tick = (time: number) => { lenis?.raf(time); frame = requestAnimationFrame(tick); };
    const stop = () => { cancelAnimationFrame(frame); lenis?.destroy(); lenis = undefined; };
    const start = () => {
      stop();
      if (media.matches || motionPaused() || document.hidden) return;
      lenis = new Lenis({ duration: 1.2, smoothWheel: true, syncTouch: false, anchors: true, prevent: node => node.hasAttribute('data-lenis-prevent') });
      frame = requestAnimationFrame(tick);
    };
    start();
    media.addEventListener('change', start);
    window.addEventListener('orivelle-motion', start);
    document.addEventListener('visibilitychange', start);
    return () => { stop(); media.removeEventListener('change', start); window.removeEventListener('orivelle-motion', start); document.removeEventListener('visibilitychange', start); };
  }, []);
}

/** Pure scroll position drives the planes in either direction; no render per frame. */
export function useParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = true;
    const planes = [...root.querySelectorAll<HTMLElement>('[data-speed]')];
    const draw = () => {
      frame = 0;
      if (document.hidden || !visible) return;
      const offset = Math.max(0, -root.getBoundingClientRect().top);
      for (const plane of planes) {
        const distance = media.matches || motionPaused() ? 0 : offset * Number(plane.dataset.speed);
        plane.style.transform = plane.dataset.axis === 'x' ? `translate3d(${-distance}px,0,0)` : `translate3d(0,${distance}px,0)`;
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) schedule(); });
    observer.observe(root);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    media.addEventListener('change', schedule);
    window.addEventListener('orivelle-motion', schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); window.removeEventListener('orivelle-motion', schedule); document.removeEventListener('visibilitychange', schedule); media.removeEventListener('change', schedule); };
  }, [ref]);
}

export function useReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('is-visible', entry.isIntersecting)), { threshold: 0.12 });
    root.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [ref]);
}

export function useCursorTilt(containerRef: RefObject<HTMLElement | null>, cardRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current, card = cardRef.current;
    if (!container || !card) return;
    const media = matchMedia('(prefers-reduced-motion: reduce), (hover: none)');
    let active = false, visible = false, raf = 0, x = 0, y = 0, rx = 0, ry = 0, tx = 0, ty = 0;
    const started = performance.now();
    const move = (e: PointerEvent) => { const r = container.getBoundingClientRect(); tx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width / 2))); ty = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / (r.height / 2))); active = true; };
    const leave = () => { active = false; };
    const tick = (time: number) => {
      const t = time - started;
      const dx = active ? tx * 22 : t > 1200 ? 14 * Math.sin(t / 2400 * Math.PI * 2) : 0;
      const dy = active ? ty * 22 : t > 1200 ? 10 * Math.sin(t / 3100 * Math.PI * 2) : 0;
      x += (dx - x) * .07; y += (dy - y) * .07;
      rx += ((active ? -ty * 4 : dy * .15) - rx) * .07; ry += ((active ? tx * 4 : dx / 7) - ry) * .07;
      card.style.transform = `perspective(800px) translate3d(${x}px,${y}px,0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      raf = requestAnimationFrame(tick);
    };
    const sync = () => { cancelAnimationFrame(raf); if (!media.matches && !motionPaused() && visible && !document.hidden) raf = requestAnimationFrame(tick); else if (media.matches || motionPaused()) card.style.transform = ''; };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(container); container.addEventListener('pointermove', move); container.addEventListener('pointerleave', leave); document.addEventListener('visibilitychange', sync); media.addEventListener('change', sync); window.addEventListener('orivelle-motion', sync);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); container.removeEventListener('pointermove', move); container.removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', sync); media.removeEventListener('change', sync); window.removeEventListener('orivelle-motion', sync); };
  }, [containerRef, cardRef]);
}

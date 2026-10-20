import { useEffect, useRef } from 'react';

/** Reveals once at the viewport edge without a render or a continuous frame loop. */
export function useCommerceReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = false;
    let revealed = false;
    const reveal = () => {
      if (revealed || document.hidden || (!inView && !reduced.matches)) return;
      revealed = true;
      element.classList.add('c-revealed');
      observer.disconnect();
    };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; reveal(); }, {threshold: 0.06});
    element.classList.add('c-reveal-ready');
    observer.observe(element);
    document.addEventListener('visibilitychange', reveal);
    reduced.addEventListener('change', reveal);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', reveal); reduced.removeEventListener('change', reveal); element.classList.remove('c-reveal-ready'); };
  }, []);
  return ref;
}

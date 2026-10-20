import { useEffect, type RefObject } from 'react';

/** Decorative loops only run while their section is visible and the tab is active. */
export function useAmbientMotion(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('ambient-visible', entry.isIntersecting)));
    root.querySelectorAll('[data-ambient]').forEach(element => observer.observe(element));
    const visibility = () => document.documentElement.classList.toggle('page-hidden', document.hidden);
    document.addEventListener('visibilitychange', visibility); visibility();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [ref]);
}

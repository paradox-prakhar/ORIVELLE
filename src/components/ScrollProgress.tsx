import { useEffect, useRef } from 'react';

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      frame = 0;
      const height = document.documentElement.scrollHeight - innerHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${height > 0 ? Math.min(1, Math.max(0, scrollY / height)) : 0})`;
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(schedule); observer.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule); document.addEventListener('visibilitychange', schedule); draw();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); document.removeEventListener('visibilitychange', schedule); };
  }, []);
  return <div ref={ref} className="reading-progress" aria-hidden="true" />;
}

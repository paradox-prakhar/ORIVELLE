import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export function MotionControl() {
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem('orivelle-motion') === 'off'; } catch { return false; } });
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? 'off' : 'on';
    try { localStorage.setItem('orivelle-motion', paused ? 'off' : 'on'); } catch { /* Preference storage is optional. */ }
    window.dispatchEvent(new Event('orivelle-motion'));
  }, [paused]);
  return <button className="motion-control" aria-pressed={paused} onClick={() => setPaused(!paused)} title={paused ? 'Resume decorative motion' : 'Pause decorative motion'}>{paused ? <Play size={10} /> : <Pause size={10} />}<span>{paused ? 'RESUME MOTION' : 'PAUSE MOTION'}</span></button>;
}

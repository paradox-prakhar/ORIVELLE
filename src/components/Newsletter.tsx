import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { assets } from '../lib/assets';

export function Newsletter() {
  const [email, setEmail] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState(false), [failedImage, setFailedImage] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || data.error || 'Unable to save your interest. Please try again.'); setSuccess(true); setMessage('Your interest is saved. Email delivery is not yet configured for this demonstration store.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  };
  return <section className={`newsletter ${failedImage ? 'newsletter-fallback' : ''}`}>
    <img src={assets.closing} className="newsletter-background" alt="Stone pagoda in Gyeongju framed by cherry blossom at sunrise" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; setFailedImage(true); }} />
    <div className="newsletter-panel" data-reveal><p className="eyebrow">A LETTER FROM ORIVELLE</p><h2>Good things<br /><em>take their time.</em></h2><p>New chapters, thoughtful pieces, and a little inspiration from Korea. Join our circle.</p><form onSubmit={submit}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" required maxLength={254} disabled={success} /><button type="submit" disabled={busy || success} aria-label="Join the Orivelle mailing list">{success ? <Check /> : busy ? '…' : <ArrowUpRight />}</button></form><small>By signing up, you agree to our <a href="/policies/privacy">privacy notice</a>.</small>{message && <p role="status" className="newsletter-message">{message}</p>}</div><span className="newsletter-signature" aria-hidden="true">O.</span>
  </section>;
}

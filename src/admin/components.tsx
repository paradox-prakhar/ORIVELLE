import { useEffect, useRef, type ReactNode } from 'react'
import { AlertCircle, Check, Inbox, Loader2, X } from 'lucide-react'

export function Loading() { return <div className="ad-state" role="status"><Loader2 className="ad-spin" size={24} /><p>Loading your store…</p></div> }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="ad-state ad-error" role="alert"><AlertCircle size={24} /><p>{message}</p>{retry && <button className="ad-button ad-button-secondary" onClick={retry}>Try again</button>}</div> }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="ad-state"><Inbox size={28} strokeWidth={1.3} /><h3>{title}</h3><p>{children}</p></div> }
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <div className={`ad-notice ${error ? 'ad-notice-error' : ''}`} role={error ? 'alert' : 'status'}>{error ? <AlertCircle size={16} /> : <Check size={16} />}{children}</div> }
export function Status({ value }: { value: string }) { return <span className={`ad-status ad-status-${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span> }
export function PageHeading({ eyebrow = 'YOUR STORE, CONSIDERED.', title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) { return <div className="ad-page-heading"><div><p className="ad-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="ad-muted">{description}</p></div>{children && <div className="ad-heading-actions">{children}</div>}</div> }
export function Modal({ title, subtitle, children, close, wide = false }: { title: string; subtitle?: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { dialog?.close(); document.body.style.overflow = oldOverflow } }, [])
  return <dialog data-lenis-prevent ref={ref} className={`ad-modal ${wide ? 'ad-modal-wide' : ''}`} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }} aria-labelledby="ad-dialog-title"><div className="ad-modal-head"><div><p className="ad-eyebrow">ORIVELLE / ATELIER</p><h2 id="ad-dialog-title">{title}</h2>{subtitle && <p className="ad-muted">{subtitle}</p>}</div><button className="ad-icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div>{children}</dialog>
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="ad-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label> }
export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) { return <button type="submit" className="ad-button" disabled={busy}>{busy && <Loader2 className="ad-spin" size={15} />}{busy ? 'Saving…' : children}</button> }




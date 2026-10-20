import { useState, type FormEvent } from 'react'
import { Edit3, Search } from 'lucide-react'
import { api, date, useResource, type AuditItem, type Variant } from './api'
import { Empty, ErrorState, Field, Loading, Modal, Notice, PageHeading, Status, SubmitButton } from './components'

function Adjustment({ variant, close, saved }: { variant: Variant; close: () => void; saved: () => void }) {
  const [adjustment, setAdjustment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    if (Number(adjustment) === 0) { setError('Enter a positive or negative quantity to adjust stock.'); return }
    setBusy(true); setError('')
    try { await api(`/admin/inventory/${variant.id}`, { method: 'POST', body: JSON.stringify({ adjustment: Number(adjustment), reason: form.get('reason') }) }); saved() } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <Modal title="Adjust inventory" subtitle={`${variant.productName} · ${variant.size} · ${variant.color}`} close={close}><form className="ad-form" onSubmit={submit}>{error && <Notice error>{error}</Notice>}<div className="ad-inventory-preview"><div><small>Current stock</small><strong>{variant.stock}</strong></div><span>→</span><div><small>After adjustment</small><strong>{variant.stock + Number(adjustment || 0)}</strong></div></div><Field label="Quantity adjustment" hint="Use a positive number for stock received, or a negative number to remove units."><input autoFocus type="number" name="adjustment" min={-variant.stock} step="1" required value={adjustment} onChange={event => setAdjustment(event.target.value)} placeholder="e.g. 12 or -2" /></Field><Field label="Reason" hint="This note is saved to the audit trail."><textarea name="reason" required minLength={3} maxLength={500} rows={3} placeholder="New stock received, stocktake correction…" /></Field><div className="ad-modal-actions"><button type="button" className="ad-button ad-button-secondary" onClick={close}>Cancel</button><SubmitButton busy={busy}>Save adjustment</SubmitButton></div></form></Modal>
}

export default function Inventory() {
  const resource = useResource<{ items: Variant[] }>('/admin/inventory')
  const audit = useResource<{ items: AuditItem[] }>('/admin/audit')
  const [selected, setSelected] = useState<Variant | null>(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const items = (resource.data?.items || []).filter(item => (!lowOnly || item.stock <= 8) && `${item.productName} ${item.sku} ${item.size} ${item.color}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading title="Everything in its place" description="Keep every size accounted for, and every change traceable." />{notice && <Notice>{notice}</Notice>}<div className="ad-panel"><div className="ad-panel-toolbar"><div><span className="ad-panel-title">Stock by variant</span><span className="ad-count">{resource.data?.items.length ?? '—'}</span></div><div className="ad-toolbar-filters"><label className="ad-inline-check"><input type="checkbox" checked={lowOnly} onChange={event => setLowOnly(event.target.checked)} /> Low stock ≤ 8</label><label className="ad-search"><Search size={16} /><input aria-label="Search inventory" placeholder="Product or SKU" value={query} onChange={event => setQuery(event.target.value)} /></label></div></div>{resource.loading ? <Loading /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : !items.length ? <Empty title="No variants to show">Try a different filter, or add sizes to a new product.</Empty> : <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Product / SKU</th><th>Size</th><th>Color</th><th>Available</th><th>Status</th><th><span className="ad-sr-only">Adjust</span></th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.productName}</strong><small className="ad-table-small ad-mono">{item.sku}</small></td><td>{item.size}</td><td>{item.color}</td><td><strong>{item.stock}</strong></td><td><Status value={item.stock === 0 ? 'out_of_stock' : item.stock <= 8 ? 'low_stock' : 'in_stock'} /></td><td><button className="ad-text-button" onClick={() => setSelected(item)} aria-label={`Adjust stock for ${item.sku}`}><Edit3 size={14} /> Adjust</button></td></tr>)}</tbody></table></div>}</div><div className="ad-panel ad-spaced-panel"><div className="ad-panel-toolbar"><div><p className="ad-eyebrow">AN ACCOUNTABLE STORE</p><h2>Activity & audit trail</h2></div></div>{audit.loading ? <Loading /> : audit.error ? <ErrorState message={audit.error} retry={audit.reload} /> : !audit.data?.items.length ? <Empty title="A clean slate">Administrative changes will be recorded here.</Empty> : <div className="ad-audit-list">{audit.data.items.slice(0, 30).map(item => <div key={item.id}><span className="ad-audit-dot" /><div><strong>{item.action.replaceAll('_', ' ').replaceAll('.', ' / ')}</strong><p>{item.reason || (typeof item.details === 'string' ? item.details : item.details ? JSON.stringify(item.details) : item.entityId || 'Store record updated')}</p><small>{item.user?.name || item.user?.email || item.actorEmail || item.actor || 'Administrator'}</small></div><time dateTime={item.createdAt}>{date(item.createdAt)}</time></div>)}</div>}</div>{selected && <Adjustment variant={selected} close={() => setSelected(null)} saved={() => { setSelected(null); setNotice('Stock adjusted and recorded in the audit trail.'); resource.reload(); audit.reload() }} />}</>
}



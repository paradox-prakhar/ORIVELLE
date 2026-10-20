import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { api, date, useResource } from './api'
import { Empty, ErrorState, Loading, Modal, Notice, Status, SubmitButton } from './components'

interface ReturnRequest { id: string; orderId: string; reference: string; email: string; reason: string; status: string; createdAt: string }

export default function Returns() {
  const resource = useResource<{ items: ReturnRequest[] }>('/admin/returns')
  const [decision, setDecision] = useState<{ request: ReturnRequest; status: 'approved' | 'rejected' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  async function save() {
    if (!decision) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api<{ message: string }>(`/admin/returns/${decision.request.id}`, { method: 'PATCH', body: JSON.stringify({ status: decision.status }) })
      setNotice(result.message)
      setDecision(null)
      resource.reload()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <div className="ad-panel ad-spaced-panel"><div className="ad-panel-toolbar"><div><p className="ad-eyebrow">AFTER THE DELIVERY</p><h2>Return requests</h2></div><span className="ad-count">{resource.data?.items.filter(item => item.status === 'requested').length ?? '—'} pending</span></div>{notice && <div className="ad-panel-notice"><Notice>{notice}</Notice></div>}{resource.loading ? <Loading /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : !resource.data?.items.length ? <Empty title="All settled for now">Customer return requests will appear here for review.</Empty> : <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Order / customer</th><th>Reason</th><th>Requested</th><th>Status</th><th>Review</th></tr></thead><tbody>{resource.data.items.map(request => <tr key={request.id}><td><strong>{request.reference}</strong><small className="ad-table-small">{request.email}</small></td><td className="ad-return-reason">{request.reason}</td><td className="ad-nowrap">{date(request.createdAt)}</td><td><Status value={request.status} /></td><td>{request.status === 'requested' ? <div className="ad-row-actions"><button className="ad-icon-button" aria-label={`Approve return ${request.reference}`} onClick={() => { setError(''); setDecision({ request, status: 'approved' }) }}><Check size={17} /></button><button className="ad-icon-button" aria-label={`Reject return ${request.reference}`} onClick={() => { setError(''); setDecision({ request, status: 'rejected' }) }}><X size={17} /></button></div> : <span className="ad-muted">Reviewed</span>}</td></tr>)}</tbody></table></div>}{decision && <Modal title={decision.status === 'approved' ? 'Approve this return?' : 'Decline this return?'} subtitle={decision.request.reference} close={() => { if (!busy) setDecision(null) }}><form className="ad-form" onSubmit={event => { event.preventDefault(); void save() }}>{error && <Notice error>{error}</Notice>}<div className="ad-return-summary"><strong>Customer’s reason</strong><p>{decision.request.reason}</p></div><p className="ad-form-note">This records your decision. Arrange collection, any refund and customer communication separately. This action does not send an email or issue a payment refund.</p><div className="ad-modal-actions"><button type="button" disabled={busy} className="ad-button ad-button-secondary" onClick={() => setDecision(null)}>Keep reviewing</button><SubmitButton busy={busy}>{decision.status === 'approved' ? 'Approve return' : 'Decline return'}</SubmitButton></div></form></Modal>}</div>
}

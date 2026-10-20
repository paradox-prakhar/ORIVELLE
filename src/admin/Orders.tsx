import { useState, type FormEvent } from 'react'
import { ArrowUpRight, Package, Search } from 'lucide-react'
import Returns from './Returns'
import OrderEvents from './OrderEvents'
import { api, date, money, useResource, type Order } from './api'
import { Empty, ErrorState, Field, Loading, Modal, Notice, PageHeading, Status, SubmitButton } from './components'

export function OrdersTable({ orders, select }: { orders: Order[]; select: (order: Order) => void }) {
  return <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Fulfillment</th><th><span className="ad-sr-only">Details</span></th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td><button className="ad-link-button" onClick={() => select(order)}>{order.reference}</button><small className="ad-table-small">{order.paymentMethod.replaceAll('_', ' ')} · {order.paymentStatus.replaceAll('_', ' ')}</small></td><td>{order.user?.name || 'Customer'}<small className="ad-table-small">{order.user?.email}</small></td><td className="ad-nowrap">{date(order.createdAt)}</td><td className="ad-nowrap">{money(order.total)}</td><td><Status value={order.status} /></td><td><button className="ad-icon-button" aria-label={`View order ${order.reference}`} onClick={() => select(order)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div>
}

const transitions: Record<string, string[]> = { confirmed: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] }
export function OrderDetail({ order, close, saved }: { order: Order; close: () => void; saved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nextStatuses = transitions[order.status] || []
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try { await api(`/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status: form.get('status'), trackingNumber: form.get('trackingNumber') || '', trackingUrl: form.get('trackingUrl') || '' }) }); saved() } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  const address = Object.entries(order.address || {}).filter(([key, value]) => value && !['id', 'userId', 'createdAt', 'updatedAt', 'isDefault', 'label'].includes(key))
  return <Modal title={order.reference} subtitle={`Placed ${date(order.createdAt)}`} close={close} wide><div className="ad-order-detail"><div className="ad-order-flags"><Status value={order.status} /><Status value={order.paymentStatus} /><span className="ad-muted">{order.paymentMethod.replaceAll('_', ' ')}</span></div><div className="ad-form-grid"><div className="ad-detail-block"><h3>Customer</h3><strong>{order.user?.name || 'Customer'}</strong><a href={`mailto:${order.user?.email || ''}`}>{order.user?.email}</a></div><div className="ad-detail-block"><h3>Delivery address</h3>{address.map(([key, value]) => <span key={key}>{String(value)}</span>)}</div></div><h3 className="ad-section-label">The pieces</h3><div className="ad-order-items">{order.items.map((item, index) => <div key={item.id || index}><div className="ad-item-symbol"><Package size={21} strokeWidth={1.1} /></div><div><strong>{item.name || item.productName || item.product?.name || 'Product'}</strong><small>{item.size || item.variant?.size || 'One size'}{(item.color || item.variant?.color) && ` · ${item.color || item.variant?.color}`} · Qty {item.quantity}</small></div><span>{money((item.unitPrice ?? item.price ?? 0) * item.quantity)}</span></div>)}</div><dl className="ad-totals"><div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div><div><dt>Discount</dt><dd>−{money(order.discount)}</dd></div><div><dt>Shipping</dt><dd>{money(order.shipping)}</dd></div><div><dt>Tax</dt><dd>{money(order.tax)}</dd></div><div className="ad-total"><dt>Order total</dt><dd>{money(order.total)}</dd></div></dl><form className="ad-form" onSubmit={submit}>{error && <Notice error>{error}</Notice>}<div className="ad-form-divider"><h3>Fulfillment</h3><p className="ad-muted">Updates are recorded in your store audit trail.</p></div><Field label="Order status"><select name="status" defaultValue={order.status}><option value={order.status}>{order.status}</option>{nextStatuses.map(status => <option value={status} key={status}>{status}</option>)}</select></Field><div className="ad-form-grid"><Field label="Tracking number"><input name="trackingNumber" defaultValue={order.trackingNumber || ''} placeholder="Courier tracking reference" /></Field><Field label="Tracking URL"><input type="url" name="trackingUrl" defaultValue={order.trackingUrl || ''} placeholder="https://…" /></Field></div><p className="ad-form-note">Payment status is controlled by verified payment events. Changing fulfillment does not mark a payment as paid.</p><div className="ad-modal-actions"><button type="button" className="ad-button ad-button-secondary" onClick={close}>Close</button><SubmitButton busy={busy}>Update order</SubmitButton></div></form><OrderEvents orderId={order.id} /></div></Modal>
}

export default function Orders() {
  const resource = useResource<{ items: Order[]; total: number }>('/admin/orders')
  const [selected, setSelected] = useState<Order | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [notice, setNotice] = useState('')
  const orders = (resource.data?.items || []).filter(order => (status === 'all' || order.status === status) && `${order.reference} ${order.user?.name || ''} ${order.user?.email || ''}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading title="Every order, in hand" description="Care from checkout to the moment it arrives." />{notice && <Notice>{notice}</Notice>}<div className="ad-panel"><div className="ad-panel-toolbar"><div><span className="ad-panel-title">Orders</span><span className="ad-count">{resource.data?.total ?? '—'}</span></div><div className="ad-toolbar-filters"><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter by fulfillment status"><option value="all">All statuses</option>{['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(value => <option key={value} value={value}>{value}</option>)}</select><label className="ad-search"><Search size={16} /><input aria-label="Search orders" placeholder="Order or customer" value={query} onChange={event => setQuery(event.target.value)} /></label></div></div>{resource.loading ? <Loading /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : !orders.length ? <Empty title={query || status !== 'all' ? 'No matching orders' : 'A fresh beginning'}>{query || status !== 'all' ? 'Try changing your search or status filter.' : 'Your customers’ orders will appear here once they check out.'}</Empty> : <OrdersTable orders={orders} select={setSelected} />}</div><Returns />{selected && <OrderDetail order={selected} close={() => setSelected(null)} saved={() => { setSelected(null); setNotice('Order updated successfully.'); resource.reload() }} />}</>
}



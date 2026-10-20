import { date, useResource } from './api'
import { Empty, ErrorState, Loading } from './components'

interface OrderEvent { id: string; event: string; details: Record<string, unknown>; createdAt: string }
export default function OrderEvents({ orderId }: { orderId: string }) {
  const resource = useResource<{ events: OrderEvent[] }>(`/admin/orders/${orderId}`)
  return <div className="ad-order-events"><h3 className="ad-section-label">Order history</h3>{resource.loading ? <Loading /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : !resource.data?.events.length ? <Empty title="No events yet" /> : <ol>{resource.data.events.map(event => <li key={event.id}><span className="ad-audit-dot" /><div><strong>{event.event.replaceAll('.', ' / ').replaceAll('_', ' ')}</strong>{typeof event.details.previous === 'string' && <small>Previously {event.details.previous}</small>}{typeof event.details.trackingNumber === 'string' && event.details.trackingNumber && <small>Tracking: {event.details.trackingNumber}</small>}<time dateTime={event.createdAt}>{date(event.createdAt)} · {new Date(event.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time></div></li>)}</ol>}</div>
}

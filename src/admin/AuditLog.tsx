import { FileText, ShieldAlert } from 'lucide-react'
import { date, useResource } from './api'
import { Empty, ErrorState, Loading, PageHeading } from './components'

interface AuditItem {
  id: string
  actorId: string | null
  actorEmail: string | null
  action: string
  targetId: string
  details: Record<string, unknown> | null
  createdAt: string
}

export default function AuditLog() {
  const resource = useResource<{ items: AuditItem[] }>('/admin/audit')

  return (
    <div className="ad-panel ad-spaced-panel">
      <PageHeading
        title="Audit trail"
        description="Immutable record of administrative operations, stock changes, and store events."
      />

      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.items.length ? (
        <Empty title="No recorded events">Administrative and system events will be recorded here.</Empty>
      ) : (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Administrator</th>
                <th>Target ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.items.map((item) => (
                <tr key={item.id}>
                  <td className="ad-nowrap">{date(item.createdAt)}</td>
                  <td>
                    <span className="ad-status-badge ad-status-neutral">
                      <FileText size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {item.action}
                    </span>
                  </td>
                  <td>
                    <strong>{item.actorEmail || 'System / Provisioning'}</strong>
                  </td>
                  <td className="ad-table-mono">{item.targetId}</td>
                  <td className="ad-table-details">
                    <pre style={{ margin: 0, fontSize: 10, maxHeight: 60, overflow: 'auto', background: '#f5f0e8', padding: '4px 8px', borderRadius: 3 }}>
                      {JSON.stringify(item.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

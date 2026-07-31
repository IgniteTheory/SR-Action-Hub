import type { Action } from '../api/types';
import { formatDateTime, initials, PRIORITY_LABELS, QUOTE_STATUS_LABELS, STATUS_LABELS } from '../utils/format';

interface Props {
  actions: Action[];
  onSelect: (action: Action) => void;
}

export default function ActionList({ actions, onSelect }: Props) {
  if (!actions.length) {
    return <div className="empty-state">No actions match this view.</div>;
  }

  const now = Date.now();
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;

  return (
    <div className="action-list">
      {actions.map((a) => {
        const needsManualQuote = a.quoteStatus === 'NEEDS_MANUAL_QUOTE';
        const overdue = new Date(a.dueAt).getTime() < now && a.status !== 'COMPLETED' && a.status !== 'CANCELLED';
        const stale =
          a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && now - new Date(a.updatedAt).getTime() > fourDaysMs;
        return (
          <div key={a.id} className={`action-row${needsManualQuote ? ' quote-flag' : ''}`} onClick={() => onSelect(a)}>
            <div className="main-info">
              <div className="client">{a.client.name}{stale && <span className="stale-badge" title="No updates in 4+ days">⏰ Stale</span>}</div>
              <div className="desc">{a.description}</div>
            </div>
            <div>
              <span className={`badge priority-${a.priority}`}>{PRIORITY_LABELS[a.priority]}</span>
              {a.quoteStatus !== 'NOT_NEEDED' && (
                <span className={`quote-badge ${a.quoteStatus}`}>{QUOTE_STATUS_LABELS[a.quoteStatus]}</span>
              )}
            </div>
            <div className="assignee">
              {a.assignedTo ? (
                <>
                  <span className="avatar" style={{ background: a.assignedTo.colour, width: 20, height: 20, fontSize: 10 }}>
                    {initials(a.assignedTo.name)}
                  </span>
                  {a.assignedTo.name}
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Unallocated</span>
              )}
            </div>
            <div className={`due${overdue ? ' overdue' : ''}`}>{formatDateTime(a.dueAt)}</div>
            <div>
              <span className={`status-pill ${a.status}`}>{STATUS_LABELS[a.status]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

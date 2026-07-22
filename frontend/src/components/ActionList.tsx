import type { Action } from '../api/types';
import { formatDateTime, initials, PRIORITY_LABELS, STATUS_LABELS } from '../utils/format';

interface Props {
  actions: Action[];
  onSelect: (action: Action) => void;
}

export default function ActionList({ actions, onSelect }: Props) {
  if (!actions.length) {
    return <div className="empty-state">No actions match this view.</div>;
  }

  const now = Date.now();

  return (
    <div className="action-list">
      {actions.map((a) => {
        const isStephan = a.assignedTo?.name === 'Stephan';
        const overdue = new Date(a.dueAt).getTime() < now && a.status !== 'COMPLETED' && a.status !== 'CANCELLED';
        return (
          <div key={a.id} className={`action-row${isStephan ? ' stephan' : ''}`} onClick={() => onSelect(a)}>
            <div className="ticket">{a.ticketNumber}</div>
            <div className="main-info">
              <div className="client">{a.client.name}</div>
              <div className="desc">{a.description}</div>
            </div>
            <div>
              <span className={`badge priority-${a.priority}`}>{PRIORITY_LABELS[a.priority]}</span>
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

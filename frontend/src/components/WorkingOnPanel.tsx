import type { Action } from '../api/types';
import { formatDateTime } from '../utils/format';

interface Props {
  actions: Action[];
  onSelect: (action: Action) => void;
}

export default function WorkingOnPanel({ actions, onSelect }: Props) {
  return (
    <aside className="working-on-panel">
      <h2>Working On</h2>
      {actions.length === 0 ? (
        <div className="completed-empty">Nothing in progress.</div>
      ) : (
        <div className="completed-list">
          {actions.map((a) => (
            <div key={a.id} className="completed-row" onClick={() => onSelect(a)}>
              <div className="client">{a.client.name}</div>
              <div className="meta">
                <span>{a.assignedTo ? a.assignedTo.name : 'Unallocated'}</span>
                <span>Due {formatDateTime(a.dueAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

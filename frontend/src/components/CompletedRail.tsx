import { useState } from 'react';
import type { Action } from '../api/types';
import { formatDateTime } from '../utils/format';

interface Props {
  actions: Action[];
  onSelect: (action: Action) => void;
}

export default function CompletedRail({ actions, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <aside className="completed-rail">
      <button type="button" className="completed-rail-toggle" onClick={() => setOpen((o) => !o)}>
        <span>Completed ({actions.length})</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open &&
        (actions.length === 0 ? (
          <div className="completed-empty">Nothing completed yet.</div>
        ) : (
          <div className="completed-list">
            {actions.map((a) => (
              <div key={a.id} className="completed-row" onClick={() => onSelect(a)}>
                <div className="client">{a.client.name}</div>
                <div className="meta">
                  <span>{a.assignedTo ? a.assignedTo.name : 'Unallocated'}</span>
                  <span>{a.completedAt ? formatDateTime(a.completedAt) : ''}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
    </aside>
  );
}

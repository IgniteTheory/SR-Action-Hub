import { useState } from 'react';
import type { UserSummary } from '../api/types';

interface Props {
  users: UserSummary[];
  selectedUserIds: number[];
  onToggleUser: (id: number) => void;
  onClearAll: () => void;
}

export default function FilterBar({ users, selectedUserIds, onToggleUser, onClearAll }: Props) {
  const [open, setOpen] = useState(false);
  const hasAny = selectedUserIds.length > 0;

  return (
    <div className="dropdown-section">
      <button type="button" className="dropdown-section-toggle" onClick={() => setOpen((o) => !o)}>
        <span>Staff{hasAny ? ` (${selectedUserIds.length})` : ''}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="dropdown-section-body">
          <button type="button" className={`filter-chip all-chip${!hasAny ? ' active' : ''}`} onClick={onClearAll}>
            ALL
          </button>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`filter-chip${selectedUserIds.includes(u.id) ? ' active' : ''}`}
              onClick={() => onToggleUser(u.id)}
            >
              {u.name.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

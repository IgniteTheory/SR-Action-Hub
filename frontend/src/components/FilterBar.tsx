import { useState } from 'react';
import type { UserSummary } from '../api/types';

// Every pill here is independently toggleable and all combine together
// (AND across staff + status/urgency filters) — e.g. Stephan + Overdue +
// Quote Needed at once. "Mine" and "Completed" are deliberately not here:
// "Mine" was a single-user special case now redundant with picking your
// own name, and Completed has its own dedicated dropdown (see
// CompletedRail) instead of cluttering the working list.
export const FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'stale', label: 'Stale (4+ days no update)' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'unallocated', label: 'Unallocated' },
  { key: 'quote-needed', label: 'Quote Needed' },
  { key: 'needs-internal-approval', label: 'Needs Approval' },
  { key: 'approval-pending', label: 'Approval Pending' },
];

interface Props {
  users: UserSummary[];
  selectedUserIds: number[];
  onToggleUser: (id: number) => void;
  selectedFilters: string[];
  onToggleFilter: (key: string) => void;
  onClearAll: () => void;
}

export default function FilterBar({
  users,
  selectedUserIds,
  onToggleUser,
  selectedFilters,
  onToggleFilter,
  onClearAll,
}: Props) {
  const [staffOpen, setStaffOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasAnyUser = selectedUserIds.length > 0;
  const hasAnyFilter = selectedFilters.length > 0;

  return (
    <>
      <div className="dropdown-section">
        <button type="button" className="dropdown-section-toggle" onClick={() => setStaffOpen((o) => !o)}>
          <span>Staff{hasAnyUser ? ` (${selectedUserIds.length})` : ''}</span>
          <span>{staffOpen ? '▾' : '▸'}</span>
        </button>
        {staffOpen && (
          <div className="dropdown-section-body">
            <button type="button" className={`filter-chip all-chip${!hasAnyUser ? ' active' : ''}`} onClick={onClearAll}>
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

      <div className="dropdown-section">
        <button type="button" className="dropdown-section-toggle" onClick={() => setFiltersOpen((o) => !o)}>
          <span>Filters{hasAnyFilter ? ` (${selectedFilters.length})` : ''}</span>
          <span>{filtersOpen ? '▾' : '▸'}</span>
        </button>
        {filtersOpen && (
          <div className="dropdown-section-body">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`filter-chip${selectedFilters.includes(f.key) ? ' active' : ''}`}
                onClick={() => onToggleFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

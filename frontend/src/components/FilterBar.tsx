import type { UserSummary } from '../api/types';

// Every pill here is independently toggleable and all combine together
// (AND across staff + status/urgency filters) — e.g. Stephan + Overdue +
// Quote Needed at once. "Mine" and "Completed" are deliberately not here:
// "Mine" was a single-user special case now redundant with picking your
// own name, and Completed has its own dedicated dropdown (see
// CompletedDropdown) instead of cluttering the working list.
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
  const hasAny = selectedUserIds.length > 0 || selectedFilters.length > 0;

  return (
    <div className="filter-bar">
      <button className={`filter-chip all-chip${!hasAny ? ' active' : ''}`} onClick={onClearAll}>
        ALL
      </button>
      {users.map((u) => (
        <button
          key={u.id}
          className={`filter-chip${selectedUserIds.includes(u.id) ? ' active' : ''}`}
          onClick={() => onToggleUser(u.id)}
        >
          {u.name.toUpperCase()}
        </button>
      ))}
      <span className="filter-divider" />
      {FILTER_OPTIONS.map((f) => (
        <button
          key={f.key}
          className={`filter-chip${selectedFilters.includes(f.key) ? ' active' : ''}`}
          onClick={() => onToggleFilter(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

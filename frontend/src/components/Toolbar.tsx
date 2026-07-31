interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filter: string | null;
  onFilterChange: (f: string | null) => void;
}

const FILTERS: { key: string; label: string }[] = [
  { key: 'mine', label: 'Mine' },
  { key: 'today', label: 'Today' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'stale', label: 'Stale (4+ days no update)' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'unallocated', label: 'Unallocated' },
  { key: 'completed', label: 'Completed' },
  { key: 'quote-needed', label: 'Quote Needed' },
  { key: 'needs-internal-approval', label: 'Needs Approval' },
  { key: 'approval-pending', label: 'Approval Pending' },
];

export default function Toolbar({ search, onSearchChange, filter, onFilterChange }: Props) {
  return (
    <div className="toolbar">
      <input
        className="search-input"
        placeholder="Search by client, contact, phone, reference, description…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select
        className="filter-select"
        value={filter ?? ''}
        onChange={(e) => onFilterChange(e.target.value || null)}
      >
        <option value="">All actions</option>
        {FILTERS.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>
    </div>
  );
}

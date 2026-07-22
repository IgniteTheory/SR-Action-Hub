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
  { key: 'waiting', label: 'Waiting' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'unallocated', label: 'Unallocated' },
  { key: 'completed', label: 'Completed' },
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
      <div className="filter-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'active' : ''}
            onClick={() => onFilterChange(filter === f.key ? null : f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

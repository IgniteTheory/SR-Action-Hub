interface Props {
  search: string;
  onSearchChange: (v: string) => void;
}

export default function Toolbar({ search, onSearchChange }: Props) {
  return (
    <div className="toolbar">
      <input
        className="search-input"
        placeholder="Search by client, contact, phone, reference, description…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}

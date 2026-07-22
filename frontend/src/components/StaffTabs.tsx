import type { UserSummary } from '../api/types';

interface Props {
  users: UserSummary[];
  activeId: number | 'all';
  onChange: (id: number | 'all') => void;
}

export default function StaffTabs({ users, activeId, onChange }: Props) {
  return (
    <div className="staff-tabs">
      <button className={activeId === 'all' ? 'active' : ''} onClick={() => onChange('all')}>
        ALL
      </button>
      {users.map((u) => (
        <button key={u.id} className={activeId === u.id ? 'active' : ''} onClick={() => onChange(u.id)}>
          {u.name.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

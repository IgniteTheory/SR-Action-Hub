import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Client, UserSummary } from '../api/types';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ users: UserSummary[] }>('/users').then((r) => setUsers(r.users));
  }, []);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .get<{ clients: Client[] }>(`/clients?search=${encodeURIComponent(search)}`)
        .then((r) => setClients(r.clients))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load clients'))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [search]);

  async function setAccountant(clientId: number, accountantId: number | null) {
    setSavingId(clientId);
    setError(null);
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, assignedAccountantId: accountantId } : c)));
    try {
      const res = await api.patch<{ client: Client }>(`/clients/${clientId}`, { assignedAccountantId: accountantId });
      setClients((prev) => prev.map((c) => (c.id === clientId ? res.client : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Clients</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 640, marginTop: -8 }}>
        Set each client's usual accountant here — new tickets for that client auto-assign to them, and any ticket
        that needs a quote still goes to Stephan first, with a duplicate ticket sent to this accountant.
      </p>

      {error && <div className="error-text">{error}</div>}

      <input
        className="search-input"
        style={{ marginBottom: 14, maxWidth: 400 }}
        placeholder="Search clients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p style={{ fontSize: 13.5 }}>Loading…</p>
      ) : clients.length === 0 ? (
        <div className="empty-state">No clients match.</div>
      ) : (
        <div className="action-list">
          {clients.map((c) => (
            <div key={c.id} className="action-row" style={{ gridTemplateColumns: '1fr 260px', cursor: 'default' }}>
              <div className="main-info"><div className="client">{c.name}</div></div>
              <div className="field" style={{ margin: 0 }}>
                <select
                  value={c.assignedAccountantId ?? ''}
                  disabled={savingId === c.id}
                  onChange={(e) => setAccountant(c.id, e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

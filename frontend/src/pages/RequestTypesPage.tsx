import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { QuoteBehavior, RequestType } from '../api/types';

const BEHAVIOR_LABELS: Record<QuoteBehavior, string> = {
  NEVER: 'Never — routine work, no quote',
  MANUAL: 'Manual — Stephan draws up a quote',
  AUTO: 'Auto — price on file, system drafts the quote',
};

export default function RequestTypesPage() {
  const [types, setTypes] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  function load() {
    setLoading(true);
    api.get<{ requestTypes: RequestType[] }>('/request-types')
      .then((r) => {
        setTypes(r.requestTypes);
        setPriceDrafts(Object.fromEntries(r.requestTypes.map((t) => [t.id, t.price ?? ''])));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load request types'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateBehavior(type: RequestType, quoteBehavior: QuoteBehavior) {
    setSavingId(type.id);
    setError(null);
    try {
      const res = await api.patch<{ requestType: RequestType }>(`/request-types/${type.id}`, { quoteBehavior });
      setTypes((prev) => prev.map((t) => (t.id === type.id ? res.requestType : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    } finally {
      setSavingId(null);
    }
  }

  async function savePrice(type: RequestType) {
    setSavingId(type.id);
    setError(null);
    try {
      const raw = priceDrafts[type.id];
      const price = raw === '' || raw === undefined ? null : Number(raw);
      const res = await api.patch<{ requestType: RequestType }>(`/request-types/${type.id}`, { price });
      setTypes((prev) => prev.map((t) => (t.id === type.id ? res.requestType : t)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Request Types</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 640, marginTop: -8 }}>
        Decide whether each request type needs a quote before work starts. "Never" skips quoting entirely,
        "Manual" flags it for Stephan to price by hand, and "Auto" uses the price on file to draft a quote
        the client can accept online. "Other" always stays Manual — it's unclassified work by definition.
      </p>

      {error && <div className="error-text">{error}</div>}
      {loading && <p style={{ fontSize: 13.5 }}>Loading…</p>}

      {!loading && (
        <div className="action-list">
          {types.map((t) => {
            const isOther = t.name === 'Other';
            return (
              <div key={t.id} className="action-row" style={{ gridTemplateColumns: '1fr 260px 140px 100px', cursor: 'default' }}>
                <div className="main-info"><div className="client">{t.name}</div></div>
                <div className="field" style={{ margin: 0 }}>
                  <select
                    value={t.quoteBehavior}
                    onChange={(e) => updateBehavior(t, e.target.value as QuoteBehavior)}
                    disabled={savingId === t.id || isOther}
                  >
                    {(Object.keys(BEHAVIOR_LABELS) as QuoteBehavior[]).map((b) => (
                      <option key={b} value={b}>{BEHAVIOR_LABELS[b]}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  {t.quoteBehavior === 'AUTO' ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="R price"
                      value={priceDrafts[t.id] ?? ''}
                      onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      onBlur={() => savePrice(t)}
                      disabled={savingId === t.id}
                    />
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>—</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{savingId === t.id ? 'Saving…' : ''}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

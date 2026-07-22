import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { formatCurrency, formatDateTime } from '../utils/format';

interface Quote {
  ticketNumber: string;
  clientName: string;
  requestType: string;
  description: string;
  quoteAmount: string | null;
  quoteStatus: 'NOT_NEEDED' | 'NEEDS_MANUAL_QUOTE' | 'PENDING_APPROVAL' | 'ACCEPTED' | 'DECLINED';
  quoteRespondedAt: string | null;
}

export default function QuotePage() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get<{ quote: Quote }>(`/quotes/${token}`)
      .then((r) => setQuote(r.quote))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load quote'))
      .finally(() => setLoading(false));
  }, [token]);

  async function respond(decision: 'ACCEPTED' | 'DECLINED') {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ quote: { quoteStatus: Quote['quoteStatus']; quoteRespondedAt: string | null } }>(
        `/quotes/${token}/respond`,
        { decision }
      );
      setQuote((prev) => (prev ? { ...prev, ...res.quote } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit your response');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ width: 400 }}>
        <h1>SR Accounting</h1>
        <div className="tagline">Quote for your review</div>

        {loading && <p style={{ fontSize: 13.5 }}>Loading…</p>}

        {!loading && error && !quote && <div className="error-text">{error}</div>}

        {quote && (
          <>
            <div className="detail-row"><span>Reference</span><b>{quote.ticketNumber}</b></div>
            <div className="detail-row"><span>Client</span><b>{quote.clientName}</b></div>
            <div className="detail-row"><span>Request Type</span><b>{quote.requestType}</b></div>
            <h3>Description</h3>
            <p style={{ fontSize: 13.5, margin: '0 0 12px' }}>{quote.description}</p>

            {quote.quoteAmount && (
              <div className="quote-panel">
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Quoted amount</div>
                <div className="quote-amount">{formatCurrency(quote.quoteAmount)}</div>
              </div>
            )}

            {quote.quoteStatus === 'PENDING_APPROVAL' && (
              <>
                {error && <div className="error-text">{error}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => respond('ACCEPTED')} disabled={submitting}>
                    Accept Quote
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => respond('DECLINED')} disabled={submitting}>
                    Decline
                  </button>
                </div>
              </>
            )}

            {quote.quoteStatus === 'ACCEPTED' && (
              <div className="quote-badge ACCEPTED" style={{ fontSize: 13, padding: '8px 14px' }}>
                Quote accepted{quote.quoteRespondedAt ? ` — ${formatDateTime(quote.quoteRespondedAt)}` : ''}. Thank you, we'll be in touch.
              </div>
            )}

            {quote.quoteStatus === 'DECLINED' && (
              <div className="quote-badge DECLINED" style={{ fontSize: 13, padding: '8px 14px' }}>
                Quote declined{quote.quoteRespondedAt ? ` — ${formatDateTime(quote.quoteRespondedAt)}` : ''}. Contact us if you'd like to discuss further.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

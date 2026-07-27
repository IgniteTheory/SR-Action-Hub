import { useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Action, ActionStatus, QuoteStatus, UserSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import {
  COMM_SOURCE_LABELS,
  formatCurrency,
  formatDate,
  formatDateTime,
  PRIORITY_LABELS,
  QUOTE_STATUS_LABELS,
  STATUS_LABELS,
  TURNAROUND_LABELS,
} from '../utils/format';

interface Props {
  action: Action;
  users: UserSummary[];
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_OPTIONS: ActionStatus[] = [
  'NEW', 'ALLOCATED', 'IN_PROGRESS', 'WAITING_CLIENT', 'WAITING_SARS',
  'WAITING_BANK', 'WAITING_THIRD_PARTY', 'COMPLETED', 'CANCELLED',
];

export default function ActionDetailDrawer({ action, users, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRATOR';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSnooze, setShowSnooze] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState('');
  const [snoozeReason, setSnoozeReason] = useState('Waiting for documents');
  const [quoteAmountInput, setQuoteAmountInput] = useState(action.quoteAmount ?? '');
  const [quoteDueDateInput, setQuoteDueDateInput] = useState('');

  const timesheetRequired = !!action.assignedTo?.requiresTimesheetCheck;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(status: ActionStatus) {
    run(() => api.post(`/actions/${action.id}/status`, { status }));
  }

  function reassign(assignedToId: number | null) {
    run(() => api.patch(`/actions/${action.id}`, { assignedToId }));
  }

  function submitSnooze() {
    if (!snoozeUntil) {
      setError('Choose a snooze date.');
      return;
    }
    run(() => api.post(`/actions/${action.id}/snooze`, { snoozeUntil, reason: snoozeReason })).then(() =>
      setShowSnooze(false)
    );
  }

  function deleteAction() {
    if (!confirm(`Delete ${action.ticketNumber}? An administrator can restore it later.`)) return;
    run(() => api.delete(`/actions/${action.id}`)).then(() => onClose());
  }

  function toggleTimesheet(checked: boolean) {
    run(() => api.patch(`/actions/${action.id}`, { addedToTimesheet: checked }));
  }

  function setQuoteStatus(quoteStatus: QuoteStatus, quoteAmount?: number | null, dueDate?: string | null) {
    run(() => api.post(`/actions/${action.id}/quote-status`, { quoteStatus, quoteAmount, dueDate }));
  }

  function sendManualQuote() {
    const amount = quoteAmountInput === '' ? null : Number(quoteAmountInput);
    const dueDate = quoteDueDateInput ? new Date(quoteDueDateInput).toISOString() : null;
    setQuoteStatus('PENDING_APPROVAL', amount, dueDate);
  }

  function approveQuote() {
    const amount = quoteAmountInput === '' ? null : Number(quoteAmountInput);
    run(() => api.post(`/actions/${action.id}/approve-quote`, { quoteAmount: amount }));
  }

  function sendBackForManualQuote() {
    if (!confirm('Send this back to Stephan for a manual quote instead of the price-list amount?')) return;
    setQuoteStatus('NEEDS_MANUAL_QUOTE');
  }

  const quoteLink = action.quoteToken ? `${window.location.origin}/quote/${action.quoteToken}` : null;

  function copyQuoteLink() {
    if (quoteLink) navigator.clipboard.writeText(quoteLink);
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700 }}>{action.ticketNumber}</div>
            <h2 style={{ margin: '2px 0 0' }}>{action.client.name}</h2>
          </div>
          <span className={`status-pill ${action.status}`}>{STATUS_LABELS[action.status]}</span>
        </div>

        {action.status === 'SNOOZED' && action.snoozeUntil && (
          <div style={{ background: '#f1eafe', color: '#7c3aed', padding: '8px 10px', borderRadius: 8, fontSize: 12.5, margin: '12px 0' }}>
            Snoozed until {formatDate(action.snoozeUntil)} — {action.snoozeReason}
          </div>
        )}

        <div className="detail-row"><span>Contact</span><b>{action.contactPerson}</b></div>
        {action.telephone && <div className="detail-row"><span>Telephone</span><b>{action.telephone}</b></div>}
        {action.email && <div className="detail-row"><span>Email</span><b>{action.email}</b></div>}
        <div className="detail-row"><span>Source</span><b>{COMM_SOURCE_LABELS[action.communicationSource]}</b></div>
        <div className="detail-row"><span>Request Type</span><b>{action.requestType.name}</b></div>
        <div className="detail-row"><span>Priority</span><b>{PRIORITY_LABELS[action.priority]}</b></div>
        <div className="detail-row"><span>Turnaround</span><b>{TURNAROUND_LABELS[action.turnaround]}</b></div>
        <div className="detail-row"><span>Due</span><b>{formatDateTime(action.dueAt)}</b></div>
        <div className="detail-row"><span>Created by</span><b>{action.createdBy.name}</b></div>

        {action.sendAcknowledgement && (
          <div style={{ fontSize: 12, margin: '6px 0' }}>
            {action.acknowledgementEmailSentAt && (
              <span style={{ color: 'var(--green-dark)' }}>
                ✓ Acknowledgement sent {formatDateTime(action.acknowledgementEmailSentAt)}
              </span>
            )}
            {action.acknowledgementEmailError && (
              <span style={{ color: 'var(--red)' }}>
                ⚠ Acknowledgement email failed — {action.acknowledgementEmailError}
              </span>
            )}
          </div>
        )}

        <h3>Description</h3>
        <p style={{ fontSize: 13.5, margin: 0 }}>{action.description}</p>

        {action.quoteStatus !== 'NOT_NEEDED' && (
          <>
            <h3>Quote</h3>
            <div className="quote-panel">
              <span className={`quote-badge ${action.quoteStatus}`}>{QUOTE_STATUS_LABELS[action.quoteStatus]}</span>
              {action.quoteAmount && <div className="quote-amount" style={{ marginTop: 8 }}>{formatCurrency(action.quoteAmount)}</div>}
              {action.quoteRespondedAt && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Responded {formatDateTime(action.quoteRespondedAt)}
                </div>
              )}

              {action.quoteStatus === 'NEEDS_MANUAL_QUOTE' && (
                <div style={{ marginTop: 10 }}>
                  <div className="field">
                    <label>Quote amount (optional)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={quoteAmountInput}
                      onChange={(e) => setQuoteAmountInput(e.target.value)}
                      placeholder="R"
                    />
                  </div>
                  <div className="field">
                    <label>Estimated timeline / due date (optional)</label>
                    <input
                      type="datetime-local"
                      value={quoteDueDateInput}
                      onChange={(e) => setQuoteDueDateInput(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={sendManualQuote} disabled={busy}>
                    Mark Quote Sent
                  </button>
                </div>
              )}

              {action.quoteStatus === 'NEEDS_INTERNAL_APPROVAL' && (
                <div style={{ marginTop: 10 }}>
                  <div className="field">
                    <label>Quote amount</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={quoteAmountInput}
                      onChange={(e) => setQuoteAmountInput(e.target.value)}
                      placeholder="R"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-sm" onClick={approveQuote} disabled={busy}>
                      Approve &amp; Send to Client
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={sendBackForManualQuote} disabled={busy}>
                      Quote Manually Instead
                    </button>
                  </div>
                </div>
              )}

              {action.quoteStatus === 'PENDING_APPROVAL' && (
                <div style={{ marginTop: 10 }}>
                  {action.quoteEmailSentAt && (
                    <div style={{ fontSize: 12, color: 'var(--green-dark)', marginBottom: 8 }}>
                      ✓ Emailed to client {formatDateTime(action.quoteEmailSentAt)}
                    </div>
                  )}
                  {action.quoteEmailError && (
                    <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>
                      ⚠ Quote email failed — {action.quoteEmailError}. Send the link manually instead.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {quoteLink && (
                      <button className="btn btn-ghost btn-sm" onClick={copyQuoteLink}>Copy Client Link</button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => setQuoteStatus('ACCEPTED')} disabled={busy}>
                      Mark Accepted
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setQuoteStatus('DECLINED')} disabled={busy}>
                      Mark Declined
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <h3>Assignment</h3>
        <select
          value={action.assignedToId ?? ''}
          onChange={(e) => reassign(e.target.value ? Number(e.target.value) : null)}
          disabled={busy}
        >
          <option value="">Unallocated</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        {timesheetRequired && (
          <label className={`checkbox-field${!action.addedToTimesheet ? ' required-unchecked' : ''}`} style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={action.addedToTimesheet}
              onChange={(e) => toggleTimesheet(e.target.checked)}
              disabled={busy}
            />
            Added to Time Sheet {!action.addedToTimesheet && '— required before this can be completed'}
          </label>
        )}

        <h3>Status</h3>
        <select value={action.status} onChange={(e) => changeStatus(e.target.value as ActionStatus)} disabled={busy}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {action.status === 'COMPLETED' && action.email && (
          <div style={{ fontSize: 12, marginTop: 6 }}>
            {action.completionEmailSentAt && (
              <span style={{ color: 'var(--green-dark)' }}>
                ✓ Completion email sent {formatDateTime(action.completionEmailSentAt)}
              </span>
            )}
            {action.completionEmailError && (
              <span style={{ color: 'var(--red)' }}>
                ⚠ Completion email failed — {action.completionEmailError}. Follow up with the client directly.
              </span>
            )}
          </div>
        )}

        {showSnooze && (
          <div style={{ marginTop: 10 }}>
            <div className="field">
              <label>Snooze until</label>
              <input type="date" value={snoozeUntil} onChange={(e) => setSnoozeUntil(e.target.value)} />
            </div>
            <div className="field">
              <label>Reason</label>
              <select value={snoozeReason} onChange={(e) => setSnoozeReason(e.target.value)}>
                <option>Waiting for documents</option>
                <option>Waiting for approval</option>
                <option>Waiting for client</option>
                <option>Waiting for SARS</option>
                <option>Custom</option>
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={submitSnooze} disabled={busy}>Confirm Snooze</button>
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        <h3>Timeline</h3>
        <ul className="timeline">
          {(action.statusHistory ?? []).map((h) => (
            <li key={h.id}>
              <div className="ts">{formatDateTime(h.changedAt)} — {h.changedBy.name}</div>
              <div>{h.note || STATUS_LABELS[h.toStatus]}</div>
            </li>
          ))}
        </ul>

        <div className="drawer-actions spread">
          <div>
            {isAdmin && (
              <button className="btn btn-danger btn-sm" onClick={deleteAction} disabled={busy}>Delete</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSnooze((v) => !v)} disabled={busy}>Snooze</button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

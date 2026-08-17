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
import { buildAcknowledgementEmail, buildCompletionEmail, buildQuoteEmail, mailtoLink, type EmailDraft } from '../utils/emailTemplates';

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
  const isStale =
    action.status !== 'COMPLETED' &&
    action.status !== 'CANCELLED' &&
    Date.now() - new Date(action.updatedAt).getTime() > 4 * 24 * 60 * 60 * 1000;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState('');
  const [snoozeReason, setSnoozeReason] = useState('Waiting for documents');
  const [quoteAmountInput, setQuoteAmountInput] = useState(action.quoteAmount ?? '');
  const [quoteDescriptionInput, setQuoteDescriptionInput] = useState(action.quoteDescription ?? '');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [addQuoteFeeInput, setAddQuoteFeeInput] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editContactPerson, setEditContactPerson] = useState(action.contactPerson);
  const [editTelephone, setEditTelephone] = useState(action.telephone ?? '');
  const [editEmail, setEditEmail] = useState(action.email ?? '');
  const [editDescription, setEditDescription] = useState(action.description);
  const [editPriority, setEditPriority] = useState(action.priority);

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
    if (!confirm(`Delete this action for ${action.client.name}? An administrator can restore it later.`)) return;
    run(() => api.delete(`/actions/${action.id}`)).then(() => onClose());
  }

  function toggleTimesheet(checked: boolean) {
    run(() => api.patch(`/actions/${action.id}`, { addedToTimesheet: checked }));
  }

  function toggleQuoteBilled(checked: boolean) {
    run(() => api.patch(`/actions/${action.id}`, { quoteBilled: checked }));
  }

  function addSubtask() {
    const text = subtaskInput.trim();
    if (!text) return;
    run(() => api.post(`/actions/${action.id}/subtasks`, { text })).then(() => setSubtaskInput(''));
  }

  function toggleSubtask(subId: number, done: boolean) {
    run(() => api.patch(`/actions/${action.id}/subtasks/${subId}`, { done }));
  }

  function deleteSubtask(subId: number) {
    run(() => api.delete(`/actions/${action.id}/subtasks/${subId}`));
  }

  function setQuoteStatus(quoteStatus: QuoteStatus, quoteAmount?: number | null, dueDate?: string | null) {
    run(() => api.post(`/actions/${action.id}/quote-status`, { quoteStatus, quoteAmount, dueDate }));
  }

  function saveQuoteDetails() {
    const amount = quoteAmountInput === '' ? null : Number(quoteAmountInput);
    const description = quoteDescriptionInput.trim() || null;
    run(() => api.patch(`/actions/${action.id}`, { quoteDescription: description, quoteAmount: amount }));
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

  function copyEmailDraft(draft: EmailDraft, key: string) {
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }

  function emailActions(draft: EmailDraft, key: string) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => copyEmailDraft(draft, key)}>
          {copiedKey === key ? 'Copied!' : 'Copy Email Text'}
        </button>
        {action.email && (
          <a className="btn btn-ghost btn-sm" href={mailtoLink(action.email, draft)} target="_blank" rel="noreferrer">
            Open in Email App
          </a>
        )}
      </div>
    );
  }

  function submitAddQuote() {
    const feeInput = addQuoteFeeInput === '' ? null : Number(addQuoteFeeInput);
    run(() => api.post(`/actions/${action.id}/request-quote`, { feeInput })).then(() => {
      setShowAddQuote(false);
      setAddQuoteFeeInput('');
    });
  }

  function submitEdit() {
    if (!editContactPerson.trim()) {
      setError('Contact Person is required.');
      return;
    }
    if (!editDescription.trim()) {
      setError('Description is required.');
      return;
    }
    run(() =>
      api.patch(`/actions/${action.id}`, {
        contactPerson: editContactPerson.trim(),
        telephone: editTelephone.trim() || undefined,
        email: editEmail.trim() || undefined,
        description: editDescription.trim(),
        priority: editPriority,
      })
    ).then(() => setShowEdit(false));
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h2 style={{ margin: 0 }}>{action.client.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit((v) => !v)} disabled={busy}>
              {showEdit ? 'Cancel Edit' : 'Edit'}
            </button>
            <span className={`status-pill ${action.status}`}>{STATUS_LABELS[action.status]}</span>
          </div>
        </div>

        {action.status === 'SNOOZED' && action.snoozeUntil && (
          <div style={{ background: '#f1eafe', color: '#7c3aed', padding: '8px 10px', borderRadius: 8, fontSize: 12.5, margin: '12px 0' }}>
            Snoozed until {formatDate(action.snoozeUntil)} — {action.snoozeReason}
          </div>
        )}

        {action.linkedAction && (
          <div style={{ background: '#eef1f0', color: 'var(--text)', padding: '8px 10px', borderRadius: 8, fontSize: 12.5, margin: '12px 0' }}>
            Linked ticket — needs a quote. {action.linkedAction.assignedTo ? `Also assigned to ${action.linkedAction.assignedTo.name}` : 'Unallocated'} ({STATUS_LABELS[action.linkedAction.status]})
          </div>
        )}

        {isStale && (
          <div style={{ background: 'var(--amber-bg)', color: 'var(--amber)', padding: '8px 10px', borderRadius: 8, fontSize: 12.5, margin: '12px 0', fontWeight: 700 }}>
            ⏰ No updates in 4+ days
          </div>
        )}

        <div className="dropdown-section">
          <button type="button" className="dropdown-section-toggle" onClick={() => setDetailsOpen((o) => !o)}>
            <span>Details</span>
            <span>{detailsOpen ? '▾' : '▸'}</span>
          </button>
          {detailsOpen && (
            <div className="dropdown-section-body">
        {!showEdit ? (
          <>
            <div className="detail-row"><span>Contact</span><b>{action.contactPerson}</b></div>
            {action.telephone && <div className="detail-row"><span>Telephone</span><b>{action.telephone}</b></div>}
            {action.email && <div className="detail-row"><span>Email</span><b>{action.email}</b></div>}
            <div className="detail-row"><span>Source</span><b>{COMM_SOURCE_LABELS[action.communicationSource]}</b></div>
            <div className="detail-row"><span>Request Type</span><b>{action.requestType.name}</b></div>
            <div className="detail-row"><span>Priority</span><b>{PRIORITY_LABELS[action.priority]}</b></div>
            <div className="detail-row"><span>Turnaround</span><b>{TURNAROUND_LABELS[action.turnaround]}</b></div>
            <div className="detail-row"><span>Due</span><b>{formatDateTime(action.dueAt)}</b></div>
            <div className="detail-row"><span>Created by</span><b>{action.createdBy.name}</b></div>
            <div className="detail-row">
              <span>Last updated</span>
              <b style={isStale ? { color: 'var(--amber)' } : undefined}>{formatDateTime(action.updatedAt)}</b>
            </div>

            {action.sendAcknowledgement && (
              <div style={{ fontSize: 12, margin: '6px 0' }}>
                {action.acknowledgementEmailSentAt && (
                  <span style={{ color: 'var(--green-dark)' }}>
                    ✓ Acknowledgement sent {formatDateTime(action.acknowledgementEmailSentAt)}
                  </span>
                )}
                {action.acknowledgementEmailError && (
                  <>
                    <div style={{ color: 'var(--red)', marginBottom: 6 }}>
                      ⚠ Acknowledgement email failed — {action.acknowledgementEmailError}
                    </div>
                    {emailActions(buildAcknowledgementEmail(action), 'acknowledgement')}
                  </>
                )}
              </div>
            )}

            <h3>Description</h3>
            <p style={{ fontSize: 13.5, margin: '0 0 14px' }}>{action.description}</p>
          </>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div className="field">
              <label>Contact Person</label>
              <input value={editContactPerson} onChange={(e) => setEditContactPerson(e.target.value)} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Telephone</label>
                <input value={editTelephone} onChange={(e) => setEditTelephone(e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as Action['priority'])}>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={submitEdit} disabled={busy}>Save Changes</button>
          </div>
        )}

        <h3>Sub-tasks</h3>
        {action.subtasks.length ? (
          action.subtasks.map((s) => (
            <div key={s.id} className="subtask-row">
              <input type="checkbox" checked={s.done} onChange={(e) => toggleSubtask(s.id, e.target.checked)} disabled={busy} />
              <span className={`txt${s.done ? ' done' : ''}`}>{s.text}</span>
              <button onClick={() => deleteSubtask(s.id)} title="Delete" disabled={busy}>×</button>
            </div>
          ))
        ) : (
          <div className="empty-note" style={{ marginBottom: 8 }}>No sub-tasks yet.</div>
        )}
        <div className="subtask-add">
          <input
            type="text"
            placeholder="Add sub-task…"
            value={subtaskInput}
            onChange={(e) => setSubtaskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addSubtask();
            }}
          />
          <button className="btn btn-ghost btn-sm" onClick={addSubtask} disabled={busy || !subtaskInput.trim()}>Add</button>
        </div>
            </div>
          )}
        </div>

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
              <div style={{ marginTop: 8 }}>
                {action.quoteDescription && action.quoteAmount ? (
                  <a className="btn btn-ghost btn-sm" href={`/api/actions/${action.id}/quote-pdf`} download>
                    Download PDF
                  </a>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Add a description of work and a price below, then save, to enable the PDF download.
                  </div>
                )}
              </div>

              {action.quoteStatus === 'NEEDS_MANUAL_QUOTE' && (
                <div style={{ marginTop: 10 }}>
                  <div className="field">
                    <label>Description of work to be done</label>
                    <textarea
                      value={quoteDescriptionInput}
                      onChange={(e) => setQuoteDescriptionInput(e.target.value)}
                      placeholder="What exactly will be delivered for this fee?"
                    />
                  </div>
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
                  <button className="btn btn-primary btn-sm" onClick={saveQuoteDetails} disabled={busy}>
                    Save Quote Details
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
                      ⚠ Quote email failed — {action.quoteEmailError}
                    </div>
                  )}
                  {quoteLink && (
                    <div style={{ marginBottom: 10 }}>
                      {emailActions(buildQuoteEmail(action, quoteLink), 'quote')}
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

              {action.quoteStatus === 'ACCEPTED' && (
                <label className="checkbox-field" style={{ marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={action.quoteBilled}
                    onChange={(e) => toggleQuoteBilled(e.target.checked)}
                    disabled={busy}
                  />
                  Quote billed
                </label>
              )}

              {(action.quoteStatus === 'ACCEPTED' || action.quoteStatus === 'DECLINED') && (
                <div style={{ marginTop: 10 }}>
                  {!showAddQuote ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddQuote(true)} disabled={busy}>
                      + Request Another Quote
                    </button>
                  ) : (
                    <>
                      <div className="field">
                        <label>Fee for the extra work (leave blank for Stephan to quote personally)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={addQuoteFeeInput}
                          onChange={(e) => setAddQuoteFeeInput(e.target.value)}
                          placeholder="R"
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={submitAddQuote} disabled={busy}>Request Quote</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddQuote(false)} disabled={busy}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {action.quoteStatus === 'NOT_NEEDED' && (
          <>
            <h3>Quote</h3>
            <div className="quote-panel">
              {!showAddQuote ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddQuote(true)} disabled={busy}>
                  + Add a Quote for Extra Work
                </button>
              ) : (
                <>
                  <div className="field">
                    <label>Fee (leave blank for Stephan to quote personally)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={addQuoteFeeInput}
                      onChange={(e) => setAddQuoteFeeInput(e.target.value)}
                      placeholder="R"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={submitAddQuote} disabled={busy}>Request Quote</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddQuote(false)} disabled={busy}>Cancel</button>
                  </div>
                </>
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
              <>
                <div style={{ color: 'var(--red)', marginBottom: 6 }}>
                  ⚠ Completion email failed — {action.completionEmailError}
                </div>
                {emailActions(buildCompletionEmail(action), 'completion')}
              </>
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

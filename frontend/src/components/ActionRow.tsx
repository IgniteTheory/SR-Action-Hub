import { useState } from 'react';
import type { Action, ActionStatus } from '../api/types';
import {
  formatDate,
  formatDateTime,
  initials,
  PRIORITY_LABELS,
  QUOTE_STATUS_LABELS,
  STATUS_LABELS,
  TURNAROUND_LABELS,
} from '../utils/format';

const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [ActionStatus, string][];

interface Props {
  action: Action;
  onSelect: (action: Action) => void;
  onStatusChange: (actionId: number, status: ActionStatus) => void;
  onAddNote: (actionId: number, text: string) => void;
}

export default function ActionRow({ action: a, onSelect, onStatusChange, onAddNote }: Props) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const now = Date.now();
  const needsManualQuote = a.quoteStatus === 'NEEDS_MANUAL_QUOTE';
  const overdue = new Date(a.dueAt).getTime() < now && a.status !== 'COMPLETED' && a.status !== 'CANCELLED';
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
  const stale = a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && now - new Date(a.updatedAt).getTime() > fourDaysMs;

  function submitNote() {
    const text = draft.trim();
    if (!text) return;
    onAddNote(a.id, text);
    setDraft('');
  }

  return (
    <div className={`action-row${needsManualQuote ? ' quote-flag' : ''}`} onClick={() => onSelect(a)}>
      <div className="main-info">
        <div className="client">{a.client.name}{stale && <span className="stale-badge" title="No updates in 4+ days">⏰ Stale</span>}</div>
        <div className="desc">{a.description}</div>
      </div>
      <div>
        <span className={`badge priority-${a.priority}`}>{PRIORITY_LABELS[a.priority]}</span>
        {a.quoteStatus !== 'NOT_NEEDED' && (
          <span className={`quote-badge ${a.quoteStatus}`}>{QUOTE_STATUS_LABELS[a.quoteStatus]}</span>
        )}
      </div>
      <div className="assignee">
        {a.assignedTo ? (
          <>
            <span className="avatar" style={{ background: a.assignedTo.colour, width: 20, height: 20, fontSize: 10 }}>
              {initials(a.assignedTo.name)}
            </span>
            {a.assignedTo.name}
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Unallocated</span>
        )}
      </div>
      <div className="meta">
        <div>Req: {formatDate(a.createdAt)}</div>
        <div>{TURNAROUND_LABELS[a.turnaround]}</div>
      </div>
      <div className={`due${overdue ? ' overdue' : ''}`}>{formatDateTime(a.dueAt)}</div>
      <div className="status-notes" onClick={(e) => e.stopPropagation()}>
        <select
          className={`status-pill status-select ${a.status}`}
          value={a.status}
          onChange={(e) => onStatusChange(a.id, e.target.value as ActionStatus)}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`notes-toggle${a.notes.length ? ' has-notes' : ''}`}
          onClick={() => setNotesOpen((open) => !open)}
        >
          Notes ({a.notes.length})
        </button>
      </div>

      {notesOpen && (
        <div className="notes-panel" onClick={(e) => e.stopPropagation()}>
          {a.notes.length === 0 && <div className="notes-empty">No notes yet.</div>}
          <ul className="timeline">
            {a.notes.map((note) => (
              <li key={note.id}>
                <b>{note.createdBy.name}</b> — {note.text}
                <div className="ts">{formatDateTime(note.createdAt)}</div>
              </li>
            ))}
          </ul>
          <div className="note-add">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNote()}
              placeholder="Add a note..."
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={submitNote}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

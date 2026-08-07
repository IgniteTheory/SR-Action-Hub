import { useState } from 'react';
import type { Action, ActionStatus } from '../api/types';
import {
  formatDate,
  formatDateTime,
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
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
  const stale = a.status !== 'COMPLETED' && a.status !== 'CANCELLED' && now - new Date(a.updatedAt).getTime() > fourDaysMs;

  function submitNote() {
    const text = draft.trim();
    if (!text) return;
    onAddNote(a.id, text);
    setDraft('');
  }

  return (
    <>
      <tr className={`action-tr${needsManualQuote ? ' quote-flag' : ''}`} onClick={() => onSelect(a)}>
        <td className="client-cell">
          {a.client.name}
          {stale && <span className="stale-badge" title="No updates in 4+ days">⏰ Stale</span>}
        </td>

        <td onClick={(e) => e.stopPropagation()}>
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
        </td>

        <td>{a.assignedTo ? a.assignedTo.name : 'Unallocated'}</td>
        <td>{formatDate(a.createdAt)}</td>
        <td>{TURNAROUND_LABELS[a.turnaround]}</td>

        <td onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`notes-toggle${a.notes.length ? ' has-notes' : ''}`}
            onClick={() => setNotesOpen((open) => !open)}
          >
            Notes ({a.notes.length}) {notesOpen ? '▲' : '▼'}
          </button>
        </td>
      </tr>

      {notesOpen && (
        <tr className="notes-tr">
          <td colSpan={6} onClick={(e) => e.stopPropagation()}>
            <div className="notes-panel">
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
          </td>
        </tr>
      )}
    </>
  );
}

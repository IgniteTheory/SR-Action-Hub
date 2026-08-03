import type { Action, ActionStatus } from '../api/types';
import ActionRow from './ActionRow';

interface Props {
  actions: Action[];
  onSelect: (action: Action) => void;
  onStatusChange: (actionId: number, status: ActionStatus) => void;
  onAddNote: (actionId: number, text: string) => void;
}

export default function ActionList({ actions, onSelect, onStatusChange, onAddNote }: Props) {
  if (!actions.length) {
    return <div className="empty-state">No actions match this view.</div>;
  }

  return (
    <div className="action-list">
      {actions.map((a) => (
        <ActionRow key={a.id} action={a} onSelect={onSelect} onStatusChange={onStatusChange} onAddNote={onAddNote} />
      ))}
    </div>
  );
}

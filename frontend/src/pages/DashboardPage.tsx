import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Action, ActionStatus, DashboardKpis, RequestType, UserSummary } from '../api/types';
import KpiCards from '../components/KpiCards';
import FilterBar from '../components/FilterBar';
import Toolbar from '../components/Toolbar';
import ActionList from '../components/ActionList';
import CompletedRail from '../components/CompletedRail';
import WorkingOnPanel from '../components/WorkingOnPanel';
import CreateActionDrawer from '../components/CreateActionDrawer';
import ActionDetailDrawer from '../components/ActionDetailDrawer';
import Toast from '../components/Toast';

export default function DashboardPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [completedActions, setCompletedActions] = useState<Action[]>([]);
  const [workingOnActions, setWorkingOnActions] = useState<Action[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleFilter = (key: string) => {
    setSelectedFilters((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };
  const clearAll = () => {
    setSelectedUserIds([]);
    setSelectedFilters([]);
  };

  const loadStatic = useCallback(async () => {
    const [u, rt] = await Promise.all([
      api.get<{ users: UserSummary[] }>('/users'),
      api.get<{ requestTypes: RequestType[] }>('/request-types'),
    ]);
    setUsers(u.users);
    setRequestTypes(rt.requestTypes);
  }, []);

  const loadKpis = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedUserIds.length) params.set('assignedToIds', selectedUserIds.join(','));
    const res = await api.get<DashboardKpis>(`/dashboard/kpis?${params.toString()}`);
    setKpis(res);
  }, [selectedUserIds]);

  const loadActions = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (selectedFilters.length) params.set('filters', selectedFilters.join(','));
    if (selectedUserIds.length) params.set('assignedToIds', selectedUserIds.join(','));
    const res = await api.get<{ actions: Action[] }>(`/actions?${params.toString()}`);
    setActions(res.actions);
  }, [search, selectedFilters, selectedUserIds]);

  const loadCompleted = useCallback(async () => {
    const params = new URLSearchParams({ status: 'COMPLETED' });
    if (selectedUserIds.length) params.set('assignedToIds', selectedUserIds.join(','));
    const res = await api.get<{ actions: Action[] }>(`/actions?${params.toString()}`);
    setCompletedActions(res.actions);
  }, [selectedUserIds]);

  const loadWorkingOn = useCallback(async () => {
    const params = new URLSearchParams({ status: 'IN_PROGRESS' });
    if (selectedUserIds.length) params.set('assignedToIds', selectedUserIds.join(','));
    const res = await api.get<{ actions: Action[] }>(`/actions?${params.toString()}`);
    const sorted = [...res.actions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    setWorkingOnActions(sorted);
  }, [selectedUserIds]);

  useEffect(() => {
    loadStatic();
  }, [loadStatic]);

  useEffect(() => {
    loadKpis();
    loadActions();
    loadCompleted();
    loadWorkingOn();
  }, [loadKpis, loadActions, loadCompleted, loadWorkingOn]);

  async function refreshAll() {
    await Promise.all([loadKpis(), loadActions(), loadCompleted(), loadWorkingOn()]);
  }

  async function openAction(action: Action) {
    const res = await api.get<{ action: Action }>(`/actions/${action.id}`);
    setSelectedAction(res.action);
  }

  async function changeStatus(actionId: number, status: ActionStatus) {
    try {
      await api.post(`/actions/${actionId}/status`, { status });
    } catch (err) {
      setToast({ message: err instanceof ApiError ? err.message : 'Could not update status', variant: 'error' });
      return;
    }
    if (status === 'COMPLETED') {
      const completedTicket = actions.find((a) => a.id === actionId);
      setToast({ message: `${completedTicket ? completedTicket.client.name : 'Ticket'} marked as completed`, variant: 'success' });
    }
    await refreshAll();
  }

  async function addNote(actionId: number, text: string) {
    await api.post(`/actions/${actionId}/notes`, { text });
    await refreshAll();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Action</button>
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <Toolbar search={search} onSearchChange={setSearch} />

          <FilterBar
            users={users}
            selectedUserIds={selectedUserIds}
            onToggleUser={toggleUser}
            selectedFilters={selectedFilters}
            onToggleFilter={toggleFilter}
            onClearAll={clearAll}
          />

          <ActionList actions={actions} onSelect={openAction} onStatusChange={changeStatus} onAddNote={addNote} />
        </div>

        <div className="side-rail">
          <KpiCards kpis={kpis} />
          <WorkingOnPanel actions={workingOnActions} onSelect={openAction} />
          <CompletedRail actions={completedActions} onSelect={openAction} />
        </div>
      </div>

      {showCreate && (
        <CreateActionDrawer
          users={users}
          requestTypes={requestTypes}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await refreshAll();
          }}
          onRequestTypeCreated={(rt) => setRequestTypes((prev) => [...prev, rt].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {selectedAction && (
        <ActionDetailDrawer
          action={selectedAction}
          users={users}
          onClose={() => setSelectedAction(null)}
          onUpdated={async () => {
            const res = await api.get<{ action: Action }>(`/actions/${selectedAction.id}`);
            setSelectedAction(res.action);
            await refreshAll();
          }}
        />
      )}

      {toast && <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />}
    </div>
  );
}

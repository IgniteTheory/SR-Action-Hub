import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Action, DashboardKpis, RequestType, UserSummary } from '../api/types';
import KpiCards from '../components/KpiCards';
import StaffTabs from '../components/StaffTabs';
import Toolbar from '../components/Toolbar';
import ActionList from '../components/ActionList';
import CompletedRail from '../components/CompletedRail';
import WorkingOnPanel from '../components/WorkingOnPanel';
import CreateActionDrawer from '../components/CreateActionDrawer';
import ActionDetailDrawer from '../components/ActionDetailDrawer';

export default function DashboardPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [completedActions, setCompletedActions] = useState<Action[]>([]);
  const [workingOnActions, setWorkingOnActions] = useState<Action[]>([]);
  const [staffFilter, setStaffFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  const loadStatic = useCallback(async () => {
    const [u, rt] = await Promise.all([
      api.get<{ users: UserSummary[] }>('/users'),
      api.get<{ requestTypes: RequestType[] }>('/request-types'),
    ]);
    setUsers(u.users);
    setRequestTypes(rt.requestTypes);
  }, []);

  const loadKpis = useCallback(async () => {
    const q = staffFilter !== 'all' ? `?assignedToId=${staffFilter}` : '';
    const res = await api.get<DashboardKpis>(`/dashboard/kpis${q}`);
    setKpis(res);
  }, [staffFilter]);

  const loadActions = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filter) params.set('filter', filter);
    if (staffFilter !== 'all') params.set('assignedToId', String(staffFilter));
    const res = await api.get<{ actions: Action[] }>(`/actions?${params.toString()}`);
    setActions(res.actions);
  }, [search, filter, staffFilter]);

  const loadCompleted = useCallback(async () => {
    const params = new URLSearchParams({ filter: 'completed' });
    if (staffFilter !== 'all') params.set('assignedToId', String(staffFilter));
    const res = await api.get<{ actions: Action[] }>(`/actions?${params.toString()}`);
    setCompletedActions(res.actions);
  }, [staffFilter]);

  const loadWorkingOn = useCallback(async () => {
    const params = new URLSearchParams({ status: 'IN_PROGRESS' });
    if (staffFilter !== 'all') params.set('assignedToId', String(staffFilter));
    const res = await api.get<{ actions: Action[] }>(`/actions?${params.toString()}`);
    const sorted = [...res.actions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    setWorkingOnActions(sorted);
  }, [staffFilter]);

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

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Action</button>
      </div>

      <KpiCards kpis={kpis} />

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <StaffTabs users={users} activeId={staffFilter} onChange={setStaffFilter} />

          <Toolbar search={search} onSearchChange={setSearch} filter={filter} onFilterChange={setFilter} />

          <ActionList actions={actions} onSelect={openAction} />
        </div>

        <div className="side-rail">
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
    </div>
  );
}

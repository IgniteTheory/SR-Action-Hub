import type { DashboardKpis } from '../api/types';

export default function KpiCards({ kpis }: { kpis: DashboardKpis | null }) {
  if (!kpis) return null;
  return (
    <div className="kpi-row">
      <div className="kpi-card overdue">
        <div className="value">{kpis.overdue}</div>
        <div className="label">🔴 Overdue</div>
      </div>
      <div className="kpi-card due-today">
        <div className="value">{kpis.dueToday}</div>
        <div className="label">🟠 Due Today</div>
      </div>
      <div className="kpi-card waiting">
        <div className="value">{kpis.waiting}</div>
        <div className="label">🟡 Waiting</div>
      </div>
      <div className="kpi-card completed">
        <div className="value">{kpis.completedToday}</div>
        <div className="label">🟢 Completed Today</div>
      </div>
      <div className="kpi-card new">
        <div className="value">{kpis.newActions}</div>
        <div className="label">📥 New Actions</div>
      </div>
      <div className="kpi-card approval">
        <div className="value">{kpis.approvalPending}</div>
        <div className="label">🧾 Approval Pending</div>
      </div>
      <div className="kpi-card stale">
        <div className="value">{kpis.stale}</div>
        <div className="label">⏰ Stale (4+ days)</div>
      </div>
      <div className="kpi-card">
        <div className="value">{kpis.avgTurnaroundHours != null ? `${kpis.avgTurnaroundHours}h` : '—'}</div>
        <div className="label">📈 Avg Turnaround</div>
      </div>
    </div>
  );
}

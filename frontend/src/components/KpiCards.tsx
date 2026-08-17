import { useState } from 'react';
import type { DashboardKpis } from '../api/types';

export default function KpiCards({ kpis }: { kpis: DashboardKpis | null }) {
  const [open, setOpen] = useState(true);
  if (!kpis) return null;
  return (
    <div className="dropdown-section">
      <button type="button" className="dropdown-section-toggle" onClick={() => setOpen((o) => !o)}>
        <span>Overview</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="kpi-mini-row">
          <button type="button" className="kpi-mini overdue">
            <span className="value">🔴 {kpis.overdue}</span>
            <span className="label">Overdue</span>
          </button>
          <button type="button" className="kpi-mini due-today">
            <span className="value">🟠 {kpis.dueToday}</span>
            <span className="label">Due Today</span>
          </button>
          <button type="button" className="kpi-mini waiting">
            <span className="value">🟡 {kpis.waiting}</span>
            <span className="label">Waiting</span>
          </button>
          <button type="button" className="kpi-mini completed">
            <span className="value">🟢 {kpis.completedToday}</span>
            <span className="label">Completed Today</span>
          </button>
          <button type="button" className="kpi-mini new">
            <span className="value">📥 {kpis.newActions}</span>
            <span className="label">New</span>
          </button>
          <button type="button" className="kpi-mini approval">
            <span className="value">🧾 {kpis.approvalPending}</span>
            <span className="label">Approval Pending</span>
          </button>
          <button type="button" className="kpi-mini stale">
            <span className="value">⏰ {kpis.stale}</span>
            <span className="label">Stale</span>
          </button>
          <button type="button" className="kpi-mini">
            <span className="value">📈 {kpis.avgTurnaroundHours != null ? `${kpis.avgTurnaroundHours}h` : '—'}</span>
            <span className="label">Avg Turnaround</span>
          </button>
        </div>
      )}
    </div>
  );
}

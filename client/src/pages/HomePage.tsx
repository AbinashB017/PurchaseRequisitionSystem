import { useState, useEffect } from 'react';
import { dashboardApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface DashboardData {
  submitted_count: number;
  ordered_total: number;
  overdue_count: number;
  received_last_7_days: number;
  status_breakdown: Record<string, number>;
  department_breakdown: Record<string, number>;
  received_per_week: Array<{ week: string; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     '#737368',
  submitted: '#9B761E',
  approved:  '#1F4D3A',
  ordered:   '#705969',
  received:  '#4A6B53',
  rejected:  '#8C3B3B',
};

function StatCard({ label, value, sub, color = 'brand' }: {
  label: string; value: string | number; sub?: string; color?: 'brand' | 'amber' | 'red' | 'emerald' | 'violet'
}) {
  const borderColors: Record<string, string> = {
    brand: 'border-brand-600',
    amber: 'border-[#9B761E]',
    red: 'border-[#8C3B3B]',
    emerald: 'border-[#4A6B53]',
    violet: 'border-[#705969]',
  };
  return (
    <div className={`card overflow-hidden border-t-2 ${borderColors[color]}`}>
      <div className="p-6 relative">
        <p className="text-sm font-medium text-surface-600">{label}</p>
        <p className="text-3xl font-serif text-surface-900 mt-1 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// Simple horizontal bar chart rendered with divs
function HorizontalBarChart({ data, colors }: { data: Record<string, number>; colors?: Record<string, string> }) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="space-y-2">
      {entries.map(([label, count]) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-24 text-xs text-surface-600 text-right capitalize shrink-0">{label}</div>
          <div className="flex-1 h-5 bg-surface-100 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all duration-500"
              style={{
                width: `${(count / max) * 100}%`,
                backgroundColor: colors?.[label] || '#1F4D3A',
                minWidth: count > 0 ? '4px' : '0',
              }}
            />
          </div>
          <div className="text-xs font-medium text-surface-700 w-6 text-right shrink-0">{count}</div>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-sm text-surface-400 text-center py-4">No data yet</p>
      )}
    </div>
  );
}

// Line chart rendered as SVG
function LineChart({ data }: { data: Array<{ week: string; count: number }> }) {
  if (data.length === 0) return <p className="text-sm text-surface-400 text-center py-8">No data yet</p>;

  const W = 560, H = 160, pad = { top: 12, right: 12, bottom: 36, left: 32 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxV = Math.max(1, ...data.map(d => d.count));

  const points = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * innerW,
    y: pad.top + innerH - (d.count / maxV) * innerH,
    ...d,
  }));

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const area = [
    `${points[0].x},${pad.top + innerH}`,
    ...points.map(p => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${pad.top + innerH}`,
  ].join(' ');

  const formatWeek = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={pad.left} y1={pad.top + innerH * (1 - t)}
            x2={pad.left + innerW} y2={pad.top + innerH * (1 - t)}
            stroke="#e2e8f0" strokeWidth={1}
          />
        ))}
        {/* Y-axis labels */}
        {[0, Math.round(maxV * 0.5), maxV].map(v => (
          <text key={v} x={pad.left - 6} y={pad.top + innerH - (v / maxV) * innerH + 4}
            textAnchor="end" fontSize={10} fill="#94a3b8">{v}</text>
        ))}
        {/* Area fill */}
        <polygon points={area} fill="#1F4D3A" opacity={0.08} />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#1F4D3A" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="white" stroke="#1F4D3A" strokeWidth={2} />
            <title>{p.week}: {p.count} received</title>
          </g>
        ))}
        {/* X-axis labels */}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={H - 8} textAnchor="middle" fontSize={9} fill="#94a3b8">
            {formatWeek(p.week)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.getDashboard().then(res => {
      if (res.ok && res.data) {
        setData(res.data as DashboardData);
      } else {
        setError(res.error || 'Failed to load dashboard');
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-surface-500">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Loading dashboard…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-red-500">{error || 'No data'}</p>;
  }

  const totalReqs = Object.values(data.status_breakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-surface-500 mt-1">Here's an overview of your procurement pipeline.</p>
      </div>

      {/* Headline Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Awaiting Approval"
          value={data.submitted_count}
          sub="submitted requisitions"
          color="amber"
        />
        <StatCard
          label="Open Commitments"
          value={`$${Number(data.ordered_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="ordered requisitions"
          color="brand"
        />
        <StatCard
          label="Overdue Orders"
          value={data.overdue_count}
          sub="past needed-by date"
          color={data.overdue_count > 0 ? 'red' : 'emerald'}
        />
        <StatCard
          label="Received (Last 7 Days)"
          value={data.received_last_7_days}
          sub="rolling 7-day window"
          color="violet"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-surface-900 mb-1">Status Breakdown</h2>
          <p className="text-xs text-surface-400 mb-4">{totalReqs} total requisition{totalReqs !== 1 ? 's' : ''}</p>
          <HorizontalBarChart data={data.status_breakdown} colors={STATUS_COLORS} />
        </div>

        {/* Department Breakdown */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-surface-900 mb-1">Department Breakdown</h2>
          <p className="text-xs text-surface-400 mb-4">Requisitions by department</p>
          <HorizontalBarChart data={data.department_breakdown} />
        </div>
      </div>

      {/* Received Per Week Chart */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-surface-900 mb-1">Receipts Per Week</h2>
        <p className="text-xs text-surface-400 mb-4">Requisitions completed (received) — last 8 rolling weeks</p>
        <LineChart data={data.received_per_week} />
      </div>
    </div>
  );
}

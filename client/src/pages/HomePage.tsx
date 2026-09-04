import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

// ── Clickable StatCard ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'brand', href }: {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'brand' | 'amber' | 'red' | 'emerald' | 'violet';
  href?: string;
}) {
  const navigate = useNavigate();
  const borderColors: Record<string, string> = {
    brand:   'border-brand-600',
    amber:   'border-[#9B761E]',
    red:     'border-[#8C3B3B]',
    emerald: 'border-[#4A6B53]',
    violet:  'border-[#705969]',
  };

  const clickable = !!href;
  return (
    <div
      className={`card overflow-hidden border-t-2 ${borderColors[color]} ${
        clickable
          ? 'cursor-pointer hover:bg-surface-100 transition-colors duration-150'
          : ''
      }`}
      onClick={href ? () => navigate(href) : undefined}
      role={href ? 'button' : undefined}
      tabIndex={href ? 0 : undefined}
      onKeyDown={href ? (e) => e.key === 'Enter' && navigate(href) : undefined}
      title={href ? `Click to view details` : undefined}
    >
      <div className="p-6 relative">
        <p className="text-sm font-medium text-surface-600">{label}</p>
        <p className="text-3xl font-serif text-surface-900 mt-1 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
        {clickable && (
          <span className="absolute bottom-3 right-4 text-[10px] text-surface-400 font-medium select-none">
            View →
          </span>
        )}
      </div>
    </div>
  );
}

// ── Clickable Horizontal Bar Chart ────────────────────────────────────────────
function HorizontalBarChart({
  data,
  colors,
  onBarClick,
}: {
  data: Record<string, number>;
  colors?: Record<string, string>;
  onBarClick?: (label: string) => void;
}) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const clickable = !!onBarClick;

  return (
    <div className="space-y-2">
      {entries.map(([label, count]) => (
        <div
          key={label}
          className={`flex items-center gap-3 ${clickable ? 'cursor-pointer group' : ''}`}
          onClick={clickable ? () => onBarClick!(label) : undefined}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          onKeyDown={clickable ? (e) => e.key === 'Enter' && onBarClick!(label) : undefined}
          title={clickable ? `Filter by ${label}` : undefined}
        >
          <div className={`w-24 text-xs text-right capitalize shrink-0 transition-colors duration-100 ${
            clickable ? 'text-surface-700 group-hover:text-brand-600' : 'text-surface-600'
          }`}>
            {label}
          </div>
          <div className="flex-1 h-5 bg-surface-100 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all duration-500 ${
                clickable ? 'group-hover:opacity-80' : ''
              }`}
              style={{
                width: `${(count / max) * 100}%`,
                backgroundColor: colors?.[label] || '#1F4D3A',
                minWidth: count > 0 ? '4px' : '0',
              }}
            />
          </div>
          <div className={`text-xs font-medium w-6 text-right shrink-0 tabular-nums transition-colors duration-100 ${
            clickable ? 'text-surface-700 group-hover:text-brand-600' : 'text-surface-700'
          }`}>
            {count}
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-sm text-surface-400 text-center py-4">No data yet</p>
      )}
    </div>
  );
}

// ── Line Chart with hover tooltips ────────────────────────────────────────────
function LineChart({ data }: { data: Array<{ week: string; count: number }> }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; week: string; count: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (data.length === 0) return <p className="text-sm text-surface-400 text-center py-8">No data yet</p>;

  const W = 560, H = 160, pad = { top: 16, right: 16, bottom: 36, left: 32 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const maxV = Math.max(1, ...data.map(d => d.count));

  const points = data.map((d, i) => ({
    x: data.length === 1
      ? pad.left + innerW / 2
      : pad.left + (i / (data.length - 1)) * innerW,
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

  /** Compute week date range: Mon–Sun of the given ISO week-start (Monday) */
  const formatWeekRange = (iso: string) => {
    const start = new Date(iso);
    const end = new Date(iso);
    end.setUTCDate(end.getUTCDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return `${fmt(start)} – ${fmt(end)}`;
  };

  return (
    <div className="overflow-x-auto relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 320 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={pad.left} y1={pad.top + innerH * (1 - t)}
            x2={pad.left + innerW} y2={pad.top + innerH * (1 - t)}
            stroke="#E5E5DF" strokeWidth={1}
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
        {/* Dots — interactive */}
        {points.map((p, i) => (
          <g
            key={i}
            style={{ cursor: 'default' }}
            onMouseEnter={() => setTooltip({ x: p.x, y: p.y, week: p.week, count: p.count })}
          >
            {/* larger invisible hit target */}
            <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
            <circle
              cx={p.x} cy={p.y} r={tooltip?.week === p.week ? 5 : 4}
              fill="white" stroke="#1F4D3A" strokeWidth={2}
              style={{ transition: 'r 0.1s' }}
            />
          </g>
        ))}
        {/* X-axis labels */}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={H - 8} textAnchor="middle" fontSize={9} fill="#94a3b8">
            {formatWeek(p.week)}
          </text>
        ))}
        {/* SVG Tooltip rendered inside SVG for correct positioning */}
        {tooltip && (() => {
          const tw = 140, th = 44, margin = 8;
          // Flip to left if too close to right edge
          const tx = tooltip.x + margin + tw > W ? tooltip.x - margin - tw : tooltip.x + margin;
          const ty = Math.max(pad.top, tooltip.y - th / 2);
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={tx} y={ty} width={tw} height={th} rx={3}
                fill="#1A1D23" opacity={0.92} />
              <text x={tx + 10} y={ty + 16} fontSize={9} fill="#b0b0a5">
                {formatWeekRange(tooltip.week)}
              </text>
              <text x={tx + 10} y={ty + 32} fontSize={13} fontWeight="600" fill="white"
                fontFamily="Newsreader, Georgia, serif">
                {tooltip.count} received
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // Navigation targets for clickable elements
  const awaitingHref = user?.role === 'approver'
    ? '/queues/submitted'                       // approvers → their dedicated queue
    : '/requisitions?status=submitted';         // requesters → filtered list

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-surface-500 mt-1">Here's an overview of your procurement pipeline.</p>
      </div>

      {/* Headline Cards — all clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Awaiting Approval"
          value={data.submitted_count}
          sub="submitted requisitions"
          color="amber"
          href={awaitingHref}
        />
        <StatCard
          label="Open Commitments"
          value={`$${Number(data.ordered_total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="ordered requisitions"
          color="brand"
          href="/requisitions?status=ordered"
        />
        <StatCard
          label="Overdue Orders"
          value={data.overdue_count}
          sub="past needed-by date"
          color={data.overdue_count > 0 ? 'red' : 'emerald'}
          href={user?.role === 'approver' ? '/alerts' : '/requisitions?overdue=true'}
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
        {/* Status Breakdown — bars are clickable */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-surface-900 mb-1">Status Breakdown</h2>
          <p className="text-xs text-surface-400 mb-4">{totalReqs} total requisition{totalReqs !== 1 ? 's' : ''} · click a bar to filter</p>
          <HorizontalBarChart
            data={data.status_breakdown}
            colors={STATUS_COLORS}
            onBarClick={(status) => navigate(`/requisitions?status=${encodeURIComponent(status)}`)}
          />
        </div>

        {/* Department Breakdown — bars are clickable */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-surface-900 mb-1">Department Breakdown</h2>
          <p className="text-xs text-surface-400 mb-4">Requisitions by department · click a bar to filter</p>
          <HorizontalBarChart
            data={data.department_breakdown}
            onBarClick={(dept) => navigate(`/requisitions?department=${encodeURIComponent(dept)}`)}
          />
        </div>
      </div>

      {/* Received Per Week Chart — hover tooltips only */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-surface-900 mb-1">Receipts Per Week</h2>
        <p className="text-xs text-surface-400 mb-4">Requisitions completed (received) — last 8 rolling weeks · hover for exact count</p>
        <LineChart data={data.received_per_week} />
      </div>
    </div>
  );
}


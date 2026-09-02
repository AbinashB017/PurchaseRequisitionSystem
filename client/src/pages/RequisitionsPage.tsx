import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { requisitionApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import StatusDot from '../components/StatusDot';


const STATUS_OPTIONS = ['draft', 'submitted', 'approved', 'ordered', 'received'];

type SortField = 'needed_by_date' | 'status' | 'created_at' | 'total';
type SortDir = 'asc' | 'desc';

export default function RequisitionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Derive state from URL
  const q          = searchParams.get('q')          || '';
  const status     = searchParams.get('status')     || '';
  const department = searchParams.get('department') || '';
  const overdue    = searchParams.get('overdue')    || '';
  const archived   = searchParams.get('archived')   || '';
  const sortBy     = (searchParams.get('sortBy')    || 'created_at') as SortField;
  const sortDir    = (searchParams.get('sortDir')   || 'desc') as SortDir;
  const page       = parseInt(searchParams.get('page') || '1', 10);
  const pageSize   = 20;

  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local input state — only written to URL on submit/blur, never on every keystroke.
  // This is critical: if these were URL-bound on onChange, navigating from the dashboard
  // to /requisitions?status=draft would still work (clean URL), but any pending local
  // state from a previous visit would silently survive component re-use in the same
  // React Router session and combine with the incoming filter.
  const [qInput, setQInput] = useState(q);
  const [deptInput, setDeptInput] = useState(department);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize), sortBy, sortDir };
    if (q)          params.q = q;
    if (status)     params.status = status;
    if (department) params.department = department;
    if (overdue)    params.overdue = overdue;
    if (archived)   params.archived = archived;

    const res = await requisitionApi.list(params);
    if (res.ok && res.data) {
      const { data, meta } = res.data as any;
      setRequisitions(data);
      setMeta(meta);
    } else {
      setError(res.error || 'Failed to fetch requisitions');
    }
    setLoading(false);
  }, [q, status, department, overdue, archived, sortBy, sortDir, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync local inputs whenever the URL changes (e.g. dashboard navigation replaces URL)
  useEffect(() => { setQInput(q); }, [q]);
  useEffect(() => { setDeptInput(department); }, [department]);

  const updateParams = (updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
      next.set('page', '1'); // reset page on any filter change
      return next;
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: qInput });
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      updateParams({ sortBy: field, sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ sortBy: field, sortDir: 'desc' });
    }
  };

  const setPage = (p: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <span className="ml-1 text-surface-300">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>{user?.role === 'approver' ? 'All Requisitions' : 'My Requisitions'}</h1>
          <p className="mt-1 text-surface-500">
            {user?.role === 'approver'
              ? 'Browse and search all requisitions across every status.'
              : 'Manage your purchase requests.'}
          </p>
        </div>
        {user?.role === 'requester' && (
          <Link to="/requisitions/new" className="btn-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Requisition
          </Link>
        )}
      </div>

      {/* Search + Filters */}
      <div className="ledger-section space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={qInput}
            onChange={e => setQInput(e.target.value)}
            placeholder="Search title or vendor..."
            className="input flex-1"
          />
          <button type="submit" className="btn-primary px-5">Search</button>
          {q && (
            <button type="button" onClick={() => { setQInput(''); updateParams({ q: '' }); }} className="btn-ghost px-3 text-sm">
              Clear
            </button>
          )}
        </form>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Status filter */}
          <select
            value={status}
            onChange={e => updateParams({ status: e.target.value })}
            className="input py-1.5 text-sm w-40"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {/* Department filter — committed on blur or Enter, not on every keystroke */}
          <input
            type="text"
            value={deptInput}
            onChange={e => setDeptInput(e.target.value)}
            onBlur={() => updateParams({ department: deptInput })}
            onKeyDown={e => { if (e.key === 'Enter') updateParams({ department: deptInput }); }}
            placeholder="Department..."
            className="input py-1.5 text-sm w-40"
          />

          {/* Overdue filter */}
          <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overdue === 'true'}
              onChange={e => updateParams({ overdue: e.target.checked ? 'true' : '' })}
              className="rounded"
            />
            Overdue only
          </label>

          {/* Archived filter */}
          <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={archived === 'true'}
              onChange={e => updateParams({ archived: e.target.checked ? 'true' : '' })}
              className="rounded"
            />
            Show archived
          </label>

          {/* Active filter pills */}
          {(q || status || department || overdue || archived) && (
            <button
              onClick={() => setSearchParams({})}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="border-t border-surface-200 pt-4">
        {/* Result count */}
        {meta && (
          <div className="px-6 py-3 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
            <span className="text-xs text-surface-500">
              {meta.total} result{meta.total !== 1 ? 's' : ''}
              {meta.totalPages > 1 && ` · Page ${page} of ${meta.totalPages}`}
            </span>
          </div>
        )}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surface-200">
              <th className="px-6 py-4 text-sm font-medium text-surface-600">Title</th>
              <th className="px-6 py-4 text-sm font-medium text-surface-600">Vendor</th>
              <th
                className="px-6 py-4 text-sm font-medium text-surface-600 cursor-pointer hover:text-surface-900"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon field="status" />
              </th>
              <th
                className="px-6 py-4 text-sm font-medium text-surface-600 text-right cursor-pointer hover:text-surface-900"
                onClick={() => handleSort('total')}
              >
                Total <SortIcon field="total" />
              </th>
              <th
                className="px-6 py-4 text-sm font-medium text-surface-600 text-right cursor-pointer hover:text-surface-900"
                onClick={() => handleSort('needed_by_date')}
              >
                Needed By <SortIcon field="needed_by_date" />
              </th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-400 text-sm">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-500 text-sm">{error}</td>
              </tr>
            ) : requisitions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-500 text-sm">
                  No requisitions match your filters.
                </td>
              </tr>
            ) : (
              requisitions.map((req) => {
                const isOverdue = req.status === 'ordered' && new Date(req.needed_by_date) < new Date();
                return (
                  <tr key={req.id} className="hover:bg-surface-50/50 transition-colors border-b border-surface-100 last:border-0">
                    <td className="px-6 py-4 text-sm font-medium text-surface-900">
                      {req.title}
                      {isOverdue && (
                        <span className="ml-2 text-xs font-medium text-[#8C3B3B]">Overdue</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-600">{req.vendor_name}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <StatusDot status={req.status} />
                        {req.archived_at && (
                          <span className="text-[10px] font-medium text-surface-500 uppercase tracking-widest">(Archived)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-900 text-right tabular-nums">
                      ${Number(req.total).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-600 text-right tabular-nums">
                      {new Date(req.needed_by_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/requisitions/${req.id}`} className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-surface-200 flex items-center justify-between">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === meta.totalPages || Math.abs(p - page) <= 2)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && (arr[i - 1] as number) !== p - 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-2 py-1 text-surface-400 text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        p === page
                          ? 'bg-brand-600 text-white'
                          : 'text-surface-600 hover:bg-surface-100'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= meta.totalPages}
              className="btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

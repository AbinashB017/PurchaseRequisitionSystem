import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { queueApi } from '../lib/api';
import StatusDot from '../components/StatusDot';

interface Props {
  assignedOnly?: boolean;
}

export default function ApproverQueuePage({ assignedOnly = false }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();

  const q        = searchParams.get('q')          || '';
  const archived = searchParams.get('archived')   || '';
  const sortDir  = (searchParams.get('sortDir')   || 'asc') as 'asc' | 'desc';
  const page     = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20;

  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search input (local)
  const [qInput, setQInput] = useState(q);

  // Bulk approve state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {
      page: String(page),
      pageSize: String(pageSize),
      sortDir,
    };
    if (q) params.q = q;
    if (archived) params.archived = archived;

    const res = assignedOnly
      ? await queueApi.getAssignedToMe(params)
      : await queueApi.getSubmittedQueue(params);

    if (res.ok && res.data) {
      const { data, meta } = res.data as any;
      setRequisitions(data);
      setMeta(meta);
      // Clear selections that are no longer in this page
      setSelected(prev => {
        const ids = new Set(data.map((r: any) => r.id));
        return new Set([...prev].filter(id => ids.has(id)));
      });
    } else {
      setError(res.error || 'Failed to fetch queue');
    }
    setLoading(false);
  }, [assignedOnly, q, archived, sortDir, page]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);
  useEffect(() => { setQInput(q); }, [q]);

  const updateParams = (updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
      next.set('page', '1');
      return next;
    });
  };

  const setPage = (p: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: qInput });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === requisitions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(requisitions.map(r => r.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    setBulkResult(null);
    const res = await queueApi.bulkApprove([...selected]);
    if (res.ok && res.data) {
      setBulkResult(res.data);
      setSelected(new Set());
      await fetchQueue();
    } else {
      setBulkResult({ error: res.error || 'Bulk approve failed' });
    }
    setBulkLoading(false);
  };

  const handleExportCsv = () => {
    const url = queueApi.exportOrderedCsvUrl();
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ordered-requisitions.csv';
    // Pass cookie by navigating to the URL directly
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>{assignedOnly ? 'Assigned to Me' : 'Submitted Queue'}</h1>
          <p className="mt-1 text-surface-500">
            {assignedOnly
              ? 'Requisitions specifically assigned to you for review.'
              : 'All submitted requisitions awaiting approval.'}
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={bulkLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {bulkLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              Bulk Approve ({selected.size})
            </button>
          )}
          <button
            onClick={handleExportCsv}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Ordered CSV
          </button>
        </div>
      </div>

      {/* Bulk Approve Result */}
      {bulkResult && (
        <div className={`ledger-section border-l-4 p-5 ${bulkResult.error ? 'border-l-[#8C3B3B] bg-[#8C3B3B]/5' : 'border-l-[#4A6B53] bg-[#4A6B53]/5'}`}>
          {bulkResult.error ? (
            <p className="text-[#8C3B3B] text-sm font-medium">{bulkResult.error}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm font-medium">
                <span className="text-[#4A6B53]">✅ Approved: {bulkResult.summary.approved_count}</span>
                <span className="text-[#8C3B3B]">❌ Refused: {bulkResult.summary.refused_count}</span>
                <button onClick={() => setBulkResult(null)} className="ml-auto text-surface-500 hover:text-surface-900 text-xs underline decoration-surface-300">Dismiss</button>
              </div>
              {bulkResult.approved.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#4A6B53] mb-1">Approved:</p>
                  {bulkResult.approved.map((a: any) => (
                    <div key={a.id} className="text-xs text-[#4A6B53]">• {a.title} — ${Number(a.total).toFixed(2)}</div>
                  ))}
                </div>
              )}
              {bulkResult.refused.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#8C3B3B] mb-1">Refused:</p>
                  {bulkResult.refused.map((r: any) => (
                    <div key={r.id} className="text-xs text-[#8C3B3B]">• {r.title} — {r.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="ledger-section pb-4">
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
            <button type="button" onClick={() => { setQInput(''); updateParams({ q: '' }); }} className="btn-ghost text-sm px-3">
              Clear
            </button>
          )}
          {/* Archived toggle */}
          <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer select-none ml-2 mr-2">
            <input
              type="checkbox"
              checked={archived === 'true'}
              onChange={e => updateParams({ archived: e.target.checked ? 'true' : '' })}
              className="rounded"
            />
            Show archived
          </label>
          {/* Sort toggle */}
          <button
            type="button"
            onClick={() => updateParams({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })}
            className="btn-ghost text-sm px-3 flex items-center gap-1"
            title="Toggle sort direction for Needed By"
          >
            Needed By {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </form>
      </div>

      {/* Queue Items */}
      <div className="border-t border-surface-200 pt-4">
        {meta && (
          <div className="px-6 py-3 border-b border-surface-200 bg-surface-50 text-xs text-surface-500">
            {meta.total} result{meta.total !== 1 ? 's' : ''}
            {meta.totalPages > 1 && ` · Page ${page} of ${meta.totalPages}`}
          </div>
        )}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surface-200">
              <th className="px-6 py-4 w-10">
                <input
                  type="checkbox"
                  checked={requisitions.length > 0 && selected.size === requisitions.length}
                  onChange={toggleSelectAll}
                  className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
              </th>
              <th className="px-6 py-4 text-sm font-medium text-surface-600">Title</th>
              <th className="px-6 py-4 text-sm font-medium text-surface-600">Requester</th>
              <th className="px-6 py-4 text-sm font-medium text-surface-600">Vendor</th>
              <th className="px-6 py-4 text-sm font-medium text-surface-600 text-right">Total</th>
              <th className="px-6 py-4 text-sm font-medium text-surface-600 text-right">Needed By</th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-surface-400 text-sm">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-red-500 text-sm">{error}</td></tr>
            ) : requisitions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-surface-500 text-sm">
                  {assignedOnly
                    ? 'No requisitions are currently assigned to you.'
                    : 'No requisitions are currently awaiting approval.'}
                </td>
              </tr>
            ) : (
              requisitions.map(req => (
                <tr
                  key={req.id}
                  className={`hover:bg-surface-50/50 transition-colors border-b border-surface-100 last:border-0 ${selected.has(req.id) ? 'bg-surface-100/50' : ''}`}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(req.id)}
                      onChange={() => toggleSelect(req.id)}
                      className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-surface-900">
                    <div className="flex items-center gap-2">
                      {req.title}
                      {req.archived_at && (
                        <span className="text-[10px] font-medium text-surface-500 uppercase tracking-widest">(Archived)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-600">{req.owner?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-sm text-surface-600">{req.vendor_name}</td>
                  <td className="px-6 py-4 text-sm text-surface-900 text-right tabular-nums">
                    ${Number(req.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-600 text-right tabular-nums">
                    {new Date(req.needed_by_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/requisitions/${req.id}`} className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                      Review
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-surface-200 flex items-center justify-between">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="btn-ghost text-sm disabled:opacity-40">
              ← Previous
            </button>
            <span className="text-sm text-surface-600">Page {page} of {meta.totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages} className="btn-ghost text-sm disabled:opacity-40">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requisitionApi } from '../lib/api';

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequisitions();
  }, []);

  const fetchRequisitions = async () => {
    setLoading(true);
    const res = await requisitionApi.listMyRequisitions();
    if (res.ok && res.data) {
      setRequisitions(res.data as any[]);
    } else {
      setError(res.error || 'Failed to fetch requisitions');
    }
    setLoading(false);
  };

  if (loading) {
    return <p className="text-surface-500">Loading requisitions...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>My Requisitions</h1>
          <p className="mt-1 text-surface-500">Manage your purchase requests.</p>
        </div>
        <Link to="/requisitions/new" className="btn-primary">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Requisition
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50">
              <th className="px-4 py-3 text-sm font-medium text-surface-600">Title</th>
              <th className="px-4 py-3 text-sm font-medium text-surface-600">Vendor</th>
              <th className="px-4 py-3 text-sm font-medium text-surface-600">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-surface-600 text-right">Total</th>
              <th className="px-4 py-3 text-sm font-medium text-surface-600 text-right">Needed By</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {requisitions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-500 text-sm">
                  You haven't created any requisitions yet.
                </td>
              </tr>
            ) : (
              requisitions.map((req) => (
                <tr key={req.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-surface-900">{req.title}</td>
                  <td className="px-4 py-3 text-sm text-surface-600">{req.vendor_name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`badge badge-${req.status}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-900 text-right font-medium">
                    ${Number(req.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600 text-right">
                    {new Date(req.needed_by_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/requisitions/${req.id}`} className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

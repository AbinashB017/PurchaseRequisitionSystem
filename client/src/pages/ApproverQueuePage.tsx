import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { queueApi } from '../lib/api';

interface Props {
  assignedOnly?: boolean;
}

export default function ApproverQueuePage({ assignedOnly = false }: Props) {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, [assignedOnly]);

  const fetchQueue = async () => {
    setLoading(true);
    const res = assignedOnly
      ? await queueApi.getAssignedToMe()
      : await queueApi.getSubmittedQueue();
    if (res.ok && res.data) {
      setRequisitions(res.data as any[]);
    } else {
      setError(res.error || 'Failed to fetch queue');
    }
    setLoading(false);
  };

  if (loading) return <p className="text-surface-500">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1>{assignedOnly ? 'Assigned to Me' : 'Submitted Queue'}</h1>
        <p className="mt-1 text-surface-500">
          {assignedOnly
            ? 'Requisitions that have been specifically assigned to you for review.'
            : 'All submitted requisitions awaiting approval.'}
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50">
              <th className="px-4 py-3 text-sm font-medium text-surface-600">Title</th>
              <th className="px-4 py-3 text-sm font-medium text-surface-600">Requester</th>
              <th className="px-4 py-3 text-sm font-medium text-surface-600">Vendor</th>
              <th className="px-4 py-3 text-sm font-medium text-surface-600 text-right">Total</th>
              <th className="px-4 py-3 text-sm font-medium text-surface-600 text-right">Needed By</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {requisitions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-500 text-sm">
                  {assignedOnly
                    ? 'No requisitions are currently assigned to you.'
                    : 'No requisitions are currently awaiting approval.'}
                </td>
              </tr>
            ) : (
              requisitions.map((req) => (
                <tr key={req.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-surface-900">{req.title}</td>
                  <td className="px-4 py-3 text-sm text-surface-600">{req.owner?.name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-sm text-surface-600">{req.vendor_name}</td>
                  <td className="px-4 py-3 text-sm text-surface-900 text-right font-medium">
                    ${Number(req.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-600 text-right">
                    {new Date(req.needed_by_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/requisitions/${req.id}`} className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                      Review
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

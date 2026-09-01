import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function AlertsPage() {
  const { refreshAlertCount } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    const res = await dashboardApi.getAlerts();
    if (res.ok && res.data) {
      setAlerts(res.data as any[]);
    } else {
      setError(res.error || 'Failed to load alerts');
    }
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const handleDismiss = async (requisitionId: string) => {
    setDismissing(requisitionId);
    const res = await dashboardApi.dismiss(requisitionId);
    if (res.ok) {
      // Remove the dismissed alert from the list
      setAlerts(prev => prev.filter(a => a.id !== requisitionId));
      refreshAlertCount(); // Update the nav badge
    } else {
      alert(res.error || 'Failed to dismiss alert');
    }
    setDismissing(null);
  };

  const daysPast = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-500">
        Loading alerts…
      </div>
    );
  }

  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="ledger-section pb-6 border-b-0">
        <h1 className="text-3xl font-serif text-surface-900">Overdue Alerts</h1>
        <p className="text-surface-500 mt-2">
          Ordered requisitions assigned to you that have passed their needed-by date.
          Dismissing an alert hides it until the date is extended.
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="ledger-section py-16 text-center border-t-2 border-[#4A6B53]">
          <div className="w-16 h-16 rounded-full bg-[#4A6B53]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#4A6B53]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h3 className="text-lg font-serif text-surface-900 mb-1">All clear!</h3>
          <p className="text-surface-500 text-sm">No overdue requisitions assigned to you right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const past = daysPast(alert.needed_by_date);
            return (
              <div
                key={alert.id}
                className="ledger-section border-l-4 border-l-[#8C3B3B] p-5 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  {/* Alert Icon */}
                  <div className="w-10 h-10 rounded-full bg-[#8C3B3B]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-[#8C3B3B]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/requisitions/${alert.id}`}
                        className="font-medium text-surface-900 hover:text-brand-700 truncate"
                      >
                        {alert.title}
                      </Link>
                      <span className="text-xs font-medium text-[#8C3B3B]">
                        {past} day{past !== 1 ? 's' : ''} overdue
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-surface-500">
                      <span>Vendor: <span className="text-surface-700">{alert.vendor_name}</span></span>
                      <span>Needed by: <span className="text-[#8C3B3B] font-medium tabular-nums">{new Date(alert.needed_by_date).toLocaleDateString()}</span></span>
                      <span>Total: <span className="text-surface-700 font-medium tabular-nums">${Number(alert.total).toFixed(2)}</span></span>
                      <span>Owner: <span className="text-surface-700">{alert.owner?.name}</span></span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/requisitions/${alert.id}`}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    disabled={dismissing === alert.id}
                    className="btn-ghost py-1.5 px-3 text-xs text-surface-500 hover:text-surface-700 disabled:opacity-50"
                  >
                    {dismissing === alert.id ? 'Dismissing…' : 'Dismiss'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

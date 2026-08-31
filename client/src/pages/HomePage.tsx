import { useAuth } from '../contexts/AuthContext';

/**
 * Placeholder home / dashboard page.
 * Will be replaced with real dashboard content in a later phase.
 */
export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1>Dashboard</h1>
        <p className="mt-1 text-surface-500">
          Welcome back, {user?.name}. You're logged in as a{' '}
          <span className="font-medium text-surface-700 capitalize">{user?.role}</span>.
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Awaiting Approval', value: '—', color: 'text-amber-600' },
          { label: 'Open Commitments', value: '—', color: 'text-brand-600' },
          { label: 'Overdue', value: '—', color: 'text-red-600' },
          { label: 'Received This Week', value: '—', color: 'text-emerald-600' },
        ].map((item) => (
          <div key={item.label} className="card p-5">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">
              {item.label}
            </p>
            <p className={`text-3xl font-bold mt-2 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </div>
          <p className="text-surface-500 text-sm">
            Dashboard charts and data will be built in a later phase.
          </p>
        </div>
      </div>
    </div>
  );
}

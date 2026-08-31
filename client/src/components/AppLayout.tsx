import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Main app shell with navigation bar.
 * Includes placeholder for alert badge (to be wired in a later phase).
 */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-surface-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & nav links */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-soft group-hover:shadow-medium transition-shadow">
                  <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                  </svg>
                </div>
                <span className="font-semibold text-surface-900 text-base">ProcureFlow</span>
              </Link>

              <div className="hidden sm:flex items-center gap-1">
                <Link
                  to="/"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/')
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
                  }`}
                >
                  Dashboard
                </Link>

                {user?.role === 'approver' && (
                  <div className="relative">
                    <Link
                      to="/alerts"
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                        isActive('/alerts')
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
                      }`}
                    >
                      Alerts
                      {/* Alert badge placeholder — will be wired to real count in a later phase */}
                      <span className="sr-only">alert count placeholder</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Right: User info & logout */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-surface-900">{user?.name}</span>
                <span className="text-xs text-surface-500 capitalize">{user?.role}</span>
              </div>
              <div className="w-px h-8 bg-surface-200" />
              <button
                onClick={handleLogout}
                className="btn-ghost text-surface-500 hover:text-red-600"
                title="Log out"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

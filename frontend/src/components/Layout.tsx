import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Menu, X, Brain, Home, FolderOpen, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { to: '/dashboard', icon: Home, label: 'Overview' },
    { to: '/scanner', icon: Activity, label: 'Scanner' },
    { to: '/batch', icon: FolderOpen, label: 'Batch' },
    { to: '/engine', icon: Brain, label: 'Model Lab' },
  ];

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* TOP NAV BAR */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/[0.12]">
        <div className="flex items-center h-14 px-6 md:px-8 gap-6">

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/soteria-logo.png" alt="Soteria" className="w-7 h-7 rounded-lg object-cover" />
            <span className="text-sm font-bold tracking-[0.15em] text-white uppercase hidden sm:block">SOTERIA</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive(to)
                    ? 'bg-white/[0.08] text-white border border-white/[0.10]'
                    : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            {/* User badge */}
            {user && (
              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-white/[0.12]">
                <div className="text-right hidden lg:block">
                  <p className="text-xs font-bold text-white leading-none tracking-wide">{user.name}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5 truncate max-w-[140px] font-normal">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-neutral-400 hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black pt-14 px-4 pb-6 md:hidden flex flex-col gap-1 overflow-y-auto">
          {[{ to: '/dashboard', icon: Home, label: 'Overview' }, ...navLinks].map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                isActive(to)
                  ? 'bg-white/[0.08] text-white border border-white/[0.10]'
                  : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          {user && (
            <>
              <div className="h-px bg-white/[0.12] my-2" />
              <div className="px-4 py-2">
                <p className="text-xs font-bold text-white tracking-wide">{user.name}</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">{user.email}</p>
              </div>
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          )}
        </div>
      )}

      {/* PAGE CONTENT */}
      <main className="flex-1 pt-14">
        {children}
      </main>

    </div>
  );
}

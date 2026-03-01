import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Shield, Activity, Menu, X, Github, Brain, Home, Info, Zap, FolderOpen, LogOut, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAdminAuthenticated } = useAdmin();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label, activeColor = "text-blue-400" }: any) => (
    <Link to={to} onClick={() => setMobileMenuOpen(false)}>
      <motion.button
        whileHover={{ x: 5 }}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all border border-transparent ${isActive(to)
          ? `bg-blue-500/[0.08] ${activeColor} border-blue-500/[0.12] shadow-lg shadow-blue-900/10`
          : 'text-neutral-500 hover:text-white hover:bg-white/[0.03]'
          }`}
      >
        <Icon className={`w-5 h-5 ${isActive(to) ? activeColor : 'text-neutral-600'}`} />
        {label}
        {isActive(to) && (
          <motion.div
            layoutId="active-pill"
            className="ml-auto w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]"
          />
        )}
      </motion.button>
    </Link>
  );

  return (
    <div className="min-h-screen w-full bg-black text-white overflow-hidden flex">

      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside className="hidden md:flex w-72 h-screen flex-col border-r border-white/[0.06] bg-black/80 backdrop-blur-xl z-50 fixed left-0 top-0">
        <div className="p-8">
          <Link to="/dashboard" className="flex items-center gap-3 mb-2">
            <img src="/soteria-logo.png" alt="Soteria" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="font-black text-xl tracking-tight text-white">SOTERIA</h1>
              <p className="text-[10px] font-mono text-neutral-600 tracking-widest uppercase">Security Engine</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 px-4 space-y-8 overflow-y-auto custom-scrollbar">

          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-neutral-700 uppercase tracking-widest mb-2">Workspace</p>
            <NavItem to="/scanner" icon={Activity} label="Code Reviewer" activeColor="text-blue-400" />
            <NavItem to="/batch" icon={FolderOpen} label="Batch Scanner" activeColor="text-purple-400" />
            {isAdminAuthenticated && (
              <NavItem to="/engine" icon={Brain} label="Model Lab" activeColor="text-cyan-400" />
            )}
          </div>

          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-neutral-700 uppercase tracking-widest mb-2">Resources</p>
            <NavItem to="/dashboard" icon={Home} label="Overview" />
            <NavItem to="/features" icon={Zap} label="Features" />
            <NavItem to="/changelog" icon={FileText} label="Changelog" />
            <NavItem to="/about" icon={Info} label="About" />
          </div>

        </div>

        <div className="p-6 border-t border-white/[0.06] space-y-3">
          {user && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/50 border border-white/[0.06]">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-neutral-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-mono text-neutral-500">System Online</span>
            </div>
            <p className="text-[10px] text-neutral-700">v2.4.0-stable</p>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/[0.06] p-4 flex justify-between items-center">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/soteria-logo.png" alt="Soteria" className="w-7 h-7 rounded-lg object-cover" />
          <span className="font-bold text-lg">SOTERIA</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-neutral-500">
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black pt-20 px-6 space-y-4 md:hidden">
          <NavItem to="/scanner" icon={Activity} label="Reviewer" />
          {isAdminAuthenticated && (
            <NavItem to="/engine" icon={Brain} label="Model Lab" />
          )}
          <div className="h-px bg-white/[0.06] my-4"></div>
          <NavItem to="/dashboard" icon={Home} label="Home" />
          <NavItem to="/features" icon={Zap} label="Features" />
          <NavItem to="/changelog" icon={FileText} label="Changelog" />
          {user && (
            <>
              <div className="h-px bg-white/[0.06] my-4"></div>
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 md:ml-72 min-h-screen relative z-10">
        <div className="h-full pt-20 md:pt-0">
          {children}
        </div>
      </main>

    </div>
  );
}

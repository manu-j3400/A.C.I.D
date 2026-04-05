/**
 * AppSidebar — the persistent left rail for all authenticated pages.
 * Design: Weaponized Minimalism · JetBrains Mono · Acid green accent #ADFF2F
 */
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Brain, Home, Layers, LogOut, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'OVERVIEW',  Icon: Home },
  { to: '/scanner',   label: 'SCANNER',   Icon: Activity },
  { to: '/batch',     label: 'BATCH',     Icon: Layers },
  { to: '/engine',    label: 'MODEL LAB', Icon: Brain },
];

const S = {
  sidebar:   { background: '#000', borderRight: '1px solid #141414', fontFamily: "'JetBrains Mono', monospace" },
  topBorder: { borderBottom: '1px solid #141414' },
  midBorder: { borderBottom: '1px solid #0D0D0D' },
  botBorder: { borderTop: '1px solid #141414' },
  pill:      { background: '#ADFF2F', color: '#000', borderRadius: 0 },
  pillHover: { background: '#C4FF52', color: '#000', borderRadius: 0 },
} as const;

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [btnHover, setBtnHover] = React.useState(false);
  const [logoutHover, setLogoutHover] = React.useState(false);

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-48 flex flex-col z-50 select-none" style={S.sidebar}>

      {/* ── Logo ── */}
      <div className="h-14 flex items-center gap-3 px-5 flex-shrink-0" style={S.topBorder}>
        <img src="/soteria-logo.png" alt="" className="w-5 h-5 object-cover" style={{ borderRadius: 0 }} />
        <span className="text-[10px] font-bold tracking-[0.28em] text-white">SOTERIA</span>
      </div>

      {/* ── Status pill ── */}
      <div className="px-5 py-2 flex-shrink-0" style={S.midBorder}>
        <span className="flex items-center gap-2 text-[9px] tracking-[0.18em] font-bold" style={{ color: '#ADFF2F' }}>
          <span className="inline-block w-1.5 h-1.5 animate-pulse" style={{ background: '#ADFF2F', borderRadius: 0 }} />
          SYSTEM LIVE
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 pt-2 overflow-y-auto">
        {NAV.map(({ to, label, Icon }) => {
          const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to));
          return (
            <Link key={to} to={to}
              className="relative flex items-center gap-3 px-5 py-[11px] text-[10px] font-bold tracking-[0.14em] transition-all duration-100 no-underline"
              style={{ color: active ? '#E5E5E5' : '#303030', background: active ? '#080808' : 'transparent' }}>
              {active && (
                <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: '#ADFF2F' }} />
              )}
              <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── New Scan CTA ── */}
      <div className="px-4 pb-4 flex-shrink-0">
        <button
          onClick={() => navigate('/scanner')}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold tracking-[0.14em] transition-all duration-100"
          style={btnHover ? S.pillHover : S.pill}>
          <Plus className="w-3 h-3" />
          NEW SCAN
        </button>
      </div>

      {/* ── User ── */}
      <div className="px-5 py-4 flex-shrink-0" style={S.botBorder}>
        {user && (
          <>
            <div className="text-[9px] tracking-[0.22em] mb-0.5" style={{ color: '#222' }}>OPERATOR</div>
            <div className="text-[9px] font-bold truncate mb-3" style={{ color: '#3A3A3A' }}>
              {user.email ?? user.name}
            </div>
          </>
        )}
        <button
          onClick={() => { logout(); navigate('/'); }}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          className="flex items-center gap-2 text-[9px] font-bold tracking-[0.14em] transition-all duration-100"
          style={{ color: logoutHover ? '#FF3131' : '#282828' }}>
          <LogOut className="w-3 h-3" />
          TERMINATE SESSION
        </button>
      </div>
    </aside>
  );
}

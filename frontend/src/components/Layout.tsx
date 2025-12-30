import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Shield, Activity, Menu, X, Github } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-x-hidden relative">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e1b4b_1px,transparent_1px),linear-gradient(to_bottom,#1e1b4b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
        
        {/* Hexagonal Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='28' height='49' viewBox='0 0 28 49' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23a855f7' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '28px 49px'
        }}></div>
        
        {/* Scanning Line Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/8 via-fuchsia-500/12 to-transparent animate-scan-line"></div>
        
        {/* Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/25 rounded-full blur-[140px] animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-fuchsia-500/25 rounded-full blur-[140px] animate-pulse-slow-delayed"></div>
        <div className="absolute top-1/2 right-1/3 w-[400px] h-[400px] bg-violet-500/20 rounded-full blur-[130px] animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
        
        {/* Animated Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/10 via-transparent to-fuchsia-900/10 animate-gradient"></div>
        
        {/* Subtle Noise Texture */}
        <div className="absolute inset-0 opacity-[0.02] bg-noise"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/60 rounded-2xl shadow-2xl shadow-purple-500/5">
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="p-2 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 rounded-lg group-hover:from-purple-500/30 group-hover:to-fuchsia-500/30 transition-all">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
                Sentinel
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/">
                <button
                  className={`px-4 py-2 text-sm rounded-lg transition-all ${
                    isActive('/') 
                      ? 'bg-purple-500/20 text-white' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Home
                </button>
              </Link>
              <Link to="/features">
                <button
                  className={`px-4 py-2 text-sm rounded-lg transition-all ${
                    isActive('/features') 
                      ? 'bg-purple-500/20 text-white' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Features
                </button>
              </Link>
              <Link to="/scanner">
                <button
                  className={`px-4 py-2 text-sm rounded-lg transition-all ${
                    isActive('/scanner') 
                      ? 'bg-purple-500/20 text-white' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Scanner
                </button>
              </Link>
              <Link to="/about">
                <button
                  className={`px-4 py-2 text-sm rounded-lg transition-all ${
                    isActive('/about') 
                      ? 'bg-purple-500/20 text-white' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  About
                </button>
              </Link>
            </div>

            {/* CTA Button */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/scanner">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-400 hover:to-fuchsia-400 text-white font-medium shadow-lg shadow-purple-500/25"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Try Scanner
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-800/60 px-6 py-4 space-y-2">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <button
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-all ${
                    isActive('/') 
                      ? 'bg-purple-500/20 text-white' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Home
                </button>
              </Link>
              <Link to="/features" onClick={() => setMobileMenuOpen(false)}>
                <button
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-all ${
                    isActive('/features') 
                      ? 'bg-purple-500/20 text-white' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Features
                </button>
              </Link>
              <Link to="/scanner" onClick={() => setMobileMenuOpen(false)}>
                <button
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-all ${
                    isActive('/scanner') 
                      ? 'bg-purple-500/20 text-white' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Scanner
                </button>
              </Link>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
                <button
                  className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-all ${
                    isActive('/about') 
                      ? 'bg-purple-500/20 text-white' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  About
                </button>
              </Link>
              <Link to="/scanner" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-400 hover:to-fuchsia-400 text-white font-medium shadow-lg shadow-purple-500/25"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Try Scanner
                </Button>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 pt-28 min-h-screen">
        {children}
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © 2025 Cyber Sentinel • Built with Advanced AI & Neural Networks
          </p>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-purple-400 transition-colors"
          >
            <Github className="w-5 h-5" />
            View on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

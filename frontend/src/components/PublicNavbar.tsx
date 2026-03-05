import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';

export default function PublicNavbar() {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b-2 border-neutral-800">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
                <Link to="/" className="flex items-center gap-3 group">
                    <img src="/soteria-logo.png" alt="Soteria" className="h-9 w-9 rounded-none object-cover transition-transform group-hover:-translate-y-[2px]" />
                    <span className="text-xl font-mono font-bold tracking-[0.15em] uppercase text-white">SOTERIA</span>
                </Link>

                <div className="hidden md:flex items-center gap-8">
                    <Link to="/features" className={`text-xs font-mono font-bold uppercase transition-colors duration-300 ${isActive('/features') ? 'text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}>Features</Link>
                    <Link to="/how-it-works" className={`text-xs font-mono font-bold uppercase transition-colors duration-300 ${isActive('/how-it-works') ? 'text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}>How It Works</Link>
                    <Link to="/changelog" className={`text-xs font-mono font-bold uppercase transition-colors duration-300 ${isActive('/changelog') ? 'text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}>Lifecycle</Link>
                    <Link to="/about" className={`text-xs font-mono font-bold uppercase transition-colors duration-300 ${isActive('/about') ? 'text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}>About</Link>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/login">
                        <Button variant="ghost" className="text-xs font-mono font-bold uppercase text-neutral-400 hover:text-white rounded-md hover:bg-white/10 h-9 px-4">
                            Sign In
                        </Button>
                    </Link>
                    <Link to="/signup">
                        <Button className="text-xs font-mono font-bold uppercase h-9 px-5 bg-blue-600 text-white hover:bg-blue-500 rounded-lg shadow-[3px_3px_0px_#1e3a5f] hover:shadow-[1px_1px_0px_#1e3a5f] hover:translate-x-[2px] hover:translate-y-[2px] transition-all border-0">
                            Get Started
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}

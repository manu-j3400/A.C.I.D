import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

export default function PublicNavbar() {
    const location = useLocation();
    const navigate = useNavigate();

    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();

        // If we are not on the home page, navigate to home and append the hash
        if (location.pathname !== '/home' && location.pathname !== '/') {
            navigate(`/#${id}`);
            return;
        }

        // If we are on the home page, scroll to the section
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b-2 border-neutral-800">
            <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
                <Link to="/" className="flex items-center gap-3 group">
                    <img src="/soteria-logo.png" alt="Soteria" className="h-9 w-9 rounded-none object-cover transition-transform group-hover:-translate-y-[2px]" />
                    <span className="text-xl font-mono font-bold tracking-[0.15em] uppercase text-white">SOTERIA</span>
                </Link>

                <div className="hidden md:flex items-center gap-8">
                    <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className={`text-xs font-mono font-bold uppercase transition-colors duration-300 ${location.pathname === '/home' ? 'text-neutral-500 hover:text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}>Features</a>
                    <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className={`text-xs font-mono font-bold uppercase transition-colors duration-300 ${location.pathname === '/home' ? 'text-neutral-500 hover:text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}>How It Works</a>
                    <Link to="/changelog" className={`text-xs font-mono font-bold uppercase transition-colors duration-300 ${location.pathname === '/changelog' ? 'text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}>Lifecycle</Link>
                    <Link to="/about" className={`text-xs font-mono font-bold uppercase transition-colors duration-300 ${location.pathname === '/about' ? 'text-cyan-400' : 'text-neutral-500 hover:text-cyan-400'}`}>About</Link>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/login">
                        <Button variant="ghost" className="text-xs font-mono font-bold uppercase text-neutral-400 hover:text-white rounded-none hover:bg-white/10 h-9 px-4">
                            Sign In
                        </Button>
                    </Link>
                    <Link to="/signup">
                        <Button className="text-xs font-mono font-bold uppercase h-9 px-5 bg-white text-black hover:bg-neutral-200 rounded-none brutalist-shadow-white hover:-translate-y-[2px] hover:brutalist-shadow-cyan transition-all border-2 border-black">
                            Get Started
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    );
}

import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';

/**
 * Wraps public-only routes (landing, login, signup).
 * Redirects authenticated users to /dashboard so they never
 * see the public marketing site after logging in.
 */
export default function PublicRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-neutral-800 border-t-white animate-spin" />
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}

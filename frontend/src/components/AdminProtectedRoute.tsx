import { useAdmin } from '@/context/AdminContext';
import { Navigate } from 'react-router-dom';

export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAdminAuthenticated, isAdminLoading } = useAdmin();

    if (isAdminLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-neutral-800 border-t-orange-500 animate-spin" />
            </div>
        );
    }

    if (!isAdminAuthenticated) {
        return <Navigate to="/admin/login" replace />;
    }

    return <>{children}</>;
}

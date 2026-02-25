import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AdminUser {
    id: string;
    name: string;
    email: string;
    is_admin: boolean;
}

interface AdminContextType {
    adminUser: AdminUser | null;
    adminToken: string | null;
    adminLogin: (email: string, password: string) => Promise<void>;
    adminLogout: () => void;
    isAdminAuthenticated: boolean;
    isAdminLoading: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Local validation MVP for admin
const ADMIN_EMAILS = ['admin@soteria.io'];

export function AdminProvider({ children }: { children: React.ReactNode }) {
    const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
    const [adminToken, setAdminToken] = useState<string | null>(null);
    const [isAdminLoading, setIsAdminLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && session.user.email && ADMIN_EMAILS.includes(session.user.email)) {
                setAdminToken(session.access_token);
                setAdminUser({
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.name || 'Admin',
                    is_admin: true
                });
            } else {
                setAdminToken(null);
                setAdminUser(null);
            }
            setIsAdminLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session && session.user.email && ADMIN_EMAILS.includes(session.user.email)) {
                setAdminToken(session.access_token);
                setAdminUser({
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.name || 'Admin',
                    is_admin: true
                });
            } else if (!session) {
                setAdminToken(null);
                setAdminUser(null);
            }
            setIsAdminLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const adminLogin = async (email: string, password: string) => {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);

        if (data.session && data.session.user.email && ADMIN_EMAILS.includes(data.session.user.email)) {
            setAdminToken(data.session.access_token);
            setAdminUser({
                id: data.session.user.id,
                email: data.session.user.email,
                name: data.session.user.user_metadata?.name || 'Admin',
                is_admin: true
            });
        } else {
            await supabase.auth.signOut();
            throw new Error('Not authorized as an administrator');
        }
    };

    const adminLogout = async () => {
        await supabase.auth.signOut();
        setAdminUser(null);
        setAdminToken(null);
    };

    return (
        <AdminContext.Provider value={{
            adminUser,
            adminToken,
            adminLogin,
            adminLogout,
            isAdminAuthenticated: !!adminUser,
            isAdminLoading
        }}>
            {children}
        </AdminContext.Provider>
    );
}

export function useAdmin() {
    const context = useContext(AdminContext);
    if (context === undefined) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AdminContextType {
  isAdmin: boolean;
  isLoading: boolean;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  isLoading: true,
});

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    const checkAdminStatus = async () => {
      if (authLoading) {
        if (!cancelled) {
          setIsLoading(true);
        }
        return;
      }

      // No user - not admin, done loading
      if (!userId) {
        if (!cancelled) {
          setIsAdmin(false);
          setIsLoading(false);
          setCheckedUserId(null);
        }
        return;
      }

      // Already checked for this user - skip
      if (checkedUserId === userId) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setIsLoading(true);
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .single();

        console.log('Admin check result:', { data, error });
        if (!cancelled) {
          setIsAdmin(!!data && !error);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        if (!cancelled) {
          setIsAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setCheckedUserId(userId);
          setIsLoading(false);
        }
      }
    };

    void checkAdminStatus();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, checkedUserId]);

  return (
    <AdminContext.Provider value={{ isAdmin, isLoading }}>
      {children}
    </AdminContext.Provider>
  );
};

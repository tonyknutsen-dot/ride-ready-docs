import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface TesterContextType {
  isTester: boolean;
  isLoading: boolean;
}

const TesterContext = createContext<TesterContextType>({
  isTester: false,
  isLoading: true,
});

export const useTester = () => {
  const context = useContext(TesterContext);
  if (!context) {
    throw new Error('useTester must be used within TesterProvider');
  }
  return context;
};

export const TesterProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [isTester, setIsTester] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkTesterStatus = async () => {
      // No user - not tester, done loading
      if (!user) {
        setIsTester(false);
        setIsLoading(false);
        setCheckedUserId(null);
        return;
      }

      // Already checked for this user - skip
      if (checkedUserId === user.id) {
        return;
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'tester')
          .maybeSingle();

        console.log('Tester check result:', { data, error });
        setIsTester(!!data && !error);
      } catch (error) {
        console.error('Error checking tester status:', error);
        setIsTester(false);
      } finally {
        setCheckedUserId(user.id);
        setIsLoading(false);
      }
    };

    checkTesterStatus();
  }, [user?.id, checkedUserId]);

  return (
    <TesterContext.Provider value={{ isTester, isLoading }}>
      {children}
    </TesterContext.Provider>
  );
};

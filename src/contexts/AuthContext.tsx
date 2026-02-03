import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, country?: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Sync subscription status with Stripe (debounced and deferred)
// Skip for testers to avoid unnecessary API calls
// This runs in the background AFTER the UI is interactive
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
const syncSubscriptionStatus = async (userId: string) => {
  // Debounce syncs to avoid excessive API calls
  if (syncTimeout) clearTimeout(syncTimeout);
  
  // Use requestIdleCallback for non-blocking background sync
  const scheduleSync = () => {
    syncTimeout = setTimeout(async () => {
      try {
        // Check if user is a tester first - skip Stripe sync for testers
        const { data: testerRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'tester')
          .maybeSingle();
        
        if (testerRole) {
          console.log('[AUTH] Skipping Stripe sync for tester account');
          return;
        }
        
        await supabase.functions.invoke('check-subscription');
      } catch (error) {
        console.error('Error syncing subscription:', error);
      }
    }, 2000); // Increased delay for better initial page load
  };
  
  // Schedule during idle time if available, otherwise use setTimeout
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(scheduleSync, { timeout: 5000 });
  } else {
    scheduleSync();
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);

  const checkSuspensionStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_suspended, suspended_reason')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking suspension status:', error);
        return { suspended: false, reason: null };
      }

      return {
        suspended: data?.is_suspended ?? false,
        reason: data?.suspended_reason ?? null,
      };
    } catch (err) {
      console.error('Error checking suspension:', err);
      return { suspended: false, reason: null };
    }
  };

  useEffect(() => {
    let isMounted = true;
    let initialLoadDone = false;

    // Listener for ONGOING auth changes (does NOT control loading after initial load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        // Always update session and user state synchronously
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle suspension and subscription sync in a deferred callback
        // to avoid Supabase deadlock issues
        if (session?.user) {
          setTimeout(async () => {
            if (!isMounted) return;
            const { suspended, reason } = await checkSuspensionStatus(session.user.id);
            if (!isMounted) return;
            setIsSuspended(suspended);
            setSuspensionReason(reason);
            
            // If suspended, sign them out
            if (suspended) {
              await supabase.auth.signOut();
            } else {
              // Sync subscription status with Stripe on login
              if (event === 'SIGNED_IN') {
                syncSubscriptionStatus(session.user.id);
              }
            }
          }, 0);
        } else {
          setIsSuspended(false);
          setSuspensionReason(null);
        }
        
        // Only set loading false from the listener if initial load hasn't completed yet
        // This handles the INITIAL_SESSION event
        if (!initialLoadDone) {
          initialLoadDone = true;
          setLoading(false);
        }
      }
    );

    // INITIAL load - explicit getSession as fallback
    // If onAuthStateChange fires INITIAL_SESSION first, that will set loading=false
    // If not, this will handle it
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        // Only update if we haven't already via onAuthStateChange
        if (!initialLoadDone) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            const { suspended, reason } = await checkSuspensionStatus(session.user.id);
            if (!isMounted) return;
            setIsSuspended(suspended);
            setSuspensionReason(reason);
          }
        }
      } finally {
        if (isMounted && !initialLoadDone) {
          initialLoadDone = true;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      // Check if user is suspended
      const { suspended, reason } = await checkSuspensionStatus(data.user.id);
      if (suspended) {
        setIsSuspended(true);
        setSuspensionReason(reason);
        await supabase.auth.signOut();
        return { 
          error: { 
            message: `Your account has been suspended.${reason ? ` Reason: ${reason}` : ''} Please contact support@ridereadydocs.com to resolve this issue.` 
          } 
        };
      }
      
      // Log successful login to audit log
      try {
        await supabase.rpc('log_audit_event', {
          p_action: 'login',
          p_resource_type: 'session',
          p_resource_id: null,
          p_details: { 
            method: 'password',
            user_agent: navigator.userAgent,
          }
        });
      } catch (auditError) {
        console.error('Failed to log login event:', auditError);
      }
    }

    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, country?: string) => {
    const redirectUrl = `${window.location.origin}/profile-setup`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          country: country || 'GB'
        }
      }
    });

    // Send welcome email
    if (!error) {
      setTimeout(async () => {
        try {
          await supabase.functions.invoke('send-welcome-email', {
            body: { email }
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
        }
      }, 0);
    }

    return { error };
  }, []);

  const signOut = useCallback(async () => {
    // Log logout event before signing out
    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'logout',
        p_resource_type: 'session',
        p_resource_id: null,
        p_details: { method: 'manual' }
      });
    } catch (auditError) {
      console.error('Failed to log logout event:', auditError);
    }
    
    setIsSuspended(false);
    setSuspensionReason(null);
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { error };
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    session,
    loading,
    isSuspended,
    suspensionReason,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }), [user, session, loading, isSuspended, suspensionReason, signIn, signUp, signOut, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

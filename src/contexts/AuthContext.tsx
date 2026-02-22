import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getIdentityCache, clearIdentityCache, type IdentityCacheEntry } from '@/lib/offlineDb';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  isOfflineMode: boolean;
  cachedIdentity: IdentityCacheEntry | null;
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
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
const syncSubscriptionStatus = async (userId: string) => {
  if (syncTimeout) clearTimeout(syncTimeout);

  const scheduleSync = () => {
    syncTimeout = setTimeout(async () => {
      try {
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
    }, 2000);
  };

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
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cachedIdentity, setCachedIdentity] = useState<IdentityCacheEntry | null>(null);

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

    console.log('[AUTH] Initializing auth', {
      pathname: window.location.pathname,
      hasHash: !!window.location.hash,
      origin: window.location.origin
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        // Only clear offline mode if we're actually online
        if (navigator.onLine) {
          setIsOfflineMode(false);
        }

        if (session?.user) {
          // Only run network-dependent checks when online
          if (navigator.onLine) {
            setTimeout(async () => {
              if (!isMounted) return;
              try {
                const { suspended, reason } = await checkSuspensionStatus(session.user.id);
                if (!isMounted) return;
                setIsSuspended(suspended);
                setSuspensionReason(reason);

                if (suspended) {
                  await supabase.auth.signOut();
                } else if (event === 'SIGNED_IN') {
                  syncSubscriptionStatus(session.user.id);
                }
              } catch {
                // Network failed during check – ignore, don't block
              }
            }, 0);
          }
        } else {
          setIsSuspended(false);
          setSuspensionReason(null);
        }

        if (!initialLoadDone) {
          initialLoadDone = true;
          setLoading(false);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          // We have a valid Supabase session. Set user immediately.
          setSession(session);
          setUser(session.user);

          // Try to load cached identity from IndexedDB
          try {
            const cached = await getIdentityCache(session.user.id);
            if (cached) {
              console.log('[AUTH] Loaded identity cache for', session.user.id);
              setCachedIdentity(cached);
            }
          } catch (e) {
            console.warn('[AUTH] Failed to load identity cache:', e);
          }

          // If online, check suspension (profile fetch will happen in useProfileComplete)
          if (navigator.onLine) {
            try {
              const { suspended, reason } = await checkSuspensionStatus(session.user.id);
              if (!isMounted) return;
              setIsSuspended(suspended);
              setSuspensionReason(reason);
            } catch {
              // Suspension check failed but we have a session – continue
            }
          } else {
            // Offline with session – mark offline mode
            console.log('[AUTH] Offline boot with valid session');
            setIsOfflineMode(true);
          }

          if (!initialLoadDone) {
            initialLoadDone = true;
            setLoading(false);
          }
          return;
        }

        // No session returned
        if (!navigator.onLine) {
          // Offline with no session – can't do anything
          console.log('[AUTH] Offline boot with no session');
          if (!initialLoadDone) {
            initialLoadDone = true;
            setLoading(false);
          }
          return;
        }

        // Online with no session – check for OAuth callback
        if (!initialLoadDone) {
          const hash = window.location.hash;
          const hasAuthCallback = hash.includes('access_token') || hash.includes('error_description');

          if (hasAuthCallback) {
            console.log('[AUTH] OAuth callback detected, waiting for session from hash...');
            setTimeout(() => {
              if (isMounted && !initialLoadDone) {
                console.log('[AUTH] OAuth callback timeout - setting loading false');
                initialLoadDone = true;
                setLoading(false);
              }
            }, 5000);
            return;
          }

          setSession(null);
          setUser(null);
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
    setCachedIdentity(null);
    clearIdentityCache();
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

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isSuspended,
    suspensionReason,
    isOfflineMode,
    cachedIdentity,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }), [user, session, loading, isSuspended, suspensionReason, isOfflineMode, cachedIdentity, signIn, signUp, signOut, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check suspension status when user signs in
        if (session?.user) {
          setTimeout(async () => {
            const { suspended, reason } = await checkSuspensionStatus(session.user.id);
            setIsSuspended(suspended);
            setSuspensionReason(reason);
            
            // If suspended, sign them out
            if (suspended) {
              await supabase.auth.signOut();
            }
          }, 0);
        } else {
          setIsSuspended(false);
          setSuspensionReason(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { suspended, reason } = await checkSuspensionStatus(session.user.id);
        setIsSuspended(suspended);
        setSuspensionReason(reason);
        
        // If suspended, sign them out
        if (suspended) {
          await supabase.auth.signOut();
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
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
            message: `Your account has been suspended.${reason ? ` Reason: ${reason}` : ''} Please contact info@knutssoftware.co.uk to resolve this issue.` 
          } 
        };
      }
    }

    return { error };
  };

  const signUp = async (email: string, password: string, country?: string) => {
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
  };

  const signOut = async () => {
    setIsSuspended(false);
    setSuspensionReason(null);
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    isSuspended,
    suspensionReason,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
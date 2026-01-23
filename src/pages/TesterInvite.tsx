import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FlaskConical, CheckCircle, XCircle, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { APP_VERSION } from '@/config/appVersion';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'already_accepted';

export default function TesterInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [inviteEmail, setInviteEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Auth form state
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validate the invite token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setStatus('invalid');
        setErrorMessage('No invite token provided');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('accept-tester-invite', {
          body: { token },
        });

        if (error) throw error;

        if (data.valid) {
          setStatus('valid');
          setInviteEmail(data.email);
          setEmail(data.email);
        } else if (data.status === 'accepted') {
          setStatus('already_accepted');
        } else if (data.status === 'expired') {
          setStatus('expired');
        } else {
          setStatus('invalid');
          setErrorMessage(data.error || 'Invalid invite');
        }
      } catch (error: any) {
        console.error('Error validating invite:', error);
        setStatus('invalid');
        setErrorMessage(error.message || 'Failed to validate invite');
      }
    };

    validateToken();
  }, [token]);

  // If user is logged in and invite is valid, try to accept
  useEffect(() => {
    const acceptInvite = async () => {
      if (!user || status !== 'valid' || accepting) return;

      // Check if logged in user's email matches invite
      if (user.email?.toLowerCase() !== inviteEmail.toLowerCase()) {
        toast.error(`This invite was sent to ${inviteEmail}. Please sign in with that email.`);
        return;
      }

      setAccepting(true);
      try {
        const { data, error } = await supabase.functions.invoke('accept-tester-invite', {
          body: { token, userId: user.id },
        });

        if (error) throw error;

        if (data.success) {
          setStatus('accepted');
          toast.success(data.message);
          
          // Wait a moment then redirect
          setTimeout(() => {
            navigate('/overview');
          }, 2000);
        } else {
          throw new Error(data.error);
        }
      } catch (error: any) {
        console.error('Error accepting invite:', error);
        toast.error(error.message || 'Failed to accept invite');
      } finally {
        setAccepting(false);
      }
    };

    acceptInvite();
  }, [user, status, inviteEmail, token, navigate, accepting]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Force email to match invite email
    const authEmail = inviteEmail;
    
    if (isSignUp && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setAuthLoading(true);

    try {
      let userId: string | undefined;
      
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/tester-invite/${token}`,
          },
        });
        
        if (error) throw error;
        
        // Check if user already exists (identities will be empty)
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
          toast.error('An account with this email already exists. Please sign in instead.');
          setIsSignUp(false);
          setAuthLoading(false);
          return;
        }
        
        // Check if email confirmation is required
        if (data.user && !data.session) {
          toast.success('Please check your email to confirm your account, then click the invite link again.');
          setAuthLoading(false);
          return;
        }
        
        userId = data.user?.id;
        toast.success('Account created!');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });
        if (error) throw error;
        userId = data.user?.id;
        toast.success('Signed in!');
      }
      
      // Immediately accept the invite
      if (userId && token) {
        setAccepting(true);
        const { data: acceptData, error: acceptError } = await supabase.functions.invoke('accept-tester-invite', {
          body: { token, userId },
        });
        
        if (acceptError) {
          console.error('Error accepting invite:', acceptError);
          toast.error('Account created but failed to accept invite. Please contact support.');
        } else if (acceptData?.success) {
          toast.success('Welcome to the tester team! 🎉');
          setStatus('accepted');
          // Redirect to app
          setTimeout(() => {
            navigate('/overview');
          }, 1500);
          return;
        } else if (acceptData?.alreadyTester) {
          toast.success("You're already a tester!");
          setTimeout(() => {
            navigate('/overview');
          }, 1500);
          return;
        } else {
          toast.error(acceptData?.error || 'Failed to accept invite');
        }
        setAccepting(false);
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted-foreground">Validating your invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid/Expired states
  if (status === 'invalid' || status === 'expired' || status === 'already_accepted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>
              {status === 'expired' ? 'Invite Expired' : 
               status === 'already_accepted' ? 'Already Accepted' : 
               'Invalid Invite'}
            </CardTitle>
            <CardDescription>
              {status === 'expired' 
                ? 'This invite link has expired. Please request a new one.'
                : status === 'already_accepted'
                ? 'This invite has already been used.'
                : errorMessage || 'This invite link is not valid.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/auth">
              <Button>Go to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepted state
  if (status === 'accepted') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-success">Welcome to the Team! 🎉</CardTitle>
            <CardDescription>
              You're now a tester for Showmen's Ride Ready {APP_VERSION}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-sm">
                <FlaskConical className="h-4 w-4 inline mr-2" />
                You'll see a "TEST MODE" banner at the top of the app
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Redirecting to the app...</p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invite - show auth form
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="h-8 w-8 text-warning-foreground" />
          </div>
          <CardTitle>You're Invited to Test!</CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Create an account to accept your tester invite'
              : 'Sign in to accept your tester invite'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite info */}
          <div className="p-4 rounded-lg bg-secondary border border-border">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Invited email</p>
                <p className="font-medium">{inviteEmail}</p>
              </div>
            </div>
          </div>

          {accepting ? (
            <div className="text-center py-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Accepting your invite...</p>
            </div>
          ) : user ? (
            // User is logged in but email doesn't match
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                You're signed in as <strong>{user.email}</strong>
              </p>
              {user.email?.toLowerCase() !== inviteEmail.toLowerCase() && (
                <p className="text-sm text-destructive">
                  Please sign in with <strong>{inviteEmail}</strong> to accept this invite.
                </p>
              )}
            </div>
          ) : (
            // Auth form
            <form onSubmit={handleAuth} className="space-y-4" autoComplete="off">
              {/*
                Prevent browser password managers from autofilling this signup form.
                Some browsers ignore autoComplete="new-password" and still inject values.
                These hidden fields attract the autofill instead of our controlled inputs.
              */}
              <input
                className="hidden"
                type="text"
                name="username"
                autoComplete="username"
                tabIndex={-1}
              />
              <input
                className="hidden"
                type="password"
                name="current-password"
                autoComplete="current-password"
                tabIndex={-1}
              />

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={inviteEmail}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  This is the email the invite was sent to
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={authLoading}
                    minLength={6}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                  </Button>
                </div>
                {isSignUp && <PasswordStrengthIndicator password={password} />}
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirm-new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                      disabled={authLoading}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="sr-only">{showConfirmPassword ? 'Hide password' : 'Show password'}</span>
                    </Button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full gap-2" disabled={authLoading}>
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? 'Create Account & Accept' : 'Sign In & Accept'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-primary hover:underline"
                  disabled={authLoading}
                >
                  {isSignUp 
                    ? 'Already have an account? Sign in' 
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

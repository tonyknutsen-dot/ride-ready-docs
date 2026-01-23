import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FlaskConical, CheckCircle, XCircle, Mail, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { APP_VERSION } from '@/config/appVersion';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'already_accepted';

export default function TesterInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [inviteEmail, setInviteEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Auth form state
  const [isSignUp, setIsSignUp] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
          toast.success(data.message || 'Tester access granted!');
          
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

  // Handle new account creation (uses our custom edge function - no email confirmation!)
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setAuthLoading(true);

    try {
      // Use our custom edge function to create account with pre-confirmed email
      // This bypasses Supabase's email confirmation entirely!
      const { data, error } = await supabase.functions.invoke('register-tester', {
        body: { 
          email: inviteEmail, 
          password, 
          token 
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.success) {
        // Now sign in the user
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: inviteEmail,
          password
        });

        if (signInError) {
          throw signInError;
        }

        toast.success('Account created! Welcome to the team! 🎉');
        setStatus('accepted');
        
        // Short delay then redirect
        setTimeout(() => {
          navigate('/overview');
        }, 1500);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setFormError(err.message || 'Failed to create account');
      toast.error(err.message || 'Failed to create account');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle sign in for existing users
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAuthLoading(true);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteEmail,
        password
      });

      if (signInError) throw signInError;

      if (signInData.user) {
        // Accept the invite for this user
        const { data, error } = await supabase.functions.invoke('accept-tester-invite', {
          body: { token, userId: signInData.user.id }
        });

        if (error) throw error;

        if (data.success) {
          toast.success('Signed in! Tester access granted. 🎉');
          setStatus('accepted');
          setTimeout(() => {
            navigate('/overview');
          }, 1500);
        } else if (data.alreadyTester) {
          toast.success("You're already a tester!");
          navigate('/overview');
        } else {
          throw new Error(data.error || 'Failed to accept invite');
        }
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setFormError(err.message || 'Failed to sign in');
      toast.error(err.message || 'Failed to sign in');
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
                ? 'This invite has already been used. You can sign in to access your account.'
                : errorMessage || 'This invite link is not valid.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <Link to="/auth">
              <Button>Go to Sign In</Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              Or visit <a href="https://ridereadydocs.com" className="text-primary hover:underline">ridereadydocs.com</a>
            </p>
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
              ? 'Create an account to join as a tester'
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

          {/* Error display */}
          {formError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{formError}</p>
            </div>
          )}

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
          ) : isSignUp ? (
            // Create account form
            <form onSubmit={handleCreateAccount} className="space-y-4" autoComplete="off">
              {/* Hidden fields to prevent autofill */}
              <input className="hidden" type="text" name="username" autoComplete="username" tabIndex={-1} />
              <input className="hidden" type="password" name="current-password" autoComplete="current-password" tabIndex={-1} />

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
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
                <Label htmlFor="password">Create Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a secure password"
                    required
                    disabled={authLoading}
                    minLength={8}
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
                <PasswordStrengthIndicator password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    disabled={authLoading}
                    minLength={8}
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

              <Button type="submit" className="w-full gap-2" disabled={authLoading}>
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setFormError(null);
                  }}
                  className="text-sm text-primary hover:underline"
                  disabled={authLoading}
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          ) : (
            // Sign in form
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={authLoading}
                    autoComplete="current-password"
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
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={authLoading}>
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setFormError(null);
                  }}
                  className="text-sm text-primary hover:underline"
                  disabled={authLoading}
                >
                  Need an account? Create one
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

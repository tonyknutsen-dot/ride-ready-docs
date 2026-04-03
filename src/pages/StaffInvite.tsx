import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users, CheckCircle, XCircle, Mail, ArrowRight, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'already_accepted';

const permissionLabels: Record<string, string> = {
  staff: 'Staff',
  supervisor: 'Staff',
  manager: 'Staff',
};

const permissionDescriptions: Record<string, string> = {
  staff: 'You can perform checks, log maintenance, and record wind/pressure readings on assigned equipment',
  supervisor: 'You can perform checks, log maintenance, and record wind/pressure readings on assigned equipment',
  manager: 'You can perform checks, log maintenance, and record wind/pressure readings on assigned equipment',
};

export default function StaffInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [inviteEmail, setInviteEmail] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<keyof typeof permissionLabels>('staff');
  const [errorMessage, setErrorMessage] = useState('');
  
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
        const { data, error } = await supabase.functions.invoke('accept-staff-invite', {
          body: { token },
        });

        if (error) throw error;

        if (data.valid) {
          setStatus('valid');
          setInviteEmail(data.email);
          setOrganisationName(data.organisationName || 'the organisation');
          setPermissionLevel(data.permissionLevel || 'staff');
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

      if (user.email?.toLowerCase() !== inviteEmail.toLowerCase()) {
        toast.error(`This invite was sent to ${inviteEmail}. Please sign in with that email.`);
        return;
      }

      setAccepting(true);
      try {
        const { data, error } = await supabase.functions.invoke('accept-staff-invite', {
          body: { token, userId: user.id },
        });

        if (error) throw error;

        if (data.success) {
          setStatus('accepted');
          toast.success(data.message || 'You\'ve joined the team!');
          
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
      const { data, error } = await supabase.functions.invoke('register-staff', {
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
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: inviteEmail,
          password
        });

        if (signInError) {
          throw signInError;
        }

        toast.success(`Welcome to ${data.organisationName}! 🎉`);
        setStatus('accepted');
        
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
        const { data, error } = await supabase.functions.invoke('accept-staff-invite', {
          body: { token, userId: signInData.user.id }
        });

        if (error) throw error;

        if (data.success) {
          toast.success(data.message || 'You\'ve joined the team! 🎉');
          setStatus('accepted');
          setTimeout(() => {
            navigate('/overview');
          }, 1500);
        } else if (data.alreadyMember) {
          toast.success("You're already a member!");
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
                ? 'This invite link has expired. Please ask for a new invite.'
                : status === 'already_accepted'
                ? 'This invite has already been used. You can sign in to access your account.'
                : errorMessage || 'This invite link is not valid.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <Link to="/auth">
              <Button>Go to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              You've joined {organisationName}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-sm">
                <Shield className="h-4 w-4 inline mr-2" />
                Your access level: <strong>{permissionLabels[permissionLevel]}</strong>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Redirecting to the app...</p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Join {organisationName}</CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Create an account to join the team'
              : 'Sign in to accept your invitation'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-secondary border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Invited email</p>
                <p className="font-medium">{inviteEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Access level</p>
                <p className="font-medium">{permissionLabels[permissionLevel]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{permissionDescriptions[permissionLevel]}</p>
              </div>
            </div>
          </div>

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
            <form onSubmit={handleCreateAccount} className="space-y-4" autoComplete="off">
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
                    Create Account & Join
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
                    Sign In & Join
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

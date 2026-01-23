import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useTester } from '@/contexts/TesterContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  User, 
  Shield, 
  FlaskConical,
  CreditCard,
  Database,
  Zap,
  AlertTriangle,
  LogOut,
  Home
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warning';
  message?: string;
  details?: string;
}

export default function Diagnostics() {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { isTester, isLoading: testerLoading } = useTester();
  const { subscription, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  
  const [tests, setTests] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<any>(null);

  // Collect session details
  useEffect(() => {
    const getSessionDetails = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionDetails({
          accessToken: session.access_token ? `${session.access_token.substring(0, 50)}...` : null,
          refreshToken: session.refresh_token ? `${session.refresh_token.substring(0, 20)}...` : null,
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : null,
          expiresIn: session.expires_in,
          tokenType: session.token_type,
        });
      }
    };
    getSessionDetails();
  }, [user]);

  const updateTest = (name: string, update: Partial<TestResult>) => {
    setTests(prev => prev.map(t => t.name === name ? { ...t, ...update } : t));
  };

  const runAllTests = async () => {
    setRunning(true);
    
    // Initialize all tests
    const testList: TestResult[] = [
      { name: 'Auth State', status: 'pending' },
      { name: 'Session Validity', status: 'pending' },
      { name: 'Profile Exists', status: 'pending' },
      { name: 'Admin Role Check', status: 'pending' },
      { name: 'Tester Role Check', status: 'pending' },
      { name: 'Subscription Status', status: 'pending' },
      { name: 'Database Connection', status: 'pending' },
      { name: 'Edge Function: check-subscription', status: 'pending' },
      { name: 'Edge Function: send-tester-invite', status: 'pending' },
    ];
    setTests(testList);

    // Test 1: Auth State
    updateTest('Auth State', { status: 'running' });
    await new Promise(r => setTimeout(r, 300));
    if (user) {
      updateTest('Auth State', { 
        status: 'pass', 
        message: `Logged in as ${user.email}`,
        details: `User ID: ${user.id}`
      });
    } else if (authLoading) {
      updateTest('Auth State', { status: 'warning', message: 'Still loading...' });
    } else {
      updateTest('Auth State', { status: 'fail', message: 'Not authenticated' });
    }

    // Test 2: Session Validity
    updateTest('Session Validity', { status: 'running' });
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        updateTest('Session Validity', { status: 'fail', message: error.message });
      } else if (session) {
        const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
        const isExpired = expiresAt && expiresAt < new Date();
        if (isExpired) {
          updateTest('Session Validity', { status: 'fail', message: 'Session expired', details: `Expired at ${expiresAt.toLocaleString()}` });
        } else {
          updateTest('Session Validity', { 
            status: 'pass', 
            message: 'Session valid',
            details: expiresAt ? `Expires: ${expiresAt.toLocaleString()}` : 'No expiry set'
          });
        }
      } else {
        updateTest('Session Validity', { status: 'fail', message: 'No session found' });
      }
    } catch (e: any) {
      updateTest('Session Validity', { status: 'fail', message: e.message });
    }

    // Test 3: Profile Exists
    updateTest('Profile Exists', { status: 'running' });
    if (user) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, company_name, subscription_status')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) {
          updateTest('Profile Exists', { status: 'fail', message: error.message });
        } else if (data) {
          updateTest('Profile Exists', { 
            status: 'pass', 
            message: data.company_name || 'Profile found',
            details: `Status: ${data.subscription_status || 'none'}`
          });
        } else {
          updateTest('Profile Exists', { status: 'warning', message: 'No profile record found' });
        }
      } catch (e: any) {
        updateTest('Profile Exists', { status: 'fail', message: e.message });
      }
    } else {
      updateTest('Profile Exists', { status: 'warning', message: 'Not logged in' });
    }

    // Test 4: Admin Role Check
    updateTest('Admin Role Check', { status: 'running' });
    await new Promise(r => setTimeout(r, 300));
    if (!user) {
      updateTest('Admin Role Check', { status: 'warning', message: 'Not logged in' });
    } else if (adminLoading) {
      updateTest('Admin Role Check', { status: 'warning', message: 'Still loading...' });
    } else if (isAdmin) {
      updateTest('Admin Role Check', { status: 'pass', message: 'Admin role confirmed' });
    } else {
      // Double-check with direct query
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (data) {
          updateTest('Admin Role Check', { 
            status: 'warning', 
            message: 'Admin role in DB but context says no',
            details: 'Context may need refresh'
          });
        } else {
          updateTest('Admin Role Check', { status: 'pass', message: 'Not an admin (correct)' });
        }
      } catch (e: any) {
        updateTest('Admin Role Check', { status: 'fail', message: e.message });
      }
    }

    // Test 5: Tester Role Check
    updateTest('Tester Role Check', { status: 'running' });
    await new Promise(r => setTimeout(r, 300));
    if (!user) {
      updateTest('Tester Role Check', { status: 'warning', message: 'Not logged in' });
    } else if (testerLoading) {
      updateTest('Tester Role Check', { status: 'warning', message: 'Still loading...' });
    } else {
      // Direct query check
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role, expires_at')
          .eq('user_id', user.id)
          .eq('role', 'tester')
          .maybeSingle();
        
        if (data) {
          const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
          if (isExpired) {
            updateTest('Tester Role Check', { 
              status: 'warning', 
              message: 'Tester role expired',
              details: `Expired: ${new Date(data.expires_at).toLocaleString()}`
            });
          } else {
            updateTest('Tester Role Check', { 
              status: isTester ? 'pass' : 'warning', 
              message: isTester ? 'Tester role active' : 'Tester in DB but context says no',
              details: data.expires_at ? `Expires: ${new Date(data.expires_at).toLocaleString()}` : 'No expiry'
            });
          }
        } else {
          updateTest('Tester Role Check', { status: 'pass', message: 'Not a tester (correct)' });
        }
      } catch (e: any) {
        updateTest('Tester Role Check', { status: 'fail', message: e.message });
      }
    }

    // Test 6: Subscription Status
    updateTest('Subscription Status', { status: 'running' });
    await new Promise(r => setTimeout(r, 300));
    if (!user) {
      updateTest('Subscription Status', { status: 'warning', message: 'Not logged in' });
    } else if (subLoading) {
      updateTest('Subscription Status', { status: 'warning', message: 'Still loading...' });
    } else if (subscription) {
      updateTest('Subscription Status', { 
        status: 'pass', 
        message: `Status: ${subscription.subscriptionStatus}`,
        details: subscription.isTesterAccount ? 'Tester bypass active' : 
                 `Plan: ${subscription.subscriptionPlan || 'none'}, Days left: ${subscription.daysRemaining}`
      });
    } else {
      updateTest('Subscription Status', { status: 'warning', message: 'No subscription data' });
    }

    // Test 7: Database Connection
    updateTest('Database Connection', { status: 'running' });
    try {
      const start = Date.now();
      const { error } = await supabase.from('ride_categories').select('id').limit(1);
      const duration = Date.now() - start;
      if (error) {
        updateTest('Database Connection', { status: 'fail', message: error.message });
      } else {
        updateTest('Database Connection', { 
          status: 'pass', 
          message: 'Connected',
          details: `Latency: ${duration}ms`
        });
      }
    } catch (e: any) {
      updateTest('Database Connection', { status: 'fail', message: e.message });
    }

    // Test 8: Edge Function - check-subscription
    updateTest('Edge Function: check-subscription', { status: 'running' });
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        updateTest('Edge Function: check-subscription', { 
          status: 'fail', 
          message: error.message,
          details: 'Function returned an error'
        });
      } else {
        updateTest('Edge Function: check-subscription', { 
          status: 'pass', 
          message: 'Function responded',
          details: `Subscribed: ${data?.subscribed ?? 'unknown'}, Plan: ${data?.plan || 'none'}`
        });
      }
    } catch (e: any) {
      updateTest('Edge Function: check-subscription', { status: 'fail', message: e.message });
    }

    // Test 9: Edge Function - send-tester-invite (just checks auth, not full send)
    updateTest('Edge Function: send-tester-invite', { status: 'running' });
    if (!isAdmin) {
      updateTest('Edge Function: send-tester-invite', { 
        status: 'warning', 
        message: 'Skipped - requires admin role' 
      });
    } else {
      try {
        const { data, error } = await supabase.functions.invoke('send-tester-invite', {
          body: { email: '' } // Empty email will fail validation but test auth
        });
        const errorMsg = error?.message?.toLowerCase() || '';
        // Check for session/auth issues first
        if (errorMsg.includes('session') || errorMsg.includes('invalid token') || errorMsg.includes('expired')) {
          updateTest('Edge Function: send-tester-invite', { 
            status: 'fail', 
            message: 'Session error',
            details: error.message
          });
        // A 400 with "email" validation error or non-2xx means auth passed, validation caught the empty email
        } else if (errorMsg.includes('email') || errorMsg.includes('2xx') || errorMsg.includes('400')) {
          updateTest('Edge Function: send-tester-invite', { 
            status: 'pass', 
            message: 'Auth working (validation error expected)',
          });
        } else if (error) {
          updateTest('Edge Function: send-tester-invite', { 
            status: 'warning', 
            message: error.message
          });
        } else {
          updateTest('Edge Function: send-tester-invite', { 
            status: 'pass', 
            message: 'Function responded'
          });
        }
      } catch (e: any) {
        updateTest('Edge Function: send-tester-invite', { status: 'fail', message: e.message });
      }
    }

    setRunning(false);
    
    // Log all results to console for debugging
    setTests(prev => {
      console.log('[DIAGNOSTICS] === Test Results ===');
      prev.forEach(t => {
        const icon = t.status === 'pass' ? '✓' : t.status === 'fail' ? '✗' : t.status === 'warning' ? '⚠' : '○';
        console.log(`[DIAGNOSTICS] ${icon} ${t.name}: ${t.status.toUpperCase()}${t.message ? ` - ${t.message}` : ''}${t.details ? ` (${t.details})` : ''}`);
      });
      console.log('[DIAGNOSTICS] === End Results ===');
      return prev;
    });
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error && !error.message?.includes('session')) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.success('Signed out');
      navigate('/');
    }
  };

  const handleRefreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        toast.error(`Refresh failed: ${error.message}`);
      } else if (data.session) {
        toast.success('Session refreshed');
        window.location.reload();
      } else {
        toast.warning('No session to refresh');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail': return <XCircle className="h-5 w-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'running': return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return <Badge variant="default" className="bg-green-500">PASS</Badge>;
      case 'fail': return <Badge variant="destructive">FAIL</Badge>;
      case 'warning': return <Badge variant="outline" className="border-warning text-warning">WARN</Badge>;
      case 'running': return <Badge variant="secondary">RUNNING</Badge>;
      default: return <Badge variant="outline">PENDING</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Diagnostics</h1>
            <p className="text-muted-foreground">Test all authentication and authorization flows</p>
          </div>
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" size="icon">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            {user && (
              <Button variant="outline" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Current State Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Current State
            </CardTitle>
            <CardDescription>Real-time status from context providers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground mb-1">Auth</div>
                <div className="flex items-center gap-2">
                  {authLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : user ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium text-sm truncate">
                    {authLoading ? 'Loading...' : user?.email || 'Not logged in'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground mb-1">Admin</div>
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${isAdmin ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-sm">
                    {adminLoading ? 'Loading...' : isAdmin ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground mb-1">Tester</div>
                <div className="flex items-center gap-2">
                  <FlaskConical className={`h-4 w-4 ${isTester ? 'text-warning' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-sm">
                    {testerLoading ? 'Loading...' : isTester ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted">
                <div className="text-xs text-muted-foreground mb-1">Subscription</div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {subLoading ? 'Loading...' : subscription?.subscriptionStatus || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {sessionDetails && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Session Details
                  </h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Token Type:</span>
                      <span className="font-mono">{sessionDetails.tokenType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires At:</span>
                      <span className="font-mono">{sessionDetails.expiresAt}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires In:</span>
                      <span className="font-mono">{sessionDetails.expiresIn}s</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={handleRefreshSession} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Session
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Runner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Test Suite
            </CardTitle>
            <CardDescription>Run comprehensive tests on all auth systems</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={runAllTests} disabled={running} className="w-full">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Run All Tests
                </>
              )}
            </Button>

            {tests.length > 0 && (
              <div className="space-y-2">
                {tests.map((test) => (
                  <div 
                    key={test.name} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <div className="font-medium">{test.name}</div>
                        {test.message && (
                          <div className="text-sm text-muted-foreground">{test.message}</div>
                        )}
                        {test.details && (
                          <div className="text-xs text-muted-foreground/70">{test.details}</div>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(test.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/auth">
              <Button variant="outline">Go to Auth</Button>
            </Link>
            <Link to="/overview">
              <Button variant="outline">Go to Overview</Button>
            </Link>
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline">Go to Admin</Button>
              </Link>
            )}
            <Link to="/billing">
              <Button variant="outline">Go to Billing</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

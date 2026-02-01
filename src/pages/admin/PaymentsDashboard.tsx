import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  RefreshCw,
  CreditCard,
  Calendar,
  XCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface PaymentData {
  summary: {
    totalRevenue30Days: number;
    mrr: number;
    upcomingRevenue30Days: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    recentCancellations: number;
    failedPaymentsCount: number;
    balance: {
      available: number;
      pending: number;
      currency: string;
    };
  };
  failedPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    error: string;
    created: number;
    email?: string;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created: number;
    email?: string;
  }>;
  subscriptionBreakdown: {
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
  };
}

const formatCurrency = (amount: number, currency: string = 'gbp') => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

export default function PaymentsDashboard() {
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('admin-stripe-data');
      
      if (fnError) throw fnError;
      if (response.error) throw new Error(response.error);
      
      setData(response);
    } catch (err: any) {
      console.error('Error fetching payment data:', err);
      setError(err.message || 'Failed to fetch payment data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch payment data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load payment data</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AdminLayout>
    );
  }

  if (!data) return null;

  const { summary, failedPayments, recentPayments, subscriptionBreakdown } = data;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payments Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor revenue, subscriptions, and payment issues
            </p>
          </div>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue (30 days)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalRevenue30Days, summary.balance.currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                From successful payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.mrr, summary.balance.currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Monthly recurring revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">
                +{summary.trialingSubscriptions} trialing
              </p>
            </CardContent>
          </Card>

          <Card className={summary.failedPaymentsCount > 0 ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${summary.failedPaymentsCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.failedPaymentsCount > 0 ? 'text-destructive' : ''}`}>
                {summary.failedPaymentsCount}
              </div>
              <p className="text-xs text-muted-foreground">
                In the last 60 days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Upcoming Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatCurrency(summary.upcomingRevenue30Days, summary.balance.currency)}
              </div>
              <p className="text-xs text-muted-foreground">
                Expected from draft invoices
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Available:</span>
                  <span className="font-medium">{formatCurrency(summary.balance.available, summary.balance.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pending:</span>
                  <span className="font-medium">{formatCurrency(summary.balance.pending, summary.balance.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={summary.pastDueSubscriptions > 0 ? 'border-warning' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Subscription Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Past Due:</span>
                  <Badge variant={summary.pastDueSubscriptions > 0 ? 'destructive' : 'secondary'}>
                    {summary.pastDueSubscriptions}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Recent Cancellations:</span>
                  <Badge variant="secondary">{summary.recentCancellations}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subscription Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium">{subscriptionBreakdown.active}</span>
                <span className="text-muted-foreground">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{subscriptionBreakdown.trialing}</span>
                <span className="text-muted-foreground">Trialing</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">{subscriptionBreakdown.pastDue}</span>
                <span className="text-muted-foreground">Past Due</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{subscriptionBreakdown.canceled}</span>
                <span className="text-muted-foreground">Canceled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Tables */}
        <Tabs defaultValue="failed" className="space-y-4">
          <TabsList>
            <TabsTrigger value="failed" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Failed Payments
              {failedPayments.length > 0 && (
                <Badge variant="destructive" className="ml-1">{failedPayments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Recent Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="failed">
            <Card>
              <CardHeader>
                <CardTitle>Failed Payments</CardTitle>
                <CardDescription>
                  Payments that failed or require action in the last 60 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {failedPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No failed payments! All payments are processing correctly.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(payment.created * 1000), 'dd MMM yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            {payment.email || (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount, payment.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">{payment.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {payment.error}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Successful Payments</CardTitle>
                <CardDescription>
                  Payments successfully processed in the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No recent payments found.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(payment.created * 1000), 'dd MMM yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            {payment.email || (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount, payment.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-500">
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

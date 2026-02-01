import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FolderOpen, FileText, Users, Clock, FlaskConical, BarChart3, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface DashboardStats {
  pendingRideRequests: number;
  pendingDocRequests: number;
  totalUsers: number;
  totalTesters: number;
  totalRides: number;
  totalDocuments: number;
  totalChecks: number;
  totalMaintenanceRecords: number;
  // Test data counts
  testRides: number;
  testDocuments: number;
  testChecks: number;
  testMaintenanceRecords: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    pendingRideRequests: 0,
    pendingDocRequests: 0,
    totalUsers: 0,
    totalTesters: 0,
    totalRides: 0,
    totalDocuments: 0,
    totalChecks: 0,
    totalMaintenanceRecords: 0,
    testRides: 0,
    testDocuments: 0,
    testChecks: 0,
    testMaintenanceRecords: 0,
  });
  const [loading, setLoading] = useState(true);
  const [excludeTestData, setExcludeTestData] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [
          rideRequests, 
          docRequests, 
          users, 
          testers,
          allRides,
          testRides,
          allDocuments,
          testDocuments,
          allChecks,
          testChecks,
          allMaintenance,
          testMaintenance,
        ] = await Promise.all([
          supabase.from('ride_type_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('document_type_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'tester'),
          supabase.from('rides').select('id', { count: 'exact', head: true }),
          supabase.from('rides').select('id', { count: 'exact', head: true }).eq('is_test_data', true),
          supabase.from('documents').select('id', { count: 'exact', head: true }),
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('is_test_data', true),
          supabase.from('checks').select('id', { count: 'exact', head: true }),
          supabase.from('checks').select('id', { count: 'exact', head: true }).eq('is_test_data', true),
          supabase.from('maintenance_records').select('id', { count: 'exact', head: true }),
          supabase.from('maintenance_records').select('id', { count: 'exact', head: true }).eq('is_test_data', true),
        ]);

        setStats({
          pendingRideRequests: rideRequests.count || 0,
          pendingDocRequests: docRequests.count || 0,
          totalUsers: users.count || 0,
          totalTesters: testers.count || 0,
          totalRides: allRides.count || 0,
          totalDocuments: allDocuments.count || 0,
          totalChecks: allChecks.count || 0,
          totalMaintenanceRecords: allMaintenance.count || 0,
          testRides: testRides.count || 0,
          testDocuments: testDocuments.count || 0,
          testChecks: testChecks.count || 0,
          testMaintenanceRecords: testMaintenance.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Calculate displayed stats based on filter
  const displayedRides = excludeTestData 
    ? stats.totalRides - stats.testRides 
    : stats.totalRides;
  const displayedDocuments = excludeTestData 
    ? stats.totalDocuments - stats.testDocuments 
    : stats.totalDocuments;
  const displayedChecks = excludeTestData 
    ? stats.totalChecks - stats.testChecks 
    : stats.totalChecks;
  const displayedMaintenance = excludeTestData 
    ? stats.totalMaintenanceRecords - stats.testMaintenanceRecords 
    : stats.totalMaintenanceRecords;

  const hasTestData = stats.testRides > 0 || stats.testDocuments > 0 || stats.testChecks > 0 || stats.testMaintenanceRecords > 0;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Manage user requests and system data</p>
          </div>
          
          {/* Test Data Filter Toggle */}
          {hasTestData && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <FlaskConical className="h-5 w-5 text-warning-foreground shrink-0" />
                  <div className="flex items-center gap-3">
                    <Label htmlFor="exclude-test-data" className="text-sm font-medium cursor-pointer">
                      Exclude test data
                    </Label>
                    <Switch
                      id="exclude-test-data"
                      checked={excludeTestData}
                      onCheckedChange={setExcludeTestData}
                    />
                  </div>
                  {excludeTestData && (
                    <Badge variant="outline" className="text-xs border-warning/50 text-warning-foreground">
                      Production Only
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Pending Requests */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pending Rides</CardTitle>
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingRideRequests}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.pendingRideRequests === 1 ? 'request' : 'requests'} awaiting review
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Pending Docs</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingDocRequests}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.pendingDocRequests === 1 ? 'request' : 'requests'} awaiting review
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    registered users
                    {stats.totalTesters > 0 && (
                      <span className="ml-1 text-warning-foreground">
                        ({stats.totalTesters} tester{stats.totalTesters !== 1 ? 's' : ''})
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Data Analytics */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Data Analytics</h2>
                {excludeTestData && hasTestData && (
                  <Badge variant="secondary" className="text-xs">
                    Excluding {stats.testRides + stats.testDocuments + stats.testChecks + stats.testMaintenanceRecords} test records
                  </Badge>
                )}
              </div>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card className={excludeTestData && stats.testRides > 0 ? 'border-l-4 border-l-success' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Rides</CardTitle>
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{displayedRides}</div>
                    {!excludeTestData && stats.testRides > 0 && (
                      <p className="text-xs text-warning-foreground mt-1 flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" />
                        {stats.testRides} test
                      </p>
                    )}
                    {excludeTestData && stats.testRides > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.testRides} test excluded
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className={excludeTestData && stats.testDocuments > 0 ? 'border-l-4 border-l-success' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{displayedDocuments}</div>
                    {!excludeTestData && stats.testDocuments > 0 && (
                      <p className="text-xs text-warning-foreground mt-1 flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" />
                        {stats.testDocuments} test
                      </p>
                    )}
                    {excludeTestData && stats.testDocuments > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.testDocuments} test excluded
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className={excludeTestData && stats.testChecks > 0 ? 'border-l-4 border-l-success' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Checks</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{displayedChecks}</div>
                    {!excludeTestData && stats.testChecks > 0 && (
                      <p className="text-xs text-warning-foreground mt-1 flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" />
                        {stats.testChecks} test
                      </p>
                    )}
                    {excludeTestData && stats.testChecks > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.testChecks} test excluded
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className={excludeTestData && stats.testMaintenanceRecords > 0 ? 'border-l-4 border-l-success' : ''}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium">Maintenance</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{displayedMaintenance}</div>
                    {!excludeTestData && stats.testMaintenanceRecords > 0 && (
                      <p className="text-xs text-warning-foreground mt-1 flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" />
                        {stats.testMaintenanceRecords} test
                      </p>
                    )}
                    {excludeTestData && stats.testMaintenanceRecords > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.testMaintenanceRecords} test excluded
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Review Pending Requests</p>
                      <p className="text-sm text-muted-foreground">
                        {stats.pendingRideRequests + stats.pendingDocRequests} total pending
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Test Data Summary */}
            {hasTestData && (
              <Card className="border-warning/30 bg-warning/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-warning-foreground" />
                    <CardTitle className="text-lg">Test Data Summary</CardTitle>
                  </div>
                  <CardDescription>
                    Data created by users with the tester role
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-background border">
                      <div className="text-2xl font-bold text-warning-foreground">{stats.testRides}</div>
                      <div className="text-xs text-muted-foreground">Test Rides</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background border">
                      <div className="text-2xl font-bold text-warning-foreground">{stats.testDocuments}</div>
                      <div className="text-xs text-muted-foreground">Test Documents</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background border">
                      <div className="text-2xl font-bold text-warning-foreground">{stats.testChecks}</div>
                      <div className="text-xs text-muted-foreground">Test Checks</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background border">
                      <div className="text-2xl font-bold text-warning-foreground">{stats.testMaintenanceRecords}</div>
                      <div className="text-xs text-muted-foreground">Test Maintenance</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

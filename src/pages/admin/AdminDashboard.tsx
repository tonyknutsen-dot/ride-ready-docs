import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { FolderOpen, FileText, Users, Clock } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    pendingRideRequests: 0,
    pendingDocRequests: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [rideRequests, docRequests, users] = await Promise.all([
        supabase.from('ride_type_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('document_type_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact' }),
      ]);

      setStats({
        pendingRideRequests: rideRequests.count || 0,
        pendingDocRequests: docRequests.count || 0,
        totalUsers: users.count || 0,
      });
    };

    fetchStats();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage user requests and system data</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Ride Requests</CardTitle>
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
              <CardTitle className="text-sm font-medium">Pending Doc Requests</CardTitle>
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
              <p className="text-xs text-muted-foreground mt-1">registered users</p>
            </CardContent>
          </Card>
        </div>

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
      </div>
    </AdminLayout>
  );
}

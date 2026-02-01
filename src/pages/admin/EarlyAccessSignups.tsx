import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Sparkles, Search, Download, Mail, Users, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface EarlyAccessSignup {
  id: string;
  email: string;
  name: string | null;
  source: string;
  created_at: string;
}

export default function EarlyAccessSignups() {
  const { toast } = useToast();
  const [signups, setSignups] = useState<EarlyAccessSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSignups = async () => {
    try {
      const { data, error } = await supabase
        .from('early_access_signups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSignups(data || []);
    } catch (error: any) {
      console.error('Error fetching signups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load early access signups',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSignups();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSignups();
    toast({
      title: 'Refreshed',
      description: 'Early access signups have been refreshed',
    });
  };

  const handleExportCSV = () => {
    const headers = ['Email', 'Name', 'Source', 'Signed Up'];
    const rows = signups.map(s => [
      s.email,
      s.name || '',
      s.source,
      format(new Date(s.created_at), 'yyyy-MM-dd HH:mm')
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `early-access-signups-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Exported',
      description: `${signups.length} signups exported to CSV`,
    });
  };

  const filteredSignups = signups.filter(s =>
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Early Access Signups
            </h1>
            <p className="text-muted-foreground">
              Users who signed up for early access from the coming soon page
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={signups.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Signups</p>
                  <p className="text-2xl font-bold">{signups.length}</p>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">This Week</p>
                  <p className="text-2xl font-bold">
                    {signups.filter(s => {
                      const signupDate = new Date(s.created_at);
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return signupDate > weekAgo;
                    }).length}
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">With Name</p>
                  <p className="text-2xl font-bold">
                    {signups.filter(s => s.name).length}
                  </p>
                </div>
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Signups</CardTitle>
            <CardDescription>
              All early access registrations from the coming soon page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredSignups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {signups.length === 0 ? 'No early access signups yet' : 'No signups match your search'}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Signed Up</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSignups.map((signup) => (
                        <TableRow key={signup.id}>
                          <TableCell className="font-medium">{signup.email}</TableCell>
                          <TableCell>{signup.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{signup.source}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(signup.created_at), 'dd MMM yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {filteredSignups.map((signup) => (
                    <div key={signup.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{signup.email}</p>
                          {signup.name && (
                            <p className="text-xs text-muted-foreground">{signup.name}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">{signup.source}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(signup.created_at), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
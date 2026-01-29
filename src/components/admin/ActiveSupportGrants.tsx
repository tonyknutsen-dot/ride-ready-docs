import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Key, Clock, User, Eye, Loader2, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

interface SupportGrant {
  id: string;
  user_id: string;
  granted_to_admin: string | null;
  reason: string;
  status: 'active' | 'expired' | 'revoked';
  granted_at: string;
  expires_at: string;
  access_scope: string;
  user_email?: string;
  user_company?: string;
}

export const ActiveSupportGrants = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [grants, setGrants] = useState<SupportGrant[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  const fetchGrants = async () => {
    try {
      const { data, error } = await supabase
        .from('support_access_grants')
        .select('*')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user info for each grant
      const rawGrants = data || [];
      const uniqueUserIds = [...new Set(rawGrants.map(g => g.user_id))];
      let profileMap = new Map<string, string>();
      
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, company_name')
          .in('user_id', uniqueUserIds);
        
        profileMap = new Map(profiles?.map(p => [p.user_id, p.company_name || 'Unknown']) || []);
      }

      const grantsWithUsers: SupportGrant[] = rawGrants.map(grant => ({
        ...grant,
        status: grant.status as 'active' | 'expired' | 'revoked',
        user_company: profileMap.get(grant.user_id) || 'Unknown',
      }));

      setGrants(grantsWithUsers);
    } catch (error) {
      console.error('Error fetching support grants:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch support grants',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGrants();
  };

  const handleClaimGrant = async (grantId: string) => {
    if (!user) return;
    
    setClaiming(grantId);
    try {
      const { error } = await supabase
        .from('support_access_grants')
        .update({ granted_to_admin: user.id })
        .eq('id', grantId);

      if (error) throw error;

      toast({
        title: 'Grant Claimed',
        description: 'You now have access to this user\'s documents',
      });

      fetchGrants();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to claim grant',
        variant: 'destructive',
      });
    } finally {
      setClaiming(null);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Active Support Grants
          </CardTitle>
          <CardDescription>
            Users who have granted temporary access for support
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {grants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active support grants</p>
            <p className="text-sm mt-1">Users must explicitly grant access for you to view their documents</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead>Claimed By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grants.map((grant) => (
                <TableRow key={grant.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{grant.user_company}</div>
                        <div className="text-xs text-muted-foreground">
                          Granted {formatDistanceToNow(new Date(grant.granted_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm max-w-[250px] truncate">{grant.reason}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">{getTimeRemaining(grant.expires_at)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {grant.granted_to_admin ? (
                      grant.granted_to_admin === user?.id ? (
                        <Badge className="bg-green-500">You</Badge>
                      ) : (
                        <Badge variant="secondary">Other Admin</Badge>
                      )
                    ) : (
                      <Badge variant="outline">Unclaimed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!grant.granted_to_admin ? (
                      <Button
                        size="sm"
                        onClick={() => handleClaimGrant(grant.id)}
                        disabled={claiming === grant.id}
                      >
                        {claiming === grant.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-1" />
                            Claim & View
                          </>
                        )}
                      </Button>
                    ) : grant.granted_to_admin === user?.id ? (
                      <Button size="sm" variant="outline">
                        <FileText className="h-4 w-4 mr-1" />
                        View Docs
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Assigned to other admin</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ActiveSupportGrants;

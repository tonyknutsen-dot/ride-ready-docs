import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, Clock, Shield, AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, addHours, addDays } from 'date-fns';

interface SupportGrant {
  id: string;
  reason: string;
  status: 'active' | 'expired' | 'revoked';
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  access_scope: string;
}

export const SupportAccessManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<SupportGrant[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('24');

  const fetchGrants = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('support_access_grants')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGrants((data || []) as SupportGrant[]);
    } catch (error) {
      console.error('Error fetching support grants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, [user]);

  const handleGrantAccess = async () => {
    if (!user || !reason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for granting access',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const hours = parseInt(duration);
      const expiresAt = hours <= 24 
        ? addHours(new Date(), hours)
        : addDays(new Date(), hours / 24);

      const { error } = await supabase
        .from('support_access_grants')
        .insert({
          user_id: user.id,
          reason: reason.trim(),
          expires_at: expiresAt.toISOString(),
          access_scope: 'read_only',
        });

      if (error) throw error;

      toast({
        title: 'Access Granted',
        description: `Support team can now view your documents for ${hours <= 24 ? `${hours} hours` : `${hours / 24} days`}`,
      });

      setDialogOpen(false);
      setReason('');
      setDuration('24');
      fetchGrants();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to grant access',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeAccess = async (grantId: string) => {
    setRevoking(grantId);
    try {
      const { error } = await supabase
        .from('support_access_grants')
        .update({ 
          status: 'revoked',
          revoked_at: new Date().toISOString(),
        })
        .eq('id', grantId);

      if (error) throw error;

      toast({
        title: 'Access Revoked',
        description: 'Support access has been revoked immediately',
      });

      fetchGrants();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke access',
        variant: 'destructive',
      });
    } finally {
      setRevoking(null);
    }
  };

  const activeGrants = grants.filter(g => 
    g.status === 'active' && new Date(g.expires_at) > new Date()
  );

  const getStatusBadge = (grant: SupportGrant) => {
    if (grant.status === 'revoked') {
      return <Badge variant="secondary">Revoked</Badge>;
    }
    if (grant.status === 'expired' || new Date(grant.expires_at) <= new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return <Badge className="bg-green-500">Active</Badge>;
  };

  if (loading) {
    return (
      <Card className="border-2 border-warning/30 bg-gradient-to-br from-warning/5 to-transparent shadow-elegant">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-warning/30 bg-gradient-to-br from-warning/5 to-transparent shadow-elegant">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
            <Key className="h-4 w-4 text-warning" />
          </div>
          <CardTitle className="text-base">Support Access</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Grant temporary access to our support team for troubleshooting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Privacy Notice */}
        <Alert className="border-primary/30 bg-primary/5">
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Your privacy is protected.</strong> Support access is:
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• Only granted when you explicitly request it</li>
              <li>• Read-only (support cannot modify your data)</li>
              <li>• Fully logged in your activity history</li>
              <li>• Automatically expires after your chosen duration</li>
              <li>• Revocable by you at any time</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Active Grants */}
        {activeGrants.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Active Access Grants</Label>
            {activeGrants.map((grant) => (
              <div 
                key={grant.id}
                className="p-4 rounded-lg border-2 border-warning/30 bg-warning/5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(grant)}
                      <span className="text-xs text-muted-foreground">
                        Granted {formatDistanceToNow(new Date(grant.granted_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{grant.reason}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Expires {format(new Date(grant.expires_at), 'dd MMM yyyy HH:mm')}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeAccess(grant.id)}
                    disabled={revoking === grant.id}
                  >
                    {revoking === grant.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Revoke
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grant Access Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2" variant={activeGrants.length > 0 ? 'outline' : 'default'}>
              <Key className="h-4 w-4" />
              {activeGrants.length > 0 ? 'Grant Additional Access' : 'Grant Support Access'}
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby="grant-access-description">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Grant Support Access
              </DialogTitle>
              <DialogDescription id="grant-access-description">
                This allows our support team to temporarily view your documents to help troubleshoot issues.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Access</Label>
                <Textarea
                  id="reason"
                  placeholder="Describe the issue you need help with..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  This helps our team understand your issue and focus on relevant documents.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Access Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Access will automatically expire after this time. You can revoke it earlier if needed.
                </p>
              </div>

              <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-sm">
                  Support access is <strong>read-only</strong>. Our team cannot modify, delete, or download your files.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGrantAccess} disabled={creating || !reason.trim()}>
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Grant Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Previous Grants */}
        {grants.length > activeGrants.length && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label className="text-xs text-muted-foreground">Previous Grants</Label>
            <div className="space-y-2">
              {grants
                .filter(g => g.status !== 'active' || new Date(g.expires_at) <= new Date())
                .slice(0, 3)
                .map((grant) => (
                  <div 
                    key={grant.id}
                    className="p-3 rounded-lg bg-secondary/50 border border-border/50 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground truncate">{grant.reason}</span>
                      {getStatusBadge(grant)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(grant.granted_at), 'dd MMM yyyy')}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SupportAccessManager;

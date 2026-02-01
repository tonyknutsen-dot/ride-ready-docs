import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Mail, UserPlus, FolderOpen, Calendar, FileText, CheckSquare, Wrench, ShieldCheck, Send, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Ride {
  id: string;
  ride_name: string;
}

interface FeaturePermissions {
  calendar: boolean;
  documents: boolean;
  checks: boolean;
  maintenance: boolean;
  risk_assessments: boolean;
  send_documents: boolean;
}

const FEATURE_CONFIG: Array<{
  key: keyof FeaturePermissions;
  label: string;
  icon: any;
  description: string;
  default?: boolean;
  sensitive?: boolean;
}> = [
  { key: 'checks', label: 'Checks', icon: CheckSquare, description: 'Daily, monthly, yearly inspections', default: true },
  { key: 'calendar', label: 'Calendar', icon: Calendar, description: 'View schedules and reminders', default: true },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, description: 'Log maintenance activities' },
  { key: 'documents', label: 'Documents', icon: FileText, description: 'View and manage documents', sensitive: true },
  { key: 'risk_assessments', label: 'Risk Assessments', icon: ShieldCheck, description: 'View and create risk assessments', sensitive: true },
  { key: 'send_documents', label: 'Send Documents', icon: Send, description: 'Email documents externally', sensitive: true },
];

interface StaffInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function StaffInviteDialog({ open, onOpenChange, onSuccess }: StaffInviteDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState<FeaturePermissions>({
    calendar: true,
    documents: false,
    checks: true,
    maintenance: false,
    risk_assessments: false,
    send_documents: false,
  });
  const [selectedRides, setSelectedRides] = useState<string[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingRides, setFetchingRides] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchRides();
      // Reset form when opening
      setEmail('');
      setPermissions({
        calendar: true,
        documents: false,
        checks: true,
        maintenance: false,
        risk_assessments: false,
        send_documents: false,
      });
      setSelectedRides([]);
    }
  }, [open, user]);

  const fetchRides = async () => {
    if (!user) return;
    setFetchingRides(true);
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('id, ride_name')
        .eq('user_id', user.id)
        .order('ride_name');
      
      if (error) throw error;
      setRides(data || []);
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setFetchingRides(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;

    // Ensure at least one permission is selected
    const hasAnyPermission = Object.values(permissions).some(v => v);
    if (!hasAnyPermission) {
      toast({
        title: 'Select at least one feature',
        description: 'Staff members need access to at least one feature.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      // Map legacy permission level from granular permissions
      // This maintains backwards compatibility
      let legacyPermissionLevel = 'checks_only';
      if (permissions.documents || permissions.risk_assessments || permissions.send_documents) {
        legacyPermissionLevel = 'full_access';
      } else if (permissions.maintenance) {
        legacyPermissionLevel = 'checks_maintenance';
      }

      const response = await supabase.functions.invoke('send-staff-invite', {
        body: {
          email: email.trim().toLowerCase(),
          permissionLevel: legacyPermissionLevel,
          assignedRides: selectedRides.length > 0 ? selectedRides : null,
          featurePermissions: permissions,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send invite');
      }

      toast({
        title: 'Invitation Sent',
        description: `An invite has been sent to ${email}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRide = (rideId: string) => {
    setSelectedRides(prev => 
      prev.includes(rideId) 
        ? prev.filter(id => id !== rideId)
        : [...prev, rideId]
    );
  };

  const togglePermission = (key: keyof FeaturePermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectAll = () => {
    setPermissions({
      calendar: true,
      documents: true,
      checks: true,
      maintenance: true,
      risk_assessments: true,
      send_documents: true,
    });
  };

  const selectBasic = () => {
    setPermissions({
      calendar: true,
      documents: false,
      checks: true,
      maintenance: false,
      risk_assessments: false,
      send_documents: false,
    });
  };

  const hasSensitiveAccess = permissions.documents || permissions.risk_assessments || permissions.send_documents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Staff Member
          </DialogTitle>
          <DialogDescription>
            Choose exactly which features they can access. They cannot see billing or settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 pb-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="staff@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Feature Permissions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Feature Access</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectBasic} className="h-7 text-xs">
                      Basic
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                      Full Access
                    </Button>
                  </div>
                </div>

                <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                  {FEATURE_CONFIG.map(({ key, label, icon: Icon, description, sensitive }) => (
                    <div
                      key={key}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                        permissions[key as keyof FeaturePermissions] 
                          ? 'border-primary/50 bg-primary/5' 
                          : 'border-border'
                      }`}
                      onClick={() => togglePermission(key as keyof FeaturePermissions)}
                    >
                      <Checkbox
                        checked={permissions[key as keyof FeaturePermissions]}
                        onCheckedChange={() => togglePermission(key as keyof FeaturePermissions)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{label}</span>
                          {sensitive && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-300">
                              Sensitive
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {hasSensitiveAccess && (
                  <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                      This staff member will have access to sensitive company documents and data.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              {/* Equipment Assignment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Assign Equipment (Optional)
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Leave empty to allow access to all your equipment
                </p>
                
                {fetchingRides ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : rides.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No equipment found. Add some rides first.
                  </p>
                ) : (
                  <div className="border rounded-lg p-3 max-h-[120px] overflow-y-auto">
                    <div className="space-y-2">
                      {rides.map((ride) => (
                        <div key={ride.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={ride.id}
                            checked={selectedRides.includes(ride.id)}
                            onCheckedChange={() => toggleRide(ride.id)}
                          />
                          <label
                            htmlFor={ride.id}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {ride.ride_name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRides.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedRides.map(id => {
                      const ride = rides.find(r => r.id === id);
                      return ride ? (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {ride.ride_name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

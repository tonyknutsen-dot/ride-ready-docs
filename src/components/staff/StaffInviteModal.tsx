import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, UserPlus, ArrowLeft, ArrowRight, Mail, Shield, Wrench, CheckCircle2, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_CONFIG } from '@/utils/permissions';
import { Database } from '@/integrations/supabase/types';

type StaffRole = Database['public']['Enums']['staff_role'];

interface Ride {
  id: string;
  ride_name: string;
}

interface StaffInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ROLE_OPTIONS: { value: StaffRole; icon: React.ElementType; capabilities: string[] }[] = [
  {
    value: 'manager',
    icon: Shield,
    capabilities: ['Full access except billing', 'Can create calendar events', 'Can manage compliance'],
  },
  {
    value: 'supervisor',
    icon: Wrench,
    capabilities: ['Checks, maintenance & compliance completion', 'Cannot create calendar events', 'Operations lead'],
  },
  {
    value: 'staff',
    icon: CheckCircle2,
    capabilities: ['Checks & maintenance only', 'Cannot create calendar events', 'No compliance admin'],
  },
];

export function StaffInviteModal({ open, onOpenChange, onSuccess }: StaffInviteModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('staff');
  const [accessMode, setAccessMode] = useState<'all' | 'assigned'>('assigned');
  const [selectedRides, setSelectedRides] = useState<string[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingRides, setFetchingRides] = useState(false);

  useEffect(() => {
    if (open && user) {
      setStep(1);
      setEmail('');
      setName('');
      setRole('staff');
      setAccessMode('assigned');
      setSelectedRides([]);
      fetchRides();
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
    } catch (e) {
      console.error('Error fetching rides:', e);
    } finally {
      setFetchingRides(false);
    }
  };

  const toggleRide = (rideId: string) => {
    setSelectedRides(prev =>
      prev.includes(rideId) ? prev.filter(id => id !== rideId) : [...prev, rideId]
    );
  };

  const canProceed = () => {
    if (step === 1) return email.trim().length > 0;
    if (step === 2) return true;
    if (step === 3) {
      if (accessMode === 'assigned' && selectedRides.length === 0) return false;
      return true;
    }
    return true;
  };

  const handleSend = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      // Map feature permissions from role
      const featurePermissions = {
        checks: true,
        calendar: true,
        maintenance: role !== 'staff',
        documents: role === 'manager',
        risk_assessments: role === 'manager',
        send_documents: role === 'manager',
      };

      const response = await supabase.functions.invoke('send-staff-invite', {
        body: {
          email: email.trim().toLowerCase(),
          permissionLevel: role,
          assignedRides: accessMode === 'assigned' ? selectedRides : null,
          featurePermissions,
          staffName: name.trim() || undefined,
        },
      });

      if (response.error) throw new Error(response.error.message || 'Failed to send invite');

      toast({ title: 'Invitation sent', description: `Invite sent to ${email}` });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Staff — Step {step} of 3
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Enter their email address and optional name.'}
            {step === 2 && 'Choose a role for this team member.'}
            {step === 3 && 'Set which equipment they can access.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background: s <= step ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              }}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Step 1: Email + Name */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="staff@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name (optional)</Label>
                <Input
                  id="invite-name"
                  type="text"
                  placeholder="John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2: Role Selection */}
          {step === 2 && (
            <RadioGroup value={role} onValueChange={v => setRole(v as StaffRole)} className="space-y-3">
              {ROLE_OPTIONS.map(opt => {
                const cfg = ROLE_CONFIG[opt.value];
                const Icon = opt.icon;
                const isSelected = role === opt.value;
                return (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all"
                    style={{
                      borderColor: isSelected ? cfg.color : 'hsl(var(--border))',
                      background: isSelected ? cfg.bg : 'transparent',
                    }}
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                        <span className="font-semibold text-sm">{cfg.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                      <ul className="mt-2 space-y-0.5">
                        {opt.capabilities.map((cap, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                            <span className="mt-0.5">•</span>
                            {cap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          )}

          {/* Step 3: Equipment Access */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Segmented control */}
              <div className="flex rounded-xl border border-border overflow-hidden">
                {(['all', 'assigned'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAccessMode(mode)}
                    className="flex-1 py-2.5 text-xs font-semibold transition-colors"
                    style={{
                      background: accessMode === mode ? 'hsl(var(--primary))' : 'transparent',
                      color: accessMode === mode ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {mode === 'all' ? 'All Equipment' : 'Assigned Only'}
                  </button>
                ))}
              </div>

              {accessMode === 'assigned' && (
                <>
                  {fetchingRides ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : rides.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No equipment found. Add some first.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Select which equipment this person can access.
                      </p>
                      <ScrollArea className="max-h-[200px] border rounded-xl p-2">
                        <div className="space-y-1">
                          {rides.map(ride => (
                            <label
                              key={ride.id}
                              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedRides.includes(ride.id)}
                                onCheckedChange={() => toggleRide(ride.id)}
                              />
                              <span className="text-sm">{ride.ride_name}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                      {selectedRides.length === 0 && (
                        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5">
                          Select at least one item to continue, or switch to "All Equipment".
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t">
          {step > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step < 3 ? (
            <Button size="sm" onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="gap-1">
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSend} disabled={loading || !canProceed()} className="gap-1">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Send Invite
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

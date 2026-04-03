import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, X, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StaffRoleBadge } from './StaffRoleBadge';
import { ROLE_CONFIG, STAFF_ACCESS_SUMMARY, type AppRole } from '@/utils/permissions';
import type { StaffMemberData } from './StaffCard';

interface Ride {
  id: string;
  ride_name: string;
}

interface StaffDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: StaffMemberData | null;
  actorRole: AppRole;
  onRefresh: () => void;
}

export function StaffDetailsDrawer({ open, onOpenChange, member, actorRole, onRefresh }: StaffDetailsDrawerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);
  const [accessMode, setAccessMode] = useState<'all' | 'assigned'>('all');
  const [selectedRides, setSelectedRides] = useState<string[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);

  useEffect(() => {
    if (open && member && user) {
      setAccessMode(member.equipment_access_mode || 'all');
      setSelectedRides(member.assigned_rides.map(r => r.id));
      fetchRides();
    }
  }, [open, member, user]);

  const fetchRides = async () => {
    if (!user) return;
    setLoadingRides(true);
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('id, ride_name')
        .eq('user_id', user.id)
        .order('ride_name');
      if (error) throw error;
      setRides(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRides(false);
    }
  };

  const toggleRide = (rideId: string) => {
    setSelectedRides(prev =>
      prev.includes(rideId) ? prev.filter(id => id !== rideId) : [...prev, rideId]
    );
  };

  const saveEquipment = async () => {
    if (!member || !user) return;
    setSaving(true);
    try {
      const { error: modeError } = await supabase
        .from('organisation_members')
        .update({ equipment_access_mode: accessMode } as any)
        .eq('id', member.id);
      if (modeError) throw modeError;

      await supabase.from('staff_equipment_assignments').delete().eq('member_id', member.id);

      if (accessMode === 'assigned' && selectedRides.length > 0) {
        const assignments = selectedRides.map(rideId => ({
          member_id: member.id,
          ride_id: rideId,
          assigned_by: user.id,
        }));
        const { error } = await supabase.from('staff_equipment_assignments').insert(assignments);
        if (error) throw error;
      }

      toast({
        title: 'Ride access updated',
        description: accessMode === 'all'
          ? 'Access to all rides'
          : `Assigned to ${selectedRides.length} ride${selectedRides.length !== 1 ? 's' : ''}`,
      });
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl flex flex-col">
        <SheetHeader className="pb-1">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{
                background: ROLE_CONFIG['staff']?.bg || 'hsl(var(--muted))',
                color: ROLE_CONFIG['staff']?.color || 'hsl(var(--foreground))',
              }}
            >
              {(member.display_name || member.email || '?')[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-left text-sm">
                {member.display_name || member.email || 'Unknown'}
              </SheetTitle>
              {member.email && member.display_name && (
                <SheetDescription className="text-left text-xs">
                  {member.email}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5 pb-6 pt-2">

          {/* 1) Role — read-only */}
          <section className="space-y-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</h4>
            <StaffRoleBadge role="staff" size="md" />
            <p className="text-[11px] text-muted-foreground">
              {ROLE_CONFIG['staff']?.description}
            </p>
          </section>

          {/* 2) Access summary — read-only, not editable */}
          <section className="space-y-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Access</h4>
            <div className="rounded-lg border border-border p-2.5 space-y-1">
              {STAFF_ACCESS_SUMMARY.map(p => (
                <div key={p.label} className="flex items-center gap-2">
                  {p.granted ? (
                    <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${p.granted ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 3) Ride Access — this is the only editable control */}
          <section className="space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3 w-3" />
              Ride Access
            </h4>

            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['all', 'assigned'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAccessMode(mode)}
                  className="flex-1 py-2 text-xs font-semibold transition-colors"
                  style={{
                    background: accessMode === mode ? 'hsl(var(--primary))' : 'transparent',
                    color: accessMode === mode ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {mode === 'all' ? 'All Rides' : 'Assigned Only'}
                </button>
              ))}
            </div>

            {accessMode === 'assigned' && (
              <>
                {loadingRides ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="border rounded-lg p-1.5 max-h-[160px] overflow-y-auto space-y-0.5">
                    {rides.map(ride => (
                      <label
                        key={ride.id}
                        className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedRides.includes(ride.id)}
                          onCheckedChange={() => toggleRide(ride.id)}
                        />
                        <span className="text-sm">{ride.ride_name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}

            <Button
              size="sm"
              onClick={saveEquipment}
              disabled={saving || (accessMode === 'assigned' && selectedRides.length === 0)}
              className="w-full h-10"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Ride Access
            </Button>
          </section>

          <p className="text-[10px] text-muted-foreground text-center">
            All changes are audit logged.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

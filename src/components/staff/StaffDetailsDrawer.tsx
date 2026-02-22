import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, X, Shield, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StaffRoleBadge } from './StaffRoleBadge';
import { ROLE_CONFIG, getRolePermissions, assignable_roles, can_change_role, type AppRole } from '@/utils/permissions';
import type { StaffMemberData } from './StaffCard';
import { Database } from '@/integrations/supabase/types';

type StaffRole = Database['public']['Enums']['staff_role'];

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

  const memberRole = member?.permission_level as AppRole || 'staff';
  const canEditRole = can_change_role(actorRole, memberRole);
  const availableRoles = assignable_roles(actorRole);
  const permissions = getRolePermissions(memberRole);

  useEffect(() => {
    if (open && member && user) {
      const hasAssignments = member.assigned_rides.length > 0;
      setAccessMode(hasAssignments ? 'assigned' : 'all');
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

  const handleRoleChange = async (newRole: string) => {
    if (!member) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organisation_members')
        .update({ permission_level: newRole as StaffRole })
        .eq('id', member.id);
      if (error) throw error;
      toast({ title: 'Role updated' });
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
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
      // Delete existing
      await supabase.from('staff_equipment_assignments').delete().eq('member_id', member.id);

      // Insert new if assigned mode
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
        title: 'Equipment access updated',
        description: accessMode === 'all'
          ? 'Now has access to all equipment'
          : `Assigned to ${selectedRides.length} item${selectedRides.length !== 1 ? 's' : ''}`,
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
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl flex flex-col">
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{
                background: ROLE_CONFIG[memberRole]?.bg || 'hsl(var(--muted))',
                color: ROLE_CONFIG[memberRole]?.color || 'hsl(var(--foreground))',
              }}
            >
              {(member.display_name || member.email || '?')[0]?.toUpperCase()}
            </div>
            <div>
              <SheetTitle className="text-left text-base">
                {member.display_name || member.email || 'Unknown'}
              </SheetTitle>
              <SheetDescription className="text-left">
                {member.email}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">

            {/* 1) Role */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Role
              </h4>
              {canEditRole && availableRoles.length > 0 ? (
                <Select
                  value={member.permission_level}
                  onValueChange={handleRoleChange}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map(r => (
                      <SelectItem key={r} value={r}>
                        {ROLE_CONFIG[r]?.label || r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <StaffRoleBadge role={memberRole} size="md" />
              )}
            </section>

            {/* 2) Permissions Summary */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permissions
              </h4>
              <div className="rounded-xl border border-border p-3 space-y-1.5">
                {permissions.map(p => (
                  <div key={p.label} className="flex items-center gap-2">
                    {p.granted ? (
                      <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${p.granted ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 3) Equipment Access */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Equipment Access
              </h4>

              {/* Toggle */}
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
                  {loadingRides ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="border rounded-xl p-2 max-h-[180px] overflow-y-auto space-y-0.5">
                      {rides.map(ride => (
                        <label
                          key={ride.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
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
                className="w-full"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Save Equipment Access
              </Button>
            </section>

            {/* Audit note */}
            <p className="text-[11px] text-muted-foreground text-center pt-2">
              All changes are audit logged.
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

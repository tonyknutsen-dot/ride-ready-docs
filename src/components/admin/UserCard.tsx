import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  ShieldOff,
  Ban,
  CheckCircle,
  FlaskConical,
  Clock,
  Building,
  MoreVertical,
  Loader2,
  UserMinus,
  UserX,
  Calendar,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  getAccountStatusMeta,
  getBillingStatusMeta,
  getOrgRoleLabel,
  getPlatformRoleLabel,
  getUserCompany,
} from './userManagementMeta';

interface UserProfile {
  company_name: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  trial_ends_at: string | null;
  country: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface UserCardData {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  profile: UserProfile | null;
  isAdmin: boolean;
  isTester: boolean;
  isStaffMember: boolean;
  staffOrgName: string | null;
  testerExpiresAt: string | null;
  rideCount: number;
}

interface UserCardProps {
  user: UserCardData;
  updatingUserId: string | null;
  updatingTesterUserId: string | null;
  suspendingUserId: string | null;
  onToggleAdmin: (userId: string, currentlyAdmin: boolean) => void;
  onToggleSuspension: (userId: string, currentlySuspended: boolean, reason?: string) => void;
  onToggleTester: (userId: string, currentlyTester: boolean, expiryDays?: number) => void;
  onExtendTester: (userId: string, days: number) => void;
  onOffboardTester: (userId: string, newRole: 'user' | 'disabled', reason?: string) => void;
}

export function UserCard({
  user,
  updatingUserId,
  updatingTesterUserId,
  suspendingUserId,
  onToggleAdmin,
  onToggleSuspension,
  onToggleTester,
  onExtendTester,
  onOffboardTester,
}: UserCardProps) {
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [showTesterDialog, setShowTesterDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [testerExpiryDays, setTesterExpiryDays] = useState('30');
  const [offboardReason, setOffboardReason] = useState('');
  const accountStatus = getAccountStatusMeta(user);
  const billingStatus = getBillingStatusMeta(user);
  const platformRole = getPlatformRoleLabel(user);
  const orgRole = getOrgRoleLabel(user);
  const companyName = getUserCompany(user);

  return (
    <>
      <div className={cn(
        'rounded-lg border p-3 space-y-3',
        accountStatus.isSuspended ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card',
      )}>
        {/* Row 1: Name + kebab */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">
              {user.name || user.email?.split('@')[0] || 'Unknown'}
            </p>
            <p className="text-xs text-foreground/60 truncate">{user.email || 'No email'}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(() => setShowSuspendDialog(true), 0);
                }}
              >
                {user.profile?.is_suspended ? (
                  <><CheckCircle className="h-4 w-4 mr-2" />Reactivate</>
                ) : (
                  <><Ban className="h-4 w-4 mr-2" />Suspend</>
                )}
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(() => setShowAdminDialog(true), 0);
                }}
              >
                {user.isAdmin ? (
                  <><ShieldOff className="h-4 w-4 mr-2" />Remove Admin</>
                ) : (
                  <><Shield className="h-4 w-4 mr-2" />Make Admin</>
                )}
              </DropdownMenuItem>

              {!user.isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setTimeout(() => setShowTesterDialog(true), 0);
                    }}
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    {user.isTester ? 'Manage Tester' : 'Make Tester'}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2: Company */}
        {companyName && (
          <div className="flex items-center gap-1.5 text-xs text-foreground/60">
            <Building className="h-3 w-3 shrink-0" />
            <span className="truncate">{companyName}</span>
          </div>
        )}

        {/* Row 3: Separated state summary */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="space-y-1 rounded-md border border-border/70 bg-background/80 p-2">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Account</span>
            <Badge variant="outline" className={cn('max-w-full', accountStatus.className)}>
              {accountStatus.isSuspended && <Ban className="h-3 w-3 mr-1" />}
              {accountStatus.label}
            </Badge>
          </div>
          <div className="space-y-1 rounded-md border border-border/70 bg-background/80 p-2">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Billing</span>
            <Badge variant="outline" className={billingStatus.className}>{billingStatus.label}</Badge>
          </div>
          <div className="space-y-1 rounded-md border border-border/70 bg-background/80 p-2">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Platform</span>
            {platformRole === 'Admin' ? (
              <Badge className="bg-primary text-primary-foreground"><Shield className="h-3 w-3 mr-1" />Admin</Badge>
            ) : platformRole === 'Tester' ? (
              <Badge className="bg-warning text-warning-foreground"><FlaskConical className="h-3 w-3 mr-1" />Tester</Badge>
            ) : (
              <Badge variant="outline">User</Badge>
            )}
          </div>
          <div className="space-y-1 rounded-md border border-border/70 bg-background/80 p-2">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Org Role</span>
            {orgRole === 'Controller' ? (
              <Badge variant="outline" className="border-primary/40 text-primary">Controller</Badge>
            ) : orgRole === 'Staff' ? (
              <Badge variant="outline" className="border-primary/40 text-primary"><Users className="h-3 w-3 mr-1" />Staff</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">None</Badge>
            )}
          </div>
        </div>

        {/* Row 4: Meta */}
        <div className="flex items-center gap-3 text-[10px] text-foreground/60">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(user.created_at), 'MMM d, yyyy')}
          </span>
          <span>{user.rideCount} ride{user.rideCount !== 1 ? 's' : ''}</span>
          {user.isTester && user.testerExpiresAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(user.testerExpiresAt) < new Date() ? 'Tester expired' : `Exp ${format(new Date(user.testerExpiresAt), 'MMM d, yy')}`}
            </span>
          )}
          {user.profile?.country && <span>{user.profile.country}</span>}
        </div>
      </div>

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={(open) => {
        if (!open) { setShowSuspendDialog(false); setSuspendReason(''); }
      }}>
        <AlertDialogContent className="w-[95vw] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {user.profile?.is_suspended ? 'Reactivate User Account?' : 'Suspend User Account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {user.profile?.is_suspended
                ? "This will restore the user's access to their account."
                : 'This will prevent the user from accessing their account.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!user.profile?.is_suspended && (
            <div className="space-y-2">
              <Label htmlFor={`suspend-reason-${user.id}`}>Reason (optional)</Label>
              <Textarea
                id={`suspend-reason-${user.id}`}
                placeholder="Enter reason for suspension..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          )}
          {user.profile?.is_suspended && user.profile?.suspended_reason && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              <strong>Suspension reason:</strong> {user.profile.suspended_reason}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onToggleSuspension(user.id, user.profile?.is_suspended ?? false, suspendReason);
                setShowSuspendDialog(false);
                setSuspendReason('');
              }}
            >
              {user.profile?.is_suspended ? 'Reactivate' : 'Suspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin Dialog */}
      <AlertDialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
        <AlertDialogContent className="w-[95vw] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {user.isAdmin ? 'Remove Admin Access?' : 'Grant Admin Access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {user.isAdmin
                ? 'This user will lose access to the admin dashboard and management features.'
                : 'This user will gain full admin access including user management and system settings.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onToggleAdmin(user.id, user.isAdmin);
              setShowAdminDialog(false);
            }}>
              {user.isAdmin ? 'Remove Admin' : 'Grant Admin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tester Dialog */}
      <AlertDialog open={showTesterDialog} onOpenChange={(open) => {
        if (!open) { setShowTesterDialog(false); setTesterExpiryDays('30'); setOffboardReason(''); }
      }}>
        <AlertDialogContent className="w-[95vw] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-warning" />
              {user.isTester ? 'Manage Tester Role' : 'Grant Tester Role'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {user.isTester ? (
                  <>
                    <p>
                      This user currently has the tester role.
                      {user.testerExpiresAt && (
                        <span className="block mt-1 font-medium">
                          Expires: {format(new Date(user.testerExpiresAt), 'MMM d, yyyy h:mm a')}
                          {new Date(user.testerExpiresAt) < new Date() && (
                            <Badge variant="destructive" className="ml-2">Expired</Badge>
                          )}
                        </span>
                      )}
                    </p>
                    <div className="space-y-2">
                      <Label>Extend Access</Label>
                      <div className="flex gap-2">
                        {[7, 30, 90].map(d => (
                          <Button key={d} size="sm" variant="outline"
                            onClick={() => onExtendTester(user.id, d)}
                            disabled={updatingTesterUserId === user.id}
                          >
                            +{d} days
                          </Button>
                        ))}
                      </div>
                    </div>
                    <hr className="border-border" />
                    <div className="space-y-3">
                      <Label className="text-destructive">Off-board Tester</Label>
                      <div className="space-y-2">
                        <Label htmlFor={`offboard-reason-${user.id}`} className="text-sm text-muted-foreground">
                          Reason (optional)
                        </Label>
                        <Input
                          id={`offboard-reason-${user.id}`}
                          placeholder="e.g., Testing period complete"
                          value={offboardReason}
                          onChange={(e) => setOffboardReason(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1"
                          onClick={() => { onOffboardTester(user.id, 'user', offboardReason); setShowTesterDialog(false); }}
                          disabled={updatingTesterUserId === user.id}
                        >
                          <UserMinus className="h-4 w-4 mr-1" />Convert to User
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1"
                          onClick={() => { onOffboardTester(user.id, 'disabled', offboardReason); setShowTesterDialog(false); }}
                          disabled={updatingTesterUserId === user.id}
                        >
                          <UserX className="h-4 w-4 mr-1" />Disable
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p>This user will see a "TEST MODE" banner and have access to all paid features without billing.</p>
                    <div className="space-y-2">
                      <Label htmlFor={`tester-expiry-${user.id}`}>Access Duration</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`tester-expiry-${user.id}`}
                          type="number"
                          min="0"
                          value={testerExpiryDays}
                          onChange={(e) => setTesterExpiryDays(e.target.value)}
                          className="w-24"
                        />
                        <span className="self-center text-sm text-muted-foreground">days</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Set to 0 for no expiry.</p>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {user.isTester ? (
              <AlertDialogAction
                onClick={() => { onToggleTester(user.id, true); setShowTesterDialog(false); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove Tester Role
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={() => { onToggleTester(user.id, false, parseInt(testerExpiryDays) || 0); setShowTesterDialog(false); }}
              >
                Grant Tester Role
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

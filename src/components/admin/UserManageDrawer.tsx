import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
  Shield, ShieldOff, Ban, CheckCircle, FlaskConical, Clock,
  Building, Calendar, Users, UserMinus, UserX, Loader2, Trash2, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import type { UserCardData } from './UserCard';
import {
  getAccountStatusMeta,
  getBillingStatusMeta,
  getOrgRoleLabel,
  getPlatformRoleLabel,
  getUserCompany,
} from './userManagementMeta';

interface UserManageDrawerProps {
  user: UserCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updatingUserId: string | null;
  updatingTesterUserId: string | null;
  suspendingUserId: string | null;
  onToggleAdmin: (userId: string, currentlyAdmin: boolean) => void;
  onToggleSuspension: (userId: string, currentlySuspended: boolean, reason?: string) => void;
  onToggleTester: (userId: string, currentlyTester: boolean, expiryDays?: number) => void;
  onExtendTester: (userId: string, days: number) => void;
  onOffboardTester: (userId: string, newRole: 'user' | 'disabled', reason?: string) => void;
  onRemoveFromOrg?: (userId: string) => void;
  onDeleteUser?: (userId: string, confirmEmail: string) => Promise<{ error?: string }>;
  currentUserId?: string;
}

export function UserManageDrawer({
  user, open, onOpenChange,
  updatingUserId, updatingTesterUserId, suspendingUserId,
  onToggleAdmin, onToggleSuspension, onToggleTester, onExtendTester, onOffboardTester,
  onRemoveFromOrg, onDeleteUser, currentUserId,
}: UserManageDrawerProps) {
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'admin' | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [testerExpiryDays, setTesterExpiryDays] = useState('30');
  const [offboardReason, setOffboardReason] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!user) return null;

  const isSuspended = user.profile?.is_suspended ?? false;
  const accountStatus = getAccountStatusMeta(user);
  const billingStatus = getBillingStatusMeta(user);
  const orgRole = getOrgRoleLabel(user);
  const platformRole = getPlatformRoleLabel(user);
  const companyName = getUserCompany(user);
  const isLoading = updatingUserId === user.id || updatingTesterUserId === user.id || suspendingUserId === user.id;

  const isSelf = currentUserId === user.id;
  const isOrgOwner = !!user.profile?.company_name && !user.isStaffMember;

  // Determine delete blockers — these are for full ACCOUNT deletion only
  const getDeleteBlockReason = (): string | null => {
    if (isSelf) return 'You cannot delete your own account.';
    if (user.isAdmin) return 'Cannot delete an admin account. Remove admin role first.';
    if (isOrgOwner) return 'This user is the controller/owner of an organisation. Transfer or delete the organisation first.';
    // Active org membership blocks account deletion — remove from org first
    if (user.isStaffMember) return `This user is a member of ${user.staffOrgName || 'an organisation'}. Remove them from the organisation first, then delete if needed.`;
    return null;
  };

  const deleteBlockReason = getDeleteBlockReason();

  const handleConfirm = () => {
    if (confirmAction === 'suspend') {
      onToggleSuspension(user.id, isSuspended, suspendReason);
      setSuspendReason('');
    } else if (confirmAction === 'admin') {
      onToggleAdmin(user.id, user.isAdmin);
    }
    setConfirmAction(null);
  };

  const handleDeleteUser = async () => {
    if (!onDeleteUser) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await onDeleteUser(user.id, deleteConfirmText);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        setShowDeleteDialog(false);
        setDeleteConfirmText('');
        onOpenChange(false);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-lg">
              {user.name || user.email?.split('@')[0] || 'Unknown'}
            </SheetTitle>
            <SheetDescription className="text-xs truncate">{user.email}</SheetDescription>
          </SheetHeader>

          {/* User Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {companyName && (
                <div>
                  <span className="text-xs text-muted-foreground block">Company</span>
                  <span className="flex items-center gap-1 font-medium">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    {companyName}
                  </span>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground block">Joined</span>
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {format(new Date(user.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Rides</span>
                <span className="font-medium">{user.rideCount}</span>
              </div>
              {user.profile?.country && (
                <div>
                  <span className="text-xs text-muted-foreground block">Country</span>
                  <span className="font-medium">{user.profile.country}</span>
                </div>
              )}
              {user.profile?.subscription_plan && (
                <div>
                  <span className="text-xs text-muted-foreground block">Plan</span>
                  <Badge variant="outline" className="capitalize text-xs">{user.profile.subscription_plan}</Badge>
                </div>
              )}
            </div>

            {/* Status Badges */}
            <div className="space-y-2">
              {accountStatus.isSuspended && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2 font-medium">
                    <Ban className="h-4 w-4" /> Account suspended
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This account is suspended independently of billing state.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">Platform:</span>
                {platformRole === 'Admin' ? (
                  <Badge className="bg-primary text-primary-foreground"><Shield className="h-3 w-3 mr-1" />Admin</Badge>
                ) : platformRole === 'Tester' ? (
                  <Badge className="bg-warning text-warning-foreground"><FlaskConical className="h-3 w-3 mr-1" />Tester</Badge>
                ) : (
                  <Badge variant="outline">User</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">Org Role:</span>
                {orgRole === 'Staff' ? (
                  <Badge variant="outline" className="border-muted-foreground/40"><Users className="h-3 w-3 mr-1" />Staff</Badge>
                ) : orgRole === 'Controller' ? (
                  <Badge variant="outline" className="border-primary/40 text-primary">Controller</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">None</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">Account:</span>
                <Badge variant="outline" className={accountStatus.className}>
                  {accountStatus.isSuspended && <Ban className="h-3 w-3 mr-1" />}
                  {accountStatus.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">Billing:</span>
                <Badge variant="outline" className={billingStatus.className}>
                  {billingStatus.label}
                </Badge>
              </div>
              {user.isTester && user.testerExpiresAt && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Tester Exp:</span>
                  <span className="flex items-center gap-1 text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {new Date(user.testerExpiresAt) < new Date() ? (
                      <span className="text-destructive font-medium">Expired</span>
                    ) : (
                      format(new Date(user.testerExpiresAt), 'MMM d, yyyy')
                    )}
                  </span>
                </div>
              )}
            </div>

            {isSuspended && user.profile?.suspended_reason && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm">
                <strong className="text-destructive">Suspension reason:</strong>
                <p className="text-muted-foreground mt-1">{user.profile.suspended_reason}</p>
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Actions</h4>

              {/* Suspend / Reactivate */}
              <Button
                variant={isSuspended ? 'default' : 'outline'}
                size="sm"
                className="w-full justify-start h-9"
                disabled={isLoading}
                onClick={() => setConfirmAction('suspend')}
              >
                {isLoading && suspendingUserId === user.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isSuspended ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <Ban className="h-4 w-4 mr-2" />
                )}
                {isSuspended ? 'Reactivate Account' : 'Suspend Account'}
              </Button>
              <p className="text-xs text-muted-foreground -mt-1 pl-1">
                {isSuspended
                  ? 'Restores sign-in access. Does not affect organisation membership.'
                  : 'Blocks sign-in, sign-up with same email, and invite acceptance. Retains minimal data for security/audit.'}
              </p>

              {/* Admin toggle */}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-9"
                disabled={isLoading}
                onClick={() => setConfirmAction('admin')}
              >
                {isLoading && updatingUserId === user.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : user.isAdmin ? (
                  <ShieldOff className="h-4 w-4 mr-2" />
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
              </Button>

              {/* Remove from organisation */}
              {user.isStaffMember && onRemoveFromOrg && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start h-9 text-warning"
                    disabled={isLoading}
                    onClick={() => onRemoveFromOrg(user.id)}
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Remove from Organisation
                  </Button>
                  <p className="text-xs text-muted-foreground -mt-1 pl-1">
                    Revokes organisation access only. The user account and any operational records they created are preserved for audit traceability.
                  </p>
                </>
              )}

              {/* Tester section */}
              {!user.isAdmin && (
                <>
                  <Separator />
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                    <FlaskConical className="h-3.5 w-3.5" /> Tester Management
                  </h4>

                  {user.isTester ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        {[7, 30, 90].map(d => (
                          <Button key={d} size="sm" variant="outline" className="flex-1 h-8 text-xs"
                            onClick={() => onExtendTester(user.id, d)}
                            disabled={isLoading}
                          >
                            +{d}d
                          </Button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="offboard-reason" className="text-xs text-muted-foreground">Off-board reason</Label>
                        <Input
                          id="offboard-reason"
                          placeholder="e.g., Testing complete"
                          value={offboardReason}
                          onChange={(e) => setOffboardReason(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                          onClick={() => { onOffboardTester(user.id, 'user', offboardReason); setOffboardReason(''); }}
                          disabled={isLoading}
                        >
                          <UserMinus className="h-3.5 w-3.5 mr-1" />To User
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs"
                          onClick={() => { onOffboardTester(user.id, 'disabled', offboardReason); setOffboardReason(''); }}
                          disabled={isLoading}
                        >
                          <UserX className="h-3.5 w-3.5 mr-1" />Disable
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full h-8 text-xs"
                        onClick={() => { onToggleTester(user.id, true); }}
                        disabled={isLoading}
                      >
                        Remove Tester Role
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" min="0" value={testerExpiryDays}
                          onChange={(e) => setTesterExpiryDays(e.target.value)}
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">days (0 = no expiry)</span>
                      </div>
                      <Button
                        size="sm" className="w-full h-8 text-xs"
                        onClick={() => onToggleTester(user.id, false, parseInt(testerExpiryDays) || 0)}
                        disabled={isLoading}
                      >
                        <FlaskConical className="h-3.5 w-3.5 mr-1" />Grant Tester Role
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Danger Zone */}
              {onDeleteUser && (
                <>
                  <Separator />
                  <h4 className="text-sm font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Danger Zone
                  </h4>

                  {deleteBlockReason ? (
                    <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Delete blocked</p>
                      <p>{deleteBlockReason}</p>
                      <p className="italic">Consider using "Remove from Organisation" or "Suspend Account" instead. Operational records require retained attribution for audit and legal purposes.</p>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full justify-start h-9"
                        disabled={isLoading || isDeleting}
                        onClick={() => { setShowDeleteDialog(true); setDeleteError(null); setDeleteConfirmText(''); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete User Account
                      </Button>
                      <p className="text-xs text-muted-foreground -mt-1 pl-1">
                        Permanently removes the account and all associated data. Only available for test/demo accounts with no real operational history. This cannot be undone.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog — Suspend/Admin */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(o) => { if (!o) { setConfirmAction(null); setSuspendReason(''); } }}>
        <AlertDialogContent className="w-[95vw] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'suspend'
                ? (isSuspended ? 'Reactivate User Account?' : 'Suspend User Account?')
                : (user.isAdmin ? 'Remove Admin Access?' : 'Grant Admin Access?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'suspend'
                ? (isSuspended ? "This will restore the user's access." : 'This will prevent the user from accessing their account.')
                : (user.isAdmin ? 'This user will lose admin access.' : 'This user will gain full admin access.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmAction === 'suspend' && !isSuspended && (
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea placeholder="Enter reason..." value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {confirmAction === 'suspend'
                ? (isSuspended ? 'Reactivate' : 'Suspend')
                : (user.isAdmin ? 'Remove Admin' : 'Grant Admin')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog — type-to-confirm */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(o) => { if (!o) { setShowDeleteDialog(false); setDeleteConfirmText(''); setDeleteError(null); } }}>
        <AlertDialogContent className="w-[95vw] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Permanently Delete User?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will permanently delete the user account for <strong>{user.email}</strong>. This action cannot be undone.</p>
              <p className="text-destructive font-medium">Type the user's email address to confirm:</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Input
              placeholder={user.email || 'Type email to confirm'}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="text-sm"
              autoComplete="off"
            />
            {deleteError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {deleteError}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteConfirmText.toLowerCase() !== (user.email || '').toLowerCase() || isDeleting}
              onClick={handleDeleteUser}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

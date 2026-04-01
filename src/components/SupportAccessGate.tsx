import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldOff, Key, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SupportAccessGateProps {
  /** Whether the admin has a valid grant for the target */
  hasGrant: boolean;
  /** Whether still loading grants */
  loading?: boolean;
  /** Target user/company description for the blocked message */
  targetDescription?: string;
  /** Children to render when access is granted */
  children: ReactNode;
}

/**
 * Gate component that blocks rendering of customer data
 * when no valid support access grant exists.
 *
 * Usage:
 * ```tsx
 * <SupportAccessGate hasGrant={hasGrantForUser(targetUserId)}>
 *   <CustomerDataView userId={targetUserId} />
 * </SupportAccessGate>
 * ```
 */
export function SupportAccessGate({
  hasGrant,
  loading = false,
  targetDescription,
  children,
}: SupportAccessGateProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="animate-pulse text-muted-foreground text-sm">
            Checking support access…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasGrant) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">No Valid Support Access Grant</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {targetDescription
                ? `You do not have an active support access grant for ${targetDescription}.`
                : 'A valid, unexpired support access grant is required to view customer data.'}
            </p>
            <p className="text-xs text-muted-foreground">
              Grants must be created by the customer or an admin, and must be active and unexpired.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/support-access">
                <Key className="h-4 w-4 mr-1" />
                Manage Grants
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>This access attempt has been logged</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

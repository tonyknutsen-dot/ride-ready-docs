import { WifiOff, Clock } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useEffect, useState } from 'react';
import { getLastSyncTime } from '@/lib/offlineCache';

/**
 * Small inline alert shown on Compliance / Rides headers when offline.
 * Shows "Last synced: Xm ago · Data may be out of date"
 */
export function OfflineStaleAlert() {
  const { isOnline } = useOnlineStatus();
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    getLastSyncTime().then(setLastSync).catch(() => {});
  }, [isOnline]);

  if (isOnline) return null;

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return null;
    }
  };

  const syncLabel = formatSyncTime(lastSync);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium">Offline</span>
      {syncLabel && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last synced: {syncLabel}
        </span>
      )}
      <span className="text-muted-foreground">· Data may be out of date</span>
    </div>
  );
}

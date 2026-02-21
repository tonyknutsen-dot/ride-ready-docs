import { CloudOff, Wifi, RefreshCw, Loader2 } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useEffect, useState } from 'react';
import { getLastSyncTime } from '@/lib/offlineCache';

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, syncAll } = useOfflineSync();
  const [showSynced, setShowSynced] = useState(false);
  const [wasOfflineOrPending, setWasOfflineOrPending] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Load last sync time
  useEffect(() => {
    getLastSyncTime().then(setLastSync).catch(() => {});
  }, [isOnline, pendingCount]);

  // Track when we had pending items so we can show "All synced" after
  useEffect(() => {
    if (!isOnline || pendingCount > 0) {
      setWasOfflineOrPending(true);
    }
  }, [isOnline, pendingCount]);

  // Show "All synced" briefly after clearing pending items
  useEffect(() => {
    if (isOnline && pendingCount === 0 && wasOfflineOrPending && !isSyncing) {
      setShowSynced(true);
      const timer = setTimeout(() => {
        setShowSynced(false);
        setWasOfflineOrPending(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, wasOfflineOrPending, isSyncing]);

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch { return null; }
  };

  // Syncing state - online with pending items
  if (isOnline && isSyncing && pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Syncing… {pendingCount} remaining
      </div>
    );
  }

  // Online with pending items not yet syncing
  if (isOnline && pendingCount > 0 && !isSyncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4" />
        {pendingCount} pending sync
        <button
          onClick={syncAll}
          className="ml-2 underline underline-offset-2 font-bold text-xs"
        >
          Sync now
        </button>
      </div>
    );
  }

  // All synced confirmation
  if (showSynced) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-success text-success-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <Wifi className="h-4 w-4" />
        All synced
      </div>
    );
  }

  // Offline state
  if (!isOnline) {
    const syncLabel = formatSyncTime(lastSync);
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground py-2 px-4 text-center text-xs font-medium space-y-0.5">
        <div className="flex items-center justify-center gap-2 font-semibold text-sm">
          <CloudOff className="h-4 w-4" />
          Offline mode (limited)
          {syncLabel && <span className="text-xs font-normal opacity-80">• last sync: {syncLabel}</span>}
        </div>
        <p className="opacity-80">
          View last-synced rides &amp; compliance. Some actions sync when reconnected. PDFs/photos may be unavailable unless previously opened.
        </p>
        {pendingCount > 0 && <p className="opacity-80">{pendingCount} change{pendingCount !== 1 ? 's' : ''} pending sync</p>}
      </div>
    );
  }

  return null;
}

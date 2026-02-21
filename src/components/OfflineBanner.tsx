import { CloudOff, Wifi, RefreshCw, Loader2 } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, syncAll } = useOfflineSync();
  const [showSynced, setShowSynced] = useState(false);
  const [wasOfflineOrPending, setWasOfflineOrPending] = useState(false);

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
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <CloudOff className="h-4 w-4" />
        Offline mode {pendingCount > 0 ? `• ${pendingCount} pending sync` : ''}
      </div>
    );
  }

  return null;
}

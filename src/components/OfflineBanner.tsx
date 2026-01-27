import { CloudOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const { isOnline, wasOffline, acknowledgeReconnection } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (wasOffline && isOnline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        acknowledgeReconnection();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline, acknowledgeReconnection]);

  if (showReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-success text-success-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
        <Wifi className="h-4 w-4" />
        Back online! Syncing your data...
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <CloudOff className="h-4 w-4" />
        You're offline. Changes will sync when you reconnect.
      </div>
    );
  }

  return null;
}

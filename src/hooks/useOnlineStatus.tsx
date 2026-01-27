import { useState, useEffect, useCallback } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  const handleOnline = useCallback(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
    setIsOnline(true);
  }, [isOnline]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Reset wasOffline flag after it's been acknowledged
  const acknowledgeReconnection = useCallback(() => {
    setWasOffline(false);
  }, []);

  return { isOnline, wasOffline, acknowledgeReconnection };
}

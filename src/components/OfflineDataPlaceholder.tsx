import { WifiOff } from 'lucide-react';

/**
 * Inline placeholder shown when a section has no cached data and the user is offline.
 */
export function OfflineDataPlaceholder({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center mb-3">
        <WifiOff className="h-5 w-5 text-warning" />
      </div>
      <p className="text-sm font-medium text-foreground">Not available offline</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        {message || "This section isn't cached yet. Reconnect to load it."}
      </p>
    </div>
  );
}

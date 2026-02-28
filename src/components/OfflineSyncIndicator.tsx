import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OfflineSyncIndicatorProps {
  compact?: boolean;
}

export function OfflineSyncIndicator({ compact = false }: OfflineSyncIndicatorProps) {
  const { isOnline, isSyncing, pendingCount, syncAll } = useOfflineSync();

  if (isOnline && pendingCount === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 px-3 py-1.5 ${compact ? 'justify-center' : ''}`}>
              <span className="h-2 w-2 rounded-full bg-emerald-500/70 flex-shrink-0" />
              {!compact && <span className="text-[11px] text-muted-foreground/60">Synced</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>All data is synced</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!isOnline) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 text-warning px-2 py-1 rounded-md bg-warning/10 ${compact ? 'justify-center' : ''}`}>
              <CloudOff className="h-4 w-4" />
              {!compact && <span className="text-xs font-medium">Offline</span>}
              {pendingCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>You're offline. {pendingCount > 0 ? `${pendingCount} items waiting to sync` : 'Changes will sync when online'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Online but has pending items
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={syncAll}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 text-info px-2 py-1 h-auto w-full ${compact ? 'justify-center' : 'justify-start'}`}
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            {!compact && (
              <span className="text-xs font-medium">
                {isSyncing ? 'Syncing...' : 'Sync'}
              </span>
            )}
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {pendingCount}
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isSyncing ? 'Syncing data...' : `${pendingCount} items to sync. Click to sync now.`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

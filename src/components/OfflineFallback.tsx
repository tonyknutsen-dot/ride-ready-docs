import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

/**
 * Shown when a lazy-loaded route fails to load (typically because the user
 * is offline and the chunk isn't cached by the service worker).
 */
export function OfflineFallback() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
          <WifiOff className="h-6 w-6 text-warning" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Limited offline mode</h2>
        <p className="text-sm text-muted-foreground">
          This page isn't available offline. Please reconnect to load it.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    </div>
  );
}

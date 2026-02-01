import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Link, useLocation } from 'react-router-dom';

export function InstallPromptBanner() {
  const { shouldShowReminder, promptInstall, dismiss, isIOS, isInstallable } = useInstallPrompt();
  const location = useLocation();

  // Don't show install banner on invite pages - user is focused on joining
  const isInvitePage = location.pathname.startsWith('/staff-invite') || 
                        location.pathname.startsWith('/tester-invite');

  if (!shouldShowReminder || isInvitePage) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      // iOS doesn't support beforeinstallprompt, redirect to install page
      window.location.href = '/install';
    } else {
      const success = await promptInstall();
      if (!success) {
        // If prompt failed, redirect to install page
        window.location.href = '/install';
      }
    }
  };

  return (
    <div className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-40 animate-slide-up">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
        
        <div className="flex items-start gap-3 pr-6">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-foreground">
              Install Ride Ready Docs
            </h3>
            <p className="text-xs text-muted-foreground">
              Get quick access from your home screen. Works offline too!
            </p>
            
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="gap-1.5 text-xs h-8"
              >
                <Download className="h-3.5 w-3.5" />
                Install App
              </Button>
              <Link to="/install">
                <Button variant="ghost" size="sm" className="text-xs h-8">
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

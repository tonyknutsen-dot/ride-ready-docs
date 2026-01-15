import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, MonitorSmartphone } from 'lucide-react';

interface DeviceHintBannerProps {
  variant?: 'default' | 'hero';
}

const MOBILE_BREAKPOINT = 768;
const STORAGE_KEY = 'device-hint-banner';
const MAX_SHOW_COUNT = 3;

export default function DeviceHintBanner({ variant = 'default' }: DeviceHintBannerProps) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (!isMobile) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : { dismissed: false, showCount: 0 };

      // Don't show if permanently dismissed or shown enough times
      if (data.dismissed || data.showCount >= MAX_SHOW_COUNT) {
        return;
      }

      // Show banner and increment count
      setShowBanner(true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...data,
        showCount: data.showCount + 1
      }));
    } catch {
      // If localStorage fails, just show the banner
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      // Mark as permanently dismissed
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: true, showCount: MAX_SHOW_COUNT }));
    } catch {
      // Ignore storage errors
    }
  };

  if (!showBanner) return null;

  const isHero = variant === 'hero';

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
      isHero 
        ? 'border-white/30 bg-white/10 text-white backdrop-blur-sm' 
        : 'border-primary/30 bg-primary/5'
    }`}>
      <MonitorSmartphone className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isHero ? 'text-white' : 'text-primary'}`} />
      <div className="text-sm leading-5">
        <span className="font-semibold">Tip:</span> Works great on mobile! For the full experience with lots of documents and forms, try us on a tablet or laptop.
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={`ml-auto flex-shrink-0 ${isHero ? 'text-white hover:bg-white/20' : ''}`}
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
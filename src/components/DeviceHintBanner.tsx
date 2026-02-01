import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, MonitorSmartphone } from 'lucide-react';

interface DeviceHintBannerProps {
  variant?: 'default' | 'hero';
  storageKey?: string;
}

const MOBILE_BREAKPOINT = 768;
const DEFAULT_STORAGE_KEY = 'device-hint-banner';

const TIPS = [
  "Works great on mobile! For the full experience with lots of documents and forms, try us on a tablet or laptop.",
  "Swipe between tabs for quick navigation. Need more screen space? A tablet works brilliantly!",
  "Last tip: Pin this app to your home screen for instant access. For heavy admin work, try desktop!"
];

export default function DeviceHintBanner({ variant = 'default', storageKey = DEFAULT_STORAGE_KEY }: DeviceHintBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (!isMobile) return;

    try {
      const stored = localStorage.getItem(storageKey);
      const data = stored ? JSON.parse(stored) : { dismissed: false, showCount: 0 };

      // Don't show if permanently dismissed or shown enough times
      if (data.dismissed || data.showCount >= TIPS.length) {
        return;
      }

      // Set the tip based on show count and show banner
      setTipIndex(data.showCount);
      setShowBanner(true);
      
      // Increment count for next time
      localStorage.setItem(storageKey, JSON.stringify({
        ...data,
        showCount: data.showCount + 1
      }));
    } catch {
      // If localStorage fails, just show the first tip
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      // Mark as permanently dismissed
      localStorage.setItem(storageKey, JSON.stringify({ dismissed: true, showCount: TIPS.length }));
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
        <span className="font-semibold">Tip {tipIndex + 1}/{TIPS.length}:</span> {TIPS[tipIndex]}
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
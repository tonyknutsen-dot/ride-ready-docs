import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, MonitorSmartphone } from 'lucide-react';

interface DeviceHintBannerProps {
  variant?: 'default' | 'hero';
}

const MOBILE_BREAKPOINT = 768;

export default function DeviceHintBanner({ variant = 'default' }: DeviceHintBannerProps) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem('rrd_hide_device_hint') === '1';
    if (dismissed) return;

    // Check if mobile
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    if (isMobile) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('rrd_hide_device_hint', '1');
    setShowBanner(false);
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
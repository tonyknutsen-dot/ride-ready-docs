import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { X, MonitorSmartphone } from 'lucide-react';

interface DeviceHintBannerProps {
  variant?: 'default' | 'hero';
}

export default function DeviceHintBanner({ variant = 'default' }: DeviceHintBannerProps) {
  const isMobile = useIsMobile();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem('rrd_hide_device_hint') === '1';
    setHidden(dismissed || !isMobile);
  }, [isMobile]);

  if (hidden) return null;

  const isHero = variant === 'hero';

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
      isHero 
        ? 'border-white/30 bg-white/10 text-white backdrop-blur-sm' 
        : 'border-primary/30 bg-primary/5'
    }`}>
      <MonitorSmartphone className={`h-5 w-5 mt-0.5 ${isHero ? 'text-white' : 'text-primary'}`} />
      <div className="text-sm leading-5">
        <span className="font-semibold">Tip:</span> Works great on mobile! For the full experience with lots of documents and forms, try us on a tablet or laptop.
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={`ml-auto ${isHero ? 'text-white hover:bg-white/20' : ''}`}
        onClick={() => { localStorage.setItem('rrd_hide_device_hint', '1'); setHidden(true); }}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

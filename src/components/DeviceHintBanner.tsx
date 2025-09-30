import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { X, MonitorSmartphone } from 'lucide-react';

export default function DeviceHintBanner() {
  const isMobile = useIsMobile();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem('rrd_hide_device_hint') === '1';
    setHidden(dismissed || !isMobile);
  }, [isMobile]);

  if (hidden) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3">
      <MonitorSmartphone className="h-5 w-5 text-primary mt-0.5" />
      <div className="text-sm leading-5">
        <span className="font-semibold">Tip:</span> It works fine on your phone, but for bigger jobs (lots of files or forms) it's easier on a laptop/desktop.
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        onClick={() => { localStorage.setItem('rrd_hide_device_hint', '1'); setHidden(true); }}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

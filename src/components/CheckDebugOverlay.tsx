import { useEffect, useState } from 'react';
import { CHECK_DEBUG_EVENT, getCheckDebugSnapshot, isCheckDebugEnabled, markCheckDebug } from '@/utils/checkDebug';

const MARKERS = [
  'app mounted',
  'auth provider mounted',
  'auth restore started',
  'auth restore finished',
  'current user resolved',
  'protected route allowed',
  'checks page mounted',
  'equipment query started',
  'equipment query finished',
  'equipment list rendered',
  'equipment selected',
  'template query started',
  'template query finished',
  'no checklist state mounted',
  'execution route mounted',
  'execution UI ready',
  'save started',
  'inspection record created',
  'record detail fetched',
  'back target ready',
];

const VALUE_KEYS = [
  'current origin',
  'current route',
  'auth loading state',
  'user id present yes/no',
  'session present yes/no',
  'protected-route decision',
  'equipment query status',
  'template query status',
  'equipment id',
  'frequency requested',
  'template id found',
  'saved checklist id found',
  'active checklist id found',
  'created inspection record id',
  'existing checklist lookup returned empty',
  'branch chosen',
  'any blocking error text',
  'any redirect target',
];

export function CheckDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [snapshot, setSnapshot] = useState(getCheckDebugSnapshot());

  useEffect(() => {
    const active = isCheckDebugEnabled();
    setEnabled(active);
    if (!active) return;

    markCheckDebug('app mounted', {
      'current origin': window.location.origin,
      'current route': window.location.pathname + window.location.search,
    });

    const update = () => setSnapshot({ ...getCheckDebugSnapshot(), markers: { ...getCheckDebugSnapshot().markers }, values: { ...getCheckDebugSnapshot().values } });
    update();
    window.addEventListener(CHECK_DEBUG_EVENT, update);
    return () => window.removeEventListener(CHECK_DEBUG_EVENT, update);
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed right-2 top-2 z-[9999] max-h-[92vh] w-[min(360px,calc(100vw-1rem))] overflow-auto rounded-md border border-border bg-card/95 p-3 text-[11px] shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-bold text-foreground">Checklist Debug</p>
        <p className="text-[10px] text-muted-foreground">canonical only</p>
      </div>
      <div className="space-y-1">
        {MARKERS.map(marker => (
          <div key={marker} className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
            <span className={snapshot.markers[marker] ? 'font-semibold text-success' : 'text-muted-foreground'}>{marker}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{snapshot.markers[marker] || '—'}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 rounded-sm bg-muted/50 p-2">
        {VALUE_KEYS.map(key => (
          <div key={key} className="grid grid-cols-[1fr,1.2fr] gap-2">
            <span className="text-muted-foreground">{key}</span>
            <span className="break-words font-medium text-foreground">{String(snapshot.values[key] ?? '—')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CheckDebugOverlay;

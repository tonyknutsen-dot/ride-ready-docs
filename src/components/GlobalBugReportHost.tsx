import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import BugReportDialog from './BugReportDialog';

/**
 * Listens for `open-bug-report` window events and renders the BugReportDialog
 * as a contextual overlay. Captures the route the user was on when the event
 * fired so the report points at the affected page (not /report-problem).
 */
export const GlobalBugReportHost = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [sourceRoute, setSourceRoute] = useState<string>('/');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setSourceRoute(detail.route || location.pathname);
      setOpen(true);
    };
    window.addEventListener('open-bug-report', handler as EventListener);
    return () => window.removeEventListener('open-bug-report', handler as EventListener);
  }, [location.pathname]);

  if (!open) return null;

  return (
    <BugReportDialog
      open={open}
      onOpenChange={setOpen}
      sourceRoute={sourceRoute}
    />
  );
};

export default GlobalBugReportHost;

/** Helper to open the contextual bug report dialog from anywhere. */
export const openBugReport = (route?: string) => {
  window.dispatchEvent(
    new CustomEvent('open-bug-report', {
      detail: { route: route || window.location.pathname },
    }),
  );
};

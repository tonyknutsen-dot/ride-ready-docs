import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import BugReportDialog from './BugReportDialog';

/**
 * Listens for `open-bug-report` window events and renders BugReportDialog
 * as a contextual overlay. Captures the route the user was on when the
 * event fired so the report points at the affected page (not /report-problem).
 *
 * Stays mounted while the dialog is open (and during transient
 * screenshot-capture close/reopen cycles) to preserve form state.
 */
export const GlobalBugReportHost = () => {
  const location = useLocation();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [sourceRoute, setSourceRoute] = useState<string>('/');
  const sessionActiveRef = useRef(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setSourceRoute(detail.route || location.pathname);
      sessionActiveRef.current = true;
      setMounted(true);
      setOpen(true);
    };
    window.addEventListener('open-bug-report', handler as EventListener);
    return () => window.removeEventListener('open-bug-report', handler as EventListener);
  }, [location.pathname]);

  if (!mounted) return null;

  return (
    <BugReportDialog
      open={open}
      onOpenChange={setOpen}
      sourceRoute={sourceRoute}
      onAfterClose={() => {
        // Fully tear down only after the dialog finishes closing
        sessionActiveRef.current = false;
        setMounted(false);
      }}
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

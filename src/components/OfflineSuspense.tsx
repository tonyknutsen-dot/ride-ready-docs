import { Component, Suspense, type ReactNode } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { OfflineFallback } from '@/components/OfflineFallback';

// Re-use existing page loader
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <FileText className="mx-auto h-12 w-12 text-primary" />
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  </div>
);

interface Props {
  children: ReactNode;
  /** Change this value (e.g. to current pathname) to reset the error boundary on navigation */
  resetKey?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps lazy-loaded routes. If the chunk fails to load (e.g. offline),
 * shows the OfflineFallback instead of a blank page.
 * Resets automatically when `resetKey` changes (i.e. on route navigation).
 */
class LazyErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state when route changes so user can navigate to cached pages
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error) {
    // Only treat chunk-load failures as offline errors
    const msg = error.message?.toLowerCase() ?? '';
    if (
      msg.includes('loading chunk') ||
      msg.includes('dynamically imported module') ||
      msg.includes('failed to fetch') ||
      msg.includes('loading css chunk')
    ) {
      this.setState({ hasError: true });
    } else {
      throw error; // re-throw non-chunk errors
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Suspense fallback={<PageLoader />}>
          <OfflineFallback />
        </Suspense>
      );
    }
    return this.props.children;
  }
}

/**
 * Drop-in replacement for <Suspense> around lazy routes.
 * Catches chunk-load failures and shows an offline message.
 */
export function OfflineSuspense({ children, resetKey }: { children: ReactNode; resetKey?: string }) {
  return (
    <LazyErrorBoundary resetKey={resetKey}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </LazyErrorBoundary>
  );
}

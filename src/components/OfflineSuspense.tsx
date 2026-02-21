import React, { Component, Suspense, type ReactNode } from 'react';
import { Loader2, FileText } from 'lucide-react';

// Re-use existing page loader
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <FileText className="mx-auto h-12 w-12 text-primary" />
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  </div>
);

// Lazy-import the fallback to avoid circular issues
const OfflineFallback = React.lazy(() =>
  import('@/components/OfflineFallback').then(m => ({ default: m.OfflineFallback }))
);

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps lazy-loaded routes. If the chunk fails to load (e.g. offline),
 * shows the OfflineFallback instead of a blank page.
 */
class LazyErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
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
export function OfflineSuspense({ children }: { children: ReactNode }) {
  return (
    <LazyErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </LazyErrorBoundary>
  );
}

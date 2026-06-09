import { Component, lazy, Suspense, memo, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Lazy load components that are only needed when authenticated
const MobileBottomNav = lazy(() => import('./MobileBottomNav'));
const FloatingBugButton = lazy(() => import('./FloatingBugButton'));
const InstallPromptBanner = lazy(() => import('./InstallPromptBanner').then(m => ({ default: m.InstallPromptBanner })));
const TestModeBanner = lazy(() => import('./TestModeBanner'));
const TesterSessionTracker = lazy(() => import('./TesterSessionTracker'));
const GlobalEventBridge = lazy(() => import('./GlobalEventBridge'));
const GlobalBugReportHost = lazy(() => import('./GlobalBugReportHost'));

class ShellChunkBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Authenticated shell chunk failed to load; continuing without optional shell UI.', error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}


/**
 * Shell component that only loads authenticated user components when needed.
 * This improves performance for public pages (/, /auth, /privacy, etc.)
 * by not loading MobileBottomNav, FloatingBugButton, etc. until a user is logged in.
 */
export const AuthenticatedAppShell = memo(function AuthenticatedAppShell() {
  const { user, loading } = useAuth();
  
  // Don't render anything while auth is loading
  // Don't render heavy components for unauthenticated users
  if (loading || !user) {
    return null;
  }

  return (
    <ShellChunkBoundary>
      <Suspense fallback={null}>
        <TestModeBanner />
        <TesterSessionTracker />
        <GlobalEventBridge />
        <MobileBottomNav />
        <FloatingBugButton />
        <InstallPromptBanner />
      </Suspense>
    </ShellChunkBoundary>
  );
});

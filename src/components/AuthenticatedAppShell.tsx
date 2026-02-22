import { lazy, Suspense, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Lazy load components that are only needed when authenticated
const MobileBottomNav = lazy(() => import('./MobileBottomNav'));
const FloatingBugButton = lazy(() => import('./FloatingBugButton'));
const InstallPromptBanner = lazy(() => import('./InstallPromptBanner').then(m => ({ default: m.InstallPromptBanner })));
const TestModeBanner = lazy(() => import('./TestModeBanner'));
const TesterSessionTracker = lazy(() => import('./TesterSessionTracker'));
const GlobalEventBridge = lazy(() => import('./GlobalEventBridge'));


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
    <Suspense fallback={null}>
      <TestModeBanner />
      <TesterSessionTracker />
      <GlobalEventBridge />
      <MobileBottomNav />
      <FloatingBugButton />
      <InstallPromptBanner />
    </Suspense>
  );
});

import { useTesterSessionTracking } from '@/hooks/useTesterSessionTracking';

/**
 * Component that tracks tester session time for billing purposes.
 * Must be mounted inside TesterProvider and AuthProvider.
 * Does not render any UI - just activates the tracking hook.
 */
const TesterSessionTracker = () => {
  useTesterSessionTracking();
  return null;
};

export default TesterSessionTracker;

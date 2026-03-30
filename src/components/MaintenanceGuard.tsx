import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { useAdmin } from '@/contexts/AdminContext';
import { MaintenanceScreen } from '@/components/MaintenanceScreen';

/** Routes that must remain accessible even during maintenance */
const EXEMPT_PREFIXES = [
  '/admin',
  '/auth',
  '/setup-admin',
  '/diagnostics',
  '/privacy',
  '/terms',
  '/cookies',
  '/dpa',
  '/data-independence',
  '/security',
  '/shared/',
];

interface MaintenanceGuardProps {
  children: ReactNode;
}

/**
 * Wraps the app route tree. When maintenance_mode is on:
 * - admin users pass through
 * - exempt routes (auth, admin, legal) pass through
 * - all other routes see the MaintenanceScreen
 */
export const MaintenanceGuard = ({ children }: MaintenanceGuardProps) => {
  const { isOn, getSetting, isLoading } = usePlatformSettings();
  const { isAdmin } = useAdmin();
  const { pathname } = useLocation();

  // Don't block while settings are loading
  if (isLoading) return <>{children}</>;

  // Not in maintenance → pass through
  if (!isOn('maintenance_mode')) return <>{children}</>;

  // Admins always pass through
  if (isAdmin) return <>{children}</>;

  // Exempt routes pass through
  const isExempt = EXEMPT_PREFIXES.some(p => pathname.startsWith(p));
  if (isExempt) return <>{children}</>;

  // Show maintenance screen
  const message = getSetting('maintenance_message');
  return <MaintenanceScreen message={message || undefined} />;
};

export default MaintenanceGuard;

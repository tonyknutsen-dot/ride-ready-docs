import React, { useEffect } from 'react';

interface StartupUpdateCheckProps {
  children: React.ReactNode;
}

/**
 * Non-blocking update check component.
 * Checks for service worker updates in the background without blocking the initial render.
 * This improves First Contentful Paint (FCP) significantly.
 */
export const StartupUpdateCheck: React.FC<StartupUpdateCheckProps> = ({ children }) => {
  useEffect(() => {
    // Check for service worker updates in the background (non-blocking)
    const checkForUpdates = async () => {
      try {
        if ('serviceWorker' in navigator && navigator.onLine) {
          const registration = await navigator.serviceWorker.getRegistration();
          
          if (registration) {
            // Trigger an update check in the background
            await registration.update();
          }
        }
      } catch (err) {
        // Silent fail - update check is non-critical
        console.log('[Startup] Background update check skipped:', err);
      }
    };

    // Run update check after a short delay to not interfere with initial render
    const timeoutId = setTimeout(checkForUpdates, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  // Render children immediately - no blocking
  return <>{children}</>;
};

export default StartupUpdateCheck;

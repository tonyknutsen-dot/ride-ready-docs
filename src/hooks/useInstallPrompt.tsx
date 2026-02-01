import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPromptState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<boolean>;
  dismissedAt: string | null;
  dismiss: () => void;
  shouldShowReminder: boolean;
}

const DISMISS_KEY = 'install-prompt-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const INSTALLED_FLAG_KEY = 'pwa-was-installed';

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  // Detect platform
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(userAgent);
  
  // Check if running as standalone PWA - be more strict to avoid false positives
  // Only consider it standalone if we're NOT in an iframe AND the media query matches
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const mediaQueryStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone = typeof window !== 'undefined' && (window.navigator as any).standalone === true;
  
  // Only truly standalone if not in iframe and detected as standalone
  const isStandalone = !isInIframe && (mediaQueryStandalone || navigatorStandalone);

  // Check localStorage for dismissed state and previous installation
  useEffect(() => {
    // Check if dismissed
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) {
      const dismissTime = new Date(stored).getTime();
      const now = Date.now();
      if (now - dismissTime < DISMISS_DURATION_MS) {
        setDismissedAt(stored);
      } else {
        // Clear expired dismissal
        localStorage.removeItem(DISMISS_KEY);
        setDismissedAt(null);
      }
    }

    // Check if we've previously detected the app was installed
    // This helps when user opens a link in browser but has the PWA installed
    const wasInstalled = localStorage.getItem(INSTALLED_FLAG_KEY);
    if (wasInstalled === 'true') {
      setIsInstalled(true);
    }
  }, []);

  // When running in standalone mode, remember that the app was installed
  // This flag persists so even if user opens a link in browser, we know they have the PWA
  useEffect(() => {
    if (isStandalone) {
      localStorage.setItem(INSTALLED_FLAG_KEY, 'true');
      setIsInstalled(true);
    }
  }, [isStandalone]);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    const installedHandler = () => {
      localStorage.setItem(INSTALLED_FLAG_KEY, 'true');
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Install prompt error:', error);
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    const now = new Date().toISOString();
    localStorage.setItem(DISMISS_KEY, now);
    setDismissedAt(now);
  }, []);

  // Determine if we should show the reminder
  const shouldShowReminder = 
    !isInstalled && 
    !isStandalone && 
    !dismissedAt &&
    (!!deferredPrompt || isIOS); // iOS doesn't fire beforeinstallprompt

  return {
    isInstallable: !!deferredPrompt || isIOS,
    isInstalled,
    isIOS,
    isAndroid,
    isStandalone,
    promptInstall,
    dismissedAt,
    dismiss,
    shouldShowReminder,
  };
}

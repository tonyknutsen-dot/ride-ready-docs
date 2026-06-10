import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

/**
 * Detects when a new app build has been deployed by comparing the main entry
 * script hash in the freshly-fetched index.html against the one currently loaded.
 *
 * Works without a service worker. Shows a single "Update available" toast with
 * an Update action that hard-reloads the page. Especially important for
 * installed PWAs where the browser/OS may serve a cached index.html.
 */
const POLL_MS = 60_000;
const INDEX_URL = '/index.html';

const extractEntryHash = (html: string): string | null => {
  // Look for the production entry: <script type="module" crossorigin src="/assets/index-XXXX.js">
  // Also tolerate other asset names by capturing all /assets/*.js module scripts.
  const matches = Array.from(html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)).map((m) => m[1]);
  if (matches.length === 0) return null;
  // Deterministic signature regardless of attribute order
  return matches.sort().join('|');
};

const fetchCurrentSignature = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${INDEX_URL}?_=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractEntryHash(html);
  } catch {
    return null;
  }
};

const getLoadedSignature = (): string | null => {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="/assets/"]'))
    .map((s) => {
      try {
        return new URL(s.src, window.location.origin).pathname;
      } catch {
        return s.src;
      }
    })
    .filter((s) => s.endsWith('.js'));
  if (scripts.length === 0) return null;
  return scripts.sort().join('|');
};

export default function AppUpdateChecker() {
  const baselineRef = useRef<string | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    // Only run in production builds where /assets/*.js exists.
    if (!import.meta.env.PROD) return;

    baselineRef.current = getLoadedSignature();
    // If we can't determine baseline, fetch and treat first fetch as baseline.
    let cancelled = false;

    const check = async () => {
      if (notifiedRef.current || cancelled) return;
      const current = await fetchCurrentSignature();
      if (!current) return;
      if (!baselineRef.current) {
        baselineRef.current = current;
        return;
      }
      if (current !== baselineRef.current) {
        notifiedRef.current = true;
        toast({
          title: 'Update available',
          description: 'A new version of Ride Ready Docs is ready.',
          duration: 1000 * 60 * 10,
          action: (
            <ToastAction
              altText="Update now"
              onClick={() => {
                const reload = () => window.location.reload();
                const cachesApi = (window as unknown as { caches?: CacheStorage }).caches;
                if (cachesApi) {
                  cachesApi.keys()
                    .then((keys) => Promise.all(keys.map((k) => cachesApi.delete(k))))
                    .finally(reload);
                } else {
                  reload();
                }
              }}
            >
              Update
            </ToastAction>
          ),
        });
      }
    };

    // Initial check shortly after mount
    const initial = window.setTimeout(check, 5_000);
    const interval = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  return null;
}

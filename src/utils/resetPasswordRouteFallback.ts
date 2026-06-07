type ResetPasswordFallbackState = 'booting' | 'checking' | 'form' | 'expired' | 'success' | 'diagnostic';

declare global {
  interface Window {
    __resetPasswordRouteFallback?: {
      markHealthy: (state: ResetPasswordFallbackState) => void;
      showDiagnostic: (title: string, message: string, detail?: string) => void;
    };
  }
}

const RESET_PASSWORD_PATH = '/auth/reset-password';
const FALLBACK_ID = 'reset-password-route-fallback';
const STYLE_ID = 'reset-password-route-fallback-style';

const isResetPasswordRoute = () => window.location.pathname === RESET_PASSWORD_PATH;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const safeUrlSummary = () => {
  const hashSummary = window.location.hash ? 'hash present' : 'no hash';
  return `${window.location.pathname}${window.location.search} (${hashSummary})`;
};

const describeUnknown = (value: unknown) => {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return 'Unknown browser error';
  }
};

const ensureStyle = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${FALLBACK_ID}[hidden] { display: none !important; }
    #${FALLBACK_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      background: hsl(var(--background, 210 40% 98%));
      color: hsl(var(--foreground, 222 84% 5%));
      font-family: var(--font-sans, Inter, system-ui, sans-serif);
      box-sizing: border-box;
    }
    #${FALLBACK_ID} * { box-sizing: border-box; }
    #${FALLBACK_ID} .rrd-reset-card {
      width: min(100%, 448px);
      border: 1px solid hsl(var(--border, 214 32% 91%));
      border-radius: 16px;
      background: hsl(var(--card, 0 0% 100%));
      box-shadow: var(--shadow-card, 0 4px 12px rgba(0, 0, 0, 0.06));
      padding: 24px;
    }
    #${FALLBACK_ID} .rrd-reset-logo {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      margin: 0 auto 16px;
      display: grid;
      place-items: center;
      background: hsl(var(--primary, 213 52% 24%));
      color: hsl(var(--primary-foreground, 0 0% 100%));
      font-weight: 700;
    }
    #${FALLBACK_ID} h1 {
      margin: 0 0 8px;
      text-align: center;
      font-size: 22px;
      line-height: 1.2;
      font-weight: 700;
    }
    #${FALLBACK_ID} p {
      margin: 0;
      color: hsl(var(--muted-foreground, 215 28% 27%));
      font-size: 14px;
      line-height: 1.5;
      text-align: center;
      overflow-wrap: anywhere;
    }
    #${FALLBACK_ID} .rrd-reset-actions {
      display: grid;
      gap: 10px;
      margin-top: 20px;
    }
    #${FALLBACK_ID} a {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      padding: 10px 16px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
    }
    #${FALLBACK_ID} .rrd-reset-primary {
      background: hsl(var(--primary, 213 52% 24%));
      color: hsl(var(--primary-foreground, 0 0% 100%));
    }
    #${FALLBACK_ID} .rrd-reset-secondary {
      border: 1px solid hsl(var(--primary, 213 52% 24%));
      color: hsl(var(--primary, 213 52% 24%));
      background: hsl(var(--card, 0 0% 100%));
    }
    #${FALLBACK_ID} details {
      margin-top: 16px;
      border-top: 1px solid hsl(var(--border, 214 32% 91%));
      padding-top: 12px;
      color: hsl(var(--muted-foreground, 215 28% 27%));
      font-size: 12px;
    }
    #${FALLBACK_ID} summary { cursor: pointer; font-weight: 700; }
    #${FALLBACK_ID} pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      margin: 8px 0 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
  `;
  document.head.appendChild(style);
};

const ensureFallback = () => {
  ensureStyle();
  let fallback = document.getElementById(FALLBACK_ID);
  if (!fallback) {
    fallback = document.createElement('div');
    fallback.id = FALLBACK_ID;
    fallback.setAttribute('role', 'alert');
    fallback.setAttribute('aria-live', 'assertive');
    document.body.appendChild(fallback);
  }
  return fallback;
};

const renderFallback = (title: string, message: string, detail?: string) => {
  const fallback = ensureFallback();
  const diagnostic = [
    `Time: ${new Date().toISOString()}`,
    `Route: ${safeUrlSummary()}`,
    detail ? `Detail: ${detail}` : '',
  ].filter(Boolean).join('\n');

  fallback.innerHTML = `
    <section class="rrd-reset-card" aria-label="Password reset status">
      <div class="rrd-reset-logo" aria-hidden="true">RRD</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <div class="rrd-reset-actions">
        <a class="rrd-reset-primary" href="/auth?reset=true">Request a new reset link</a>
        <a class="rrd-reset-secondary" href="/auth">Back to sign in</a>
      </div>
      <details>
        <summary>Diagnostic details</summary>
        <pre>${escapeHtml(diagnostic)}</pre>
      </details>
    </section>
  `;
  fallback.hidden = false;
};

const hideFallback = () => {
  const fallback = document.getElementById(FALLBACK_ID);
  if (fallback) fallback.hidden = true;
};

const rootHasVisibleContent = () => {
  const root = document.getElementById('root');
  if (!root) return false;
  const text = root.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const rect = root.getBoundingClientRect();
  return root.childElementCount > 0 && rect.width > 0 && rect.height > 0 && text.length > 8;
};

export const installResetPasswordRouteFallback = () => {
  if (!isResetPasswordRoute()) return;

  renderFallback(
    'Opening password reset',
    'The password reset page is starting. If it cannot continue, this diagnostic screen will stay visible.',
    'Route boot fallback is active.',
  );

  const showDiagnostic = (title: string, message: string, detail?: string) => {
    if (!isResetPasswordRoute()) return;
    renderFallback(title, message, detail);
  };

  window.__resetPasswordRouteFallback = {
    markHealthy: () => hideFallback(),
    showDiagnostic,
  };

  window.addEventListener('error', (event) => {
    if (!(event instanceof ErrorEvent)) return;
    showDiagnostic(
      'Password reset problem',
      'A browser error stopped the reset page from rendering. Please request a fresh reset link.',
      describeUnknown(event.error ?? event.message),
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    showDiagnostic(
      'Password reset problem',
      'The reset page hit an unexpected authentication error. Please request a fresh reset link.',
      describeUnknown(event.reason),
    );
  });

  window.setInterval(() => {
    if (!isResetPasswordRoute()) {
      hideFallback();
      return;
    }
    if (!rootHasVisibleContent()) {
      showDiagnostic(
        'Password reset diagnostics',
        'The app shell stopped rendering the reset page, so this fallback is shown instead of a blank screen.',
        'Root element is missing, empty, or has no visible content.',
      );
    }
  }, 750);
};

export const markResetPasswordRouteHealthy = (state: ResetPasswordFallbackState) => {
  if (!isResetPasswordRoute()) return;
  window.__resetPasswordRouteFallback?.markHealthy(state);
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installResetPasswordRouteFallback();
}


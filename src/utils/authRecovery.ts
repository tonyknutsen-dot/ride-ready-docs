export const RESET_LINK_EXPIRED_MESSAGE =
  'This reset link has expired or has already been used. Please request a new reset link.';

type ParamSource = 'query' | 'hash';

const RECOVERY_PARAM_NAMES = [
  'type',
  'code',
  'token_hash',
  'token',
  'access_token',
  'refresh_token',
  'error',
  'error_code',
  'error_description',
];

export interface AuthRecoveryParams {
  type: string | null;
  code: string | null;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  sources: ParamSource[];
  isRecovery: boolean;
  hasError: boolean;
  hasHashTokens: boolean;
  isRecoveryError: boolean;
}

const parseHashParams = (hash: string) => {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(normalizedHash);
};

const firstParam = (query: URLSearchParams, hash: URLSearchParams, name: string) => {
  return query.get(name) ?? hash.get(name);
};

const hasAnyParam = (params: URLSearchParams, names: string[]) => {
  return names.some((name) => params.has(name));
};

export const parseAuthRecoveryParams = (href = window.location.href): AuthRecoveryParams => {
  const url = new URL(href);
  const query = url.searchParams;
  const hash = parseHashParams(url.hash);
  const sources: ParamSource[] = [];

  if (hasAnyParam(query, RECOVERY_PARAM_NAMES)) sources.push('query');
  if (hasAnyParam(hash, RECOVERY_PARAM_NAMES)) sources.push('hash');

  const type = firstParam(query, hash, 'type')?.toLowerCase() ?? null;
  const code = firstParam(query, hash, 'code');
  const tokenHash = firstParam(query, hash, 'token_hash') ?? firstParam(query, hash, 'token');
  const accessToken = firstParam(query, hash, 'access_token');
  const refreshToken = firstParam(query, hash, 'refresh_token');
  const error = firstParam(query, hash, 'error');
  const errorCode = firstParam(query, hash, 'error_code');
  const errorDescription = firstParam(query, hash, 'error_description');
  const hasHashTokens = !!(hash.get('access_token') && hash.get('refresh_token'));
  const hasError = !!(error || errorCode || errorDescription);
  const errorText = `${error ?? ''} ${errorCode ?? ''} ${errorDescription ?? ''}`.toLowerCase();
  const isRecoveryError =
    hasError &&
    (type === 'recovery' ||
      errorText.includes('access_denied') ||
      errorText.includes('otp_expired') ||
      errorText.includes('invalid') ||
      errorText.includes('expired'));

  return {
    type,
    code,
    tokenHash,
    accessToken,
    refreshToken,
    error,
    errorCode,
    errorDescription,
    sources,
    isRecovery: type === 'recovery',
    hasError,
    hasHashTokens,
    isRecoveryError,
  };
};

export const logRecoveryDiagnostic = (message: string, details?: Record<string, unknown>) => {
  console.info(`[RESET-RECOVERY] ${message}`, details ?? {});
};
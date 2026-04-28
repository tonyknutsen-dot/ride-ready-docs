export const CANONICAL_APP_ORIGIN = 'https://ridereadydocs.co.uk';

const ALTERNATE_PRODUCTION_HOSTS = new Set([
  'ride-ready-docs.lovable.app',
  'ridereadydocs.com',
  'www.ridereadydocs.com',
  'www.ridereadydocs.co.uk',
]);

export function redirectToCanonicalOriginIfNeeded(): boolean {
  if (typeof window === 'undefined') return false;

  const { origin, hostname, pathname, search, hash } = window.location;
  if (origin === CANONICAL_APP_ORIGIN) return false;

  if (ALTERNATE_PRODUCTION_HOSTS.has(hostname)) {
    window.location.replace(`${CANONICAL_APP_ORIGIN}${pathname}${search}${hash}`);
    return true;
  }

  return false;
}
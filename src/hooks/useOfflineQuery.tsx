import { useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setCache, getCache } from '@/lib/offlineCache';

/**
 * Wraps useQuery with automatic IndexedDB offline caching.
 *
 * - On successful fetch: writes result to IndexedDB.
 * - Provides `placeholderData` from IndexedDB so lists render instantly when offline.
 * - Exposes `cachedAt` timestamp for UI display.
 */
export function useOfflineQuery<TData>(
  options: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'placeholderData'> & {
    /** The cache key used in IndexedDB (e.g. "rides:userId") */
    offlineCacheKey: string;
  },
) {
  const { offlineCacheKey, ...queryOptions } = options;

  // Load cached data via a separate query
  const cacheQuery = useQuery({
    queryKey: ['__offline_cache__', offlineCacheKey],
    queryFn: () => getCache<TData>(offlineCacheKey),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const cached = cacheQuery.data;

  const query = useQuery<TData, Error, TData, QueryKey>({
    ...queryOptions,
    placeholderData: (prev: TData | undefined) => prev ?? cached?.data ?? undefined,
  } as UseQueryOptions<TData, Error, TData, QueryKey>);

  // Write to IndexedDB whenever we get fresh data
  useEffect(() => {
    if (query.data && query.isFetched && !query.isPlaceholderData) {
      setCache(offlineCacheKey, query.data).catch(console.error);
    }
  }, [query.data, query.isFetched, query.isPlaceholderData, offlineCacheKey]);

  return {
    ...query,
    /** Timestamp of the last successful cache write */
    cachedAt: query.isPlaceholderData ? (cached?.updatedAt ?? null) : null,
    /** Whether we're showing cached offline data */
    isOfflineData: query.isPlaceholderData && !!cached?.data,
  };
}

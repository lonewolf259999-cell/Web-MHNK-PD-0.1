'use client';

/* Data-fetching hook with a small shared cache.
   Fetchers come from lib/client/queries.ts, so results stay typed
   end-to-end from the Elysia server. */

import { useCallback, useEffect, useRef, useState } from 'react';

const CACHE_TTL = 60_000;

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function clearApiCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `fetcher` on mount, caching by `cacheKey`.
 *
 * The fetcher is held in a ref so callers can pass an inline arrow without
 * retriggering on every render; `cacheKey` is the real dependency.
 */
export function useApi<T>(fetcher: () => Promise<T>, cacheKey: string): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let active = true;

    const hit = cache.get(cacheKey);
    if (nonce === 0 && hit && Date.now() - hit.timestamp < CACHE_TTL) {
      setData(hit.data as T);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (!active) return;
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        setData(result);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cacheKey, nonce]);

  const reload = useCallback(() => {
    cache.delete(cacheKey);
    setNonce((n) => n + 1);
  }, [cacheKey]);

  return { data, error, loading, reload };
}

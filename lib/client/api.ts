'use client';

/* Client-side API access with a small shared cache,
   replacing the v2 ApiService singleton. */

import { useCallback, useEffect, useState } from 'react';

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

export async function apiGet<T>(url: string, cacheKey?: string): Promise<T> {
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.timestamp < CACHE_TTL) return hit.data as T;
  }

  const res = await fetch(url);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* response had no JSON body */
    }
    throw new Error(message);
  }

  const data = (await res.json()) as T;
  if (cacheKey) cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function apiSend<T>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`);
  return payload as T;
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Fetches once on mount and exposes a manual reload that bypasses the cache. */
export function useApi<T>(url: string, cacheKey?: string): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    apiGet<T>(url, nonce === 0 ? cacheKey : undefined)
      .then((result) => {
        if (!active) return;
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
  }, [url, cacheKey, nonce]);

  const reload = useCallback(() => {
    if (cacheKey) clearApiCache(cacheKey);
    setNonce((n) => n + 1);
  }, [cacheKey]);

  return { data, error, loading, reload };
}

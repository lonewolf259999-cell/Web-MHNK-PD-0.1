/* In-memory cache, scoped to one serverless instance.
   The v2 file cache is gone: serverless containers have no shared writable
   disk, so it never survived a cold start anyway. */

import { config } from './config';

interface Entry {
  data: unknown;
  timestamp: number;
}

const store = new Map<string, Entry>();
const MAX_KEYS = 100;

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (entry && Date.now() - entry.timestamp < config.CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

export function setCached(key: string, data: unknown): void {
  if (store.size > MAX_KEYS) store.clear();
  store.set(key, { data, timestamp: Date.now() });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function clearAll(): void {
  store.clear();
}

/** Fetch through the cache: returns the cached value or computes and stores it. */
export async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return hit;
  const value = await compute();
  setCached(key, value);
  return value;
}

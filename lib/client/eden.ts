'use client';

import { treaty } from '@elysiajs/eden';
import type { Api } from '@/server/app';

/**
 * Typed API client generated from the Elysia server type.
 *
 * Route paths, params and response shapes are inferred from `server/app.ts`,
 * so renaming or changing a route surfaces as a type error here rather than a
 * runtime 404. Only the type crosses the boundary — no server code is bundled.
 */
function baseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.APP_URL || 'http://localhost:3000';
}

export const client = treaty<Api>(baseUrl());

/** Eden returns { data, error }; this collapses it to a value-or-throw. */
export async function unwrap<T>(
  promise: Promise<{ data: T | null; error: { value: unknown } | null }>
): Promise<T> {
  const { data, error } = await promise;

  if (error) {
    const value = error.value;
    const message =
      typeof value === 'object' && value !== null && 'error' in value
        ? String((value as { error: unknown }).error)
        : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
    throw new Error(message);
  }

  return data as T;
}

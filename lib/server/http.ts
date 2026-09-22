/* Route-handler helpers — keeps the v2 wire format:
   reads return the raw payload, writes return {success, message, data},
   failures return {error} with a status code. */

import { NextResponse } from 'next/server';
import { config } from './config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function ok<T>(data: T): NextResponse {
  return NextResponse.json(data);
}

export function okWrite(message: string, data: unknown = null): NextResponse {
  return NextResponse.json({ success: true, message, data });
}

export function fail(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a handler so thrown errors become the standard {error} response. */
export function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  return fn().catch((err: unknown) => {
    if (err instanceof ApiError) return fail(err.message, err.status);
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[api]', message);
    return fail(message, 500);
  });
}

/** Admin PIN check. Rejects everything when no PIN is configured. */
export function requirePin(body: { pin?: unknown }): void {
  let expected: string;
  try {
    expected = config.ADMIN_PIN;
  } catch {
    throw new ApiError('ระบบยังไม่ได้ตั้งค่ารหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ', 500);
  }

  if (body.pin !== expected) {
    throw new ApiError('รหัส PIN ไม่ถูกต้อง', 401);
  }
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError('Invalid JSON body', 400);
  }
}

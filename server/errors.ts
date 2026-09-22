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

/** Admin PIN check. Rejects everything when no PIN is configured. */
export function requirePin(body: unknown): void {
  const pin = (body as { pin?: unknown } | null)?.pin;

  let expected: string;
  try {
    expected = config.ADMIN_PIN;
  } catch {
    throw new ApiError('ระบบยังไม่ได้ตั้งค่ารหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ', 500);
  }

  if (pin !== expected) {
    throw new ApiError('รหัส PIN ไม่ถูกต้อง', 401);
  }
}

/* Idempotency records for payment writes.

   Instance-local, same as the v2 implementation. Entries expire lazily on
   read rather than via setTimeout, which is unreliable once a serverless
   container is frozen between invocations. */

const TTL = 10 * 60 * 1000;

export interface PaymentRecord {
  status?: 'processing';
  success?: boolean;
  message?: string;
  timestamp: number;
}

const store = new Map<string, PaymentRecord>();

export function getPayment(key: string): PaymentRecord | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > TTL) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function markProcessing(key: string): void {
  store.set(key, { status: 'processing', timestamp: Date.now() });
}

export function setPaymentResult(key: string, success: boolean, message: string): void {
  store.set(key, { success, message, timestamp: Date.now() });
}

export function clearPayment(key: string): void {
  store.delete(key);
}

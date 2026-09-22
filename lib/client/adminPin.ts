'use client';

/* Admin PIN kept in localStorage for 30 minutes so a batch of actions
   doesn't prompt on every request. */

const STORAGE_KEY = 'mhnk_payment_pin';
const TTL_MS = 30 * 60 * 1000;

interface Stored {
  pin: string;
  timestamp: number;
}

export function readPin(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const { pin, timestamp } = JSON.parse(raw) as Stored;
    if (Date.now() - timestamp < TTL_MS) return pin;

    localStorage.removeItem(STORAGE_KEY);
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
  return null;
}

export function savePin(pin: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pin, timestamp: Date.now() }));
  } catch {
    /* storage unavailable — the PIN is simply asked for again */
  }
}

export function clearPin(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function isAdminMode(): boolean {
  return readPin() !== null;
}

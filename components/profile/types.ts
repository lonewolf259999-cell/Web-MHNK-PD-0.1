export type WeekState = 'loading' | 'paid' | 'owed' | 'unpaid-zero' | 'error';

export interface WeekStatus {
  state: WeekState;
  amount: number;
}

const PAID_VALUES = ['yes', 'จ่ายแล้ว', 'true', '1'];

export function isPaidValue(paid: string | undefined): boolean {
  return PAID_VALUES.includes(String(paid || '').toLowerCase());
}

export function toWeekStatus(paid: string | undefined, amount: number): WeekStatus {
  if (isPaidValue(paid)) return { state: 'paid', amount };
  return { state: amount > 0 ? 'owed' : 'unpaid-zero', amount };
}

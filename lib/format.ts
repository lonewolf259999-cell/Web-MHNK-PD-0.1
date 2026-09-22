/* Presentation helpers — ported from legacy/src/utils/html.js */

import type { WeekData, WeekOfficerData } from './types';

/** Case counts arrive as "12", "1.5M", "0M" … */
export function parseCases(value: string | number | null | undefined): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;

  const str = String(value).trim();
  if (str.toUpperCase().endsWith('M')) return parseFloat(str) * 1_000_000;
  return parseInt(str, 10) || 0;
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (typeof amount === 'string') return amount;
  if (amount === undefined || amount === null) return '0';
  return Number(amount).toLocaleString('th-TH');
}

export function getInitials(name: string, code?: string): string {
  if (code && code.trim() !== '') return code.trim();
  if (!name) return '?';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0);
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export type RankLevel = 'high' | 'medium' | 'low';

const HIGH_RANKS = ['ผู้บัญชาการ', 'รองผู้บัญชาการ', 'พล.ต.อ.', 'พล.ต.ท.', 'พล.ต.ต.'];
const LOW_RANKS = ['ส.ต.ต.', 'ส.ต.ท.', 'ส.ต.อ.', 'ด.ต.', 'น.ร.', 'น.ต.'];

export function getRankLevel(rank: string | undefined): RankLevel {
  const text = rank || '';
  if (HIGH_RANKS.some((r) => text.includes(r))) return 'high';
  if (LOW_RANKS.some((r) => text.includes(r))) return 'low';
  return 'medium';
}

export function groupByCategory<T>(
  items: T[],
  field: keyof T,
  fallback = 'อื่นๆ'
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const key = String(item[field] ?? '') || fallback;
    (grouped[key] ??= []).push(item);
  }
  return grouped;
}

export function normalizeName(text: string | undefined): string {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function isOfficerMatch(key: string, officerName: string): boolean {
  const a = normalizeName(key);
  const b = normalizeName(officerName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function findOfficerWeekData(
  weekData: WeekData | null | undefined,
  officerName: string
): WeekOfficerData | null {
  if (!weekData) return null;
  for (const key of Object.keys(weekData)) {
    if (isOfficerMatch(key, officerName)) return weekData[key];
  }
  return null;
}

export function filterByQuery<T>(items: T[], query: string, fields: (keyof T)[]): T[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase().trim();

  return items.filter((item) =>
    fields.some((field) => {
      const value = item[field];
      return value !== undefined && value !== null && String(value).toLowerCase().includes(q);
    })
  );
}

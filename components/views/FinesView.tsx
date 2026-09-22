'use client';

import { filterByQuery, formatCurrency, groupByCategory } from '@/lib/format';
import { EmptyState, ErrorState, Loading, SectionHeader } from '@/components/ui/States';
import type { FineItem } from '@/lib/types';

function formatTime(minutes: string): string {
  if (!minutes || minutes === '0') return '-';
  return `${minutes} นาที`;
}

export function FinesView({
  items,
  loading,
  error,
  query,
  onRetry,
}: {
  items: FineItem[] | null;
  loading: boolean;
  error: string | null;
  query: string;
  onRetry: () => void;
}) {
  const groups = items ? groupByCategory(items, 'category') : {};

  const visible = Object.entries(groups)
    .map(
      ([category, entries]) =>
        [category, filterByQuery(entries, query, ['text', 'category'])] as const
    )
    .filter(([, entries]) => entries.length > 0);

  return (
    <section>
      <SectionHeader icon="💰" title="อัตราค่าปรับ" />

      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState icon="📭" title="ไม่พบค่าปรับที่ค้นหา" message="ลองค้นหาด้วยคำอื่น" />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map(([category, entries]) => (
            <div key={category} className="panel overflow-hidden">
              <h3 className="border-b border-accent/12 bg-accent/5 px-4 py-2.5 text-sm font-bold text-accent">
                {category}
              </h3>

              <div className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm transition hover:bg-white/[0.03] sm:grid-cols-[1fr_7rem_6rem]"
                  >
                    <span className="min-w-0 text-ink/90">{entry.text}</span>
                    <span className="text-right font-bold text-gold tabular-nums">
                      ฿{formatCurrency(entry.amount)}
                    </span>
                    <span className="col-span-2 text-right text-xs text-ink-dim sm:col-span-1">
                      {formatTime(entry.time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

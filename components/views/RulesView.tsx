'use client';

import { filterByQuery, groupByCategory } from '@/lib/format';
import { sanitizeRichText } from '@/lib/sanitize';
import { EmptyState, ErrorState, Loading, SectionHeader } from '@/components/ui/States';
import type { ConductItem, RuleItem } from '@/lib/types';

interface Props {
  items: RuleItem[] | ConductItem[] | null;
  loading: boolean;
  error: string | null;
  query: string;
  onRetry: () => void;
  /** 'category' for rules/fines, 'title' for conduct */
  groupField: 'category' | 'title';
  icon: string;
  title: string;
  emptyTitle: string;
}

export function RulesView({
  items,
  loading,
  error,
  query,
  onRetry,
  groupField,
  icon,
  title,
  emptyTitle,
}: Props) {
  type Entry = RuleItem & ConductItem;

  const groups = items ? groupByCategory(items as Entry[], groupField) : {};

  const visible = Object.entries(groups)
    .map(
      ([category, entries]) =>
        [category, filterByQuery(entries, query, ['text', groupField])] as const
    )
    .filter(([, entries]) => entries.length > 0);

  return (
    <section>
      <SectionHeader icon={icon} title={title} />

      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState icon="📭" title={emptyTitle} message="ลองค้นหาด้วยคำอื่น" />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map(([category, entries]) => (
            <div key={category} className="panel p-4">
              <h3 className="mb-3 border-b border-accent/12 pb-2 text-sm font-bold text-accent">
                {category}
              </h3>

              <ol className="space-y-2">
                {entries.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="flex gap-2.5 rounded-sm px-2 py-1.5 text-sm leading-relaxed transition hover:bg-white/[0.03]"
                  >
                    <span className="shrink-0 font-semibold text-ink-dim tabular-nums">
                      {index + 1}.
                    </span>
                    <span
                      className="min-w-0 text-ink/90"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichText(entry.text).replace(/\n/g, '<br>'),
                      }}
                    />
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

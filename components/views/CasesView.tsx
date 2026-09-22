'use client';

import { filterByQuery } from '@/lib/format';
import { sanitizeRichText } from '@/lib/sanitize';
import { EmptyState, ErrorState, Loading, SectionHeader } from '@/components/ui/States';
import type { CaseItem } from '@/lib/types';

/** Google Drive share links become preview embeds; anything else stays a plain link. */
function driveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) return url.trim();
  return null;
}

function CaseVideo({ url }: { url: string }) {
  const fileId = driveFileId(url);

  if (!fileId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-sm border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
      >
        🎬 ดูคลิป
      </a>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-md border border-accent/12">
      <iframe
        src={`https://drive.google.com/file/d/${fileId}/preview`}
        className="h-full w-full"
        allow="autoplay"
        allowFullScreen
        loading="lazy"
        title="คลิปคดี"
      />
    </div>
  );
}

export function CasesView({
  items,
  loading,
  error,
  query,
  onRetry,
}: {
  items: CaseItem[] | null;
  loading: boolean;
  error: string | null;
  query: string;
  onRetry: () => void;
}) {
  const visible = items ? filterByQuery(items, query, ['title', 'description']) : [];

  return (
    <section>
      <SectionHeader icon="⚖" title="การทำคดี" />

      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} onRetry={onRetry} />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState icon="📭" title="ไม่พบข้อมูลคดี" message="ลองค้นหาด้วยคำอื่น" />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map((item) => (
            <article key={item.id} className="panel space-y-3 p-4">
              <h3 className="border-b border-accent/12 pb-2 text-base font-bold text-accent">
                {item.title}
              </h3>

              {item.description && (
                <div
                  className="text-sm leading-relaxed text-ink/90"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.description) }}
                />
              )}

              {item.video_url && <CaseVideo url={item.video_url} />}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

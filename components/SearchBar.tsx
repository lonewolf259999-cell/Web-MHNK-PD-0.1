'use client';

export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-sm" aria-hidden>
          🔍
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ค้นหา..."
          autoComplete="off"
          aria-label="ค้นหาเจ้าหน้าที่"
          className="w-full rounded-sm border border-accent/12 bg-panel/60 py-2.5 pr-9 pl-9 text-sm text-ink outline-none transition placeholder:text-ink-dim/60 focus:border-accent/40"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="ล้างการค้นหา"
            className="absolute right-2 cursor-pointer rounded px-2 py-1 text-ink-dim transition hover:text-danger"
          >
            ×
          </button>
        )}
      </div>

      <div className="mt-1.5 text-[0.7rem] text-ink-dim">
        พบ <strong className="text-accent">{resultCount}</strong> นาย · ทั้งหมด{' '}
        <strong className="text-accent">{totalCount}</strong>
      </div>
    </div>
  );
}

'use client';

export const PAGES = [
  { id: 'roster', icon: '⚖', label: 'รายชื่อ' },
  { id: 'cases', icon: '⚖', label: 'การทำคดี' },
  { id: 'conduct', icon: '📚', label: 'ข้อปฏิบัติ' },
  { id: 'rules', icon: '📖', label: 'กฎตำรวจ' },
  { id: 'fines', icon: '💰', label: 'ค่าปรับ' },
  { id: 'schedule', icon: '📅', label: 'ตารางเวร' },
] as const;

export type PageId = (typeof PAGES)[number]['id'];

export function NavTabs({
  active,
  onChange,
}: {
  active: PageId;
  onChange: (page: PageId) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="หน้าหลัก">
      {PAGES.map((page) => {
        const isActive = page.id === active;
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onChange(page.id)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex cursor-pointer items-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
              isActive
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-white/5 bg-white/[0.02] text-ink-dim hover:border-accent/20 hover:text-ink',
            ].join(' ')}
          >
            <span aria-hidden>{page.icon}</span>
            {page.label}
          </button>
        );
      })}
    </nav>
  );
}

'use client';

import type { WeekStatus } from './types';

/* Button colour carries the week's payment state, matching v2:
   blue = currently viewing, red = owed money, orange = unpaid but zero,
   grey = status could not be checked, default = paid. */
function buttonClass(status: WeekStatus | undefined, isActive: boolean): string {
  if (isActive) return 'border-[#3b82f6] bg-[#3b82f6] text-white';
  if (!status || status.state === 'loading') return 'border-white/10 bg-white/5 text-ink-dim';
  if (status.state === 'error') return 'border-[#888] bg-[#888]/15 text-[#888] italic';
  if (status.state === 'owed') return 'border-[#ff4d4d] bg-[#ff4d4d]/10 text-[#ff4d4d]';
  if (status.state === 'unpaid-zero') return 'border-[#f77f07] bg-[#f77f07]/8 text-[#f77f07]';
  return 'border-white/10 bg-white/5 text-ink-dim hover:border-accent/30';
}

function buttonTitle(status: WeekStatus | undefined): string | undefined {
  if (status?.state === 'error') return 'ไม่สามารถตรวจสอบสถานะได้ (คลิกเพื่อลองใหม่)';
  if (status?.state === 'unpaid-zero') return 'ยังไม่ได้จ่าย';
  return undefined;
}

export function WeekSelector({
  weeks,
  activeWeek,
  statuses,
  selected,
  onSelectWeek,
  onToggleWeek,
}: {
  weeks: string[];
  activeWeek: string | null;
  statuses: Record<string, WeekStatus>;
  selected: Set<string>;
  onSelectWeek: (week: string) => void;
  onToggleWeek: (week: string, checked: boolean) => void;
}) {
  if (weeks.length === 0) {
    return <div className="text-sm text-gold">⚠️ ไม่พบรายชื่อสัปดาห์ในระบบ</div>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {weeks.map((week) => {
        const status = statuses[week];
        const isActive = week === activeWeek;
        // Only weeks with an outstanding balance are payable; "test" is excluded.
        const payable = status?.state === 'owed' && week.toLowerCase() !== 'test';

        return (
          <button
            key={week}
            type="button"
            onClick={() => onSelectWeek(week)}
            title={buttonTitle(status)}
            aria-current={isActive ? 'true' : undefined}
            className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-semibold transition ${buttonClass(status, isActive)}`}
          >
            <span>{week}</span>

            {payable && (
              <input
                type="checkbox"
                checked={selected.has(week)}
                onChange={(e) => onToggleWeek(week, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`เลือก ${week} เพื่อจ่ายเงิน`}
                className="h-3.5 w-3.5 cursor-pointer accent-[#f77f07]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

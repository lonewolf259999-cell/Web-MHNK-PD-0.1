'use client';

import { EmptyState, SectionHeader } from '@/components/ui/States';
import type { Officer, ScheduleConfig } from '@/lib/types';

export function ScheduleView({
  officers,
  config,
}: {
  officers: Officer[];
  config: ScheduleConfig | null;
}) {
  const days = config?.days ?? [];

  return (
    <section>
      <SectionHeader icon="📅" title="ตารางเวรเจ้าหน้าที่ (จันทร์-อาทิตย์)" />

      {officers.length === 0 ? (
        <EmptyState icon="📅" title="ไม่มีตารางเวร" message="ข้อมูลกำลังอัพเดท" />
      ) : (
        <>
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-accent/12 bg-accent/5">
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-accent">
                    เจ้าหน้าที่
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.key}
                      className="px-2 py-2.5 text-center text-xs font-bold text-accent"
                    >
                      <span className="hidden sm:inline">{day.label}</span>
                      <span className="sm:hidden">{day.short}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {officers.map((officer) => (
                  <tr key={officer.code} className="transition hover:bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <strong className="block text-sm font-medium text-ink">
                        {officer.name}
                      </strong>
                      <small className="text-[0.7rem] text-ink-dim">{officer.rank}</small>
                    </td>

                    {officer.schedule.map((shift, index) => (
                      <td key={index} className="px-2 py-2 text-center">
                        {shift ? (
                          <span className="inline-block rounded border border-accent/25 bg-accent/10 px-2 py-0.5 text-[0.7rem] font-semibold text-accent">
                            {shift}
                          </span>
                        ) : (
                          <span className="text-ink-dim/40">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-ink-dim">* ตารางแสดงเจ้าหน้าที่ตามเวรประจำสัปดาห์</p>
        </>
      )}
    </section>
  );
}

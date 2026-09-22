'use client';

import { isPaidValue } from './types';
import type { WeekOfficerData } from '@/lib/types';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

function StatTile({
  label,
  value,
  tone = 'accent',
}: {
  label: string;
  value: string | number;
  tone?: 'accent' | 'gold' | 'blue';
}) {
  const tones = {
    accent: 'text-accent',
    gold: 'text-gold',
    blue: 'text-[#60a5fa]',
  };

  return (
    <div className="rounded-md border border-white/5 bg-white/[0.03] px-3 py-2.5 text-center">
      <p className="mb-1 text-[0.65rem] text-ink-dim">{label}</p>
      <div className={`text-base font-bold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

export function WeekStats({
  weekName,
  data,
}: {
  weekName: string;
  data: WeekOfficerData | null;
}) {
  if (!data) {
    return (
      <div className="panel flex flex-col items-center gap-2 p-6 text-center">
        <span className="text-2xl">🔍</span>
        <p className="text-sm text-ink-dim">ไม่พบข้อมูลการปฏิบัติงานในสัปดาห์นี้</p>
      </div>
    );
  }

  const paid = isPaidValue(data.paid);

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/12 pb-3">
        <div>
          <span className="rounded border border-accent/25 bg-accent/10 px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-accent">
            WEEKLY REPORT
          </span>
          <h4 className="mt-1.5 text-base font-extrabold text-accent">{weekName}</h4>
        </div>
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-ink-dim">
          {data.rank || '-'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Take 2" value={data.take2 || 0} />
        <StatTile label="คดี" value={data.weeklyCases || 0} />
        <StatTile label="คุมสอบ" value={data.interrogations || 0} tone="blue" />
        <StatTile label="รวมคดี" value={data.totalCases || 0} tone="blue" />
        <StatTile
          label="เงินรายอาทิตย์"
          value={`฿${(Number(data.totalAmount) || 0).toLocaleString()}`}
          tone="gold"
        />
      </div>

      <div
        className={`rounded-md border px-4 py-3 text-center ${
          paid ? 'border-success/40 bg-success/10' : 'border-gold/40 bg-gold/10'
        }`}
      >
        <div className="mb-0.5 text-[0.7rem] text-ink-dim">สถานะการจ่ายเงิน</div>
        <div
          className={`flex items-center justify-center gap-2 text-sm font-bold ${
            paid ? 'text-success' : 'text-gold'
          }`}
        >
          <span>{paid ? '✅' : '⏳'}</span>
          <span>{paid ? 'จ่ายเงินแล้ว' : 'ยังไม่ได้จ่าย'}</span>
        </div>
      </div>
    </div>
  );
}

export function DutyTable({ duty, total }: { duty: string[] | null; total: string | null }) {
  if (!duty || duty.length === 0) {
    return (
      <div className="panel p-5 text-center text-sm text-ink-dim">
        ไม่มีข้อมูลตารางเวรในสัปดาห์นี้
      </div>
    );
  }

  return (
    <>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-accent/12 bg-accent/5">
              {DAYS.map((day) => (
                <th key={day} className="px-2 py-2.5 text-center text-xs font-bold text-accent">
                  {day}
                </th>
              ))}
              <th className="px-2 py-2.5 text-center text-xs font-bold text-gold">รวม</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {duty.map((value, index) => (
                <td key={index} className="px-2 py-3 text-center">
                  {value ? (
                    <span className="inline-block rounded border border-accent/25 bg-accent/10 px-2 py-0.5 text-[0.7rem] font-semibold text-accent">
                      {value}
                    </span>
                  ) : (
                    <span className="text-ink-dim/40">-</span>
                  )}
                </td>
              ))}
              <td className="px-2 py-3 text-center">
                {total ? (
                  <span className="inline-block rounded border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.7rem] font-bold text-gold">
                    {total}
                  </span>
                ) : (
                  <span className="text-ink-dim/40">-</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-dim">* ชั่วโมงการทำงานประจำวันของสัปดาห์นี้</p>
    </>
  );
}

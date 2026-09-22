'use client';

import { useEffect, useState } from 'react';
import { queries } from '@/lib/client/queries';
import { parseCases } from '@/lib/format';
import type { Officer } from '@/lib/types';

interface Entry {
  name: string;
  rank: string;
  cases: number;
}

function Panel({
  title,
  badge,
  children,
}: {
  title: React.ReactNode;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="panel w-full shrink-0 p-3 lg:w-[300px] xl:w-[340px]">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-accent/12 pb-2">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <span className="rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-accent">
          {badge}
        </span>
      </div>
      {children}
    </aside>
  );
}

function TopList({ entries, empty }: { entries: Entry[]; empty: string }) {
  if (entries.length === 0) {
    return <div className="py-6 text-center text-xs text-ink-dim">{empty}</div>;
  }

  return (
    <ol className="space-y-1">
      {entries.map((entry, index) => (
        <li
          key={`${entry.name}-${index}`}
          className="flex items-center gap-2.5 rounded-sm px-1.5 py-1.5 transition hover:bg-white/[0.03]"
        >
          <span
            className={[
              'flex h-6 w-6 shrink-0 items-center justify-center rounded text-[0.7rem] font-bold',
              index === 0
                ? 'bg-gold/20 text-gold'
                : index < 3
                  ? 'bg-accent/15 text-accent'
                  : 'bg-white/5 text-ink-dim',
            ].join(' ')}
          >
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-ink">{entry.name}</div>
            <div className="truncate text-[0.65rem] text-ink-dim">{entry.rank}</div>
          </div>

          <span className="text-xs font-bold text-accent tabular-nums">
            {entry.cases.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Left panel: weekly TOP 10, with a week picker. */
export function WeeklyTop10({ weeks }: { weeks: string[] }) {
  const [selected, setSelected] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  const realWeeks = weeks.filter((w) => w.toLowerCase() !== 'test');

  // Default to the newest week as soon as the list arrives.
  useEffect(() => {
    if (!selected && realWeeks.length > 0) setSelected(realWeeks[realWeeks.length - 1]);
  }, [realWeeks, selected]);

  useEffect(() => {
    if (!selected) return;

    let active = true;
    setStatus('loading');

    queries
      .weekData(selected)
      .then((data) => {
        if (!active) return;
        const top = Object.values(data)
          .sort((a, b) => (parseFloat(b.totalCases) || 0) - (parseFloat(a.totalCases) || 0))
          .slice(0, 10)
          .map((o) => ({ name: o.name, rank: o.rank, cases: parseFloat(o.totalCases) || 0 }));
        setEntries(top);
        setStatus('idle');
      })
      .catch(() => active && setStatus('error'));

    return () => {
      active = false;
    };
  }, [selected]);

  return (
    <Panel
      title={
        <>
          ★ <span className="text-accent">TOP 10</span>
          {selected && <span className="ml-1 text-xs font-normal text-ink-dim">({selected})</span>}
        </>
      }
      badge="เคส"
    >
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="เลือกสัปดาห์"
        className="mb-3 w-full cursor-pointer rounded-sm border border-accent/12 bg-panel px-2.5 py-2 text-xs text-ink outline-none focus:border-accent/40"
      >
        {realWeeks.length === 0 && <option value="">กำลังโหลด...</option>}
        {realWeeks.map((week) => (
          <option key={week} value={week}>
            {week}
          </option>
        ))}
      </select>

      {status === 'loading' && (
        <div className="py-6 text-center text-xs text-ink-dim">กำลังโหลด...</div>
      )}
      {status === 'error' && (
        <div className="py-6 text-center text-xs text-danger">โหลดไม่สำเร็จ</div>
      )}
      {status === 'idle' && <TopList entries={entries} empty="ไม่มีข้อมูล" />}
    </Panel>
  );
}

/** Right panel: all-time TOP 10 from the roster sheet. */
export function AllTimeTop10({ officers }: { officers: Officer[] }) {
  const entries = [...officers]
    .sort((a, b) => parseCases(b.cases) - parseCases(a.cases))
    .slice(0, 10)
    .map((o) => ({ name: o.name, rank: o.rank, cases: parseCases(o.cases) }));

  return (
    <Panel
      title={
        <>
          ★ <span className="text-accent">TOP 10</span> เคส
        </>
      }
      badge="TOP"
    >
      <TopList entries={entries} empty="ไม่มีข้อมูล" />
    </Panel>
  );
}

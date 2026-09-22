'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { queries, mutations } from '@/lib/client/queries';
import { clearApiCache } from '@/lib/client/api';
import { clearPin, isAdminMode, readPin, savePin } from '@/lib/client/adminPin';
import { findOfficerWeekData, isOfficerMatch } from '@/lib/format';
import { SiteFooter } from '@/components/SiteHeader';
import { ConfirmModal, CopyButton, PinModal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Loading } from '@/components/ui/States';
import { WeekSelector } from './WeekSelector';
import { DutyTable, WeekStats } from './WeekStats';
import { toWeekStatus, type WeekStatus } from './types';
import type { Officer, WeekOfficerData } from '@/lib/types';

const PAYMENT_TIMEOUT_MS = 10_000;

interface Totals {
  cases: number;
  take2: number;
  interrogations: number;
}

export function ProfileClient() {
  const searchParams = useSearchParams();
  const officerName = searchParams.get('name') ?? '';
  const toast = useToast();

  const [officer, setOfficer] = useState<Officer | null>(null);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WeekStatus>>({});
  const [totals, setTotals] = useState<Totals | null>(null);

  const [activeWeek, setActiveWeek] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<WeekOfficerData | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const [pinPrompt, setPinPrompt] = useState<null | 'admin' | 'payment'>(null);
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);

  /* Weeks paid during this session. Google's GViz export is CDN-cached and
     lags behind writes, so a re-fetch can still report them unpaid — these
     override whatever comes back. */
  const paidThisSession = useRef<Set<string>>(new Set());

  /* ---------- initial load ---------- */

  useEffect(() => {
    if (!officerName) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        const [officers, weekNames] = await Promise.all([queries.officers(), queries.weeks()]);
        if (!active) return;

        const match = officers.find(
          (o) => isOfficerMatch(o.fullName, officerName) || isOfficerMatch(o.name, officerName)
        );

        if (!match) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setOfficer(match);
        setWeeks(weekNames);
        setStatuses(
          Object.fromEntries(weekNames.map((w) => [w, { state: 'loading', amount: 0 }]))
        );
        setActiveWeek(weekNames[0] ?? null);
        setLoading(false);
      } catch {
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [officerName]);

  /* ---------- per-week status + cumulative totals ---------- */

  const refreshStatuses = useCallback(async () => {
    if (weeks.length === 0 || !officerName) return;

    const running: Totals = { cases: 0, take2: 0, interrogations: 0 };

    await Promise.all(
      weeks.map(async (week) => {
        if (paidThisSession.current.has(week)) {
          setStatuses((prev) => ({ ...prev, [week]: { state: 'paid', amount: 0 } }));
          return;
        }

        try {
          const data = await queries.weekData(week);
          const entry = findOfficerWeekData(data, officerName);

          if (entry) {
            running.cases += parseInt(entry.totalCases, 10) || 0;
            running.take2 += parseInt(entry.take2, 10) || 0;
            running.interrogations += parseInt(entry.interrogations, 10) || 0;
          }

          setStatuses((prev) => ({
            ...prev,
            [week]: entry
              ? toWeekStatus(entry.paid, Number(entry.totalAmount) || 0)
              : { state: 'unpaid-zero', amount: 0 },
          }));
        } catch {
          setStatuses((prev) => ({ ...prev, [week]: { state: 'error', amount: 0 } }));
        }
      })
    );

    setTotals(running);
  }, [weeks, officerName]);

  useEffect(() => {
    void refreshStatuses();
  }, [refreshStatuses]);

  /* Unpaid weeks with a balance start checked, matching v2. */
  useEffect(() => {
    const owed = Object.entries(statuses)
      .filter(([week, s]) => s.state === 'owed' && week.toLowerCase() !== 'test')
      .map(([week]) => week);

    if (owed.length > 0) setSelected(new Set(owed));
  }, [statuses]);

  /* ---------- active week ---------- */

  const loadWeek = useCallback(
    async (week: string) => {
      if (!officerName) return;
      setWeekLoading(true);

      try {
        const data = await queries.weekData(week);
        const entry = findOfficerWeekData(data, officerName);

        if (entry && paidThisSession.current.has(week)) entry.paid = 'จ่ายแล้ว';
        setWeekData(entry);
      } catch {
        setWeekData(null);
      } finally {
        setWeekLoading(false);
      }
    },
    [officerName]
  );

  useEffect(() => {
    if (activeWeek) void loadWeek(activeWeek);
  }, [activeWeek, loadWeek]);

  /* Poll the active week so a payment made elsewhere shows up. */
  useEffect(() => {
    if (!activeWeek) return;
    const timer = setInterval(() => {
      clearApiCache('week_');
      void loadWeek(activeWeek);
    }, 60_000);
    return () => clearInterval(timer);
  }, [activeWeek, loadWeek]);

  useEffect(() => setAdminMode(isAdminMode()), []);

  /* ---------- payment ---------- */

  const selectedWeeks = useMemo(
    () => [...selected].filter((w) => statuses[w]?.state === 'owed'),
    [selected, statuses]
  );

  const selectedTotal = useMemo(
    () => selectedWeeks.reduce((sum, w) => sum + (statuses[w]?.amount ?? 0), 0),
    [selectedWeeks, statuses]
  );

  async function runPayment(pin: string) {
    setPaying(true);

    let succeeded = 0;
    let failed = 0;
    let unknown = 0;
    const errors: string[] = [];

    await Promise.all(
      selectedWeeks.map(async (week) => {
        const idempotencyKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PAYMENT_TIMEOUT_MS);

        /* The request may be lost after the server already wrote the row, so
           an uncertain outcome is re-checked by idempotency key rather than
           reported as a failure. */
        const resolveUncertain = async () => {
          try {
            const status = await mutations.paymentStatus(idempotencyKey);
            if (status.success) {
              succeeded++;
              paidThisSession.current.add(week);
              return;
            }
          } catch {
            /* status unavailable */
          }
          unknown++;
          errors.push(`${week}: ไม่ทราบผลการจ่าย (อาจสำเร็จแล้ว) กรุณารีเฟรชเพื่อตรวจสอบ`);
        };

        try {
          const result = await mutations.markPaid(
            { pin, weekName: week, officerName, idempotencyKey },
            controller.signal
          );

          if (result.success) {
            succeeded++;
            paidThisSession.current.add(week);
            return;
          }
          if ('processing' in result && result.processing) {
            await resolveUncertain();
            return;
          }

          failed++;
          errors.push(`${week}: ${result.message || 'ไม่สำเร็จ'}`);
        } catch (err) {
          const error = err as Error;

          if (error.name === 'AbortError') {
            await resolveUncertain();
            return;
          }

          failed++;
          if (error.message.includes('PIN')) clearPin();
          errors.push(`${week}: ${error.message}`);
        } finally {
          clearTimeout(timer);
        }
      })
    );

    if (failed > 0 || unknown > 0) {
      const parts = [];
      if (failed > 0) parts.push(`ล้มเหลว ${failed} รายการ`);
      if (unknown > 0) parts.push(`ไม่ทราบผล ${unknown} รายการ`);
      toast(`${parts.join(' • ')}: ${errors[0]}`, 'error', 6000);
    } else {
      toast(`ยืนยันการจ่ายเงินสำเร็จทั้งหมด ${succeeded} รายการ`, 'success');
    }

    if (succeeded > 0) {
      setStatuses((prev) => {
        const next = { ...prev };
        for (const week of paidThisSession.current) next[week] = { state: 'paid', amount: 0 };
        return next;
      });
      setSelected(new Set());
      clearApiCache('week_');
      if (activeWeek) void loadWeek(activeWeek);
    }

    setPaying(false);
  }

  function startPayment() {
    if (selectedWeeks.length === 0) return;
    if (readPin()) {
      setConfirming(true);
      return;
    }
    setPinPrompt('payment');
  }

  /* ---------- render ---------- */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="กำลังโหลดข้อมูล..." />
      </div>
    );
  }

  if (notFound || !officer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-base text-ink-dim">ไม่พบข้อมูลเจ้าหน้าที่</p>
        <Link
          href="/"
          className="rounded-sm border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-10 border-b border-accent/12 bg-gradient-to-b from-[rgba(15,23,42,0.98)] to-[rgba(10,15,30,0.95)] px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold text-ink-dim transition hover:bg-accent/10 hover:text-accent"
          >
            <span aria-hidden>←</span> กลับ
          </Link>

          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-bold text-ink md:text-base">ประวัติเจ้าหน้าที่</h1>
            <div className="text-[0.55rem] tracking-[2px] text-ink-dim uppercase">
              กรมตำรวจ <span className="text-accent">MHNK</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (adminMode) {
                clearPin();
                setAdminMode(false);
              } else {
                setPinPrompt('admin');
              }
            }}
            className={`cursor-pointer rounded-md border px-2.5 py-1 text-[0.6rem] font-bold transition ${
              adminMode
                ? 'border-gold/40 bg-gold/15 text-gold'
                : 'border-white/10 bg-white/5 text-ink-dim hover:text-ink'
            }`}
          >
            ♛ Admin
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6">
        <section className="panel space-y-4 p-5 text-center">
          <div>
            <h2 className="text-xl font-extrabold text-ink">{officer.name}</h2>
            <span className="text-sm text-accent">{officer.rank || 'ไม่ระบุหน่วยงาน'}</span>

            {officer.phone && (
              <div className="mt-1.5 flex items-center justify-center gap-2 text-sm text-ink-dim">
                <span aria-hidden>☎</span>
                <span>{officer.phone}</span>
                <CopyButton value={officer.phone} label="คัดลอกเบอร์" />
              </div>
            )}
          </div>

          <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
            <SmallStat label="วันที่ทำงาน" value={officer.workDays || '0'} />
            <SmallStat label="ไม่ได้เข้าเวร" value={officer.daysAway || '0'} tone="gold" />
            <SmallStat
              label="SteamKey"
              value={officer.steamKey || officer.steamId || '-'}
              tone="blue"
              small
            />
          </div>

          {totals && (
            <div className="mx-auto grid max-w-lg grid-cols-3 gap-2 border-t border-white/5 pt-4">
              <SmallStat label="รวมคดีทั้งหมด" value={totals.cases.toLocaleString()} />
              <SmallStat label="รวม Take 2" value={totals.take2.toLocaleString()} />
              <SmallStat label="รวมคุมสอบ" value={totals.interrogations.toLocaleString()} />
            </div>
          )}

          <div className="border-t border-white/5 pt-4">
            <WeekSelector
              weeks={weeks}
              activeWeek={activeWeek}
              statuses={statuses}
              selected={selected}
              onSelectWeek={setActiveWeek}
              onToggleWeek={(week, checked) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(week);
                  else next.delete(week);
                  return next;
                })
              }
            />
          </div>

          {selectedTotal > 0 && (
            <div className="space-y-2.5 rounded-lg border border-gold/30 bg-gold/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      new Set(
                        Object.entries(statuses)
                          .filter(([w, s]) => s.state === 'owed' && w.toLowerCase() !== 'test')
                          .map(([w]) => w)
                      )
                    )
                  }
                  className="cursor-pointer rounded border border-gold/50 px-2 py-1 text-[0.7rem] text-gold transition hover:bg-gold/10"
                >
                  เลือกทั้งหมด
                </button>

                <strong className="flex items-center gap-1.5 text-base text-gold">
                  ฿ {selectedTotal.toLocaleString()}
                  <CopyButton value={String(selectedTotal)} label="คัดลอกจำนวนเงิน" />
                </strong>
              </div>

              <button
                type="button"
                onClick={startPayment}
                disabled={paying}
                className="w-full cursor-pointer rounded-sm bg-success py-3 text-sm font-bold text-night transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying
                  ? 'กำลังประมวลผล...'
                  : `ยืนยันการจ่ายเงิน ${selectedWeeks.length} รายการ`}
              </button>
            </div>
          )}
        </section>

        {weekLoading ? (
          <Loading />
        ) : (
          activeWeek && <WeekStats weekName={activeWeek} data={weekData} />
        )}

        <section>
          <h3 className="mb-3 text-sm font-bold text-ink">ตารางเวร (จันทร์-อาทิตย์)</h3>
          <DutyTable duty={weekData?.duty ?? null} total={weekData?.dutyTotal ?? null} />
        </section>
      </main>

      <SiteFooter />

      {pinPrompt && (
        <PinModal
          title={
            pinPrompt === 'admin'
              ? 'กรุณาระบุรหัสผ่านเพื่อเข้าโหมดผู้ดูแล'
              : 'กรุณาระบุรหัสผ่านเพื่อยืนยันการจ่าย'
          }
          onCancel={() => setPinPrompt(null)}
          onSubmit={(pin) => {
            savePin(pin);
            const mode = pinPrompt;
            setPinPrompt(null);
            if (mode === 'admin') setAdminMode(true);
            else setConfirming(true);
          }}
        />
      )}

      {confirming && (
        <ConfirmModal
          count={selectedWeeks.length}
          total={selectedTotal}
          weeks={selectedWeeks}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            const pin = readPin();
            if (!pin) {
              setPinPrompt('payment');
              return;
            }
            void runPayment(pin);
          }}
        />
      )}
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone = 'accent',
  small = false,
}: {
  label: string;
  value: string;
  tone?: 'accent' | 'gold' | 'blue';
  small?: boolean;
}) {
  const tones = { accent: 'text-accent', gold: 'text-gold', blue: 'text-[#60a5fa]' };

  return (
    <div className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-2">
      <p className="mb-0.5 text-[0.6rem] text-ink-dim">{label}</p>
      <div className={`truncate font-bold ${tones[tone]} ${small ? 'text-[0.65rem]' : 'text-sm'}`}>
        {value}
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { mutations } from '@/lib/client/queries';
import { useDiscordAuth } from '@/lib/client/useDiscordAuth';
import { readPin, savePin } from '@/lib/client/adminPin';
import { useToast } from '@/components/ui/Toast';
import { DiscordConnect, ErrorList, FormShell, TextInput } from './Field';

/* Column headers come from the Pending sheet, so they are Thai strings. */
const COL = {
  timestamp: 'Timestamp',
  discordId: 'Discord ID',
  discordName: 'ชื่อ Discord',
  icName: 'ชื่อ IC',
  phone: 'เบอร์ IC',
  age: 'อายุ OOC',
  steam: 'Steam URL',
  status: 'สถานะ',
} as const;

const PENDING = 'รอตรวจ';
const APPROVED = 'อนุมัติ';
const REJECTED = 'ปฏิเสธ';

type Row = Record<string, string | number> & { _row: number };

const STATUS_STYLE: Record<string, string> = {
  [PENDING]: 'border-gold/40 bg-gold/10 text-gold',
  [APPROVED]: 'border-success/40 bg-success/10 text-success',
  [REJECTED]: 'border-danger/40 bg-danger/10 text-danger',
};

export function ProctorPanel() {
  const auth = useDiscordAuth('admin');
  const toast = useToast();

  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load(withPin: string) {
    setBusy(true);
    setErrors([]);

    try {
      const result = await mutations.listPending(withPin);
      setRows(result.data as Row[]);
      setAuthed(true);
      savePin(withPin);
    } catch (err) {
      setErrors([(err as Error).message]);
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const count = (status: string) => rows.filter((r) => r[COL.status] === status).length;
    return {
      total: rows.length,
      pending: count(PENDING),
      approved: count(APPROVED),
      rejected: count(REJECTED),
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();

    return rows.filter((row) => {
      if (statusFilter && row[COL.status] !== statusFilter) return false;
      if (!q) return true;

      return [COL.discordId, COL.discordName, COL.icName, COL.phone].some((key) =>
        String(row[key] ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  async function decide(row: number, approve: boolean) {
    const currentPin = readPin() ?? pin;
    if (!currentPin) return;

    if (approve && !auth.user) {
      toast('กรุณาเชื่อมต่อ Discord (Proctor) ก่อนอนุมัติ', 'error');
      return;
    }

    setBusy(true);
    try {
      const result = approve
        ? await mutations.approvePending(row, {
            pin: currentPin,
            proctorDiscordId: auth.user!.userId,
            proctorDiscordName: auth.user!.name,
          })
        : await mutations.rejectPending(row, currentPin);

      toast(result.message, 'success');
      await load(currentPin);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <FormShell title="⚙️ Admin Panel" subtitle="ตรวจใบสมัคร">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(pin);
          }}
          className="panel space-y-4 p-5"
        >
          <DiscordConnect auth={auth} />

          <TextInput
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Admin PIN"
            disabled={!auth.user}
          />

          <ErrorList errors={errors} />

          <button
            type="submit"
            disabled={!auth.user || !pin || busy}
            className="w-full cursor-pointer rounded-sm bg-accent py-3 text-sm font-bold text-night transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </FormShell>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">⚙️ Admin Panel</h1>
        <button
          type="button"
          onClick={() => void load(readPin() ?? pin)}
          disabled={busy}
          className="cursor-pointer rounded-sm border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
        >
          🔄 โหลดใหม่
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="ทั้งหมด" value={stats.total} />
        <Stat label="รอตรวจ" value={stats.pending} tone="text-gold" />
        <Stat label="อนุมัติแล้ว" value={stats.approved} tone="text-success" />
        <Stat label="ปฏิเสธ" value={stats.rejected} tone="text-danger" />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา Discord ID, ชื่อ..."
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="กรองตามสถานะ"
          className="cursor-pointer rounded-sm border border-accent/15 bg-black/25 px-3 py-2.5 text-sm text-ink outline-none focus:border-accent/50"
        >
          <option value="">ทุกสถานะ</option>
          <option value={PENDING}>{PENDING}</option>
          <option value={APPROVED}>{APPROVED}</option>
          <option value={REJECTED}>{REJECTED}</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-ink-dim">💡 ไม่มีข้อมูล</div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-accent/12 bg-accent/5 text-left">
                {['เวลา', 'Discord', 'ชื่อ IC', 'เบอร์', 'อายุ', 'Steam', 'สถานะ', 'จัดการ'].map(
                  (h) => (
                    <th key={h} className="px-3 py-2.5 text-xs font-bold whitespace-nowrap text-accent">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {visible.map((row) => {
                const status = String(row[COL.status] ?? '');
                const isPending = status === PENDING;

                return (
                  <tr key={row._row} className="transition hover:bg-white/[0.03]">
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-ink-dim">
                      {String(row[COL.timestamp] ?? '')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-ink">{String(row[COL.discordName] ?? '')}</div>
                      <div className="text-[0.65rem] text-ink-dim">
                        {String(row[COL.discordId] ?? '')}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink">{String(row[COL.icName] ?? '')}</td>
                    <td className="px-3 py-2 text-xs text-ink-dim">{String(row[COL.phone] ?? '')}</td>
                    <td className="px-3 py-2 text-xs text-ink-dim">{String(row[COL.age] ?? '')}</td>
                    <td className="max-w-[10rem] px-3 py-2">
                      {row[COL.steam] ? (
                        <a
                          href={String(row[COL.steam])}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-accent hover:underline"
                        >
                          {String(row[COL.steam])}
                        </a>
                      ) : (
                        <span className="text-xs text-ink-dim/50">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-[0.65rem] font-semibold whitespace-nowrap ${
                          STATUS_STYLE[status] ?? 'border-white/10 bg-white/5 text-ink-dim'
                        }`}
                      >
                        {status || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isPending ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => void decide(row._row, true)}
                            disabled={busy}
                            className="cursor-pointer rounded bg-success/20 px-2 py-1 text-[0.7rem] font-semibold text-success transition hover:bg-success/30 disabled:opacity-40"
                          >
                            อนุมัติ
                          </button>
                          <button
                            type="button"
                            onClick={() => void decide(row._row, false)}
                            disabled={busy}
                            className="cursor-pointer rounded bg-danger/20 px-2 py-1 text-[0.7rem] font-semibold text-danger transition hover:bg-danger/30 disabled:opacity-40"
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      ) : (
                        <span className="text-[0.7rem] text-ink-dim/50">เสร็จสิ้น</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'text-accent' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="panel px-3 py-3 text-center">
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="text-[0.7rem] text-ink-dim">{label}</div>
    </div>
  );
}

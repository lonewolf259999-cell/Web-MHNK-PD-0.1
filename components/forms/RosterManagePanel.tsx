'use client';

import { useMemo, useState } from 'react';
import { mutations } from '@/lib/client/queries';
import { useDiscordAuth } from '@/lib/client/useDiscordAuth';
import { readPin, savePin } from '@/lib/client/adminPin';
import { useToast } from '@/components/ui/Toast';
import { DiscordConnect, ErrorList, FormShell, TextInput } from './Field';
import type { RosterMember } from '@/server/services/roster';

const EXIT_REASONS = ['ออกจาก Discord', 'ถูกปลดออก', 'ติดต่อขอออก', 'เกิน 15 วัน'] as const;

/** Moving a member out is irreversible from the UI, so it is confirmed first. */
interface PendingAction {
  row: number;
  label: string;
  reason: string;
}

export function RosterManagePanel() {
  const auth = useDiscordAuth('roster');
  const toast = useToast();

  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [namePD, setNamePD] = useState<RosterMember[]>([]);
  const [outDC, setOutDC] = useState<RosterMember[]>([]);
  const [tab, setTab] = useState<'namepd' | 'outdc'>('namepd');
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState<PendingAction | null>(null);

  async function load(withPin: string) {
    setBusy(true);
    setErrors([]);

    try {
      const [inSystem, departed] = await Promise.all([
        mutations.namePD(withPin),
        mutations.outDC(withPin),
      ]);
      setNamePD(inSystem.data as RosterMember[]);
      setOutDC(departed.data as RosterMember[]);
      setAuthed(true);
      savePin(withPin);
    } catch (err) {
      setErrors([(err as Error).message]);
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(
    () => ({
      inSystem: namePD.length,
      departed: outDC.length,
      leftDiscord: outDC.filter((m) => m.status === 'ออกจาก Discord').length,
      fired: outDC.filter((m) => m.status === 'ถูกปลดออก').length,
    }),
    [namePD, outDC]
  );

  const visible = useMemo(() => {
    const source = tab === 'namepd' ? namePD : outDC;
    const q = search.toLowerCase().trim();
    if (!q) return source;

    return source.filter((m) =>
      [m.name, m.code, m.discordId, m.rank].some((v) => v.toLowerCase().includes(q))
    );
  }, [tab, namePD, outDC, search]);

  async function setStatus(row: number, status: string) {
    const currentPin = readPin() ?? pin;
    setBusy(true);

    try {
      const result = await mutations.setRosterStatus(row, currentPin, status);
      toast(result.message, 'success');
      await load(currentPin);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmMoveOut() {
    if (!confirming) return;
    const currentPin = readPin() ?? pin;
    const action = confirming;

    setConfirming(null);
    setBusy(true);

    try {
      const result = await mutations.moveOut(action.row, currentPin, action.reason);
      toast(result.message, result.warnings.length > 0 ? 'info' : 'success', 6000);
      await load(currentPin);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <FormShell title="📋 จัดการสถานะสมาชิก" subtitle="Roster Management">
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
        <h1 className="text-lg font-bold text-ink">📋 จัดการสถานะสมาชิก</h1>
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
        <Stat label="ในระบบ (NamePD)" value={stats.inSystem} />
        <Stat label="ออกแล้ว (OutDC)" value={stats.departed} tone="text-ink-dim" />
        <Stat label="ออกจาก Discord" value={stats.leftDiscord} tone="text-gold" />
        <Stat label="ถูกปลดออก" value={stats.fired} tone="text-danger" />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          {(['namepd', 'outdc'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`cursor-pointer rounded-sm border px-3 py-2 text-xs font-semibold transition ${
                tab === id
                  ? 'border-accent/40 bg-accent/15 text-accent'
                  : 'border-white/5 bg-white/[0.02] text-ink-dim hover:text-ink'
              }`}
            >
              {id === 'namepd' ? `ในระบบ (${stats.inSystem})` : `ออกแล้ว (${stats.departed})`}
            </button>
          ))}
        </div>

        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา ชื่อ, รหัส, Discord ID..."
        />
      </div>

      {visible.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-ink-dim">💡 ไม่มีข้อมูล</div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-accent/12 bg-accent/5 text-left">
                {['รหัส', 'ชื่อ', 'ยศ', 'เคส', 'ไม่เข้าเวร', tab === 'namepd' ? 'สถานะ' : 'สาเหตุ'].map(
                  (h) => (
                    <th key={h} className="px-3 py-2.5 text-xs font-bold whitespace-nowrap text-accent">
                      {h}
                    </th>
                  )
                )}
                {tab === 'namepd' && (
                  <th className="px-3 py-2.5 text-xs font-bold text-accent">จัดการ</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {visible.map((member) => (
                <tr key={`${member.row}-${member.code}`} className="transition hover:bg-white/[0.03]">
                  <td className="px-3 py-2 text-xs font-bold text-accent">{member.code}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-ink">{member.name}</div>
                    <div className="text-[0.65rem] text-ink-dim">{member.discordId}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-dim">{member.rank}</td>
                  <td className="px-3 py-2 text-xs text-ink-dim">{member.cases}</td>
                  <td className="px-3 py-2 text-xs text-ink-dim">{member.duration || '-'}</td>
                  <td className="px-3 py-2">
                    {tab === 'namepd' ? (
                      <select
                        value={member.status}
                        onChange={(e) => void setStatus(member.row, e.target.value)}
                        disabled={busy}
                        aria-label={`สถานะของ ${member.name}`}
                        className="cursor-pointer rounded border border-white/10 bg-black/30 px-2 py-1 text-[0.7rem] text-ink outline-none focus:border-accent/50 disabled:opacity-50"
                      >
                        <option value="">✅ ปกติ</option>
                        {EXIT_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-ink-dim">{member.status || '-'}</span>
                    )}
                  </td>

                  {tab === 'namepd' && (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={busy || !member.status}
                        title={
                          member.status
                            ? 'ย้ายไป OutDC'
                            : 'เลือกสถานะการออกก่อนจึงจะย้ายได้'
                        }
                        onClick={() =>
                          setConfirming({
                            row: member.row,
                            label: `${member.code} ${member.name}`,
                            reason: member.status,
                          })
                        }
                        className="cursor-pointer rounded bg-danger/20 px-2 py-1 text-[0.7rem] font-semibold text-danger transition hover:bg-danger/30 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ย้ายออก
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => e.target === e.currentTarget && setConfirming(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-lg border border-danger/30 bg-[#1a1a2e] p-6">
            <h3 className="mb-2 text-base font-bold text-danger">⚠️ ยืนยันการย้ายออก</h3>
            <p className="mb-1 text-sm text-ink">{confirming.label}</p>
            <p className="mb-5 text-xs text-ink-dim">
              สาเหตุ: {confirming.reason} — ข้อมูลจะถูกย้ายไปชีต OutDC และล้างออกจาก NamePD
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 cursor-pointer rounded-sm bg-white/10 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-white/15"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void confirmMoveOut()}
                className="flex-1 cursor-pointer rounded-sm bg-danger py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                ยืนยัน
              </button>
            </div>
          </div>
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

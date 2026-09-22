'use client';

import { useEffect, useRef, useState } from 'react';

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-lg border border-accent/25 bg-[#1a1a2e] p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

export function PinModal({
  title = 'กรุณาระบุรหัสผ่าน',
  onSubmit,
  onCancel,
}: {
  title?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Backdrop onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pin) onSubmit(pin);
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-accent">🔐 {title}</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="ปิด"
            className="cursor-pointer text-xl leading-none text-ink-dim hover:text-ink"
          >
            ×
          </button>
        </div>

        <input
          ref={inputRef}
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          autoComplete="off"
          className="mb-4 w-full rounded-sm border border-accent/20 bg-black/30 px-3 py-2.5 text-center text-lg tracking-widest text-ink outline-none focus:border-accent/50"
        />

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-sm bg-white/10 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-white/15"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!pin}
            className="flex-1 cursor-pointer rounded-sm bg-accent py-2.5 text-sm font-semibold text-night transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            ยืนยัน
          </button>
        </div>
      </form>
    </Backdrop>
  );
}

export function ConfirmModal({
  count,
  total,
  weeks,
  onConfirm,
  onCancel,
}: {
  count: number;
  total: number;
  weeks: string[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Backdrop onClose={onCancel}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-gold">🔐 ยืนยันการดำเนินการ</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="ปิด"
          className="cursor-pointer text-xl leading-none text-ink-dim hover:text-ink"
        >
          ×
        </button>
      </div>

      <div className="mb-4 text-center text-sm text-ink-dim">
        <p>
          ยืนยันการจ่ายเงิน <strong className="text-gold">{count}</strong> รายการ
        </p>
        <p className="mt-2 flex items-center justify-center gap-2">
          <span>จำนวนเงิน</span>
          <strong className="text-lg text-gold">฿ {total.toLocaleString()}</strong>
          <CopyButton value={String(total)} label="คัดลอกจำนวนเงิน" />
        </p>
      </div>

      {weeks.length > 0 && (
        <ul className="mb-5 max-h-48 space-y-2 overflow-y-auto">
          {weeks.map((week) => (
            <li
              key={week}
              className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-2.5 py-2"
            >
              <span className="flex-1 truncate text-xs text-gold">{week}</span>
              <CopyButton value={week} label={`คัดลอก ${week}`} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 cursor-pointer rounded-sm bg-white/10 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-white/15"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 cursor-pointer rounded-sm bg-gold py-2.5 text-sm font-semibold text-night transition hover:brightness-110"
        >
          ยืนยัน
        </button>
      </div>
    </Backdrop>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={label}
      aria-label={label}
      className={`cursor-pointer rounded border px-1.5 py-1 text-xs transition ${
        copied
          ? 'border-success bg-success/20 text-success'
          : 'border-current/40 bg-current/10 opacity-80 hover:opacity-100'
      }`}
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}

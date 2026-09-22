'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import type { DiscordAuthState } from '@/lib/client/useDiscordAuth';

const DISCORD_ICON =
  'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

export function DiscordIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={DISCORD_ICON} />
    </svg>
  );
}

const INPUT_CLASS =
  'w-full rounded-sm border border-accent/15 bg-black/25 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-dim/50 focus:border-accent/50 disabled:opacity-50';

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-dim">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[0.7rem] text-ink-dim/70">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`${INPUT_CLASS} min-h-24 resize-y ${props.className ?? ''}`} />
  );
}

export function SubmitButton({
  children,
  disabled,
  pending,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full cursor-pointer rounded-sm bg-accent py-3 text-sm font-bold text-night transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? 'กำลังส่ง...' : children}
    </button>
  );
}

export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
      <ul className="space-y-1 text-sm text-danger">
        {errors.map((error, i) => (
          <li key={i}>• {error}</li>
        ))}
      </ul>
    </div>
  );
}

/** Discord connect panel — gates every form that needs a verified identity. */
export function DiscordConnect({ auth }: { auth: DiscordAuthState }) {
  if (auth.user) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 px-3 py-2.5">
        <img
          src={auth.avatarUrl ?? ''}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">@{auth.user.name}</div>
          <div className="truncate text-[0.7rem] text-ink-dim">{auth.user.userId}</div>
        </div>
        <button
          type="button"
          onClick={auth.disconnect}
          title="ยกเลิกการเชื่อมต่อ"
          className="cursor-pointer rounded border border-white/10 px-2 py-1 text-xs text-ink-dim transition hover:border-danger/40 hover:text-danger"
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Link
        href={auth.loginUrl}
        className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#5865F2] py-3 text-sm font-bold text-white transition hover:brightness-110"
      >
        <DiscordIcon /> เชื่อมต่อ Discord
      </Link>
      <p className="text-center text-[0.7rem] text-ink-dim">
        ต้องเชื่อมต่อ Discord ก่อนจึงจะส่งข้อมูลได้
      </p>
    </div>
  );
}

export function FormShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-10 border-b border-accent/12 bg-gradient-to-b from-[rgba(15,23,42,0.98)] to-[rgba(10,15,30,0.95)] px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold text-ink-dim transition hover:bg-accent/10 hover:text-accent"
          >
            <span aria-hidden>←</span> กลับ
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-sm font-bold text-ink md:text-base">{title}</h1>
            {subtitle && <div className="text-[0.65rem] text-ink-dim">{subtitle}</div>}
          </div>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

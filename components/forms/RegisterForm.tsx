'use client';

import { useState } from 'react';
import { mutations } from '@/lib/client/queries';
import { useDiscordAuth } from '@/lib/client/useDiscordAuth';
import { CopyButton } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  DiscordConnect,
  ErrorList,
  Field,
  FormShell,
  SubmitButton,
  TextInput,
} from './Field';

interface FormState {
  ocName: string;
  icFirstName: string;
  icLastName: string;
  ocAge: string;
  icPhone: string;
  steamUrl: string;
}

const EMPTY: FormState = {
  ocName: '',
  icFirstName: '',
  icLastName: '',
  ocAge: '',
  icPhone: '',
  steamUrl: '',
};

export function RegisterForm() {
  const auth = useDiscordAuth('register');
  const toast = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [savedMessageId, setSavedMessageId] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [messageId, setMessageId] = useState('');
  const [editCount, setEditCount] = useState(0);
  const [fetching, setFetching] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /** Pulls an existing submission back out of its Discord embed. */
  async function loadExisting() {
    if (!messageId.trim()) {
      setErrors(['กรุณาระบุ Message ID']);
      return;
    }

    setFetching(true);
    setErrors([]);

    try {
      const result = await mutations.fetchRegister(messageId.trim(), auth.user?.userId);
      const [first = '', ...rest] = (result.data.icName || '').split(' ');

      setForm({
        ocName: result.data.ocName,
        icFirstName: first,
        icLastName: rest.join(' '),
        ocAge: result.data.ocAge ? String(result.data.ocAge) : '',
        icPhone: result.data.icPhone,
        steamUrl: result.data.steamUrl,
      });
      setEditCount(result.editCount);
      toast('โหลดข้อมูลสำเร็จ', 'success');
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setFetching(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) return;

    setPending(true);
    setErrors([]);

    const payload = {
      ocName: form.ocName,
      icName: `${form.icFirstName} ${form.icLastName}`.trim(),
      ocAge: Number(form.ocAge),
      icPhone: form.icPhone,
      steamUrl: form.steamUrl,
      discordId: auth.user.userId,
      discordUserId: auth.user.userId,
      discordDisplayName: auth.user.name,
    };

    try {
      if (editMode) {
        const result = await mutations.editRegister({ ...payload, messageId: messageId.trim(), editCount });
        setEditCount(result.editCount);
        toast(result.message, 'success');
      } else {
        const result = await mutations.register(payload);
        setSavedMessageId(result.messageId);
      }
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setPending(false);
    }
  }

  if (savedMessageId) {
    return (
      <FormShell title="สมัครเป็นตำรวจ" subtitle="MHNK Police Department">
        <div className="panel space-y-4 p-6 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-bold text-success">สมัครสำเร็จ!</h2>
          <p className="text-sm text-ink-dim">ข้อมูลถูกส่งไปยังทีมงานแล้ว</p>

          <div className="rounded-md border border-accent/20 bg-accent/5 p-3 text-left">
            <p className="mb-2 text-xs text-ink-dim">Message ID (เก็บไว้สำหรับแก้ไขภายหลัง)</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-black/30 px-2 py-1.5 text-xs text-accent">
                {savedMessageId}
              </code>
              <CopyButton value={savedMessageId} label="คัดลอก Message ID" />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSavedMessageId(null);
                setForm(EMPTY);
              }}
              className="flex-1 cursor-pointer rounded-sm bg-white/10 py-2.5 text-sm font-semibold text-ink-dim transition hover:bg-white/15"
            >
              สมัครใหม่
            </button>
            <button
              type="button"
              onClick={() => {
                setMessageId(savedMessageId);
                setEditMode(true);
                setSavedMessageId(null);
              }}
              className="flex-1 cursor-pointer rounded-sm bg-accent py-2.5 text-sm font-semibold text-night transition hover:bg-accent-dark"
            >
              แก้ไขข้อมูล
            </button>
          </div>
        </div>
      </FormShell>
    );
  }

  return (
    <FormShell title="สมัครเป็นตำรวจ" subtitle="MHNK Police Department">
      <form onSubmit={submit} className="panel space-y-4 p-5">
        <DiscordConnect auth={auth} />

        {auth.failed && <ErrorList errors={['เชื่อมต่อ Discord ล้มเหลว กรุณาลองใหม่อีกครั้ง']} />}

        <div className="flex items-center justify-between gap-2 border-y border-white/5 py-2.5">
          <span className="text-xs text-ink-dim">
            {editMode ? 'กำลังแก้ไขใบสมัครเดิม' : 'สมัครใหม่'}
          </span>
          <button
            type="button"
            onClick={() => {
              setEditMode((v) => !v);
              setErrors([]);
            }}
            className="cursor-pointer rounded border border-accent/30 px-2.5 py-1 text-xs font-semibold text-accent transition hover:bg-accent/10"
          >
            {editMode ? 'ยกเลิกการแก้ไข' : '✏️ แก้ไขใบสมัคร'}
          </button>
        </div>

        {editMode && (
          <Field
            label="Message ID"
            hint="เปิด Discord → คลิกขวาที่ embed → Copy Message ID แล้วนำมาวาง"
          >
            <div className="flex gap-2">
              <TextInput
                value={messageId}
                onChange={(e) => setMessageId(e.target.value)}
                placeholder="วาง Message ID ที่คัดลอกจาก Discord"
              />
              <button
                type="button"
                onClick={loadExisting}
                disabled={fetching}
                className="shrink-0 cursor-pointer rounded-sm border border-accent/30 bg-accent/10 px-3 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
              >
                {fetching ? '...' : 'โหลด'}
              </button>
            </div>
          </Field>
        )}

        <Field label="ชื่อเล่น IC" required>
          <TextInput value={form.ocName} onChange={set('ocName')} maxLength={50} required />
        </Field>

        <Field label="ชื่อ IC / ชื่อตามบัตรประชาชน" required>
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              value={form.icFirstName}
              onChange={set('icFirstName')}
              placeholder="First Name"
              maxLength={50}
              required
            />
            <TextInput
              value={form.icLastName}
              onChange={set('icLastName')}
              placeholder="Last Name"
              maxLength={50}
              required
            />
          </div>
        </Field>

        <Field label="อายุ OC" required>
          <TextInput
            type="number"
            value={form.ocAge}
            onChange={set('ocAge')}
            min={1}
            max={120}
            required
          />
        </Field>

        <Field label="เบอร์ IC" required>
          <TextInput
            value={form.icPhone}
            onChange={set('icPhone')}
            placeholder="เช่น 123-456-7890"
            maxLength={20}
            required
          />
        </Field>

        <Field label="ลิงก์ Steam" required>
          <TextInput
            type="url"
            value={form.steamUrl}
            onChange={set('steamUrl')}
            placeholder="https://steamcommunity.com/id/yourname"
            required
          />
        </Field>

        <ErrorList errors={errors} />

        <SubmitButton disabled={!auth.user} pending={pending}>
          {editMode ? 'บันทึกการแก้ไข' : 'ส่งใบสมัคร'}
        </SubmitButton>
      </form>
    </FormShell>
  );
}

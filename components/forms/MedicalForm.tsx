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
  TextArea,
  TextInput,
} from './Field';

interface FormState {
  icName: string;
  ocAge: string;
  timeStart: string;
  timeEnd: string;
  medicalExperience: string;
  joinReason: string;
}

const EMPTY: FormState = {
  icName: '',
  ocAge: '',
  timeStart: '',
  timeEnd: '',
  medicalExperience: '',
  joinReason: '',
};

export function MedicalForm() {
  const auth = useDiscordAuth('medical');
  const toast = useToast();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [savedMessageId, setSavedMessageId] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [messageId, setMessageId] = useState('');
  const [editCount, setEditCount] = useState(0);
  const [fetching, setFetching] = useState(false);

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function loadExisting() {
    if (!messageId.trim()) {
      setErrors(['กรุณาระบุ Message ID']);
      return;
    }

    setFetching(true);
    setErrors([]);

    try {
      const result = await mutations.fetchMedical(messageId.trim(), auth.user?.userId);
      setForm({
        icName: result.data.icName,
        ocAge: result.data.ocAge ? String(result.data.ocAge) : '',
        timeStart: result.data.timeStart,
        timeEnd: result.data.timeEnd,
        medicalExperience: result.data.medicalExperience,
        joinReason: result.data.joinReason,
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
      icName: form.icName,
      ocAge: Number(form.ocAge),
      timeStart: form.timeStart,
      timeEnd: form.timeEnd,
      medicalExperience: form.medicalExperience,
      joinReason: form.joinReason,
      discordId: auth.user.userId,
      discordUserId: auth.user.userId,
    };

    try {
      if (editMode) {
        const result = await mutations.editMedical({
          ...payload,
          messageId: messageId.trim(),
          editCount,
        });
        setEditCount(result.editCount);
        toast(result.message, 'success');
      } else {
        const result = await mutations.medical(payload);
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
      <FormShell title="สมัครหน่วยแพทย์" subtitle="MHNK Medical Department">
        <div className="panel space-y-4 p-6 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-bold text-success">สมัครสำเร็จ!</h2>
          <p className="text-sm text-ink-dim">ข้อมูลถูกส่งไปยังทีมงานแล้ว</p>

          <div className="rounded-md border border-danger/20 bg-danger/5 p-3 text-left">
            <p className="mb-2 text-xs text-ink-dim">Message ID (เก็บไว้สำหรับแก้ไขภายหลัง)</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-black/30 px-2 py-1.5 text-xs text-danger">
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
              className="flex-1 cursor-pointer rounded-sm bg-danger py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              แก้ไขข้อมูล
            </button>
          </div>
        </div>
      </FormShell>
    );
  }

  return (
    <FormShell title="สมัครหน่วยแพทย์" subtitle="MHNK Medical Department">
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
            className="cursor-pointer rounded border border-danger/40 px-2.5 py-1 text-xs font-semibold text-danger transition hover:bg-danger/10"
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
                className="shrink-0 cursor-pointer rounded-sm border border-danger/40 bg-danger/10 px-3 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
              >
                {fetching ? '...' : 'โหลด'}
              </button>
            </div>
          </Field>
        )}

        <Field label="ชื่อ - นามสกุล (IC/ตามบัตร)" required>
          <TextInput value={form.icName} onChange={set('icName')} maxLength={100} required />
        </Field>

        <Field label="อายุ (OC)" required>
          <TextInput
            type="number"
            value={form.ocAge}
            onChange={set('ocAge')}
            min={1}
            max={120}
            required
          />
        </Field>

        <Field label="เวลาที่สามารถปฏิบัติหน้าที่ได้" required>
          <div className="flex items-center gap-2">
            <TextInput type="time" value={form.timeStart} onChange={set('timeStart')} required />
            <span className="text-ink-dim">-</span>
            <TextInput type="time" value={form.timeEnd} onChange={set('timeEnd')} required />
          </div>
        </Field>

        <Field label="ประสบการณ์ด้านสายแพทย์" required>
          <TextArea
            value={form.medicalExperience}
            onChange={set('medicalExperience')}
            maxLength={1000}
            required
          />
        </Field>

        <Field label="เหตุผลที่ต้องการเข้าร่วมหน่วยแพทย์" required>
          <TextArea
            value={form.joinReason}
            onChange={set('joinReason')}
            maxLength={1000}
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

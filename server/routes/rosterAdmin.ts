import { Elysia, t } from 'elysia';
import {
  EXIT_REASONS,
  getNamePDMembers,
  getOutDCMembers,
  moveToOutDC,
  sendExitWebhook,
  updateStatus,
  type ExitReason,
} from '@/server/services/roster';
import {
  approvePending,
  getPendingRegistrations,
  rejectPending,
} from '@/server/services/pending';
import { sendProctorRecord } from '@/server/services/discord';
import { ApiError, requirePin } from '@/server/errors';

const pinOnly = t.Object({ pin: t.String() });
const rowParam = t.Object({ row: t.Numeric() });

function assertReason(reason: string): ExitReason {
  if (!EXIT_REASONS.includes(reason as ExitReason)) {
    throw new ApiError('Invalid reason', 400);
  }
  return reason as ExitReason;
}

export const rosterAdminRoutes = new Elysia({ name: 'roster-admin' })
  /* ---------- pending registrations ---------- */

  .post(
    '/pending',
    async ({ body }) => {
      requirePin(body);
      return { success: true, data: await getPendingRegistrations() };
    },
    { body: pinOnly }
  )

  .post(
    '/pending/approve/:row',
    async ({ params, body }) => {
      requirePin(body);
      if (params.row < 1) throw new ApiError('ระบุหมายเลขแถวไม่ถูกต้อง', 400);
      if (!body.proctorDiscordId) {
        throw new ApiError('กรุณาเชื่อมต่อ Discord (Proctor) ก่อนอนุมัติ', 400);
      }

      const applicant = (await getPendingRegistrations()).find((r) => r._row === params.row);
      await approvePending(params.row);

      // Notifying the proctor is best-effort; approval already succeeded.
      if (applicant) {
        void sendProctorRecord(
          { id: body.proctorDiscordId, name: body.proctorDiscordName },
          {
            icName: String(applicant['ชื่อ IC'] ?? ''),
            discordId: String(applicant['Discord ID'] ?? ''),
          }
        ).catch((err) => console.error('[pending] proctor webhook failed:', err.message));
      }

      return { success: true, message: 'อนุมัติเรียบร้อย' };
    },
    {
      params: rowParam,
      body: t.Object({
        pin: t.String(),
        proctorDiscordId: t.Optional(t.String()),
        proctorDiscordName: t.Optional(t.String()),
      }),
    }
  )

  .post(
    '/pending/reject/:row',
    async ({ params, body }) => {
      requirePin(body);
      if (params.row < 1) throw new ApiError('ระบุหมายเลขแถวไม่ถูกต้อง', 400);

      await rejectPending(params.row);
      return { success: true, message: 'ปฏิเสธเรียบร้อย' };
    },
    { params: rowParam, body: pinOnly }
  )

  /* ---------- roster ---------- */

  .post(
    '/roster/namepd',
    async ({ body }) => {
      requirePin(body);
      return { success: true, data: await getNamePDMembers() };
    },
    { body: pinOnly }
  )

  .post(
    '/roster/outdc',
    async ({ body }) => {
      requirePin(body);
      return { success: true, data: await getOutDCMembers() };
    },
    { body: pinOnly }
  )

  .put(
    '/roster/status/:row',
    async ({ params, body }) => {
      requirePin(body);
      // An empty status clears the field back to "normal".
      if (body.status !== '') assertReason(body.status);

      await updateStatus(params.row, body.status);
      const display = body.status || '✅ ปกติ';
      return { success: true, message: `อัปเดตสถานะเป็น "${display}" แล้ว` };
    },
    { params: rowParam, body: t.Object({ pin: t.String(), status: t.String() }) }
  )

  .post(
    '/roster/move-out/:row',
    async ({ params, body }) => {
      requirePin(body);
      const reason = assertReason(body.reason);

      const result = await moveToOutDC(params.row, reason);

      const warnings: string[] = [];
      if (reason === 'ถูกปลดออก' || reason === 'ติดต่อขอออก') {
        const discordId = result.discordId?.replace(/[<@>]/g, '') ?? '';
        if (discordId) {
          const sent = await sendExitWebhook(reason, discordId);
          if (!sent.success) warnings.push(`WebHook: ${sent.error}`);
        }
      }

      const suffix = warnings.length > 0 ? ` (⚠️ ${warnings.join('; ')})` : '';

      return {
        success: true,
        message: `ย้าย ${result.code} ${result.name} ออกแล้ว${suffix}`,
        data: result,
        warnings,
      };
    },
    { params: rowParam, body: t.Object({ pin: t.String(), reason: t.String() }) }
  );

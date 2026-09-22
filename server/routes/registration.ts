import { Elysia, t } from 'elysia';
import {
  editMedical,
  editRegistration,
  fetchMedical,
  fetchRegistration,
  sendMedical,
  sendRegistration,
} from '@/server/services/discord';
import { addPendingRegistration, updatePendingRegistration } from '@/server/services/pending';
import { ApiError } from '@/server/errors';

/* Elysia validates shape; these check the business rules the v2 controller
   enforced and return every problem at once, as the forms expect. */

function validatePolice(data: {
  ocName: string;
  icName: string;
  ocAge: number;
  icPhone: string;
  discordId: string;
  steamUrl: string;
}): string[] {
  const errors: string[] = [];

  if (!data.ocName.trim()) errors.push('กรุณากรอกชื่อ OC');
  if (!data.icName.trim()) errors.push('กรุณากรอกชื่อ IC');
  if (!data.ocAge || data.ocAge < 1 || data.ocAge > 120) {
    errors.push('กรุณากรอกอายุ OC ที่ถูกต้อง (1-120)');
  }
  if (!data.icPhone.trim()) errors.push('กรุณากรอกเบอร์ IC');
  if (!data.discordId.trim()) errors.push('กรุณากรอก Discord ID');

  if (!data.steamUrl.trim()) {
    errors.push('กรุณากรอกลิงก์ Steam');
  } else {
    try {
      new URL(data.steamUrl);
    } catch {
      errors.push('กรุณากรอกลิงก์ Steam ที่ถูกต้อง');
    }
  }

  return errors;
}

function validateMedical(data: {
  icName: string;
  ocAge: number;
  timeStart: string;
  timeEnd: string;
  medicalExperience: string;
  joinReason: string;
  discordId: string;
}): string[] {
  const errors: string[] = [];

  if (!data.icName.trim()) errors.push('กรุณากรอกชื่อ - นามสกุล (IC/ตามบัตร)');
  if (!data.ocAge || data.ocAge < 1 || data.ocAge > 120) {
    errors.push('กรุณากรอกอายุ (OC) ที่ถูกต้อง (1-120)');
  }
  if (!data.timeStart.trim()) errors.push('กรุณาระบุเวลาเริ่มปฏิบัติหน้าที่');
  if (!data.timeEnd.trim()) errors.push('กรุณาระบุเวลาสิ้นสุดปฏิบัติหน้าที่');
  if (!data.medicalExperience.trim()) errors.push('กรุณาระบุประสบการณ์ด้านสายแพทย์');
  if (!data.joinReason.trim()) errors.push('กรุณาระบุเหตุผลที่ต้องการเข้าร่วมหน่วยแพทย์');
  if (!data.discordId.trim()) errors.push('กรุณากรอก Discord ID');

  return errors;
}

function reject(errors: string[]): never {
  throw new ApiError(errors.join(' • '), 400);
}

const policeBody = t.Object({
  ocName: t.String(),
  icName: t.String(),
  ocAge: t.Numeric(),
  icPhone: t.String(),
  discordId: t.String(),
  discordUserId: t.Optional(t.String()),
  discordDisplayName: t.Optional(t.String()),
  steamUrl: t.String(),
});

const medicalBody = t.Object({
  icName: t.String(),
  ocAge: t.Numeric(),
  timeStart: t.String(),
  timeEnd: t.String(),
  medicalExperience: t.String(),
  joinReason: t.String(),
  discordId: t.String(),
  discordUserId: t.Optional(t.String()),
});

export const registrationRoutes = new Elysia({ name: 'registration' })
  /* ---------- police ---------- */

  .post(
    '/register',
    async ({ body }) => {
      const errors = validatePolice(body);
      if (errors.length) reject(errors);

      const data = {
        ocName: body.ocName.trim(),
        icName: body.icName.trim(),
        ocAge: body.ocAge,
        icPhone: body.icPhone.trim(),
        discordId: body.discordId.trim(),
        steamUrl: body.steamUrl.trim(),
      };

      const messageId = await sendRegistration(data);

      // The sheet copy is a convenience for reviewers; Discord is the record
      // of truth, so a sheet failure must not fail the registration.
      try {
        await addPendingRegistration({
          discordId: data.discordId,
          discordName: body.discordDisplayName || data.ocName,
          icName: data.icName,
          icPhone: data.icPhone,
          ocAge: data.ocAge,
          steamUrl: data.steamUrl,
        });
      } catch (err) {
        console.error('[register] pending sheet write failed:', (err as Error).message);
      }

      return {
        success: true,
        message: 'สมัครสำเร็จ! ข้อมูลถูกส่งไปยังทีมงานแล้ว',
        messageId,
      };
    },
    { body: policeBody }
  )

  .patch(
    '/register/edit',
    async ({ body }) => {
      if (!body.messageId) throw new ApiError('กรุณาระบุ Message ID', 400);
      if (!body.discordId) throw new ApiError('กรุณาเชื่อมต่อ Discord ก่อนแก้ไขข้อมูล', 400);

      const errors = validatePolice(body);
      if (errors.length) reject(errors);

      const editCount = (body.editCount ?? 0) + 1;

      await editRegistration(
        body.messageId,
        {
          ocName: body.ocName.trim(),
          icName: body.icName.trim(),
          ocAge: body.ocAge,
          icPhone: body.icPhone.trim(),
          discordId: body.discordId.trim(),
          steamUrl: body.steamUrl.trim(),
        },
        editCount,
        body.discordUserId
      );

      try {
        await updatePendingRegistration(body.discordId.trim(), {
          icName: body.icName.trim(),
          icPhone: body.icPhone.trim(),
          ocAge: body.ocAge,
          steamUrl: body.steamUrl.trim(),
        });
      } catch (err) {
        console.error('[register] pending sheet update failed:', (err as Error).message);
      }

      return { success: true, message: 'แก้ไขข้อมูลสำเร็จ! Embed ใน Discord อัปเดตแล้ว', editCount };
    },
    {
      body: t.Composite([
        policeBody,
        t.Object({ messageId: t.String(), editCount: t.Optional(t.Numeric()) }),
      ]),
    }
  )

  .get(
    '/register/fetch/:messageId',
    async ({ params, query }) => {
      const result = await fetchRegistration(params.messageId, query.discordUserId);
      return { success: true, ...result };
    },
    {
      params: t.Object({ messageId: t.String() }),
      query: t.Object({ discordUserId: t.Optional(t.String()) }),
    }
  )

  /* ---------- medical ---------- */

  .post(
    '/medical',
    async ({ body }) => {
      const errors = validateMedical(body);
      if (errors.length) reject(errors);

      const messageId = await sendMedical({
        icName: body.icName.trim(),
        ocAge: body.ocAge,
        timeStart: body.timeStart.trim(),
        timeEnd: body.timeEnd.trim(),
        medicalExperience: body.medicalExperience.trim(),
        joinReason: body.joinReason.trim(),
        discordId: body.discordId.trim(),
      });

      return {
        success: true,
        message: 'สมัครสำเร็จ! ข้อมูลถูกส่งไปยังทีมงานแล้ว',
        messageId,
      };
    },
    { body: medicalBody }
  )

  .patch(
    '/medical/edit',
    async ({ body }) => {
      if (!body.messageId) throw new ApiError('กรุณาระบุ Message ID', 400);
      if (!body.discordId) throw new ApiError('กรุณาเชื่อมต่อ Discord ก่อนแก้ไขข้อมูล', 400);

      const errors = validateMedical(body);
      if (errors.length) reject(errors);

      const editCount = (body.editCount ?? 0) + 1;

      await editMedical(
        body.messageId,
        {
          icName: body.icName.trim(),
          ocAge: body.ocAge,
          timeStart: body.timeStart.trim(),
          timeEnd: body.timeEnd.trim(),
          medicalExperience: body.medicalExperience.trim(),
          joinReason: body.joinReason.trim(),
          discordId: body.discordId.trim(),
        },
        editCount,
        body.discordUserId
      );

      return { success: true, message: 'แก้ไขข้อมูลสำเร็จ! Embed ใน Discord อัปเดตแล้ว', editCount };
    },
    {
      body: t.Composite([
        medicalBody,
        t.Object({ messageId: t.String(), editCount: t.Optional(t.Numeric()) }),
      ]),
    }
  )

  .get(
    '/medical/fetch/:messageId',
    async ({ params, query }) => {
      const result = await fetchMedical(params.messageId, query.discordUserId);
      return { success: true, ...result };
    },
    {
      params: t.Object({ messageId: t.String() }),
      query: t.Object({ discordUserId: t.Optional(t.String()) }),
    }
  );

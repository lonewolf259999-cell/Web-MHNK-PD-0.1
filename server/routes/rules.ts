import { Elysia, t } from 'elysia';
import { addRule, deleteRule, getCases, getRulesData, updateRule } from '@/server/services/sheets';
import { ApiError, requirePin } from '@/server/errors';
import type { RulesType } from '@/lib/types';

const WRITE_TYPES = ['conduct', 'rules', 'fines'] as const;

function assertWritable(type: string): RulesType {
  if (!WRITE_TYPES.includes(type as RulesType)) {
    throw new ApiError('Invalid type. Must be: conduct, rules, or fines', 400);
  }
  return type as RulesType;
}

/** Payload shared by add/update — only `id` is structurally required. */
const rulePayload = t.Object({
  pin: t.String(),
  id: t.Optional(t.String()),
  title: t.Optional(t.String()),
  category: t.Optional(t.String()),
  text: t.Optional(t.String()),
  amount: t.Optional(t.String()),
  time: t.Optional(t.String()),
});

function toRow(body: Record<string, unknown>, id: string): Record<string, string> {
  const pick = (key: string) => (body[key] === undefined ? '' : String(body[key]));
  return {
    id,
    title: pick('title'),
    category: pick('category'),
    text: pick('text'),
    amount: pick('amount'),
    time: pick('time'),
  };
}

export const rulesRoutes = new Elysia({ name: 'rules' })
  .get(
    '/rules-data/:type',
    ({ params }) => {
      if (params.type === 'cases') return getCases();
      if (!WRITE_TYPES.includes(params.type as RulesType)) {
        throw new ApiError('Invalid type. Must be: conduct, rules, fines, or cases', 400);
      }
      return getRulesData(params.type as RulesType);
    },
    { params: t.Object({ type: t.String() }) }
  )

  .post(
    '/rules-data/:type',
    async ({ params, body }) => {
      requirePin(body);
      const type = assertWritable(params.type);
      if (!body.id) throw new ApiError('Missing required field: id', 400);

      const result = await addRule(type, toRow(body, body.id));
      return { success: true as const, message: 'เพิ่มข้อมูลสำเร็จ', data: result };
    },
    { params: t.Object({ type: t.String() }), body: rulePayload }
  )

  .put(
    '/rules-data/:type/:id',
    async ({ params, body }) => {
      requirePin(body);
      const type = assertWritable(params.type);

      const result = await updateRule(type, params.id, toRow(body, params.id));
      return { success: true as const, message: 'แก้ไขข้อมูลสำเร็จ', data: result };
    },
    { params: t.Object({ type: t.String(), id: t.String() }), body: rulePayload }
  )

  .delete(
    '/rules-data/:type/:id',
    async ({ params, body }) => {
      requirePin(body);
      const type = assertWritable(params.type);

      const result = await deleteRule(type, params.id);
      return { success: true as const, message: 'ลบข้อมูลสำเร็จ', data: result };
    },
    {
      params: t.Object({ type: t.String(), id: t.String() }),
      body: t.Object({ pin: t.String() }),
    }
  );

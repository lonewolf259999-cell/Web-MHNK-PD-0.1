import { deleteRule, updateRule } from '@/lib/server/sheets';
import { ApiError, handle, okWrite, readJson, requirePin } from '@/lib/server/http';
import type { RulesType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const WRITE_TYPES = ['conduct', 'rules', 'fines'] as const;

type Params = { params: Promise<{ type: string; id: string }> };

function assertWritable(type: string): asserts type is RulesType {
  if (!WRITE_TYPES.includes(type as (typeof WRITE_TYPES)[number])) {
    throw new ApiError('Invalid type. Must be: conduct, rules, or fines', 400);
  }
}

export function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const { type, id } = await params;
    assertWritable(type);

    const body = await readJson<Record<string, string>>(request);
    requirePin(body);

    const result = await updateRule(type, id, { ...body, id });
    return okWrite('แก้ไขข้อมูลสำเร็จ', result);
  });
}

export function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const { type, id } = await params;
    assertWritable(type);

    const body = await readJson<Record<string, string>>(request);
    requirePin(body);

    const result = await deleteRule(type, id);
    return okWrite('ลบข้อมูลสำเร็จ', result);
  });
}

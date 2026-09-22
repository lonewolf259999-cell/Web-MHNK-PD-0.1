import { addRule, getCases, getRulesData } from '@/lib/server/sheets';
import { ApiError, handle, ok, okWrite, readJson, requirePin } from '@/lib/server/http';
import type { RulesType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const READ_TYPES = ['conduct', 'rules', 'fines', 'cases'] as const;
const WRITE_TYPES = ['conduct', 'rules', 'fines'] as const;

type Params = { params: Promise<{ type: string }> };

export function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const { type } = await params;
    if (!READ_TYPES.includes(type as (typeof READ_TYPES)[number])) {
      throw new ApiError('Invalid type. Must be: conduct, rules, fines, or cases', 400);
    }

    if (type === 'cases') return ok(await getCases());
    return ok(await getRulesData(type as RulesType));
  });
}

export function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { type } = await params;
    if (!WRITE_TYPES.includes(type as (typeof WRITE_TYPES)[number])) {
      throw new ApiError('Invalid type. Must be: conduct, rules, or fines', 400);
    }

    const body = await readJson<Record<string, string>>(request);
    requirePin(body);

    if (!body.id) throw new ApiError('Missing required field: id', 400);

    const result = await addRule(type as RulesType, body);
    return okWrite('เพิ่มข้อมูลสำเร็จ', result);
  });
}

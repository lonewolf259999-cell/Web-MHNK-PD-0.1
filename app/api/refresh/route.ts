import { refreshAll } from '@/lib/server/sheets';
import { handle, okWrite, readJson, requirePin } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handle(async () => {
    requirePin(await readJson(request));
    const officers = await refreshAll();
    return okWrite(`รีเฟรชข้อมูลสำเร็จ (${officers.length} นาย)`, { count: officers.length });
  });
}

import { getWeekData } from '@/lib/server/sheets';
import { ApiError, handle, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handle(async () => {
    const name = new URL(request.url).searchParams.get('name');
    if (!name) throw new ApiError('Missing week name', 400);
    return ok(await getWeekData(name));
  });
}

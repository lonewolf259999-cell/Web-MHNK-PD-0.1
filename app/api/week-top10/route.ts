import { getLatestWeekTop10 } from '@/lib/server/sheets';
import { handle, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return handle(async () => ok(await getLatestWeekTop10()));
}

import scheduleConfig from '@/data/schedule.json';
import { ok } from '@/lib/server/http';

export function GET() {
  return ok(scheduleConfig);
}

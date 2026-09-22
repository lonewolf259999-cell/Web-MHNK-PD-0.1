import { Elysia } from 'elysia';
import { ApiError } from './errors';
import { rosterRoutes } from './routes/roster';
import { rulesRoutes } from './routes/rules';
import { adminRoutes } from './routes/admin';
import { poiRoutes } from './routes/poi';

/**
 * The API, mounted into Next.js at app/api/[[...slugs]]/route.ts.
 *
 * Elysia runs here through `.handle(request)` rather than `.listen()`, so it
 * needs no Bun runtime — both Elysia and Next route handlers speak the
 * standard Request/Response pair.
 */
export const api = new Elysia({ prefix: '/api' })
  .onError(({ error, code, set }) => {
    if (error instanceof ApiError) {
      set.status = error.status;
      return { error: error.message };
    }

    if (code === 'VALIDATION') {
      set.status = 400;
      return { error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'ไม่พบ endpoint ที่ร้องขอ' };
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[api]', message);
    set.status = 500;
    return { error: message };
  })
  .use(rosterRoutes)
  .use(rulesRoutes)
  .use(adminRoutes)
  .use(poiRoutes);

/** Consumed by Eden Treaty on the client for end-to-end types. */
export type Api = typeof api;

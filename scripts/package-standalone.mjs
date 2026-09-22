/**
 * Assembles .next/standalone into a complete, uploadable app.
 *
 * `next build` with output:'standalone' emits the server and its traced
 * dependencies, but deliberately leaves out .next/static and public/ —
 * on Vercel those are served by the CDN. A self-hosted copy needs them
 * beside the server, and omitting them yields a running site with no CSS
 * and no images, which looks like a code bug rather than a packaging one.
 *
 * Run after `npm run build`:  npm run package
 */

import { cp, rm, access, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, '.next', 'standalone');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(OUT))) {
  console.error('✗ .next/standalone not found — run `npm run build` first.');
  console.error('  (next.config.mjs must keep output: "standalone")');
  process.exit(1);
}

await cp(join(ROOT, '.next', 'static'), join(OUT, '.next', 'static'), { recursive: true });
console.log('✓ .next/static  → standalone/.next/static');

await cp(join(ROOT, 'public'), join(OUT, 'public'), { recursive: true });
console.log('✓ public/       → standalone/public');

/* next build copies the local .env into the bundle, secrets and all. That is
   convenient for a VPS and dangerous anywhere shared, so it is removed here
   and the host's own environment settings are used instead. */
const bundledEnv = join(OUT, '.env');
if (await exists(bundledEnv)) {
  await rm(bundledEnv);
  console.log('✓ removed bundled .env — set the variables on the host instead');
}

await writeFile(
  join(OUT, 'README-DEPLOY.txt'),
  [
    'Upload the entire contents of this folder to the host.',
    '',
    'Startup file : server.js',
    'Start command: node server.js',
    'Node version : 20.x or newer',
    '',
    'No npm install and no build are needed — dependencies are bundled.',
    '',
    'Set these environment variables on the host (see .env.vercel.local):',
    '  SHEET_ID, CASES_SHEET_ID, RULES_SHEET_ID, ADMIN_PIN, GOOGLE_JSON_KEY,',
    '  APP_URL, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,',
    '  DISCORD_REGISTER_WEBHOOK_URL, DISCORD_MEDICAL_WEBHOOK_URL,',
    '  DISCORD_PROCTOR_WEBHOOK_URL, DISCORD_OUTPD_WEBHOOK_URL',
    '',
    'APP_URL must equal the host actually serving the site, and',
    'APP_URL + /auth/discord/callback must be registered in the',
    'Discord Developer Portal, or login cannot return.',
    '',
  ].join('\n'),
  'utf8'
);
console.log('✓ wrote README-DEPLOY.txt');

const entries = await readdir(OUT);
console.log(`\nReady: .next/standalone (${entries.length} entries) — upload its contents.`);

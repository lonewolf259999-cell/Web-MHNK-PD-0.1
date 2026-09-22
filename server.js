/**
 * Custom server for hosts that require a startup file (DirectAdmin /
 * cPanel Node.js Selector, which run the app under Phusion Passenger).
 *
 * Vercel does NOT use this file — it runs `next build` and serves the app
 * itself. This exists only for panel-based Node hosting, where the control
 * panel needs a single entry point it can launch.
 *
 * Requires `npm run build` to have produced .next/ first; Next refuses to
 * start in production without it.
 */

const { createServer } = require('node:http');
const next = require('next');

// Passenger supplies the port (and may hand over a Unix socket path).
const port = process.env.PORT || 3000;
const hostname = process.env.HOSTNAME || '0.0.0.0';

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      handle(req, res).catch((err) => {
        console.error('[server] request failed:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      });
    }).listen(port, () => {
      console.log(`> ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error('[server] failed to start:', err);
    process.exit(1);
  });

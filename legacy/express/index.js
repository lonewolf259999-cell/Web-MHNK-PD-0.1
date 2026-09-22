/* ========================================
   MHNK Police Department v2.0
   Local dev entrypoint (node server/index.js)
   Vercel deployments use api/index.js instead,
   which imports the same app from ./app.js
   ======================================== */

const config = require('./config');
const { createLogger } = require('./utils/logger');
const app = require('./app');

const logger = createLogger('Server');

app.listen(config.PORT, () => {
    logger.info(`Server running at http://localhost:${config.PORT}`);
    logger.info('API Endpoints: /api/officers, /api/weeks, /api/week-data, /api/rules, /api/conduct, /api/fines, /api/schedule-config, /api/register');
    logger.info('Security: Helmet headers, Rate limiting, Body size limit');
    logger.info('Features: Gzip/Brotli compression, Browser cache with ETag, Centralized error handling');
});

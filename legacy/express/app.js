/* ========================================
   MHNK Police Department v2.0
   API Gateway - Express App (no listener)
   Shared by local dev (server/index.js) and
   the Vercel serverless entry (api/index.js)
   ======================================== */

// Load config first (triggers dotenv + validation)
const config = require('./config');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createLogger } = require('./utils/logger');

const routes = require('./routes');
const { getSheets } = require('./config/googleAuth');
const { errorHandler } = require('./middleware/errorHandler');
const { preWarmCache } = require('./services/sheetsService');

const logger = createLogger('Server');
const app = express();

// trust proxy - รองรับ X-Forwarded-For เมื่อรันหลัง Reverse Proxy (Render/Vercel)
app.set('trust proxy', 1);

// ==================== SECURITY MIDDLEWARE (Helmet) ====================
app.use(helmet({
    contentSecurityPolicy: false, // ปิดเพราะใช้ inline styles จาก CSS framework
    crossOriginEmbedderPolicy: false // ปิดเพราะโหลด resource จาก CDN (fonts, Discord)
}));

// ==================== RATE LIMITING ====================
// Global limiter (ทั่วไป)
const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 นาที
    max: 300,            // สูงสุด 300 request/นาที
    standardHeaders: true,
    legacyHeaders: false,
    // skip map tiles from rate limit
    skip: (req) => req.path.startsWith('/map-module/map-styles'),
    message: { success: false, error: 'มีการใช้งานมากเกินไป กรุณาลองใหม่ใน 1 นาที' }
});

// Submit limiter (สำหรับฟอร์ม)
const submitLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 นาที
    max: 10,             // สูงสุด 10 ครั้ง/นาที
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'ส่งข้อมูลถี่เกินไป กรุณารอสักครู่' }
});

// Auth limiter (สำหรับ login)
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 นาที
    max: 5,              // สูงสุด 5 ครั้ง/นาที
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'เชื่อมต่อ Discord ถี่เกินไป กรุณารอ 1 นาที' }
});

// ==================== MIDDLEWARE ====================
app.use(compression({
    threshold: config.COMPRESSION_THRESHOLD,
    level: config.COMPRESSION_LEVEL,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));
app.use(cors());
app.use(express.json({ limit: '6mb' })); // จำกัดขนาด body (เผื่อรูป 5MB + JSON)

// ใช้ global limiter กับทุก request
app.use(globalLimiter);

// ใช้ specific limiter กับบาง route
app.use('/api/register', submitLimiter);
app.use('/auth/discord', authLimiter);

// ==================== API ROUTES ====================
app.use(routes);

// ==================== MAP MODULE (optional) ====================
try {
  const createPoiRoutes = require('../map-module/server/poi-routes');
  app.use('/api/poi', createPoiRoutes(() => getSheets()));
  logger.info('[MapModule] POI API mounted at /api/poi');
} catch (e) {
  logger.warn('[MapModule] POI API not loaded: ' + e.message);
}

// ==================== STATIC FILES ====================
// Everything under /public (including public/src and public/map-module) is
// also served directly by Vercel's CDN in production; this express.static
// mount covers local dev (npm run dev) and any request that reaches the
// serverless function anyway.
const staticOptions = {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.gif') || filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.webp')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        }
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
};

app.use(express.static(path.join(__dirname, '..', 'public'), staticOptions));

// Fallback for SPA routing
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'profile.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'register.html'));
});

app.get('/proctor', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'proctor.html'));
});

// ==================== MAP MODULE ROUTE (optional) ====================
try {
  app.get('/MapMhnkPD', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'map-module', 'map.html'));
  });
  logger.info('[MapModule] /MapMhnkPD route registered');
} catch (e) {
  // map-module not present
}

// ==================== CHALLENGE GAME ROUTE ====================
try {
  app.get('/Challenge', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'map-module', 'Challenge', 'game.html'));
  });
  logger.info('[MapModule] /Challenge route registered');
} catch (e) {
  // challenge module not present
}

// ==================== ERROR HANDLER (must be last) ====================
app.use(errorHandler);

// Pre-warm cache on cold start (both local `node server/index.js` and a
// fresh Vercel serverless container evaluate this module once)
preWarmCache();

module.exports = app;

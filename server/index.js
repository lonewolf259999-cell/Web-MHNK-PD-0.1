/* ========================================
   MHNK Police Department v2.0
   API Gateway Server (Modular)
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
const { errorHandler } = require('./middleware/errorHandler');
const { preWarmCache } = require('./services/sheetsService');

const logger = createLogger('Server');
const app = express();

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
    message: { error: 'มีการใช้งานมากเกินไป กรุณาลองใหม่ใน 1 นาที' }
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
app.use('/api/proctor/submit', submitLimiter);
app.use('/api/register', submitLimiter);
app.use('/auth/discord', authLimiter);

// ==================== API ROUTES ====================
app.use(routes);

// ==================== STATIC FILES ====================
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
app.use('/src', express.static(path.join(__dirname, '..', 'src'), staticOptions));

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

// ==================== ERROR HANDLER (must be last) ====================
app.use(errorHandler);

// ==================== START SERVER ====================
app.listen(config.PORT, () => {
    logger.info(`Server running at http://localhost:${config.PORT}`);
    logger.info('API Endpoints: /api/officers, /api/weeks, /api/week-data, /api/rules, /api/conduct, /api/fines, /api/schedule-config, /api/register');
    logger.info('Security: Helmet headers, Rate limiting, Body size limit');
    logger.info('Features: Gzip/Brotli compression, Browser cache with ETag, Centralized error handling');

    // Pre-warm cache on startup
    preWarmCache();
});
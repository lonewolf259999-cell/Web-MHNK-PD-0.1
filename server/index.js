/* ========================================
   MHNK Police Department v2.0
   API Gateway Server (Modular)
   ======================================== */

// Load config first (triggers dotenv + validation)
const config = require('./config');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { createLogger } = require('./utils/logger');

const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { preWarmCache } = require('./services/sheetsService');

const logger = createLogger('Server');
const app = express();

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
app.use(express.json());

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
app.use('/data', express.static(path.join(__dirname, '..', 'data'), staticOptions));

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
    logger.info('Features: Gzip/Brotli compression, Browser cache with ETag, Centralized error handling');

    // Pre-warm cache on startup
    preWarmCache();
});

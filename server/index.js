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

const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { preWarmCache } = require('./services/sheetsService');

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

// ==================== ERROR HANDLER (must be last) ====================
app.use(errorHandler);

// ==================== START SERVER ====================
app.listen(config.PORT, () => {
    console.log('========================================');
    console.log('  MHNK Police Department v2.0');
    console.log('  ======================================');
    console.log(`  Server running at http://localhost:${config.PORT}`);
    console.log('  API Endpoints:');
    console.log(`    GET /api/officers     - Officer list`);
    console.log(`    GET /api/weeks        - Week names`);
    console.log(`    GET /api/week-data?name=X  - Week data`);
    console.log(`    GET /api/rules        - Police rules`);
    console.log(`    GET /api/conduct      - Conduct rules`);
    console.log(`    GET /api/fines        - Fine rates`);
    console.log(`    GET /api/schedule-config - Schedule config`);
    console.log(`    POST /api/register    - Registration`);
    console.log('  Pages:');
    console.log(`    GET /register         - Registration page`);
    console.log('  Performance:');
    console.log('    ✅ Gzip/Brotli compression enabled');
    console.log('    ✅ Browser cache with ETag enabled');
    console.log('    ✅ Centralized error handling');
    console.log('    ✅ Modular architecture');
    console.log('========================================');

    // Pre-warm cache on startup
    preWarmCache();
});
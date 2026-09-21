/* ========================================
   Middleware - Centralized Error Handler
   ======================================== */

const { createLogger } = require('../utils/logger');
const logger = createLogger('ErrorHandler');

/**
 * Wraps async route handlers to catch errors automatically
 * Eliminates try/catch duplication in controllers
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Centralized error handler middleware
 * Catches all errors thrown from controllers/services
 */
function errorHandler(err, req, res, _next) {
    logger.error(`${req.method} ${req.path}: ${err.message}`);

    // Determine HTTP status code
    let status = 500;
    if (err.message.includes('ไม่พบ') || err.message.includes('not found')) {
        status = 404;
    } else if (err.message.includes('PIN') || err.message.includes('ไม่ถูกต้อง')) {
        status = 401;
    } else if (err.message.includes('Missing') || err.message.includes('required')) {
        status = 400;
    }

    res.status(status).json({
        error: err.message || 'Internal Server Error'
    });
}

module.exports = { asyncHandler, errorHandler };
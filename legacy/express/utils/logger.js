/* ========================================
   Logger Utility - Centralized logging for backend
   - Log levels: ERROR, WARN, INFO, DEBUG
   - Production: only ERROR and WARN
   - Format: [LEVEL] [Module] Message
   ======================================== */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

// Determine current level based on environment
const CURRENT_LEVEL = process.env.NODE_ENV === 'production'
    ? LOG_LEVELS.WARN
    : LOG_LEVELS.DEBUG;

/**
 * Format log message with timestamp and module
 */
function formatMessage(level, module, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return `[${timestamp}] [${level}] [${module}] ${message}`;
}

/**
 * Check if level should be logged
 */
function shouldLog(level) {
    return LOG_LEVELS[level] <= CURRENT_LEVEL;
}

/**
 * Create logger instance for a module
 */
function createLogger(moduleName) {
    return {
        error(message, ...args) {
            if (shouldLog('ERROR')) {
                console.error(formatMessage('ERROR', moduleName, message), ...args);
            }
        },
        warn(message, ...args) {
            if (shouldLog('WARN')) {
                console.warn(formatMessage('WARN', moduleName, message), ...args);
            }
        },
        info(message, ...args) {
            if (shouldLog('INFO')) {
                console.log(formatMessage('INFO', moduleName, message), ...args);
            }
        },
        debug(message, ...args) {
            if (shouldLog('DEBUG')) {
                console.log(formatMessage('DEBUG', moduleName, message), ...args);
            }
        }
    };
}

module.exports = { createLogger, LOG_LEVELS };
/* ========================================
   Middleware - Cache Control Headers
   ======================================== */

/**
 * Set no-cache headers on response
 */
function setNoCache(req, res, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
}

module.exports = { setNoCache };
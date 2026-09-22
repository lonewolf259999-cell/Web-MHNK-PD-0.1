/* ========================================
   Vercel serverless entry point.
   vercel.json rewrites /api/*, /auth/* and the
   handful of clean routes (/profile, /MapMhnkPD, ...)
   to this function; Express does the real routing.
   ======================================== */

module.exports = require('../server/app');

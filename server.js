/* ========================================
   MHNK Police Department v2.0
   Legacy Entry Point
   - Redirects to modular server/index.js
   ======================================== */

console.log('🔄 Redirecting to modular server structure...');
console.log('   server.js → server/index.js');
console.log('');

// Forward to new modular entry point
require('./server/index');
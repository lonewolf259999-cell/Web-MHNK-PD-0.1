/* ========================================
   Routes - All API route definitions
   ======================================== */

const { Router } = require('express');

// Middleware
const { setNoCache } = require('../middleware/cacheHeaders');
const { verifyPin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Controllers
const officersController = require('../controllers/officersController');
const weeksController = require('../controllers/weeksController');
const adminController = require('../controllers/adminController');
const staticController = require('../controllers/staticController');
const rulesController = require('../controllers/rulesController');

const router = Router();

// ==================== Officers ====================
router.get('/api/officers', setNoCache, asyncHandler(officersController.getOfficers));
router.post('/api/refresh', asyncHandler(officersController.refreshData));

// ==================== Weeks ====================
router.get('/api/weeks', setNoCache, asyncHandler(weeksController.getWeeks));
router.get('/api/week-data', setNoCache, asyncHandler(weeksController.getWeekData));

// ==================== Admin ====================
router.post('/api/mark-paid', verifyPin, asyncHandler(adminController.markPaid));

// ==================== Static Data ====================
router.get('/api/:type(rules|conduct|fines|schedule-config)', asyncHandler(staticController.getStaticData));

// ==================== Rules/Conduct/Fines CRUD (Google Sheets) ====================
router.get('/api/rules-data/:type(conduct|rules|fines)', setNoCache, asyncHandler(rulesController.getRulesData));
router.post('/api/rules-data/:type(conduct|rules|fines)', verifyPin, asyncHandler(rulesController.addRule));
router.put('/api/rules-data/:type(conduct|rules|fines)/:id', verifyPin, asyncHandler(rulesController.updateRule));
router.delete('/api/rules-data/:type(conduct|rules|fines)/:id', verifyPin, asyncHandler(rulesController.deleteRule));

module.exports = router;
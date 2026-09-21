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
const registrationController = require('../controllers/registrationController');
const authController = require('../controllers/authController');
const pendingController = require('../controllers/pendingController');
const rosterController = require('../controllers/rosterController');

const router = Router();

// ==================== Officers ====================
router.get('/api/officers', setNoCache, asyncHandler(officersController.getOfficers));
router.post('/api/refresh', verifyPin, asyncHandler(officersController.refreshData));

// ==================== Weeks ====================
router.get('/api/weeks', setNoCache, asyncHandler(weeksController.getWeeks));
router.get('/api/week-data', setNoCache, asyncHandler(weeksController.getWeekData));
router.get('/api/week-top10', setNoCache, asyncHandler(weeksController.getWeekTop10));

// ==================== Admin ====================
router.post('/api/mark-paid', verifyPin, asyncHandler(adminController.markPaid));
// ให้ client สอบถามผลการจ่ายจริงหลัง timeout (ไม่ต้องใช้ PIN - คืนเฉพาะผลที่เคยบันทึกตาม key)
router.get('/api/mark-paid/status', asyncHandler(adminController.getPaymentStatus));

// ==================== Static Data (schedule-config only - rules/conduct/fines ใช้ /api/rules-data แทน) ====================
router.get('/api/schedule-config', asyncHandler(staticController.getStaticData));

// ==================== Rules/Conduct/Fines CRUD (Google Sheets) ====================
router.get('/api/rules-data/:type(conduct|rules|fines|cases)', setNoCache, asyncHandler(rulesController.getRulesData));
router.post('/api/rules-data/:type(conduct|rules|fines)', verifyPin, asyncHandler(rulesController.addRule));
router.put('/api/rules-data/:type(conduct|rules|fines)/:id', verifyPin, asyncHandler(rulesController.updateRule));
router.delete('/api/rules-data/:type(conduct|rules|fines)/:id', verifyPin, asyncHandler(rulesController.deleteRule));

// ==================== Registration (Police) ====================
router.post('/api/register', asyncHandler(registrationController.register));
router.patch('/api/register/edit', asyncHandler(registrationController.editRegistration));
router.get('/api/register/fetch/:messageId', asyncHandler(registrationController.fetchRegistration));

// ==================== Discord Auth ====================
router.get('/auth/discord', authController.discordLogin);
router.get('/auth/discord/callback', asyncHandler(authController.discordCallback));

// ==================== Medical Registration ====================
router.post('/api/medical', asyncHandler(registrationController.registerMedical));
router.patch('/api/medical/edit', asyncHandler(registrationController.editMedical));
router.get('/api/medical/fetch/:messageId', asyncHandler(registrationController.fetchMedical));

// ==================== Pending Registration (Admin) ====================
router.post('/api/pending', verifyPin, asyncHandler(pendingController.listPending));
router.post('/api/pending/approve/:row', verifyPin, asyncHandler(pendingController.approve));
router.post('/api/pending/reject/:row', verifyPin, asyncHandler(pendingController.reject));

// ==================== Roster Management (Admin) ====================
router.post('/api/roster/namepd', verifyPin, asyncHandler(rosterController.getNamePD));
router.post('/api/roster/outdc', verifyPin, asyncHandler(rosterController.getOutDC));
router.put('/api/roster/status/:row', verifyPin, asyncHandler(rosterController.updateStatus));
router.post('/api/roster/move-out/:row', verifyPin, asyncHandler(rosterController.moveToOutDC));

// ===== TEMP DEBUG (DELETE BEFORE COMMIT) ============================
// จุดช่วยตรวจสอบทำไม "เชื่อมต่อ Discord" ไม่ติดบนโฮสใดโฮสหนึ่ง
// ใช้แล้วให้ลบ 2 route นี้และรีสตาร์ทเซิร์ฟเวอร์ทันที — เป็นข้อมูลบนเซิร์ฟเท่านั้น ไม่เปิดเผย secret
const https = require('https');
const { URLSearchParams } = require('url');
const config = require('../config');

// 1) เซิร์ฟเวอร์มองเห็นอะไรบ้าง (ไม่พิมพ์ค่าลับ แค่ความยาว + URL)
router.get('/debug/discord-config', (req, res) => {
    res.json({
        DISCORD_CLIENT_ID_set: !!config.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET_len: (config.DISCORD_CLIENT_SECRET || '').length,
        APP_URL: config.APP_URL,
        REDIRECT_URI: `${config.APP_URL}/auth/discord/callback`
    });
});

// 2) ลองแลก code เป็น token อย่างเต็มที่แล้วคืน JSON ดวลของ Discord กลับมาดีๆ
//    วิธีใช้: เปิด /auth/discord ในเบราว์เซอร์ -> อนุญาต -> คัด code จาก URL แล้วให้มาที่นี่
//    - error:"invalid_client"  => CLIENT_SECRET ผิดบนโฮสนี้
//    - error:"invalid_grant"   => secret ถูกแต่ code เท่ากับหาย/ใช้แล้ว (ปกติไม่มี)
//    - ไม่มี error และมี access_token => การแลก token สำเร็จ (ปัญหาอยู่ฝั่งหน้าเว็บ/แคช)
router.get('/debug/discord-exchange', asyncHandler(async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).json({ error: 'ใส่พารามิเตอร์ ?code=<discord_code> มา' });
    }

    const body = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        client_secret: config.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${config.APP_URL}/auth/discord/callback`
    });

    const req2 = https.request({
        hostname: 'discord.com',
        path: '/api/oauth2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body.toString())
        }
    }, (r) => {
        let data = '';
        r.on('data', (c) => { data += c; });
        r.on('end', () => {
            let parsed;
            try { parsed = JSON.parse(data); } catch (_) {
                return res.status(502).json({ http_status: r.statusCode, raw: data.slice(0, 500) });
            }
            // ซ่อน access_token ไม่ให้โค้ม (ไม่จำเป็นให้เห็น)
            if (parsed.access_token) parsed.access_token = '[PRESENT]';
            res.json({ http_status: r.statusCode, ...parsed });
        });
    });
    req2.on('error', (e) => res.status(500).json({ error: 'request_failed', message: e.message }));
    req2.write(body.toString());
    req2.end();
}));
// เส้นทางเวลาจริงของขั้นตอนเชื่อมต่อ Discord
router.get('/debug/timeline', (req, res) => {
    res.json(require('../debug/trace').get());
});
router.get('/debug/timeline/clear', (req, res) => {
    const t = require('../debug/trace');
    t.clear();
    res.json({ cleared: true });
});
// ===== END TEMP DEBUG ================================================

module.exports = router;

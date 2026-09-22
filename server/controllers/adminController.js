/* ========================================
   Controller - Admin endpoints
   ======================================== */

const sheetsService = require('../services/sheetsService');

/**
 * In-memory store ของผลการจ่ายเงิน ตาม idempotency key (รองรับ single instance)
 * ใช้เพื่อ:
 *  1. กันการเขียนซ้ำ (double-write) เมื่อ client retry
 *  2. ให้ client สอบถามผลจริงได้เมื่อเกิด timeout (แก้กรณี "server เขียนสำเร็จ
 *     แต่ client ตัดการเชื่อมต่อก่อนได้รับคำตอบ")
 */
const paymentStore = new Map();
const PAYMENT_STORE_TTL = 10 * 60 * 1000; // 10 นาที

function setPaymentResult(key, data) {
    paymentStore.set(key, {
        ...data,
        timestamp: Date.now(),
    });
    // ลบ entry หลังหมดอายุ (กัน Memory Leak)
    setTimeout(() => {
        paymentStore.delete(key);
    }, PAYMENT_STORE_TTL);
}

async function markPaid(req, res) {
    const { weekName, officerName, idempotencyKey } = req.body;

    if (!weekName || !officerName) {
        throw new Error('Missing required fields: weekName, officerName');
    }

    // ถ้าเคยมี key นี้แล้ว -> คืนผลเดิม ไม่เขียนซ้ำ
    if (idempotencyKey && paymentStore.has(idempotencyKey)) {
        const prev = paymentStore.get(idempotencyKey);
        if (prev.status === 'processing') {
            // request แรกยังกำลังเขียนอยู่ -> บอก client ให้ถามสถานะใหม่ทีหลัง
            return res.json({ success: false, processing: true, message: 'กำลังประมวลผล' });
        }
        return res.json({ success: prev.success, message: prev.message, idempotencyKey });
    }

    // กัน double-write กรณี request ที่สองมาในขณะที่ request แรกยังค้างอยู่
    if (idempotencyKey) {
        paymentStore.set(idempotencyKey, { status: 'processing' });
    }

    try {
        const result = await sheetsService.markOfficerAsPaid(weekName, officerName);

        const payload = {
            success: true,
            message: `อัปเดตแถวที่ ${result.rowIndex} สำเร็จ`,
        };

        if (idempotencyKey) {
            setPaymentResult(idempotencyKey, payload);
            payload.idempotencyKey = idempotencyKey;
        }

        res.json(payload);
    } catch (err) {
        // การเขียนล้มเหลว -> ลบ idempotency key เพื่อให้ retry ทำใหม่ได้
        // (ไม่ค้างสถานะ 'processing' ที่จะทำให้ retry ติด "ไม่ทราบผล" ตลอด)
        if (idempotencyKey) paymentStore.delete(idempotencyKey);
        throw err; // ปล่อยให้ errorHandler ส่งข้อความจริงกลับ client
    }
}

/**
 * ให้ client สอบถามผลการจ่ายจริงตาม idempotency key
 * (ใช้เมื่อ request เดิม timeout/ถูกตัด - เพื่อรู้ว่า server เขียนสำเร็จหรือยัง)
 */
function getPaymentStatus(req, res) {
    const { key } = req.query;
    if (!key) {
        return res.json({ success: false, found: false, error: 'Missing key' });
    }
    const entry = paymentStore.get(key);
    if (!entry) {
        return res.json({ success: false, found: false, error: 'ไม่พบสถานะการจ่ายเงิน (อาจไม่ถูกประมวลผล)' });
    }
    if (entry.status === 'processing') {
        return res.json({ success: false, found: true, processing: true, error: 'กำลังประมวลผล' });
    }
    return res.json({ success: entry.success, found: true, message: entry.message });
}

module.exports = { markPaid, getPaymentStatus };
/* ========================================
   HTML Utilities - Single source for helpers
   ======================================== */

const HtmlUtils = {
    /**
     * Escape HTML to prevent XSS
     */
    escape(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },

    /**
     * Sanitize HTML — อนุญาตเฉพาะ tags ที่ปลอดภัย (b, strong, i, em, u, span style color, br)
     * ใช้สำหรับแสดงผลข้อความที่ผู้ใช้พิมพ์ HTML เองจาก Google Sheets
     * ขั้นตอน: escape ทุกอย่างก่อน แล้วค่อยคืนค่าเฉพาะ tags ที่อนุญาต
     */
    sanitize(html) {
        if (!html) return '';
        // ขั้นตอนที่ 1: escape ทุกอย่างก่อน (ป้องกัน XSS)
        // เช่น <b>ข้อความ</b> → <b>ข้อความ</b>
        const escaped = this.escape(html);
        
        // ใช้ \x26 (hex code ของ '&') เพื่อเลี่ยง auto-formatter
        // \x26lt; = < (opening angle bracket escaped)
        // \x26gt; = > (closing angle bracket escaped)
        const L = '\x26lt;';   // <
        const G = '\x26gt;';   // >
        const SL = '\x26lt;/'; // </
        
        return escaped
            // <b> → <b>
            .replace(new RegExp(L + 'b' + G, 'g'), '<b>')
            .replace(new RegExp(SL + 'b' + G, 'g'), '</b>')
            // <strong> → <strong>
            .replace(new RegExp(L + 'strong' + G, 'g'), '<strong>')
            .replace(new RegExp(SL + 'strong' + G, 'g'), '</strong>')
            // <i> → <i>
            .replace(new RegExp(L + 'i' + G, 'g'), '<i>')
            .replace(new RegExp(SL + 'i' + G, 'g'), '</i>')
            // <em> → <em>
            .replace(new RegExp(L + 'em' + G, 'g'), '<em>')
            .replace(new RegExp(SL + 'em' + G, 'g'), '</em>')
            // <u> → <u>
            .replace(new RegExp(L + 'u' + G, 'g'), '<u>')
            .replace(new RegExp(SL + 'u' + G, 'g'), '</u>')
            // <br> หรือ <br/> → <br>
            .replace(new RegExp(L + 'br\\s*\\/' + G, 'gi'), '<br>')
            .replace(new RegExp(L + 'br' + G, 'gi'), '<br>')
            // <span style="color:..."> → <span style="color: ...">
            .replace(new RegExp(L + 'span\\s+style=("|\')color\\s*:\\s*([^"\']+)\\1\\s*' + G, 'gi'), '<span style="color: $2">')
            // </span> → </span>
            .replace(new RegExp(SL + 'span' + G, 'g'), '</span>');
    },

    /**
     * Format currency (th-TH locale)
     */
    formatCurrency(amount) {
        if (typeof amount === 'string') return amount; // e.g. "x2"
        if (amount === undefined || amount === null) return '0';
        return Number(amount).toLocaleString('th-TH');
    },

    /**
     * Format time (minutes to string)
     */
    formatTime(minutes) {
        if (!minutes && minutes !== 0) return '-';
        if (minutes === 0) return '-';
        return minutes + ' นาที';
    },

    /**
     * Parse case value (supports "0M", "1.5M", etc.)
     */
    parseCases(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        const str = String(value).trim();
        if (str.toUpperCase().endsWith('M')) {
            return parseFloat(str) * 1000000;
        }
        return parseInt(str) || 0;
    },

    /**
     * Get initials from officer code
     */
    getInitials(name, code) {
        if (code && code.trim() !== '') return code.trim();
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0);
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    },

    /**
     * Get rank level for styling
     */
    getRankLevel(rank) {
        const highRanks = ['ผู้บัญชาการ', 'รองผู้บัญชาการ', 'พล.ต.อ.', 'พล.ต.ท.', 'พล.ต.ต.'];
        const lowRanks = ['ส.ต.ต.', 'ส.ต.ท.', 'ส.ต.อ.', 'ด.ต.', 'น.ร.', 'น.ต.'];
        const rankText = rank || '';
        if (highRanks.some(r => rankText.includes(r))) return 'high';
        if (lowRanks.some(r => rankText.includes(r))) return 'low';
        return 'medium';
    },

    /**
     * Group items by a specified field
     * Shared utility to prevent code duplication across RulesPage, ConductPage, FinesPage
     * @param {Array} items - Array of items to group
     * @param {string} field - Field name to group by (e.g. 'category', 'title')
     * @param {string} fallback - Default group name if field is empty
     * @returns {Object} Grouped object { categoryName: [items...] }
     */
    groupByCategory(items, field = 'category', fallback = 'อื่นๆ') {
        const grouped = {};
        for (const item of items) {
            const cat = item[field] || fallback;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        }
        return grouped;
    },

    /**
     * Normalize a name for comparison (trim, collapse spaces, lowercase)
     */
    normalizeName(text) {
        return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    },

    /**
     * ตรวจว่า key (ชื่อในชีต/ข้อมูล) ตรงกับ officerName หรือไม่
     * ลอจิกเดียวใช้ร่วมทุกจุด เพื่อลดความซ้ำซ้อนและความเสี่ยง match ผิดคน
     * @param {string} key - ชื่อฝั่งข้อมูล (เช่น key ใน weekData หรือชื่อในชีต)
     * @param {string} officerName - ชื่อเจ้าหน้าที่ที่ต้องการค้นหา
     * @returns {boolean}
     */
    isOfficerMatch(key, officerName) {
        const a = this.normalizeName(key);
        const b = this.normalizeName(officerName);
        if (!a || !b) return false;
        return a === b || a.includes(b) || b.includes(a);
    },

    /**
     * ค้นหาข้อมูลเจ้าหน้าที่ใน weekData (object ที่ key เป็นชื่อเจ้าหน้าที่)
     * รวมลูปค้นหาที่ซ้ำกันหลายจุดไว้ที่เดียว เพื่อดูแลจุดเดียวและลดความผิดพลาด
     * @param {Object} weekData - ข้อมูลรายสัปดาห์ { officerName: data }
     * @param {string} officerName - ชื่อเจ้าหน้าที่ที่ต้องการค้นหา
     * @returns {Object|null} - ข้อมูลของเจ้าหน้าที่ หรือ null ถ้าไม่พบ
     */
    findOfficerWeekData(weekData, officerName) {
        if (!weekData || typeof weekData !== 'object') return null;
        for (const key of Object.keys(weekData)) {
            if (this.isOfficerMatch(key, officerName)) {
                return weekData[key];
            }
        }
        return null;
    }
};

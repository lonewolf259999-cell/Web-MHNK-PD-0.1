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
        const escaped = this.escape(html);
        // ขั้นตอนที่ 2: อนุญาตเฉพาะ tags ที่ปลอดภัยให้กลับมาเป็น HTML
        // ใช้ String.fromCharCode(60) = '<', (62) = '>' เพื่อเลี่ยง auto-formatter
        const lt = String.fromCharCode(60); // <
        const gt = String.fromCharCode(62); // >
        return escaped
            .replace(new RegExp(lt + 'b' + gt, 'g'), '<b>')
            .replace(new RegExp(lt + '\\/b' + gt, 'g'), '</b>')
            .replace(new RegExp(lt + 'strong' + gt, 'g'), '<strong>')
            .replace(new RegExp(lt + '\\/strong' + gt, 'g'), '</strong>')
            .replace(new RegExp(lt + 'i' + gt, 'g'), '<i>')
            .replace(new RegExp(lt + '\\/i' + gt, 'g'), '</i>')
            .replace(new RegExp(lt + 'em' + gt, 'g'), '<em>')
            .replace(new RegExp(lt + '\\/em' + gt, 'g'), '</em>')
            .replace(new RegExp(lt + 'u' + gt, 'g'), '<u>')
            .replace(new RegExp(lt + '\\/u' + gt, 'g'), '</u>')
            .replace(new RegExp(lt + 'br\\s*\\/?', 'gi'), '<br>')
            // span style="color:..." — อนุญาตเฉพาะ style color เท่านั้น
            .replace(new RegExp(lt + 'span\\s+style=("|\')color\\s*:\\s*([^"\']+)\\1\\s*' + gt, 'gi'), '<span style="color: $2">')
            .replace(new RegExp(lt + '\\/span' + gt, 'g'), '</span>');
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
    }
};
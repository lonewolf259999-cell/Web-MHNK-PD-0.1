/* ========================================
   MHNK Map Module - POI Manager
   จัดการจุดแจ้ง (CRUD + UI)
   หมวดหมู่อ่านจากไฟล์ PNG ใน blips/custom/ อัตโนมัติ
   ======================================== */

/** Escape HTML เพื่อป้องกัน XSS จากชื่อ/รายละเอียดจุด */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MHNK_POI = {
  pois: [],
  _modalVisible: false,
  _selectedCoords: null,
  _searchQuery: '',
  _started: false,
  _suppressClicksUntil: 0,
  _submitting: false,

  async init() {
    if (this._started) return; // ป้องกัน init ซ้ำ (จาก event + timeout fallback)
    this._started = true;
    this._bindEvents();
    if (typeof loadCategories === 'function') {
      await loadCategories();
    }
    this._renderCategoryFilter();
    this.loadPois();
  },

  _bindEvents() {
    document.addEventListener('mhnk-map-click', (e) => {
      console.log('[MHNK-POI] Map click received:', e.detail);
      if (this._modalVisible) return;
      // ข้ามการเปิด modal ใหม่ทันทีหลังปิด (กันการคลิกนอกกรอบแล้วเด้งกลับ)
      if (Date.now() < this._suppressClicksUntil) return;
      this._selectedCoords = e.detail;
      this._showAddForm(e.detail.x, e.detail.y);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._hideModal();
    });

    const searchInput = document.getElementById('mhnk-poi-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._searchQuery = e.target.value;
        this._renderPoiList();
      });
    }

    const filterSelect = document.getElementById('mhnk-poi-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this._renderPoiList();
      });
    }
  },

  async loadPois() {
    // แสดงสถานะกำลังโหลด
    const container = document.getElementById('mhnk-poi-list');
    if (container) container.innerHTML = '<div class="mhnk-empty">⏳ กำลังโหลด...</div>';
    try {
      const res = await fetch('/api/poi');
      const data = await res.json();
      if (data.success) {
        this.pois = data.data;
        MHNK_MAP.clearPois();
        this.pois.forEach(poi => MHNK_MAP.addPoi(poi));
        this._renderPoiList();
        this._updateStats();
      } else {
        if (container) container.innerHTML = '<div class="mhnk-empty">⚠️ โหลดข้อมูลไม่สำเร็จ</div>';
      }
    } catch (err) {
      console.error('[MHNK-POI] Load failed:', err);
      if (container) container.innerHTML = '<div class="mhnk-empty">⚠️ เกิดข้อผิดพลาดในการโหลด</div>';
    }
  },

  async addPoi(poiData) {
    try {
      const res = await fetch('/api/poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poiData)
      });
      const data = await res.json();
      if (data.success) {
        await this.loadPois();
        return true;
      } else {
        alert('❌ ' + (data.error || 'ไม่สามารถเพิ่มจุดได้'));
        return false;
      }
    } catch (err) {
      console.error('[MHNK-POI] Add failed:', err);
      alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      return false;
    }
  },

  async deletePoi(id) {
    if (!confirm('🗑️ ยืนยันการลบจุดนี้?')) return;
    try {
      const res = await fetch(`/api/poi/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await this.loadPois();
      } else {
        alert('❌ ' + (data.error || 'ไม่สามารถลบจุดได้'));
      }
    } catch (err) {
      console.error('[MHNK-POI] Delete failed:', err);
      alert('❌ เกิดข้อผิดพลาด');
    }
  },

  /** Helper: icon สำหรับ sidebar dot */
  _catDotHtml(cat) {
    if (cat && cat.file) {
      const file = encodeURI(cat.file);
      return `<img src="/map-module/blips/custom/${file}" alt="" onerror="this.style.display='none';this.parentElement.textContent='📍'">`;
    }
    return '📍';
  },
  _showAddForm(x, y) {
    const overlay = document.getElementById('mhnk-modal-overlay');
    const body = document.getElementById('mhnk-modal-body');
    if (!overlay || !body) return;

    this._modalVisible = true;
    overlay.classList.add('show');

    // Dropdown options - browser ไม่ support <img> ใน <option> ใช้ข้อความอย่างเดียว
    const catEntries = Object.values(MAP_CATEGORIES);
    const catOptions = catEntries.length > 0
      ? catEntries.map(cat => `<option value="${escapeHtml(cat.id)}">📌 ${escapeHtml(cat.label)}</option>`).join('')
      : '<option value="custom">📌 อื่นๆ</option>';

    body.innerHTML = `
      <div class="mhnk-modal">
        <div class="mhnk-modal-header">
          <div class="mhnk-modal-header-icon">📍</div>
          <h3>ADD POI <span>// ลงจุดแจ้ง</span></h3>
          <button class="mhnk-modal-close" onclick="MHNK_POI._hideModal()">&times;</button>
        </div>
        <div class="mhnk-modal-content">
          <div class="mhnk-coord-box">
            <div class="mhnk-coord-item">
              <label>AXIS X</label>
              <input type="text" id="mhnk-poi-x" value="${x.toFixed(2)}" readonly class="mhnk-input-readonly">
            </div>
            <div class="mhnk-coord-item">
              <label>AXIS Y</label>
              <input type="text" id="mhnk-poi-y" value="${y.toFixed(2)}" readonly class="mhnk-input-readonly">
            </div>
          </div>
          <div class="mhnk-form-group">
            <label for="mhnk-poi-name">ชื่อสถานที่ <span class="required">*</span></label>
            <input type="text" id="mhnk-poi-name" placeholder="เช่น ด่านตรวจถนนจ้าว...">
          </div>
          <div class="mhnk-form-group">
            <label for="mhnk-poi-category">หมวดหมู่ <span class="required">*</span></label>
            <select id="mhnk-poi-category">${catOptions}</select>
          </div>
          <div class="mhnk-form-group">
            <label for="mhnk-poi-desc">รายละเอียด</label>
            <textarea id="mhnk-poi-desc" rows="3" placeholder="รายละเอียดเพิ่มเติม..."></textarea>
          </div>
        </div>
        <div class="mhnk-modal-footer">
          <button class="mhnk-btn mhnk-btn-ghost" onclick="MHNK_POI._hideModal()">✕ CANCEL</button>
          <button id="mhnk-poi-submit-btn" class="mhnk-btn mhnk-btn-primary" onclick="MHNK_POI._submitAddForm()">✓ ADD POI</button>
        </div>
      </div>
    `;

    setTimeout(() => document.getElementById('mhnk-poi-name')?.focus(), 100);
  },

  async _submitAddForm() {
    // ป้องกันการกดซ้ำหลายที (จะสร้างจุดซ้ำ)
    if (this._submitting) return;
    this._submitting = true;

    const submitBtn = document.getElementById('mhnk-poi-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ กำลังบันทึก...';
    }

    const name = document.getElementById('mhnk-poi-name')?.value?.trim();
    const category = document.getElementById('mhnk-poi-category')?.value;
    const description = document.getElementById('mhnk-poi-desc')?.value?.trim();
    const x = parseFloat(document.getElementById('mhnk-poi-x')?.value);
    const y = parseFloat(document.getElementById('mhnk-poi-y')?.value);

    const finish = (valid) => {
      this._submitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✅ เพิ่มจุด';
      }
      return valid;
    };

    if (!name) {
      alert('⚠️ กรุณากรอกชื่อสถานที่');
      document.getElementById('mhnk-poi-name')?.focus();
      return finish(false);
    }
    if (!category) {
      alert('⚠️ กรุณาเลือกหมวดหมู่');
      return finish(false);
    }
    if (isNaN(x) || isNaN(y)) {
      alert('⚠️ พิกัดไม่ถูกต้อง');
      return finish(false);
    }

    try {
      const success = await this.addPoi({ name, category, description, x, y });
      if (success) this._hideModal();
      return finish(success);
    } catch (err) {
      console.error('[MHNK-POI] Add form error:', err);
      return finish(false);
    }
  },

  _hideModal() {
    const overlay = document.getElementById('mhnk-modal-overlay');
    if (overlay) overlay.classList.remove('show');
    this._modalVisible = false;
    this._selectedCoords = null;
    // กัน modal เปิดใหม่ทันทีหลังปิด (หลังคลิกนอกกรอบเพื่อปิด)
    this._suppressClicksUntil = Date.now() + 300;
  },

  _renderPoiList() {
    const container = document.getElementById('mhnk-poi-list');
    if (!container) return;

    const filterCategory = document.getElementById('mhnk-poi-filter')?.value || 'all';
    const query = this._searchQuery?.toLowerCase() || '';

    let filtered = this.pois;
    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory);
    }
    if (query) {
      filtered = filtered.filter(p =>
        (p.name || '').toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="mhnk-empty">ไม่มีจุดแจ้ง</div>';
      return;
    }

    container.innerHTML = filtered.map(poi => {
      const cat = MAP_CATEGORIES[poi.category];
      const name = escapeHtml(poi.name || 'ไม่ระบุชื่อ');
      const mc = cat?.color || '#00e5ff';
      const x = isFinite(Number(poi.x)) ? Number(poi.x).toFixed(1) : '0.0';
      const y = isFinite(Number(poi.y)) ? Number(poi.y).toFixed(1) : '0.0';
      return `
        <div class="mhnk-poi-item" data-poi-id="${escapeHtml(poi.id)}" style="--mc:${mc}" onclick="MHNK_POI._goToPoi('${escapeHtml(poi.id)}')">
          <div class="mhnk-poi-item-dot" style="--mc:${mc}">${this._catDotHtml(cat)}</div>
          <div class="mhnk-poi-item-name" title="${name}">${name}</div>
          <span class="mhnk-poi-item-coord">X:${x} Y:${y}</span>
          <button class="mhnk-poi-item-del" onclick="event.stopPropagation(); MHNK_POI.deletePoi('${escapeHtml(poi.id)}')" title="ลบ">✕</button>
        </div>
      `;
    }).join('');

    // ยืนยัน selection เดิมหลัง rerender (ถ้ายังมีจุดนั้นอยู่)
    if (this._selectedPoiId) this._applySelection(this._selectedPoiId);
  },

  /** เลือกจุดที่รับมาจากแผนที่ (กด marker) — ไฮไลต์ + เลื่อนรายการด้านขวาไปหาจุดนั้น */
  _selectPoi(id) {
    this._selectedPoiId = id;
    this._applySelection(id);
  },

  /** ไฮไลต์การ์ดที่เลือก + เลื่อนให้เห็นในรายการ */
  _applySelection(id) {
    const items = document.querySelectorAll('.mhnk-poi-item');
    items.forEach(el => {
      const on = el.dataset.poiId === id;
      el.classList.toggle('selected', !!on);
      if (on) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  },

  /** กดการ์ดด้านขวา → แผนที่เลื่อนไปยังจุด + ไฮไลต์การ์ด */
  _goToPoi(id) {
    const p = this.pois.find(x => String(x.id) === String(id));
    if (!p) return;
    if (MHNK_MAP && MHNK_MAP.map) {
      MHNK_MAP.map.setView([Number(p.y), Number(p.x)], 4);
    }
    this._selectPoi(id);
  },

  _updateStats() {
    const statEl = document.getElementById('mhnk-poi-stats');
    if (!statEl) return;
    const count = this.pois.length;
    statEl.innerHTML = `<span class="mhnk-stat-num">${count}</span><span class="mhnk-stat-unit">BEACONS</span><span class="mhnk-stat-sig">●&nbsp;REC&nbsp;✓</span>`;
    // แอนิเมชันกระตุกตัวเลขเมื่ออัปเดต
    statEl.classList.remove('bump');
    void statEl.offsetWidth;
    statEl.classList.add('bump');
  },

  _renderCategoryFilter() {
    const filter = document.getElementById('mhnk-poi-filter');
    if (!filter) return;

    const catEntries = Object.values(MAP_CATEGORIES);
    filter.innerHTML = '<option value="all">🏷️ ทั้งหมด</option>' +
      (catEntries.length > 0
        ? catEntries.map(cat => `<option value="${escapeHtml(cat.id)}">📌 ${escapeHtml(cat.label)}</option>`).join('')
        : '<option value="custom">📌 อื่นๆ</option>'
      );
  },

  /* ══════════ EXPORT ข้อมูลจุด (JSON/CSV) ══════════ */

  /** เปิด modal Export — โหลดข้อมูลล่าสุด + สร้าง JSON/CSV รอไว้ */
  async _showExportModal() {
    const overlay = document.getElementById('mhnk-modal-overlay');
    const body = document.getElementById('mhnk-modal-body');
    if (!overlay || !body) return;

    // ดึงข้อมูลล่าสุดจาก API (ถ้าสำเร็จจะ sync กับรายการด้วย)
    try {
      const res = await fetch('/api/poi');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) this.pois = data.data;
    } catch (e) {
      console.error('[MHNK-POI] Export refresh failed (using cached):', e);
    }

    const rows = this.pois;
    this._exportJson = JSON.stringify(rows, null, 2);
    this._exportCsv = this._buildCSV(rows);

    // สรุปจำนวนตามหมวดหมู่
    const counts = {};
    rows.forEach(p => {
      const label = (MAP_CATEGORIES[p.category]?.label) || p.category || 'อื่นๆ';
      counts[label] = (counts[label] || 0) + 1;
    });
    const chips = Object.entries(counts)
      .map(([label, n]) => {
        const cat = Object.values(MAP_CATEGORIES).find(c => c.label === label);
        const color = cat?.color || '#00e5ff';
        return `<span class="mhnk-export-chip"><i style="--chip-c:${color}"></i>${escapeHtml(label)}<span>${n}</span></span>`;
      })
      .join('');

    this._modalVisible = true;
    overlay.classList.add('show');

    body.innerHTML = `
      <div class="mhnk-modal">
        <div class="mhnk-modal-header">
          <div class="mhnk-modal-header-icon">⬇</div>
          <h3>EXPORT DATABASE <span>// ดึงข้อมูลไปใช้</span></h3>
          <button class="mhnk-modal-close" onclick="MHNK_POI._hideModal()">&times;</button>
        </div>
        <div class="mhnk-modal-content">
          <div class="mhnk-export-summary">
            <span class="mhnk-export-sum-num">${rows.length}</span>
            <span class="mhnk-export-sum-lbl">BEACONS<br><b>พร้อมส่งออก</b></span>
          </div>
          <div class="mhnk-export-breakdown">${chips || '<span class="mhnk-empty">ยังไม่มีข้อมูล</span>'}</div>
          <div class="mhnk-export-actions">
            <button class="mhnk-export-action" onclick="MHNK_POI._exportDo('copy','json')">
              <span class="mhnk-export-act-ico">⧉</span>
              <span class="mhnk-export-act-txt">
                <span class="mhnk-export-act-title">COPY JSON</span>
                <span class="mhnk-export-act-sub">คัดลอกทั้งหมด</span>
              </span>
            </button>
            <button class="mhnk-export-action act-csv" onclick="MHNK_POI._exportDo('copy','csv')">
              <span class="mhnk-export-act-ico">⧉</span>
              <span class="mhnk-export-act-txt">
                <span class="mhnk-export-act-title">COPY CSV</span>
                <span class="mhnk-export-act-sub">คัดลอกตาราง</span>
              </span>
            </button>
            <button class="mhnk-export-action" onclick="MHNK_POI._exportDo('download','json')">
              <span class="mhnk-export-act-ico">⬇</span>
              <span class="mhnk-export-act-txt">
                <span class="mhnk-export-act-title">DOWNLOAD .JSON</span>
                <span class="mhnk-export-act-sub">poi-export.json</span>
              </span>
            </button>
            <button class="mhnk-export-action act-csv" onclick="MHNK_POI._exportDo('download','csv')">
              <span class="mhnk-export-act-ico">⬇</span>
              <span class="mhnk-export-act-txt">
                <span class="mhnk-export-act-title">DOWNLOAD .CSV</span>
                <span class="mhnk-export-act-sub">poi-export.csv</span>
              </span>
            </button>
          </div>
        </div>
        <div class="mhnk-modal-footer">
          <button class="mhnk-btn mhnk-btn-ghost" onclick="MHNK_POI._hideModal()">✕ CLOSE</button>
        </div>
      </div>
    `;
  },

  /** สร้าง CSV จากรายการ POI */
  _buildCSV(rows) {
    const header = ['id', 'name', 'category', 'description', 'x', 'y', 'createdAt'];
    const esc = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [header.join(',')];
    rows.forEach(p => {
      lines.push([p.id, p.name, p.category, p.description, p.x, p.y, p.createdAt].map(esc).join(','));
    });
    return lines.join('\r\n');
  },

  /** กระทำการ copy / download ตามชนิดที่เลือก */
  async _exportDo(action, kind) {
    const text = kind === 'json' ? this._exportJson : this._exportCsv;
    if (action === 'copy') {
      const ok = await this._copyText(text);
      this._toast(ok ? `✔ คัดลอก ${kind.toUpperCase()} แล้ว` : '⚠️ คัดลอกไม่สำเร็จ ใช้ปุ่มดาวน์โหลดแทน');
    } else {
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const name = `poi-export-${stamp}.${kind}`;
      const mime = kind === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
      this._downloadFile(name, text, mime);
      this._toast(`✔ เริ่มดาวน์โหลด ${name}`);
    }
  },
/** คัดลอกข้อความไป clipboard (มี fallback สำหรับ http) */
  async _copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fallthrough */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  },

  /** ดาวน์โหลดไฟล์ (Blob + anchor) */
  _downloadFile(name, content, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  /** Toast แจ้งเตือนเล็ก ๆ */
  _toast(msg) {
    let el = document.getElementById('mhnk-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mhnk-toast';
      el.className = 'mhnk-toast';
      document.body.appendChild(el);
    }
    el.innerHTML = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
};
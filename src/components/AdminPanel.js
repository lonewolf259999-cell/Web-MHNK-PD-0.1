/* ========================================
    Admin Panel - Modal & PIN for CRUD
    - Uses PinModal from shared components (server-side only PIN check)
    - Uses window.Notification for toast messages
    - CSS moved to src/styles/admin.css
    ======================================== */

const adminPanelLogger = window.getLogger ? window.getLogger('AdminPanel') : {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.log(...args),
    debug: () => {}
};

(function() {
    'use strict';

    // ==================== STATE ====================
    let currentAction = null;
    let currentType = null;
    let currentItem = null;
    let _adminMode = false;
    let _isEdit = false;

    // ==================== INIT ====================
    function init() {
        createModals();
        createToggleButton();
    }

    // ==================== MODALS ====================
    function createModals() {
        const formModal = document.createElement('div');
        formModal.id = 'adminFormModal';
        formModal.className = 'modal-overlay';
        formModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="adminFormTitle">เพิ่มข้อมูล</h3>
                    <button class="modal-close" onclick="window.AppAdmin.closeFormModal()">&times;</button>
                </div>
                <div class="form-group">
                    <label>ประเภท / Category</label>
                    <input type="text" id="adminFormCategory" list="adminCategoryOptions" placeholder="พิมพ์ประเภทเอง เช่น กฎทั่วไป...">
                    <datalist id="adminCategoryOptions">
                        <!-- ตัวเลือกจะถูกเพิ่มอัตโนมัติจากข้อมูลที่มีอยู่แล้ว -->
                    </datalist>
                </div>
                <div class="form-group">
                    <label>เนื้อหา / Text</label>
                    <textarea id="adminFormText" placeholder="กรอกเนื้อหา..."></textarea>
                </div>
                <div class="form-row" id="adminFinesFields" style="display:none;">
                    <div class="form-group">
                        <label>ค่าปรับ (บาท)</label>
                        <input type="number" id="adminFormAmount" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label>เวลา (นาที)</label>
                        <input type="number" id="adminFormTime" placeholder="0">
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="window.AppAdmin.closeFormModal()">ยกเลิก</button>
                    <button class="btn-confirm" onclick="window.AppAdmin.requestPin('save')">บันทึก</button>
                </div>
            </div>
        `;
        document.body.appendChild(formModal);

        const deleteModal = document.createElement('div');
        deleteModal.id = 'adminDeleteModal';
        deleteModal.className = 'modal-overlay';
        deleteModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🗑️ ยืนยันการลบ</h3>
                    <button class="modal-close" onclick="window.AppAdmin.closeDeleteModal()">&times;</button>
                </div>
                <p style="color:#94a3b8;margin-bottom:20px;">คุณต้องการลบรายการนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="window.AppAdmin.closeDeleteModal()">ยกเลิก</button>
                    <button class="btn-confirm-danger" onclick="window.AppAdmin.requestPin('delete')">ลบข้อมูล</button>
                </div>
            </div>
        `;
        document.body.appendChild(deleteModal);

        // Close modals on backdrop click
        [formModal, deleteModal].forEach(m => {
            m.addEventListener('click', function(e) {
                if (e.target === this) this.classList.remove('active');
            });
        });
    }

    // ==================== TOGGLE BUTTON ====================
    function createToggleButton() {
        const headerBadges = document.querySelector('.header-badges');
        if (!headerBadges) return;

        const btn = document.createElement('button');
        btn.id = 'adminToggleBtn';
        btn.className = 'btn-toggle-admin';
        btn.textContent = '♛ Admin';
        btn.onclick = function() {
            _adminMode = !_adminMode;
            btn.classList.toggle('active', _adminMode);

            adminPanelLogger.info(`Admin mode: ${_adminMode ? 'ON' : 'OFF'}`);

            if (window.App) {
                if (window.App.rulesPage) window.App.rulesPage.adminMode = _adminMode;
                if (window.App.conductPage) window.App.conductPage.adminMode = _adminMode;
                if (window.App.finesPage) window.App.finesPage.adminMode = _adminMode;
            }

            document.querySelectorAll('.admin-bar').forEach(bar => {
                bar.classList.toggle('show', _adminMode);
            });

            if (window.App) {
                const currentPage = window.App.navigation.getCurrentPage();
                window.App.handleSearch(window.App.search.getQuery());
            }

            // Use window.Notification to avoid conflict with browser's native Notification API
            try {
                window.Notification.show(_adminMode ? '🔧 เข้าสู่โหมดผู้ดูแล' : '🔒 ออกจากโหมดผู้ดูแล', 'success');
            } catch (e) {
                adminPanelLogger.warn(`Toast failed: ${e.message}`);
            }
        };
        headerBadges.appendChild(btn);
    }

    // ==================== CATEGORY OPTIONS ====================
    function populateCategoryOptions(type) {
        // ดึง category จากข้อมูลที่มีอยู่แล้ว (ไม่ hardcoded)
        const app = window.App;
        let items = null;
        if (type === 'rules') items = app && app.rulesPage && app.rulesPage.rulesData;
        else if (type === 'conduct') items = app && app.conductPage && app.conductPage.data;
        else if (type === 'fines') items = app && app.finesPage && app.finesPage.data;

        const categories = new Set();
        if (items && items.length) {
            items.forEach(item => {
                const cat = item.category || item.title;
                if (cat) categories.add(cat);
            });
        }

        const datalist = document.getElementById('adminCategoryOptions');
        datalist.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist.appendChild(option);
        });
    }

    // ==================== PUBLIC API ====================
    window.AppAdmin = {
        get adminMode() { return _adminMode; },
        set adminMode(val) { _adminMode = val; },

        openAddModal: function(type) {
            currentAction = 'add';
            currentType = type;
            currentItem = null;
            _isEdit = false;

            document.getElementById('adminFormTitle').textContent = '+ เพิ่มข้อมูล';
            document.getElementById('adminFormCategory').value = '';
            document.getElementById('adminFormText').value = '';
            document.getElementById('adminFormAmount').value = '';
            document.getElementById('adminFormTime').value = '';

            // ทุก type มี Category + Text, เฉพาะ fines มี Amount + Time
            document.getElementById('adminFinesFields').style.display = (type === 'fines') ? 'grid' : 'none';

            // ใส่ category options จากข้อมูลที่มีอยู่แล้ว
            populateCategoryOptions(type);

            document.getElementById('adminFormModal').classList.add('active');
        },

        openEditModal: function(type, item) {
            currentAction = 'edit';
            currentType = type;
            currentItem = item;
            _isEdit = true;

            document.getElementById('adminFormTitle').textContent = '✏️ แก้ไขข้อมูล';
            document.getElementById('adminFormCategory').value = item.category || '';
            document.getElementById('adminFormText').value = item.text || '';
            document.getElementById('adminFormAmount').value = item.amount || '';
            document.getElementById('adminFormTime').value = item.time || '';

            // ทุก type มี Category + Text, เฉพาะ fines มี Amount + Time
            document.getElementById('adminFinesFields').style.display = (type === 'fines') ? 'grid' : 'none';

            // ใส่ category options จากข้อมูลที่มีอยู่แล้ว
            populateCategoryOptions(type);

            document.getElementById('adminFormModal').classList.add('active');
        },

        openDeleteModal: function(type, id) {
            currentAction = 'delete';
            currentType = type;
            currentItem = { id: id };
            document.getElementById('adminDeleteModal').classList.add('active');
        },

        closeFormModal: function() { document.getElementById('adminFormModal').classList.remove('active'); },
        closeDeleteModal: function() { document.getElementById('adminDeleteModal').classList.remove('active'); },

        requestPin: async function(action) {
            currentAction = action;

            // Close current modal first
            document.getElementById('adminFormModal').classList.remove('active');
            document.getElementById('adminDeleteModal').classList.remove('active');

            // Use shared PinModal (server-side only PIN check)
            const pin = await PinModal.request('กรุณาระบุรหัสผ่านเพื่อยืนยันการดำเนินการ');
            if (!pin) return; // User cancelled

            if (currentAction === 'save') {
                await handleSave(pin);
            } else if (currentAction === 'delete') {
                await handleDelete(pin);
            }
        }
    };

    // ==================== HANDLERS ====================
    async function handleSave(pin) {
        const type = currentType;
        const category = document.getElementById('adminFormCategory').value;
        const text = document.getElementById('adminFormText').value;
        const amount = document.getElementById('adminFormAmount').value;
        const time = document.getElementById('adminFormTime').value;

        let id;
        if (_isEdit && currentItem) {
            id = currentItem.id;
        } else {
            id = generateId(type);
        }

        // Server mapping: conduct uses column D as "title", rules/fines as "category"
        // Map category value to the correct field for each type
        const data = { id, text, amount, time };
        if (type === 'conduct') {
            data.title = category; // conduct: column D = title
        } else {
            data.category = category; // rules/fines: column D = category
        }

        adminPanelLogger.info(`Save: type=${type}, id=${id}, isEdit=${_isEdit}`);

        try {
            if (_isEdit) {
                await ApiService.updateRule(type, id, data, pin);
                window.Notification.show('✅ แก้ไขข้อมูลสำเร็จ', 'success');
            } else {
                await ApiService.addRule(type, data, pin);
                window.Notification.show('✅ เพิ่มข้อมูลสำเร็จ', 'success');
            }
            refreshPage();
        } catch (err) {
            window.Notification.show('❌ ' + err.message, 'error');
        }
    }

    async function handleDelete(pin) {
        try {
            await ApiService.deleteRule(currentType, currentItem.id, pin);
            window.Notification.show('🗑️ ลบข้อมูลสำเร็จ', 'success');
            refreshPage();
        } catch (err) {
            window.Notification.show('❌ ' + err.message, 'error');
        }
    }

    function generateId(type) {
        const prefix = { 'rules': 'r', 'conduct': 'co', 'fines': 'fi' };
        return (prefix[type] || 'x') + '-' + Date.now().toString(36).substr(-4);
    }

    function refreshPage() {
        if (!window.App) return;
        const page = window.App.navigation.getCurrentPage();
        switch (page) {
            case 'rules':
                window.App.rulesPage.load().then(() => window.App.rulesPage.render(window.App.search.getQuery()));
                break;
            case 'conduct':
                window.App.conductPage.load().then(() => window.App.conductPage.render(window.App.search.getQuery()));
                break;
            case 'fines':
                window.App.finesPage.load().then(() => window.App.finesPage.render(window.App.search.getQuery()));
                break;
        }
    }

    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
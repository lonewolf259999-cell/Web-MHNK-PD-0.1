/* ========================================
    Admin Panel - Modal & PIN for CRUD
    - PIN requested once when entering admin mode
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
    let _adminPin = null; // Stored PIN for the session
    let _formatBold = false; // Toggle: bold selected
    let _formatColor = false; // Toggle: color selected

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
                    <div class="editor-toolbar">
                        <button type="button" id="editorBtnBold" class="editor-btn" onclick="window.AppAdmin.toggleBold()" title="ตัวหนา"><b>B</b></button>
                        <button type="button" id="editorBtnColor" class="editor-btn" onclick="window.AppAdmin.toggleColor()" title="เลือกสี">
                            <span style="background:linear-gradient(90deg,red,orange,yellow,green,blue,indigo,violet);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">A</span>
                        </button>
                        <input type="color" id="colorPicker" value="#ff0000" style="width:32px;height:32px;padding:0;border:none;cursor:pointer;border-radius:4px;" title="เลือกสี">
                        <button type="button" class="editor-btn editor-btn-apply" onclick="window.AppAdmin.applyFormat()" title="นำรูปแบบไปใช้">▶ ใช้</button>
                    </div>
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
                    <button class="btn-confirm" onclick="window.AppAdmin.handleSave()">บันทึก</button>
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
                    <button class="btn-confirm-danger" onclick="window.AppAdmin.handleDelete()">ลบข้อมูล</button>
                </div>
            </div>
        `;
        document.body.appendChild(deleteModal);

        // No backdrop click close — user must click ยกเลิก or &times; to close
    }

    // ==================== TOGGLE BUTTON ====================
    function createToggleButton() {
        const headerBadges = document.querySelector('.header-badges');
        if (!headerBadges) return;

        const btn = document.createElement('button');
        btn.id = 'adminToggleBtn';
        btn.className = 'btn-toggle-admin';
        btn.textContent = '♛ Admin';
        btn.onclick = async function() {
            if (!_adminMode) {
                // Turning ON — request PIN first
                const pin = await PinModal.request('🔐 กรุณาระบุรหัสผ่านเพื่อเข้าโหมดผู้ดูแล');
                if (!pin) return; // User cancelled

                _adminPin = pin;
                _adminMode = true;
                btn.classList.add('active');

                adminPanelLogger.info('Admin mode: ON');

                if (window.App) {
                    if (window.App.rulesPage) window.App.rulesPage.adminMode = true;
                    if (window.App.conductPage) window.App.conductPage.adminMode = true;
                    if (window.App.finesPage) window.App.finesPage.adminMode = true;
                }

                document.querySelectorAll('.admin-bar').forEach(bar => {
                    bar.classList.add('show');
                });

                if (window.App) {
                    const currentPage = window.App.navigation.getCurrentPage();
                    window.App.handleSearch(window.App.search.getQuery());
                }

                try {
                    window.Notification.show('🔧 เข้าสู่โหมดผู้ดูแล', 'success');
                } catch (e) {
                    adminPanelLogger.warn(`Toast failed: ${e.message}`);
                }
            } else {
                // Turning OFF — clear PIN
                _adminPin = null;
                _adminMode = false;
                btn.classList.remove('active');

                adminPanelLogger.info('Admin mode: OFF');

                if (window.App) {
                    if (window.App.rulesPage) window.App.rulesPage.adminMode = false;
                    if (window.App.conductPage) window.App.conductPage.adminMode = false;
                    if (window.App.finesPage) window.App.finesPage.adminMode = false;
                }

                document.querySelectorAll('.admin-bar').forEach(bar => {
                    bar.classList.remove('show');
                });

                if (window.App) {
                    const currentPage = window.App.navigation.getCurrentPage();
                    window.App.handleSearch(window.App.search.getQuery());
                }

                try {
                    window.Notification.show('🔒 ออกจากโหมดผู้ดูแล', 'success');
                } catch (e) {
                    adminPanelLogger.warn(`Toast failed: ${e.message}`);
                }
            }
        };
        headerBadges.appendChild(btn);
    }

    // ==================== CATEGORY OPTIONS ====================
    function populateCategoryOptions(type) {
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
            resetFormatToggles();

            document.getElementById('adminFormTitle').textContent = '+ เพิ่มข้อมูล';
            document.getElementById('adminFormCategory').value = '';
            document.getElementById('adminFormText').value = '';
            document.getElementById('adminFormAmount').value = '';
            document.getElementById('adminFormTime').value = '';

            document.getElementById('adminFinesFields').style.display = (type === 'fines') ? 'grid' : 'none';

            populateCategoryOptions(type);

            document.getElementById('adminFormModal').classList.add('active');
        },

        openEditModal: function(type, item) {
            currentAction = 'edit';
            currentType = type;
            currentItem = item;
            _isEdit = true;
            resetFormatToggles();

            document.getElementById('adminFormTitle').textContent = '✏️ แก้ไขข้อมูล';
            document.getElementById('adminFormCategory').value = item.category || '';
            document.getElementById('adminFormText').value = item.text || '';
            document.getElementById('adminFormAmount').value = item.amount || '';
            document.getElementById('adminFormTime').value = item.time || '';

            document.getElementById('adminFinesFields').style.display = (type === 'fines') ? 'grid' : 'none';

            populateCategoryOptions(type);

            document.getElementById('adminFormModal').classList.add('active');
        },

        openDeleteModal: function(type, id) {
            currentAction = 'delete';
            currentType = type;
            currentItem = { id: id };
            document.getElementById('adminDeleteModal').classList.add('active');
        },

        /**
         * Toggle bold format selection
         */
        toggleBold: function() {
            _formatBold = !_formatBold;
            const btn = document.getElementById('editorBtnBold');
            if (btn) btn.classList.toggle('active', _formatBold);
        },

        /**
         * Toggle color format selection
         */
        toggleColor: function() {
            _formatColor = !_formatColor;
            const btn = document.getElementById('editorBtnColor');
            if (btn) btn.classList.toggle('active', _formatColor);
        },

        /**
         * Apply selected formats (bold, color) to the selected text in textarea
         */
        applyFormat: function() {
            const textarea = document.getElementById('adminFormText');
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = textarea.value.substring(start, end);

            if (!selectedText) {
                window.Notification.show('⚠️ กรุณาเลือกข้อความก่อนกดใช้', 'warning');
                return;
            }

            let replacement = selectedText;

            // Apply color first (inner), then bold (outer) if both selected
            if (_formatColor) {
                const colorPicker = document.getElementById('colorPicker');
                const color = colorPicker ? colorPicker.value : '#ff0000';
                replacement = '<span style="color:' + color + '">' + replacement + '</span>';
            }
            if (_formatBold) {
                replacement = '<b>' + replacement + '</b>';
            }

            textarea.setRangeText(replacement, start, end, 'end');
            textarea.focus();
        },

        closeFormModal: function() {
            document.getElementById('adminFormModal').classList.remove('active');
            resetFormatToggles();
        },
        closeDeleteModal: function() { document.getElementById('adminDeleteModal').classList.remove('active'); },

        /**
         * Save handler — uses stored PIN from admin session
         */
        handleSave: async function() {
            if (!_adminPin) {
                window.Notification.show('❌ กรุณาเข้าโหมดผู้ดูแลก่อน (กด ♛ Admin)', 'error');
                return;
            }

            const type = currentType;
            const category = document.getElementById('adminFormCategory').value;
            const text = document.getElementById('adminFormText').value;
            const amount = document.getElementById('adminFormAmount').value;
            const time = document.getElementById('adminFormTime').value;

            if (!text.trim()) {
                window.Notification.show('❌ กรุณากรอกเนื้อหา', 'error');
                return;
            }

            let id;
            if (_isEdit && currentItem) {
                id = currentItem.id;
            } else {
                id = generateId(type);
            }

            const data = { id, text, amount, time };
            if (type === 'conduct') {
                data.title = category;
            } else {
                data.category = category;
            }

            adminPanelLogger.info(`Save: type=${type}, id=${id}, isEdit=${_isEdit}`);

            document.getElementById('adminFormModal').classList.remove('active');
            resetFormatToggles();

            try {
                if (_isEdit) {
                    await ApiService.updateRule(type, id, data, _adminPin);
                    window.Notification.show('✅ แก้ไขข้อมูลสำเร็จ', 'success');
                } else {
                    await ApiService.addRule(type, data, _adminPin);
                    window.Notification.show('✅ เพิ่มข้อมูลสำเร็จ', 'success');
                }
                refreshPage();
            } catch (err) {
                window.Notification.show('❌ ' + err.message, 'error');
            }
        },

        /**
         * Delete handler — uses stored PIN from admin session
         */
        handleDelete: async function() {
            if (!_adminPin) {
                window.Notification.show('❌ กรุณาเข้าโหมดผู้ดูแลก่อน (กด ♛ Admin)', 'error');
                return;
            }

            document.getElementById('adminDeleteModal').classList.remove('active');

            try {
                await ApiService.deleteRule(currentType, currentItem.id, _adminPin);
                window.Notification.show('🗑️ ลบข้อมูลสำเร็จ', 'success');
                refreshPage();
            } catch (err) {
                window.Notification.show('❌ ' + err.message, 'error');
            }
        }
    };

    function resetFormatToggles() {
        _formatBold = false;
        _formatColor = false;
        const boldBtn = document.getElementById('editorBtnBold');
        const colorBtn = document.getElementById('editorBtnColor');
        if (boldBtn) boldBtn.classList.remove('active');
        if (colorBtn) colorBtn.classList.remove('active');
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
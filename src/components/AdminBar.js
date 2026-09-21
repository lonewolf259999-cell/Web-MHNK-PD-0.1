/* ========================================
    Admin Bar Component
    - Creates admin bar for rules/conduct/fines pages
    ======================================== */

(function() {
    'use strict';

    function createAdminBars() {
        // Create admin bar for rules page
        createBar('rules', 'rulesContainer', '🔧 โหมดผู้ดูแล - กฎตำรวจ');
        // Create admin bar for conduct page
        createBar('conduct', 'conductContainer', '🔧 โหมดผู้ดูแล - ข้อปฏิบัติ');
        // Create admin bar for fines page
        createBar('fines', 'finesContainer', '🔧 โหมดผู้ดูแล - ค่าปรับ');
    }

    function createBar(page, containerId, title) {
        const container = document.getElementById(containerId);
        if (!container || !container.parentNode) return;

        const bar = document.createElement('div');
        bar.className = 'admin-bar';
        bar.dataset.page = page;

        bar.innerHTML = `
            <span class="admin-bar-title">${title}</span>
            <div class="admin-bar-actions">
                <button class="btn-add" onclick="window.AppAdmin.openAddModal('${page}')">+ เพิ่มข้อมูล</button>
            </div>
        `;

        container.parentNode.insertBefore(bar, container);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createAdminBars);
    } else {
        createAdminBars();
    }
})();
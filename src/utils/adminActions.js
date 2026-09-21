/* ========================================
    Admin Actions - Shared admin button renderer
    - Single source for edit/delete action buttons
    - Uses inline onclick for guaranteed event handling
    - No event listeners needed in page controllers
    ======================================== */

const adminLogger = window.getLogger('AdminActions');

const AdminActions = {
    /**
     * Render admin action buttons (edit + delete)
     * Uses inline onclick so no attachAdminEvents() needed
     * @param {string} type - 'rules', 'conduct', or 'fines'
     * @param {string} id - Item ID
     * @returns {string} HTML string or empty string if not admin mode
     */
    renderButtons(type, id) {
        if (!window.AppAdmin || !window.AppAdmin.adminMode) return '';

        const escapedId = HtmlUtils ? HtmlUtils.escape(id) : id;

        return `
            <button class="admin-action-btn btn-edit" onclick="event.stopPropagation();AdminActions._edit('${type}','${escapedId}')" title="แก้ไข">✏️</button>
            <button class="admin-action-btn btn-delete" onclick="event.stopPropagation();AdminActions._delete('${type}','${escapedId}')" title="ลบ">🗑️</button>
        `;
    },

    /**
     * Handle edit button click
     * Looks up item from window.AppAdmin._dataMap[type]
     */
_edit(type, id) {
        try {
            adminLogger.debug(`Edit: ${type} id=${id}`);
            // Read directly from page controller globals (window.App might not be available with const)
            const rulesPage = typeof RulesPage !== 'undefined' ? window.App && window.App.rulesPage : null;
            const conductPage = typeof ConductPage !== 'undefined' ? window.App && window.App.conductPage : null;
            const finesPage = typeof FinesPage !== 'undefined' ? window.App && window.App.finesPage : null;
            
            let items = null;
            if (type === 'rules') items = rulesPage ? rulesPage.rulesData : null;
            else if (type === 'conduct') items = conductPage ? conductPage.data : null;
            else if (type === 'fines') items = finesPage ? finesPage.data : null;
            
            if (!items || !items.length) {
                adminLogger.warn(`No data loaded for type: ${type}`);
                return;
            }
            const item = items.find(r => r.id === id);
            if (item) {
                window.AppAdmin.openEditModal(type, item);
            } else {
                adminLogger.warn(`Item not found: ${id}`);
            }
        } catch (err) {
            adminLogger.error(`Edit error: ${err.message}`);
        }
    },

    /**
     * Handle delete button click
     */
_delete(type, id) {
        try {
            adminLogger.debug(`Delete: ${type} id=${id}`);
            window.AppAdmin.openDeleteModal(type, id);
        } catch (err) {
            adminLogger.error(`Delete error: ${err.message}`);
        }
    }
};

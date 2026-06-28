import { SqlFormatTool } from './SqlFormatTool.js';

/**
 * SQL 管理工具
 * 聚合 SQL 相关子功能（当前：SQL 格式化），通过子 tab 切换
 */
export class SqlManagerTool {
    constructor(app) {
        this.app = app;
        this.toolId = 'sql';
        // 子功能工具实例
        this.formatTool = new SqlFormatTool(app);
        this.currentSubTab = 'format';
    }

    /**
     * 初始化：初始化各子工具并绑定子 tab 切换
     */
    init() {
        this.formatTool.init();
        this.bindSubTabEvents();
    }

    /**
     * 绑定子 tab 切换事件（限定在 SQL 管理容器内，避免与其它工具的子 tab 冲突）
     */
    bindSubTabEvents() {
        const container = document.getElementById('tool-sql');
        if (!container) return;
        container.querySelectorAll('.sql-subtab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSubTab(e.currentTarget.dataset.subtab);
            });
        });
    }

    /**
     * 切换子功能 tab
     */
    switchSubTab(subTabId) {
        if (!subTabId) return;
        const container = document.getElementById('tool-sql');
        if (!container) return;

        container.querySelectorAll('.sql-subtab').forEach(b => b.classList.remove('active'));
        const activeBtn = container.querySelector(`.sql-subtab[data-subtab="${subTabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        container.querySelectorAll('.sql-subview').forEach(v => v.classList.remove('active'));
        const activeView = document.getElementById(`sql-${subTabId}`);
        if (activeView) activeView.classList.add('active');

        this.currentSubTab = subTabId;
    }

    /**
     * 销毁工具
     */
    destroy() {
        if (typeof this.formatTool.destroy === 'function') this.formatTool.destroy();
    }
}

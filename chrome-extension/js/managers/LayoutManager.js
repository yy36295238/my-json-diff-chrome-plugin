import { Utils } from '../utils.js';

export class LayoutManager {
    constructor(app) {
        this.app = app;
        this.splitPaneWidths = [];
        this.splitPaneContents = [];
        this.maxSplitPanes = 5;
    }

    init() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('themeToggle').addEventListener('click', () => this.app.toggleTheme());
        document.getElementById('clearAll').addEventListener('click', () => this.app.clearAll());
        document.getElementById('historyBtn').addEventListener('click', () => this.showHistory());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
        document.getElementById('closeError').addEventListener('click', () => this.hideErrorPanel());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('closeSidebar').addEventListener('click', () => this.closeSidebar());

        const addSplitBtn = document.getElementById('addSplitPane');
        if (addSplitBtn) addSplitBtn.addEventListener('click', () => this.addSplitPane());

        this.initMultiSplit();
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetBtn) targetBtn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const targetContent = document.getElementById(`${tabName}-content`);
        if (targetContent) targetContent.classList.add('active');

        this.app.currentTab = tabName;
        this.updateStatus(`已切换到${this.getTabName(tabName)}`);
    }

    getTabName(name) {
        const map = { formatter: '格式化', compare: '对比', generator: '生成器', converter: '转换', split: '分隔栏' };
        return map[name] || name;
    }

    updateStatus(msg) {
        const el = document.getElementById('statusInfo');
        if (el) el.textContent = msg;
    }

    showError(title, message) {
        const panel = document.getElementById('errorPanel');
        const content = document.getElementById('errorContent');
        content.innerHTML = `<strong>${title}</strong><br><br>${message.replace(/\n/g, '<br>')}`;
        panel.style.display = 'block';
        this.updateStatus(`错误: ${title}`);
    }

    hideErrorPanel() {
        document.getElementById('errorPanel').style.display = 'none';
    }

    showSidebar(title, contentHTML) {
        document.getElementById('sidebarTitle').textContent = title;
        document.getElementById('sidebarContent').innerHTML = contentHTML;
        document.getElementById('sidebar').style.display = 'block';
    }

    closeSidebar() {
        document.getElementById('sidebar').style.display = 'none';
    }

    showModal(title, bodyHTML, onConfirm) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHTML;
        document.getElementById('modal').style.display = 'flex';
        
        const confirmBtn = document.getElementById('modalConfirm');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            this.closeModal();
        });
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }

    showHistory() {
        const list = this.app.history.map((item, idx) => `
            <div class="history-item ${idx === this.app.historyIndex ? 'current' : ''}" onclick="window.jsonTool.loadFromHistory(${idx})">
                <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
                <div class="history-preview">${Utils.escapeHtml(item.content.substring(0, 100))}...</div>
            </div>
        `).join('');
        this.showSidebar('操作历史', `<div class="history-list">${list || '暂无历史'}</div>`);
    }

    showSettings() {
        this.showSidebar('设置', `
            <div class="settings-panel">
                <h4>应用设置</h4>
                <div class="setting-group">
                    <label><input type="radio" name="theme" value="light" ${this.app.theme === 'light' ? 'checked' : ''} onclick="window.jsonTool.setTheme('light')"> 亮色</label>
                    <label><input type="radio" name="theme" value="dark" ${this.app.theme === 'dark' ? 'checked' : ''} onclick="window.jsonTool.setTheme('dark')"> 暗色</label>
                </div>
            </div>
        `);
    }

    showHelp() {
        this.showModal('帮助', '<p>快捷键: Cmd+Shift+F (格式化)</p>');
    }

    // Multi Split Logic
    initMultiSplit() {
        try {
            const data = JSON.parse(localStorage.getItem('json-tool-data') || '{}');
            if (data.splitPaneWidths) this.splitPaneWidths = data.splitPaneWidths;
            if (data.splitPaneContents) this.splitPaneContents = data.splitPaneContents;
        } catch (e) {}

        if (!this.splitPaneWidths.length) {
            this.splitPaneWidths = Array(3).fill(1/3);
            this.splitPaneContents = Array(3).fill('');
        }
        this.renderMultiSplit();
    }

    renderMultiSplit() {
        const container = document.getElementById('multiSplitContainer');
        if (!container) return;
        container.innerHTML = '';
        
        this.splitPaneWidths.forEach((width, i) => {
            const pane = document.createElement('div');
            pane.className = 'multi-pane';
            pane.style.flex = `${width} 0 0%`;
            pane.innerHTML = `
                <header>
                    <div>面板 ${i + 1}</div>
                    <div class="pane-actions">
                        <button class="pane-action-btn" onclick="window.jsonTool.layout.formatPane(${i})">美</button>
                        <button class="pane-delete-btn" onclick="window.jsonTool.layout.removeSplitPane(${i})">×</button>
                    </div>
                </header>
                <div class="multi-pane-content">
                    <textarea class="multi-pane-textarea" oninput="window.jsonTool.layout.updatePaneContent(${i}, this.value)">${this.splitPaneContents[i] || ''}</textarea>
                </div>
            `;
            container.appendChild(pane);
            if (i < this.splitPaneWidths.length - 1) {
                const resizer = document.createElement('div');
                resizer.className = 'multi-split-resizer';
                // Add drag logic here (simplified for brevity)
                container.appendChild(resizer);
            }
        });
        this.saveSplitLayout();
    }

    addSplitPane() {
        if (this.splitPaneWidths.length >= this.maxSplitPanes) return;
        const n = this.splitPaneWidths.length + 1;
        this.splitPaneWidths = Array(n).fill(1/n);
        this.splitPaneContents.push('');
        this.renderMultiSplit();
    }

    removeSplitPane(index) {
        if (this.splitPaneWidths.length <= 1) return;
        this.splitPaneContents.splice(index, 1);
        const n = this.splitPaneWidths.length - 1;
        this.splitPaneWidths = Array(n).fill(1/n);
        this.renderMultiSplit();
    }

    updatePaneContent(index, value) {
        this.splitPaneContents[index] = value;
        this.saveSplitLayout();
    }

    formatPane(index) {
        try {
            const val = this.splitPaneContents[index];
            const pretty = JSON.stringify(JSON.parse(val), null, 2);
            this.splitPaneContents[index] = pretty;
            this.renderMultiSplit();
        } catch(e) {}
    }

    saveSplitLayout() {
        const data = { splitPaneWidths: this.splitPaneWidths, splitPaneContents: this.splitPaneContents };
        localStorage.setItem('json-tool-data', JSON.stringify(data));
    }
}

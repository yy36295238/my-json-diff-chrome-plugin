export class OtherToolsManager {
    constructor(app) {
        this.app = app;
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Navigation Logic
        document.querySelectorAll('.tool-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toolId = e.currentTarget.dataset.tool;
                this.switchTool(toolId);
            });
        });

        // Timestamp Tool Events
        const tsInput = document.getElementById('timestampInput');
        const dateInput = document.getElementById('dateInput');
        const tsToDateBtn = document.getElementById('tsToDateBtn');
        const dateToTsBtn = document.getElementById('dateToTsBtn');
        const useCurrentTimeBtn = document.getElementById('useCurrentTimeBtn');
        const clearTimeBtn = document.getElementById('clearTimeBtn');

        if (tsToDateBtn) {
            tsToDateBtn.addEventListener('click', () => this.convertTsToDate());
        }

        if (dateToTsBtn) {
            dateToTsBtn.addEventListener('click', () => this.convertDateToTs());
        }

        if (useCurrentTimeBtn) {
            useCurrentTimeBtn.addEventListener('click', () => {
                const now = new Date();
                if (tsInput) tsInput.value = now.getTime();
                if (dateInput) dateInput.value = this.formatDate(now);
                this.showResult(`当前时间: ${this.formatDate(now)} / ${now.getTime()}`);
            });
        }

        if (clearTimeBtn) {
            clearTimeBtn.addEventListener('click', () => {
                if (tsInput) tsInput.value = '';
                if (dateInput) dateInput.value = '';
                this.hideResult();
            });
        }
    }

    switchTool(toolId) {
        // Update Nav
        document.querySelectorAll('.tool-nav-item').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.tool-nav-item[data-tool="${toolId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update View
        document.querySelectorAll('.tool-view').forEach(view => view.classList.remove('active'));
        const activeView = document.getElementById(`tool-${toolId}`);
        if (activeView) activeView.classList.add('active');
    }

    convertTsToDate() {
        const tsInput = document.getElementById('timestampInput');
        const dateInput = document.getElementById('dateInput');
        
        if (!tsInput || !tsInput.value.trim()) {
            this.app.layout.showError('请输入时间戳');
            return;
        }

        let ts = tsInput.value.trim();
        // Auto detect seconds vs milliseconds
        if (ts.length === 10) {
            ts = parseInt(ts) * 1000;
        } else {
            ts = parseInt(ts);
        }

        if (isNaN(ts)) {
            this.app.layout.showError('无效的时间戳格式');
            return;
        }

        const date = new Date(ts);
        if (date.toString() === 'Invalid Date') {
            this.app.layout.showError('无效的时间戳');
            return;
        }

        const formatted = this.formatDate(date);
        if (dateInput) dateInput.value = formatted;
        this.showResult(`转换结果: ${formatted}`);
    }

    convertDateToTs() {
        const dateInput = document.getElementById('dateInput');
        const tsInput = document.getElementById('timestampInput');

        if (!dateInput || !dateInput.value.trim()) {
            this.app.layout.showError('请输入日期时间');
            return;
        }

        const dateStr = dateInput.value.trim();
        const date = new Date(dateStr);

        if (date.toString() === 'Invalid Date') {
            this.app.layout.showError('无效的日期格式 (推荐: YYYY-MM-DD HH:mm:ss)');
            return;
        }

        const ts = date.getTime();
        if (tsInput) tsInput.value = ts;
        this.showResult(`转换结果: ${ts}`);
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    showResult(text) {
        const panel = document.getElementById('timeResultPanel');
        const p = document.getElementById('timeResultText');
        if (panel && p) {
            p.textContent = text;
            panel.style.display = 'block';
        }
    }

    hideResult() {
        const panel = document.getElementById('timeResultPanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
}
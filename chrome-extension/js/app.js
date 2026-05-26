import { FormatterManager } from './managers/FormatterManager.js';
import { CompareManager } from './managers/CompareManager.js';
import { ConverterManager } from './managers/ConverterManager.js';
import { OtherToolsManager } from './managers/OtherToolsManager.js';
import { LayoutManager } from './managers/LayoutManager.js';
import { NotesManager } from './managers/NotesManager.js';

class JSONToolApp {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
        this.theme = localStorage.getItem('json-tool-theme') || 'light';
        this.currentTab = 'formatter';

        this.layout = new LayoutManager(this);
        this.formatter = new FormatterManager(this);
        this.compare = new CompareManager(this);
        this.converter = new ConverterManager(this);
        this.otherTools = new OtherToolsManager(this);
        this.notes = new NotesManager(this);
    }

    init() {
        // Expose to window for inline HTML events
        window.jsonTool = this;

        this.layout.init();
        this.formatter.init();
        this.compare.init();
        this.converter.init();
        this.otherTools.init();
        this.notes.init();

        this.setupTheme();
        this.loadFromLocalStorage();
        this.layout.updateStatus('应用已就绪');
    }

    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = this.theme === 'light' ? '🌙' : '☀️';
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('json-tool-theme', this.theme);
        this.setupTheme();
    }

    setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('json-tool-theme', this.theme);
        this.setupTheme();
    }

    addToHistory(content) {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push({ content, timestamp: new Date().toISOString() });
        if (this.history.length > 50) this.history = this.history.slice(-50);
        this.historyIndex = this.history.length - 1;
        this.saveToLocalStorage();
    }

    loadFromHistory(index) {
        if (index >= 0 && index < this.history.length) {
            this.historyIndex = index;
            const item = this.history[index];
            document.getElementById('jsonEditor').value = item.content;
            this.formatter.updateEditorInfo();
            this.formatter.realTimeValidation(item.content);
            this.layout.closeSidebar();
        }
    }

    saveToLocalStorage() {
        try {
            const data = {
                history: this.history,
                theme: this.theme,
                compareHistoryLeft: this.compare.historyLeft,
                compareHistoryRight: this.compare.historyRight
            };
            localStorage.setItem('json-tool-state', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save state', e);
        }
    }

    loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem('json-tool-state');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.history) {
                    this.history = data.history;
                    this.historyIndex = this.history.length - 1;
                }
                if (data.theme) this.theme = data.theme;
                if (data.compareHistoryLeft) {
                    this.compare.historyLeft = data.compareHistoryLeft;
                    this.compare.historyLeftIndex = this.compare.historyLeft.length - 1;
                }
                if (data.compareHistoryRight) {
                    this.compare.historyRight = data.compareHistoryRight;
                    this.compare.historyRightIndex = this.compare.historyRight.length - 1;
                }
            }
        } catch (e) {
            console.error('Failed to load state', e);
        }
    }

    async clearAll() {
        const confirmed = await this.layout.confirm({
            title: '清除内容',
            message: '确定要清除当前编辑器中的所有内容吗？',
            confirmText: '清除',
            danger: true
        });
        if (!confirmed) {
            return;
        }

        document.getElementById('jsonEditor').value = '';
        this.formatter.updatePreview('');
        this.formatter.updateEditorInfo();
        this.layout.hideErrorPanel();
        this.layout.updateStatus('已清除');
    }
}

// Initialize
function startApp() {
    const app = new JSONToolApp();
    app.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

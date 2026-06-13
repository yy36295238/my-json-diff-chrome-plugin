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

        // 各模块初始化相互隔离，单个模块出错不应中断整个应用
        const managers = [
            ['layout', this.layout],
            ['formatter', this.formatter],
            ['compare', this.compare],
            ['converter', this.converter],
            ['otherTools', this.otherTools],
            ['notes', this.notes]
        ];
        managers.forEach(([name, manager]) => {
            try {
                manager.init();
            } catch (e) {
                console.error(`模块 ${name} 初始化失败:`, e);
            }
        });

        this.setupTheme();
        this.setupKeyboardShortcuts();
        this.loadFromLocalStorage();
        this.layout.updateStatus('应用已就绪');
    }

    setupTheme() {
        // 图标的月亮/太阳切换由 CSS 按 data-theme 控制，这里不覆盖按钮内容
        document.documentElement.setAttribute('data-theme', this.theme);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + Enter：执行当前页签的主操作
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                if (this.currentTab === 'formatter') {
                    this.formatter.formatJSON?.();
                } else if (this.currentTab === 'compare') {
                    document.getElementById('compareBtn')?.click();
                } else if (this.currentTab === 'converter') {
                    document.getElementById('convertBtn')?.click();
                }
                return;
            }

            // Tab 键在代码编辑区插入两个空格，而不是跳走焦点
            if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                const t = e.target;
                const isCodeArea = t.tagName === 'TEXTAREA' && (
                    t.classList.contains('code-editor') ||
                    t.classList.contains('hex-editor') ||
                    t.classList.contains('multi-pane-textarea')
                );
                if (isCodeArea) {
                    e.preventDefault();
                    t.setRangeText('  ', t.selectionStart, t.selectionEnd, 'end');
                    t.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });
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
        // 防抖：编辑过程中高频调用时合并写入，避免每次键击全量序列化
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._persistState(), 500);
    }

    _persistState() {
        // 超大条目不持久化（仍保留在内存中可撤销），防止撑爆 localStorage 配额
        const MAX_ENTRY = 200 * 1024;
        const slim = (list) => (list || []).filter(item => (item.content || '').length <= MAX_ENTRY);
        const buildData = (keep) => ({
            history: slim(this.history).slice(-keep),
            theme: this.theme,
            compareHistoryLeft: slim(this.compare.historyLeft).slice(-keep),
            compareHistoryRight: slim(this.compare.historyRight).slice(-keep)
        });

        try {
            localStorage.setItem('json-tool-state', JSON.stringify(buildData(50)));
        } catch (e) {
            // 配额超限：裁剪历史后重试一次，仍失败则提示用户
            try {
                localStorage.setItem('json-tool-state', JSON.stringify(buildData(10)));
                this.layout.showToast?.('存储空间不足，已自动裁剪历史记录', 'warning');
            } catch (e2) {
                console.error('Failed to save state', e2);
                this.layout.showToast?.('保存状态失败：存储空间不足', 'error');
            }
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
                // 主题以 json-tool-theme 为唯一来源（setupTheme 已应用），这里不再覆盖
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
        this.addToHistory('');
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

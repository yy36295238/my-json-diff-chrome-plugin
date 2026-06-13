import { Utils } from '../utils.js';
import { JSONRenderer } from '../JSONRenderer.js';

export class FormatterManager {
    constructor(app) {
        this.app = app;
        // 实时验证/预览防抖定时器
        this.inputDebounceTimer = null;
        // 防抖延迟（毫秒）
        this.INPUT_DEBOUNCE_DELAY = 300;
        // 超过此大小（1MB）时跳过自动预览更新
        this.AUTO_PREVIEW_SIZE_LIMIT = 1024 * 1024;
        // 上一次渲染的行号数量（行数不变时跳过 DOM 重建）
        this.lastLineNumberCount = -1;
    }

    init() {
        // 格式化功能
        document.getElementById('formatBtn').addEventListener('click', () => this.formatJSON());
        document.getElementById('compressBtn').addEventListener('click', () => this.compressJSON());
        document.getElementById('removeEscapeBtn').addEventListener('click', () => this.removeEscapeCharacters());
        const loadExampleBtn = document.getElementById('loadExampleBtn');
        if (loadExampleBtn) loadExampleBtn.addEventListener('click', () => this.loadExample());

        // 预览操作
        document.getElementById('expandAll').addEventListener('click', () => this.expandAll());
        document.getElementById('collapseAll').addEventListener('click', () => this.collapseAll());
        document.getElementById('treeView').addEventListener('click', () => this.toggleTreeView());

        // JSON编辑器实时验证（300ms 防抖，避免每次键击都执行完整解析和重渲染）
        const jsonEditor = document.getElementById('jsonEditor');
        jsonEditor.addEventListener('input', () => {
            clearTimeout(this.inputDebounceTimer);
            this.inputDebounceTimer = setTimeout(() => {
                this.updateEditorInfo();
                this.realTimeValidation(jsonEditor.value);
            }, this.INPUT_DEBOUNCE_DELAY);
        });

        // 粘贴后若整体为合法 JSON 则自动格式化（非 JSON 静默跳过；内容过大跳过以免卡顿）
        jsonEditor.addEventListener('paste', () => {
            setTimeout(() => {
                const val = jsonEditor.value.trim();
                if (!val || val.length > this.AUTO_PREVIEW_SIZE_LIMIT) return;
                try { JSON.parse(val); } catch (e) { return; }
                this.formatJSON();
                this.app.layout.updateStatus('已自动格式化粘贴的 JSON');
            }, 0);
        });
        
        // 初始化行号
        this.updateEditorLineNumbers();
        
        // 滚动同步
        jsonEditor.addEventListener('scroll', () => {
            const ln = document.getElementById('jsonEditorLines');
            if (ln) ln.scrollTop = jsonEditor.scrollTop;
        });

        // 预览区域事件委托 (修复 Chrome Extension CSP 问题)
        const jsonPreview = document.getElementById('jsonPreview');
        jsonPreview.addEventListener('click', (e) => {
            if (e.target.classList.contains('json-collapsible')) {
                JSONRenderer.toggleContent(e.target);
            } else if (e.target.classList.contains('json-key') && e.target.classList.contains('clickable')) {
                const path = e.target.getAttribute('data-path');
                if (path) {
                    this.onKeyClick(path);
                }
            } else {
                // Check if copy icon or its SVG child was clicked
                const copyBtn = e.target.closest('.copy-json-value');
                if (copyBtn) {
                    const path = copyBtn.getAttribute('data-path');
                    if (path) {
                        this.copyValueByPath(path);
                        e.stopPropagation();
                    }
                }
            }
        });
    }

    loadExample() {
        const complexExample = {
            "project": "SuperNova",
            "version": "1.0.0-beta",
            "active": true,
            "meta": {
                "created": "2023-10-27T10:00:00Z",
                "author": {
                    "name": "DevTeam Alpha",
                    "contact": "admin@example.com",
                    "roles": ["admin", "editor", "viewer"]
                },
                "tags": ["react", "typescript", "vite", "complex-json"]
            },
            "features": [
                {
                    "id": "f-001",
                    "name": "Dashboard",
                    "enabled": true,
                    "config": {
                        "layout": "grid",
                        "widgets": [
                            { "type": "chart", "source": "api/sales", "refreshRate": 30000 },
                            { "type": "list", "source": "api/tasks", "limit": 10 }
                        ]
                    }
                },
                {
                    "id": "f-002",
                    "name": "UserManagement",
                    "enabled": false,
                    "permissions": ["read", "write", "delete"]
                }
            ],
            "settings": {
                "theme": "dark",
                "notifications": {
                    "email": true,
                    "sms": false,
                    "push": {
                        "desktop": true,
                        "mobile": false
                    }
                },
                "retryPolicy": {
                    "maxAttempts": 3,
                    "backoff": "exponential"
                }
            },
            "nullValue": null,
            "emptyArray": [],
            "emptyObject": {}
        };

        const jsonString = JSON.stringify(complexExample, null, 2);
        const editor = document.getElementById('jsonEditor');
        editor.value = jsonString;
        this.updatePreview(jsonString);
        this.app.addToHistory(jsonString);
        this.updateEditorInfo();
        this.app.layout.updateStatus('已加载复杂示例数据');
    }

    formatJSON() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();

        if (!input) return;

        try {
            const parsed = JSON.parse(input);
            const deepParseCheckbox = document.getElementById('deepParseCheckbox');
            const shouldDeepParse = deepParseCheckbox ? deepParseCheckbox.checked : false;
            const result = shouldDeepParse ? this.deepParseJSON(parsed) : parsed;

            const formatted = JSON.stringify(result, null, 2);
            editor.value = formatted;
            this.clearEditorErrorState();
            this.updatePreview(formatted);
            this.app.addToHistory(formatted);
            this.app.layout.updateStatus(shouldDeepParse ? 'JSON格式化完成（递归）' : 'JSON格式化完成');
        } catch (error) {
            this.app.layout.showError('JSON格式化失败', error.message);
        }
    }

    deepParseJSON(obj) {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) return obj.map(item => this.deepParseJSON(item));
        if (typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    result[key] = this.deepParseJSON(obj[key]);
                }
            }
            return result;
        }
        if (typeof obj === 'string') {
            const trimmed = obj.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    const parsed = JSON.parse(obj);
                    return this.deepParseJSON(parsed);
                } catch (e) {
                    return obj;
                }
            }
        }
        return obj;
    }

    compressJSON() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();
        if (!input) return;

        try {
            const parsed = JSON.parse(input);
            const compressed = JSON.stringify(parsed);
            editor.value = compressed;
            this.clearEditorErrorState();
            this.updatePreview(compressed);
            this.app.addToHistory(compressed);
            this.app.layout.updateStatus('JSON压缩完成');
        } catch (error) {
            this.app.layout.showError('JSON压缩失败', error.message);
        }
    }

    removeEscapeCharacters() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();
        if (!input) return;

        try {
            const cleaned = this.processEscapeCharacters(input);
            editor.value = cleaned;
            this.updatePreview(cleaned);
            this.app.addToHistory(cleaned);
            this.updateEditorInfo();
            this.app.layout.updateStatus('转义符移除完成');
        } catch (error) {
            this.app.layout.showError('移除转义符失败', error.message);
        }
    }

    /**
     * 移除一层标准 JSON 转义符。
     * 采用单个正则按匹配分发的单趟扫描，从左到右每个转义序列只处理一次，
     * 避免链式 replace 的顺序问题（如 \\n 被两步替换成换行符、\\" 与 \" 互相干扰）。
     * 支持：\\ \" \/ \b \f \n \r \t \uXXXX；无法识别的反斜杠序列原样保留。
     */
    processEscapeCharacters(jsonString) {
        return jsonString.replace(/\\(u[0-9a-fA-F]{4}|["\\/bfnrt])/g, (match, seq) => {
            switch (seq) {
                case '"': return '"';
                case '\\': return '\\';
                case '/': return '/';
                case 'b': return '\b';
                case 'f': return '\f';
                case 'n': return '\n';
                case 'r': return '\r';
                case 't': return '\t';
                default:
                    // \uXXXX 形式
                    return String.fromCharCode(parseInt(seq.slice(1), 16));
            }
        });
    }

    realTimeValidation(input) {
        if (!input.trim()) {
            this.clearEditorErrorState();
            this.app.layout.hideErrorPanel();
            this.updatePreview('');
            return;
        }

        // 内容过大时跳过自动预览更新（点击格式化按钮仍会全量执行）
        if (input.length > this.AUTO_PREVIEW_SIZE_LIMIT) {
            this.clearEditorErrorState();
            const preview = document.getElementById('jsonPreview');
            if (preview) {
                preview.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">内容较大，请点击格式化按钮手动更新预览</div>';
            }
            this.app.layout.updateStatus('内容超过 1MB，已暂停自动预览');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            this.clearEditorErrorState();
            this.app.layout.hideErrorPanel();
            const pretty = JSON.stringify(parsed, null, 2);
            this.updatePreview(pretty);
        } catch (error) {
            // 解析失败：给编辑器加错误状态样式，并在状态栏提示错误信息和大致位置
            this.setEditorErrorState(error, input);
        }
    }

    /**
     * 标记编辑器为非法 JSON 状态，并在状态栏显示解析错误及大致位置
     */
    setEditorErrorState(error, input) {
        const editor = document.getElementById('jsonEditor');
        if (editor) editor.classList.add('json-invalid');
        const location = this.describeErrorLocation(error.message, input);
        this.app.layout.updateStatus(`JSON 解析错误: ${error.message}${location}`);
    }

    /**
     * 清除编辑器的非法 JSON 状态样式
     */
    clearEditorErrorState() {
        const editor = document.getElementById('jsonEditor');
        if (editor) editor.classList.remove('json-invalid');
    }

    /**
     * 从解析错误信息中提取 position，换算出大致的行列位置
     */
    describeErrorLocation(message, input) {
        // 新版 V8 的错误信息可能已自带 (line x column y)，避免重复追加
        if (/line \d+/i.test(message)) return '';
        const match = /position (\d+)/i.exec(message);
        if (!match) return '';
        const pos = Math.min(parseInt(match[1], 10), input.length);
        const before = input.slice(0, pos);
        const line = before.split('\n').length;
        const column = pos - before.lastIndexOf('\n');
        return `（约第 ${line} 行第 ${column} 列）`;
    }

    updatePreview(jsonString) {
        const preview = document.getElementById('jsonPreview');
        if (!jsonString) {
            preview.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">预览将在这里显示</div>';
            return;
        }
        try {
            const parsed = JSON.parse(jsonString);
            preview.innerHTML = JSONRenderer.renderJSONTree(parsed);
        } catch (error) {
            preview.innerHTML = '<div style="color: var(--error-color);">无效的JSON格式</div>';
        }
    }

    onKeyClick(path) {
        const input = document.getElementById('jsonPathResult');
        if (input) {
            input.value = path;
            input.select();
            this.app.layout.updateStatus(`JSONPath: ${path}`);
        }
    }

    copyValueByPath(path) {
        try {
            const editor = document.getElementById('jsonEditor');
            const json = JSON.parse(editor.value);
            const value = Utils.getValueByPath(json, path);
            
            if (value !== undefined) {
                const textToCopy = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
                navigator.clipboard.writeText(textToCopy).then(() => {
                    this.app.layout.updateStatus(`已复制 ${path} 的值到剪贴板`);
                }).catch(err => {
                     console.error('Clipboard write failed', err);
                     this.app.layout.showError('复制失败', '无法写入剪贴板');
                });
            } else {
                this.app.layout.updateStatus('无法获取该路径的值');
            }
        } catch (e) {
            console.error('Copy failed', e);
            this.app.layout.showError('复制失败', e.message);
        }
    }

    expandAll() {
        const preview = document.getElementById('jsonPreview');
        const collapsibles = preview.querySelectorAll('.json-collapsible');
        collapsibles.forEach(element => {
            element.textContent = '▼';
            const content = element.parentNode.querySelector('.json-collapsible-content');
            if (content) content.style.display = 'block';
        });
    }

    collapseAll() {
        const preview = document.getElementById('jsonPreview');
        const collapsibles = preview.querySelectorAll('.json-collapsible');
        collapsibles.forEach(element => {
            element.textContent = '▶';
            const content = element.parentNode.querySelector('.json-collapsible-content');
            if (content) content.style.display = 'none';
        });
    }

    toggleTreeView() {
        const preview = document.getElementById('jsonPreview');
        const isTreeView = preview.classList.contains('tree-view');
        if (isTreeView) preview.classList.remove('tree-view');
        else preview.classList.add('tree-view');
        
        const editor = document.getElementById('jsonEditor');
        if (editor.value.trim()) {
            try {
                const parsed = JSON.parse(editor.value);
                this.updatePreview(JSON.stringify(parsed, null, 2));
            } catch (error) {}
        }
    }

    updateEditorInfo() {
        const editor = document.getElementById('jsonEditor');
        const content = editor.value;
        const lines = content.split('\n').length;
        const chars = content.length;
        const bytes = new Blob([content]).size;

        document.getElementById('lineCount').textContent = `行: ${lines}`;
        document.getElementById('charCount').textContent = `字符: ${chars}`;
        document.getElementById('sizeInfo').textContent = `大小: ${Utils.formatBytes(bytes)}`;
        this.updateEditorLineNumbers();
    }

    updateEditorLineNumbers() {
        try {
            const editor = document.getElementById('jsonEditor');
            const gutter = document.getElementById('jsonEditorLines');
            if (!editor || !gutter) return;
            const count = editor.value.split('\n').length || 1;
            // 行数不变时跳过 DOM 重建，只同步滚动位置
            if (count !== this.lastLineNumberCount) {
                let html = '';
                for (let i = 1; i <= count; i++) {
                    html += `<div class="line-number">${i}</div>`;
                }
                gutter.innerHTML = html;
                this.lastLineNumberCount = count;
            }
            gutter.scrollTop = editor.scrollTop;
        } catch (e) {
            console.warn('更新编辑器行号失败:', e);
        }
    }

}

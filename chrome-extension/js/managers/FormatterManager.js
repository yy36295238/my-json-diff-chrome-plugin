import { Utils } from '../utils.js';
import { JSONRenderer } from '../JSONRenderer.js';

export class FormatterManager {
    constructor(app) {
        this.app = app;
    }

    init() {
        // 格式化功能
        document.getElementById('formatBtn').addEventListener('click', () => this.formatJSON());
        document.getElementById('compressBtn').addEventListener('click', () => this.compressJSON());
        document.getElementById('removeEscapeBtn').addEventListener('click', () => this.removeEscapeCharacters());
        document.getElementById('repairBtn').addEventListener('click', () => this.repairJSON());
        const loadExampleBtn = document.getElementById('loadExampleBtn');
        if (loadExampleBtn) loadExampleBtn.addEventListener('click', () => this.loadExample());

        // 预览操作
        document.getElementById('expandAll').addEventListener('click', () => this.expandAll());
        document.getElementById('collapseAll').addEventListener('click', () => this.collapseAll());
        document.getElementById('treeView').addEventListener('click', () => this.toggleTreeView());

        // JSON编辑器实时验证
        const jsonEditor = document.getElementById('jsonEditor');
        jsonEditor.addEventListener('input', (e) => {
            this.updateEditorInfo();
            this.realTimeValidation(e.target.value);
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

    processEscapeCharacters(jsonString) {
        try {
            let cleaned = jsonString
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\\//g, '/')
                .replace(/\\b/g, '\b')
                .replace(/\\f/g, '\f');
            cleaned = cleaned.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
            });
            return cleaned;
        } catch (error) {
            return jsonString;
        }
    }

    realTimeValidation(input) {
        if (!input.trim()) {
            this.app.layout.hideErrorPanel();
            this.updatePreview('');
            return;
        }
        try {
            const parsed = JSON.parse(input);
            this.app.layout.hideErrorPanel();
            const pretty = JSON.stringify(parsed, null, 2);
            this.updatePreview(pretty);
        } catch (error) {
            // ignore
        }
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
            let html = '';
            for (let i = 1; i <= count; i++) {
                html += `<div class="line-number">${i}</div>`;
            }
            gutter.innerHTML = html;
            gutter.scrollTop = editor.scrollTop;
        } catch (e) {}
    }

    /**
     * JSON自动修复功能
     * 修复常见的JSON格式问题,如缺失的引号、括号、逗号等
     */
    repairJSON() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();

        if (!input) {
            this.app.layout.showError('修复失败', '输入内容为空');
            return;
        }

        try {
            const repaired = this.attemptJSONRepair(input);
            editor.value = repaired;
            this.updatePreview(repaired);
            this.app.addToHistory(repaired);
            this.updateEditorInfo();
            this.app.layout.updateStatus('JSON修复完成');
        } catch (error) {
            this.app.layout.showError('JSON修复失败', error.message);
        }
    }

    attemptJSONRepair(input) {
        let text = input;

        // 1. 尝试先解析,如果成功则格式化返回
        try {
            const parsed = JSON.parse(text);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            // 继续修复
        }

        // 2. 移除BOM和多余空白字符
        text = text.replace(/^\uFEFF/, '').trim();

        // 3. 修复常见的键名缺少引号的问题
        // 匹配类似 {name: "value"} 的模式,转换为 {"name": "value"}
        text = text.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

        // 4. 修复单引号为双引号
        // 需要小心处理字符串内的单引号
        text = this.replaceSingleQuotesWithDouble(text);

        // 5. 修复尾随逗号问题 (JSON不允许尾随逗号)
        text = text.replace(/,(\s*[}\]])/g, '$1');

        // 6. 修复缺少逗号的问题
        // 对象属性之间缺少逗号
        text = text.replace(/("\s*)([\n\r]+\s*)(")/g, '",$2"');
        // 数组元素之间缺少逗号
        text = text.replace(/([\}\]])\s*([\n\r]+)\s*([\{\[])/g, '$1,$2$3');

        // 7. 尝试修复括号不匹配的问题
        text = this.balanceBrackets(text);

        // 8. 修复未闭合的字符串
        text = this.fixUnclosedStrings(text);

        // 9. 再次尝试解析
        try {
            const parsed = JSON.parse(text);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            // 如果还是失败,返回修复后的文本并抛出错误
            throw new Error(`无法完全修复JSON: ${e.message}`);
        }
    }

    /**
     * 将单引号替换为双引号(仅在字符串边界)
     */
    replaceSingleQuotesWithDouble(text) {
        let result = '';
        let inDoubleQuote = false;
        let inSingleQuote = false;
        let prevChar = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1] || '';

            if (char === '"' && prevChar !== '\\') {
                inDoubleQuote = !inDoubleQuote;
                result += char;
            } else if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
                if (!inSingleQuote) {
                    // 开始单引号字符串
                    inSingleQuote = true;
                    result += '"';
                } else {
                    // 结束单引号字符串
                    inSingleQuote = false;
                    result += '"';
                }
            } else {
                result += char;
            }

            prevChar = char;
        }

        return result;
    }

    /**
     * 平衡括号(大括号和中括号)
     */
    balanceBrackets(text) {
        const openBrackets = { '{': 0, '[': 0 };
        const closeBrackets = { '}': 0, ']': 0 };
        let inString = false;
        let prevChar = '';

        // 统计括号数量
        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
            }

            if (!inString) {
                if (char === '{') openBrackets['{']++;
                if (char === '[') openBrackets['[']++;
                if (char === '}') closeBrackets['}']++;
                if (char === ']') closeBrackets[']']++;
            }

            prevChar = char;
        }

        // 补充缺失的闭合括号
        let suffix = '';
        const missingCurly = openBrackets['{'] - closeBrackets['}'];
        const missingSquare = openBrackets['['] - closeBrackets[']'];

        if (missingCurly > 0) {
            suffix += '}'.repeat(missingCurly);
        }
        if (missingSquare > 0) {
            suffix += ']'.repeat(missingSquare);
        }

        // 移除多余的开括号(从开头移除)
        let result = text;
        if (missingCurly < 0) {
            // 有多余的闭合大括号,尝试移除开头的开括号
            const toRemove = Math.abs(missingCurly);
            let removed = 0;
            result = '';
            for (let i = 0; i < text.length && removed < toRemove; i++) {
                if (text[i] === '{') {
                    removed++;
                    continue;
                }
                result += text[i];
            }
            if (removed < toRemove) {
                result = text; // 还原
            }
        }

        return result + suffix;
    }

    /**
     * 修复未闭合的字符串
     */
    fixUnclosedStrings(text) {
        let result = '';
        let inString = false;
        let stringStart = -1;
        let prevChar = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === '"' && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringStart = i;
                } else {
                    inString = false;
                    stringStart = -1;
                }
            }

            result += char;
            prevChar = char;
        }

        // 如果字符串未闭合,在末尾添加引号
        if (inString && stringStart !== -1) {
            result += '"';
        }

        return result;
    }
}

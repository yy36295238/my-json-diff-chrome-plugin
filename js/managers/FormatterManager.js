import { Utils } from '../utils.js';

export class FormatterManager {
    constructor(app) {
        this.app = app;
    }

    init() {
        // 格式化功能
        document.getElementById('formatBtn').addEventListener('click', () => this.formatJSON());
        document.getElementById('compressBtn').addEventListener('click', () => this.compressJSON());
        document.getElementById('removeEscapeBtn').addEventListener('click', () => this.removeEscapeCharacters());

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
            preview.innerHTML = this.renderJSONTree(parsed);
        } catch (error) {
            preview.innerHTML = '<div style="color: var(--error-color);">无效的JSON格式</div>';
        }
    }

    renderJSONTree(obj, level = 0, key = null, path = '$') {
        let html = '';
        if (key !== null) {
            const safeKey = Utils.escapeHtml(key);
            html += `<span class="json-key clickable" onclick="window.jsonTool.formatter.onKeyClick('${Utils.escapePath(path)}')" title="点击复制 JSONPath">"${safeKey}"</span>: `;
        }

        if (obj === null) {
            html += `<span class="json-null">null</span>`;
        } else if (typeof obj === 'boolean') {
            html += `<span class="json-boolean">${obj}</span>`;
        } else if (typeof obj === 'number') {
            html += `<span class="json-number">${obj}</span>`;
        } else if (typeof obj === 'string') {
            html += `<span class="json-string">"${Utils.escapeHtml(obj)}"</span>`;
        } else if (Array.isArray(obj)) {
            html += this.renderArrayStructure(obj, level, path);
        } else if (typeof obj === 'object') {
            html += this.renderObjectStructure(obj, level, path);
        }
        return html;
    }

    renderArrayStructure(arr, level, currentPath) {
        if (arr.length === 0) return `<span class="json-bracket">[]</span>`;
        let html = '';
        html += `<span class="json-collapsible" onclick="window.jsonTool.formatter.toggleContent(this)">▼</span>`;
        html += `<span class="json-bracket">[</span>`;
        html += `<span style="color: var(--text-muted); margin-left: 8px;">${arr.length} items</span>`;
        html += `<div class="json-collapsible-content" style="margin-left: 20px; border-left: 1px solid var(--border-color); padding-left: 10px;">`;
        arr.forEach((item, index) => {
            const itemPath = `${currentPath}[${index}]`;
            html += `<div style="margin: 4px 0;">`;
            html += `<span style="color: var(--text-muted); margin-right: 8px;">[${index}]:</span>`;
            html += this.renderJSONTree(item, level + 1, null, itemPath);
            if (index < arr.length - 1) html += '<span class="json-bracket">,</span>';
            html += `</div>`;
        });
        html += `</div>`;
        html += `<span class="json-bracket">]</span>`;
        return html;
    }

    renderObjectStructure(obj, level, currentPath) {
        const keys = Object.keys(obj);
        if (keys.length === 0) return `<span class="json-bracket">{}</span>`;
        let html = '';
        html += `<span class="json-collapsible" onclick="window.jsonTool.formatter.toggleContent(this)">▼</span>`;
        html += `<span class="json-bracket">{</span>`;
        html += `<span style="color: var(--text-muted); margin-left: 8px;">${keys.length} ${keys.length === 1 ? 'property' : 'properties'}</span>`;
        html += `<div class="json-collapsible-content" style="margin-left: 20px; border-left: 1px solid var(--border-color); padding-left: 10px;">`;
        keys.forEach((key, index) => {
            const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `.${key}` : `['${key}']`;
            const propPath = `${currentPath}${safeKey}`;
            html += `<div style="margin: 4px 0;">`;
            html += this.renderJSONTree(obj[key], level + 1, key, propPath);
            if (index < keys.length - 1) html += '<span class="json-bracket">,</span>';
            html += `</div>`;
        });
        html += `</div>`;
        html += `<span class="json-bracket">}</span>`;
        return html;
    }

    toggleContent(element) {
        let content = element.nextElementSibling;
        while (content && !content.classList.contains('json-collapsible-content')) {
            content = content.nextElementSibling;
        }
        if (!content) {
            content = element.parentNode.querySelector('.json-collapsible-content');
        }
        if (content) {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            element.textContent = isVisible ? '▶' : '▼';
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
}

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
        document.getElementById('smartRepairBtn').addEventListener('click', () => this.smartRepairJSON());
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
     * AI智能修复JSON (调用智谱AI)
     */
    async smartRepairJSON() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();

        if (!input) {
            this.app.layout.showError('修复失败', '输入内容为空');
            return;
        }

        const apiKey = localStorage.getItem('zhipu_api_key');
        if (!apiKey) {
            this.app.layout.showError('未配置 API Key', '请点击右上角设置按钮配置智谱AI API Key');
            // 尝试打开设置面板 (如果 LayoutManager 有这个方法)
            if (this.app.layout.openSettings) {
                this.app.layout.openSettings();
            }
            return;
        }

        const btn = document.getElementById('smartRepairBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128a104,104,0,0,1-20.8,61.95L192,170.82a88,88,0,0,0,0-85.64l19.2-19.13A104,104,0,0,1,232,128Z"></path></svg> 修复中...`;
        this.app.layout.updateStatus('正在调用智谱AI进行智能修复...');

        try {
            const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "glm-4-flash",
                    messages: [
                        {
                            "role": "system",
                            "content": "你是一个JSON修复专家。你的任务是将用户提供的错误的JSON文本修复为标准、合法的JSON格式。请只输出修复后的JSON字符串，不要包含任何Markdown标记（如```json），不要包含任何解释性文字。必须确保输出是合法的JSON。如果输入已经是合法的，请原样返回。"
                        },
                        {
                            "role": "user",
                            "content": input
                        }
                    ],
                    temperature: 0.1,
                    top_p: 0.7,
                    max_tokens: 4096
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API 请求失败');
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;

            if (content) {
                // 清理可能的 markdown 标记
                let cleaned = content.trim();
                if (cleaned.startsWith('```json')) {
                    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                } else if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
                }

                // 验证并格式化
                try {
                    const parsed = JSON.parse(cleaned);
                    const formatted = JSON.stringify(parsed, null, 2);
                    editor.value = formatted;
                    this.updatePreview(formatted);
                    this.app.addToHistory(formatted);
                    this.updateEditorInfo();
                    this.app.layout.updateStatus('智能修复成功');
                    if (this.app.layout.showSuccess) {
                        this.app.layout.showSuccess('智能修复成功', 'JSON 已成功修复并格式化。');
                    }
                } catch (e) {
                    console.warn('AI output is not valid JSON:', cleaned);
                    editor.value = cleaned;
                    this.app.layout.showError('修复结果验证失败', 'AI返回的内容不是有效的JSON格式，已填充到编辑器供您检查。');
                }
            } else {
                 throw new Error('AI 未返回有效内容');
            }

        } catch (error) {
            console.error('Smart repair failed', error);
            this.app.layout.showError('智能修复失败', error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

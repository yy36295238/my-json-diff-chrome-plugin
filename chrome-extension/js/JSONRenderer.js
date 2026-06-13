import { Utils } from './utils.js';

export const JSONRenderer = {
    // 大 JSON 渲染保护：单节点最多渲染的子项数 / 整棵树最多渲染的节点数
    MAX_CHILDREN_PER_NODE: 500,
    MAX_TOTAL_NODES: 20000,
    _nodeCount: 0,

    renderJSONTree(obj, level = 0, key = null, path = '$') {
        // 顶层调用时重置节点计数器
        if (level === 0) this._nodeCount = 0;
        this._nodeCount++;
        let html = '';
        if (key !== null) {
            const safeKey = Utils.escapeHtml(key);
            const safePath = Utils.escapeHtml(path); 
            html += `<span class="json-key-wrapper" style="position: relative; display: inline-flex; align-items: center;">`;
            html += `<span class="json-key clickable" data-path="${safePath}" title="点击复制 JSONPath">"${safeKey}"</span>`;
            html += `<span class="copy-json-value" data-path="${safePath}" title="复制值到剪贴板" style="cursor: pointer; margin-left: 6px; display: inline-flex; align-items: center; color: var(--text-muted); opacity: 0; transition: opacity 0.2s;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path></svg></span>`;
            html += `</span>: `;
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
    },

    renderArrayStructure(arr, level, currentPath) {
        if (arr.length === 0) return `<span class="json-bracket">[]</span>`;
        // 总节点数超限时停止深入，渲染为折叠占位文本
        if (this._nodeCount > this.MAX_TOTAL_NODES) {
            return `<span class="json-item" style="color: var(--text-muted);">[ … ${arr.length} 项已折叠（数据过大） ]</span>`;
        }
        const renderCount = Math.min(arr.length, this.MAX_CHILDREN_PER_NODE);
        let html = '';
        html += `<span class="json-collapsible">▼</span>`;
        html += `<span class="json-bracket">[</span>`;
        html += `<span style="color: var(--text-muted); margin-left: 8px;">${arr.length} items</span>`;
        html += `<div class="json-collapsible-content" style="margin-left: 20px; border-left: 1px solid var(--border-color); padding-left: 10px;">`;
        for (let index = 0; index < renderCount; index++) {
            const itemPath = `${currentPath}[${index}]`;
            html += `<div style="margin: 4px 0;">`;
            html += `<span style="color: var(--text-muted); margin-right: 8px;">[${index}]:</span>`;
            html += this.renderJSONTree(arr[index], level + 1, null, itemPath);
            if (index < arr.length - 1) html += '<span class="json-bracket">,</span>';
            html += `</div>`;
        }
        // 子项过多时只渲染前面部分，追加不可折叠的提示节点
        if (arr.length > renderCount) {
            html += `<div class="json-item" style="margin: 4px 0; color: var(--text-muted);">… 其余 ${arr.length - renderCount} 项已省略（数据过大）</div>`;
        }
        html += `</div>`;
        html += `<span class="json-bracket">]</span>`;
        return html;
    },

    renderObjectStructure(obj, level, currentPath) {
        const keys = Object.keys(obj);
        if (keys.length === 0) return `<span class="json-bracket">{}</span>`;
        // 总节点数超限时停止深入，渲染为折叠占位文本
        if (this._nodeCount > this.MAX_TOTAL_NODES) {
            return `<span class="json-item" style="color: var(--text-muted);">{ … ${keys.length} 个属性已折叠（数据过大） }</span>`;
        }
        const renderCount = Math.min(keys.length, this.MAX_CHILDREN_PER_NODE);
        let html = '';
        html += `<span class="json-collapsible">▼</span>`;
        html += `<span class="json-bracket">{</span>`;
        html += `<span style="color: var(--text-muted); margin-left: 8px;">${keys.length} ${keys.length === 1 ? 'property' : 'properties'}</span>`;
        html += `<div class="json-collapsible-content" style="margin-left: 20px; border-left: 1px solid var(--border-color); padding-left: 10px;">`;
        for (let index = 0; index < renderCount; index++) {
            const key = keys[index];
            // 非法标识符 key 使用 ['...'] 形式，并转义其中的单引号
            const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? `.${key}` : `['${Utils.escapePath(key)}']`;
            const propPath = `${currentPath}${safeKey}`;
            html += `<div style="margin: 4px 0;">`;
            html += this.renderJSONTree(obj[key], level + 1, key, propPath);
            if (index < keys.length - 1) html += '<span class="json-bracket">,</span>';
            html += `</div>`;
        }
        // 子项过多时只渲染前面部分，追加不可折叠的提示节点
        if (keys.length > renderCount) {
            html += `<div class="json-item" style="margin: 4px 0; color: var(--text-muted);">… 其余 ${keys.length - renderCount} 项已省略（数据过大）</div>`;
        }
        html += `</div>`;
        html += `<span class="json-bracket">}</span>`;
        return html;
    },

    toggleContent(element) {
        let content = element.nextElementSibling;
        while (content && !content.classList.contains('json-collapsible-content')) {
            content = content.nextElementSibling;
        }
        if (!content) {
            // 只在直接子元素中查找，避免命中嵌套块的折叠容器
            content = Array.from(element.parentNode.children)
                .find(child => child.classList.contains('json-collapsible-content')) || null;
        }
        if (content) {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            element.textContent = isVisible ? '▶' : '▼';
        }
    }
};
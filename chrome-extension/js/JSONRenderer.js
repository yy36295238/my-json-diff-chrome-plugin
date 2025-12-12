import { Utils } from './utils.js';

export const JSONRenderer = {
    renderJSONTree(obj, level = 0, key = null, path = '$') {
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
        let html = '';
        html += `<span class="json-collapsible">▼</span>`;
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
    },

    renderObjectStructure(obj, level, currentPath) {
        const keys = Object.keys(obj);
        if (keys.length === 0) return `<span class="json-bracket">{}</span>`;
        let html = '';
        html += `<span class="json-collapsible">▼</span>`;
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
    },

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
};
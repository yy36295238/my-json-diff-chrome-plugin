import { Utils } from './utils.js';

export const JSONRenderer = {
    renderJSONTree(obj, level = 0, key = null, path = '$') {
        let html = '';
        if (key !== null) {
            const safeKey = Utils.escapeHtml(key);
            const safePath = Utils.escapeHtml(path); 
            html += `<span class="json-key clickable" data-path="${safePath}" title="点击复制 JSONPath">"${safeKey}"</span>: `;
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
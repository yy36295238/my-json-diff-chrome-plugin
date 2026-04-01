const fs = require('fs');

const filePath = 'chrome-extension/js/managers/LayoutManager.js';
let content = fs.readFileSync(filePath, 'utf8');

const oldStr = `    openSettings() {
        const apiKey = localStorage.getItem('zhipu_api_key') || '';
        const html = \`
            <div class="settings-form" style="padding: 10px;">
                <div class="config-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">智谱AI API Key</label>
                    <input type="password" id="zhipuApiKey" class="input-field" value="\${apiKey}" placeholder="请输入 API Key" style="width: 100%;">
                    <p class="help-text" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                        用于智能修复 JSON 功能。请访问 <a href="https://open.bigmodel.cn/" target="_blank" style="color: var(--primary-color);">智谱AI开放平台</a> 获取。
                        <br>API Key 仅保存在本地浏览器中。
                    </p>
                </div>
                <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button class="tool-btn primary" id="saveSettingsBtn">保存设置</button>
                </div>
            </div>
        \`;

        this.showSidebar('设置', html);

        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            const key = document.getElementById('zhipuApiKey').value.trim();
            if (key) {
                localStorage.setItem('zhipu_api_key', key);
                this.updateStatus('设置已保存');
                this.closeSidebar();
            } else {
                localStorage.removeItem('zhipu_api_key');
                this.updateStatus('API Key 已清除');
                this.closeSidebar();
            }
        });
    }`;

const newStr = `    openSettings() {
        const apiKey = localStorage.getItem('zhipu_api_key') || '';
        const zhipuModel = localStorage.getItem('zhipu_model') || 'glm-4-flash';
        const html = \`
            <div class="settings-form" style="padding: 10px;">
                <div class="config-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">智谱AI API Key</label>
                    <input type="password" id="zhipuApiKey" class="input-field" value="\${apiKey}" placeholder="请输入 API Key" style="width: 100%;">
                    <p class="help-text" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                        用于智能修复 JSON 功能。请访问 <a href="https://open.bigmodel.cn/" target="_blank" style="color: var(--primary-color);">智谱AI开放平台</a> 获取。
                        <br>API Key 仅保存在本地浏览器中。
                    </p>
                </div>
                <div class="config-group" style="margin-top: 15px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">智谱AI 模型名称</label>
                    <input type="text" id="zhipuModel" class="input-field" value="\${zhipuModel}" placeholder="例如: glm-4-flash" style="width: 100%;">
                    <p class="help-text" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                        默认为 glm-4-flash。如果需要更高精度，可填入其他模型名称（如 glm-4）。
                    </p>
                </div>
                <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button class="tool-btn primary" id="saveSettingsBtn">保存设置</button>
                </div>
            </div>
        \`;

        this.showSidebar('设置', html);

        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            const key = document.getElementById('zhipuApiKey').value.trim();
            const model = document.getElementById('zhipuModel').value.trim();
            
            if (key) {
                localStorage.setItem('zhipu_api_key', key);
            } else {
                localStorage.removeItem('zhipu_api_key');
            }

            if (model) {
                localStorage.setItem('zhipu_model', model);
            } else {
                localStorage.removeItem('zhipu_model');
            }

            this.updateStatus('设置已保存');
            this.closeSidebar();
        });
    }`;

// use replace with regex handling windows/unix line endings properly
const normalizedOldStr = oldStr.replace(/\r\n/g, '\n');
const normalizedContent = content.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedOldStr)) {
    fs.writeFileSync(filePath, normalizedContent.replace(normalizedOldStr, newStr), 'utf8');
    console.log('LayoutManager.js patched successfully');
} else {
    console.log('Could not find the exact string. Let me use AST or regex with dotall.');
    const regex = /openSettings\(\)\s*\{[\s\S]*?\}\);[\s]*\}/m;
    if (regex.test(normalizedContent)) {
        fs.writeFileSync(filePath, normalizedContent.replace(regex, newStr), 'utf8');
        console.log('LayoutManager.js patched with regex successfully');
    }
}


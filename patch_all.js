const fs = require('fs');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [regex, newStr] of replacements) {
        if (!regex.test(content)) {
            console.error(`Failed to match regex in ${filePath}:\n${regex}`);
        } else {
            content = content.replace(regex, newStr);
        }
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${filePath} patched successfully.`);
}

// 1. LayoutManager.js
replaceInFile('chrome-extension/js/managers/LayoutManager.js', [
    [
        /const apiKey = localStorage\.getItem\('zhipu_api_key'\) \|\| '';[\s\S]*?<div style="margin-top: 20px; display: flex; justify-content: flex-end;">/m,
        `const apiKey = localStorage.getItem('zhipu_api_key') || '';
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
                <div style="margin-top: 20px; display: flex; justify-content: flex-end;">`
    ],
    [
        /const key = document\.getElementById\('zhipuApiKey'\)\.value\.trim\(\);[\s\S]*?this\.closeSidebar\(\);\s*\}/m,
        `const key = document.getElementById('zhipuApiKey').value.trim();
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
            this.closeSidebar();`
    ]
]);

// 2. FormatterManager.js
replaceInFile('chrome-extension/js/managers/FormatterManager.js', [
    [
        /const apiKey = localStorage\.getItem\('zhipu_api_key'\);/,
        `const apiKey = localStorage.getItem('zhipu_api_key');\n        const zhipuModel = localStorage.getItem('zhipu_model') || 'glm-4-flash';`
    ],
    [
        /model: "glm-4-flash"/,
        `model: zhipuModel`
    ]
]);

// 3. CompareManager.js
replaceInFile('chrome-extension/js/managers/CompareManager.js', [
    [
        /const apiKey = localStorage\.getItem\('zhipu_api_key'\);/,
        `const apiKey = localStorage.getItem('zhipu_api_key');\n        const zhipuModel = localStorage.getItem('zhipu_model') || 'glm-4-flash';`
    ],
    [
        /model: "glm-4-flash"/,
        `model: zhipuModel`
    ]
]);


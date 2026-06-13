// Chrome扩展内容脚本
// 用于与网页交互的脚本

// 监听来自popup或background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractJSON') {
        // 尝试从页面提取JSON数据
        const jsonData = extractJSONFromPage();
        sendResponse({ json: jsonData });
    }

    if (request.action === 'injectJSONTool') {
        // 在页面中注入JSON工具面板
        injectJSONToolPanel();
    }
});

// 从页面提取JSON数据
function extractJSONFromPage() {
    const possibleJSONElements = [
        // 查找包含JSON的script标签
        'script[type="application/json"]',
        'script[type="application/ld+json"]',
        // 查找pre标签中的JSON
        'pre',
        // 查找code标签中的JSON
        'code'
    ];

    const foundJSON = [];

    possibleJSONElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            const text = element.textContent.trim();
            if (text && isValidJSON(text)) {
                foundJSON.push({
                    selector: selector,
                    json: text,
                    element: element
                });
            }
        });
    });

    return foundJSON;
}

// 验证是否为有效JSON
function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

// 在页面中注入JSON工具面板（可选功能）
function injectJSONToolPanel() {
    // 检查是否已经注入
    if (document.getElementById('json-tool-panel')) {
        return;
    }

    // 创建工具面板
    const panel = document.createElement('div');
    panel.id = 'json-tool-panel';
    panel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        height: 400px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: Arial, sans-serif;
        display: flex;
        flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        padding: 10px;
        background: #4FC3F7;
        color: white;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: bold;
    `;
    header.innerHTML = `
        <span>🔧 JSON工具</span>
        <button id="close-json-panel" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">×</button>
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        padding: 10px;
        flex: 1;
        overflow-y: auto;
    `;

    const textarea = document.createElement('textarea');
    textarea.id = 'injected-json-input';
    textarea.style.cssText = `
        width: 100%;
        height: 200px;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 12px;
        resize: vertical;
    `;
    textarea.placeholder = '在这里输入JSON数据...';

    const buttonGroup = document.createElement('div');
    buttonGroup.style.cssText = `
        margin-top: 10px;
        display: flex;
        gap: 5px;
    `;

    const formatBtn = document.createElement('button');
    formatBtn.textContent = '格式化';
    formatBtn.style.cssText = `
        padding: 6px 12px;
        background: #4FC3F7;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;

    const compressBtn = document.createElement('button');
    compressBtn.textContent = '压缩';
    compressBtn.style.cssText = `
        padding: 6px 12px;
        background: #607D8B;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;

    const extractBtn = document.createElement('button');
    extractBtn.textContent = '提取页面JSON';
    extractBtn.style.cssText = `
        padding: 6px 12px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;

    formatBtn.addEventListener('click', () => {
        try {
            const json = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(json, null, 2);
        } catch (e) {
            alert('JSON格式错误');
        }
    });

    compressBtn.addEventListener('click', () => {
        try {
            const json = JSON.parse(textarea.value);
            textarea.value = JSON.stringify(json);
        } catch (e) {
            alert('JSON格式错误');
        }
    });

    extractBtn.addEventListener('click', () => {
        const extractedJSON = extractJSONFromPage();
        if (extractedJSON.length > 0) {
            textarea.value = extractedJSON[0].json;
        } else {
            alert('未在页面中找到JSON数据');
        }
    });

    header.querySelector('#close-json-panel').addEventListener('click', () => {
        document.body.removeChild(panel);
    });

    // 组装面板
    buttonGroup.appendChild(formatBtn);
    buttonGroup.appendChild(compressBtn);
    buttonGroup.appendChild(extractBtn);
    content.appendChild(textarea);
    content.appendChild(buttonGroup);
    panel.appendChild(header);
    panel.appendChild(content);

    // 添加到页面
    document.body.appendChild(panel);
}

// 监听键盘快捷键
document.addEventListener('keydown', (e) => {
    // Ctrl + Shift + J: 打开/关闭JSON工具面板
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        const existingPanel = document.getElementById('json-tool-panel');
        if (existingPanel) {
            document.body.removeChild(existingPanel);
        } else {
            injectJSONToolPanel();
        }
    }
});

// 页面加载完成后自动提取JSON（可选）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // 可以在这里添加自动检测逻辑
    });
} else {
    // DOM已经加载完成
}
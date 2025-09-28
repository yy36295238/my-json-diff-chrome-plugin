// Chrome扩展 Popup JSON工具类 - 简化版
class JSONToolPopup {
    constructor() {
        this.currentMode = 'formatter';
        this.theme = localStorage.getItem('json-tool-theme') || 'light';
        this.history = [];
        this.historyIndex = -1;
        this.init();
    }

    // 初始化应用
    init() {
        // 设置全局引用（仅供内部使用）
        this.setupGlobalReference();

        this.setupEventListeners();
        this.setupTheme();
        this.loadFromLocalStorage();
        this.updateStatus('工具已就绪');
    }

    // 设置全局引用
    setupGlobalReference() {
        // 为了兼容性保留全局引用，但不在HTML中使用内联事件
        window.jsonTool = this;
    }

    // 设置事件监听器
    setupEventListeners() {
        // 模式切换按钮
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
            });
        });

        // 主题切换
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // 格式化功能
        const formatBtn = document.getElementById('formatBtn');
        if (formatBtn) {
            formatBtn.addEventListener('click', () => {
                this.formatJSON();
            });
        }

        const compressBtn = document.getElementById('compressBtn');
        if (compressBtn) {
            compressBtn.addEventListener('click', () => {
                this.compressJSON();
            });
        }

        // 移除转义符功能
        const removeEscapeBtn = document.getElementById('removeEscapeBtn');
        if (removeEscapeBtn) {
            removeEscapeBtn.addEventListener('click', () => {
                this.removeEscapeCharacters();
            });
        }

        // 验证功能
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => {
                this.validateJSON();
            });
        }

        // 清空按钮
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearAll();
            });
        }

        // JSON编辑器实时验证
        const jsonInput = document.getElementById('jsonInput');
        if (jsonInput) {
            jsonInput.addEventListener('input', (e) => {
                this.realTimeValidation(e.target.value);
            });
        }

        // 对比功能
        const compareBtn = document.getElementById('compareBtn');
        if (compareBtn) {
            compareBtn.addEventListener('click', () => {
                this.compareJSON();
            });
        }

        // 对比编辑器
        const leftJson = document.getElementById('leftJson');
        const rightJson = document.getElementById('rightJson');
        if (leftJson && rightJson) {
            leftJson.addEventListener('input', () => {
                this.clearCompareResults();
            });
            rightJson.addEventListener('input', () => {
                this.clearCompareResults();
            });
        }

        // 数据生成器
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateData();
            });
        }

        const useGeneratedBtn = document.getElementById('useGeneratedBtn');
        if (useGeneratedBtn) {
            useGeneratedBtn.addEventListener('click', () => {
                this.useGeneratedData();
            });
        }

        // 模板选择
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectTemplate(e.target.dataset.template);
            });
        });

        // 快捷键支持
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // 撤销重做按钮
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                this.undo();
            });
        }
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                this.redo();
            });
        }

        // 标签切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 折叠/展开按钮（使用事件委托）
        document.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-collapsible')) {
                this.toggleContent(e.target);
            }
        });
    }

    // 模式切换
    switchMode(mode) {
        // 更新按钮状态
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        // 切换内容区域
        document.querySelectorAll('.mode-content').forEach(content => {
            content.classList.remove('active');
        });
        const modeContent = document.getElementById(`${mode}-mode`);
        if (modeContent) {
            modeContent.classList.add('active');
        }

        this.currentMode = mode;
        this.updateStatus(`已切换到${this.getModeName(mode)}`);
    }

    // 获取模式中文名称
    getModeName(mode) {
        const names = {
            formatter: '格式化',
            compare: '对比',
            generator: '数据生成',
            validator: '验证'
        };
        return names[mode] || mode;
    }

    // 主题切换
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.setupTheme();
        localStorage.setItem('json-tool-theme', this.theme);
    }

    // 设置主题
    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.textContent = this.theme === 'light' ? '🌙' : '☀️';
        }
    }

    // JSON格式化
    formatJSON() {
        const editor = document.getElementById('jsonInput');
        if (!editor) return;

        const input = editor.value.trim();

        if (!input) {
            this.showError('请输入JSON数据');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const formatted = JSON.stringify(parsed, null, 2);
            editor.value = formatted;
            this.realTimeValidation(formatted);
            this.addToHistory(formatted);
            this.updateStatus('JSON格式化完成');
        } catch (error) {
            this.showError('JSON格式化失败: ' + error.message);
        }
    }

    // JSON压缩
    compressJSON() {
        const editor = document.getElementById('jsonInput');
        if (!editor) return;

        const input = editor.value.trim();

        if (!input) {
            this.showError('请输入JSON数据');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const compressed = JSON.stringify(parsed);
            editor.value = compressed;
            this.realTimeValidation(compressed);
            this.addToHistory(compressed);
            this.updateStatus('JSON压缩完成');
        } catch (error) {
            this.showError('JSON压缩失败: ' + error.message);
        }
    }

    // 移除转义符
    removeEscapeCharacters() {
        const editor = document.getElementById('jsonInput');
        if (!editor) return;

        const input = editor.value.trim();

        if (!input) {
            this.showError('请输入JSON数据');
            return;
        }

        try {
            const cleaned = this.processEscapeCharacters(input);
            editor.value = cleaned;
            this.realTimeValidation(cleaned);
            this.addToHistory(cleaned);
            this.updateStatus('转义符移除完成');
        } catch (error) {
            this.showError('移除转义符失败: ' + error.message);
        }
    }

    // 处理转义符的工具函数
    processEscapeCharacters(jsonString) {
        try {
            // 处理常见的转义符
            let cleaned = jsonString
                // 去除反斜杠转义的双引号 \"
                .replace(/\\"/g, '"')
                // 去除反斜杠转义的反斜杠 \\
                .replace(/\\\\/g, '\\')
                // 去除转义的换行符 \n
                .replace(/\\n/g, '\n')
                // 去除转义的回车符 \r
                .replace(/\\r/g, '\r')
                // 去除转义的制表符 \t
                .replace(/\\t/g, '\t')
                // 去除转义的反斜杠 \/
                .replace(/\\\//g, '/')
                // 去除转义的退格符 \b
                .replace(/\\b/g, '\b')
                // 去除转义的换页符 \f
                .replace(/\\f/g, '\f');

            // 处理Unicode转义序列 \uXXXX
            cleaned = cleaned.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                return String.fromCharCode(parseInt(hex, 16));
            });

            return cleaned;
        } catch (error) {
            // 如果处理过程中出错，返回原始字符串
            return jsonString;
        }
    }

    // JSON验证
    validateJSON() {
        const editor = document.getElementById('jsonInput');
        const resultDiv = document.getElementById('validationResult');
        if (!editor || !resultDiv) return;

        const input = editor.value.trim();

        if (!input) {
            resultDiv.innerHTML = '<div class="warning">请输入JSON数据</div>';
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const info = this.analyzeJSON(parsed, input);
            resultDiv.innerHTML = `
                <div class="success">✓ JSON格式有效</div>
                <div class="info">
                    <div>类型: ${info.type}</div>
                    <div>键数量: ${info.keys}</div>
                    <div>深度: ${info.depth}</div>
                    <div>大小: ${info.size}</div>
                </div>
            `;
            this.updateStatus('JSON验证通过');
        } catch (error) {
            resultDiv.innerHTML = `
                <div class="error">✗ JSON格式无效</div>
                <div class="error-detail">${error.message}</div>
            `;
            this.updateStatus('JSON验证失败');
        }
    }

    // 分析JSON
    analyzeJSON(obj, originalString) {
        const getType = (obj) => {
            if (obj === null) return 'null';
            if (Array.isArray(obj)) return 'array';
            return typeof obj;
        };

        const countKeys = (obj) => {
            if (typeof obj !== 'object' || obj === null) return 0;
            if (Array.isArray(obj)) return obj.length;
            return Object.keys(obj).length;
        };

        const getDepth = (obj) => {
            if (typeof obj !== 'object' || obj === null) return 1;
            if (Array.isArray(obj)) {
                return obj.length === 0 ? 1 : 1 + Math.max(...obj.map(getDepth));
            }
            const values = Object.values(obj);
            return values.length === 0 ? 1 : 1 + Math.max(...values.map(getDepth));
        };

        return {
            type: getType(obj),
            keys: countKeys(obj),
            depth: getDepth(obj),
            size: this.formatBytes(new Blob([originalString]).size)
        };
    }

    // 实时验证和预览更新
    realTimeValidation(input) {
        const statusIcon = document.getElementById('statusIcon');
        const jsonOutput = document.getElementById('jsonOutput');

        if (!input.trim()) {
            if (statusIcon) statusIcon.textContent = '';
            if (jsonOutput) jsonOutput.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">预览将在这里显示</div>';
            return;
        }

        try {
            const parsed = JSON.parse(input);
            if (statusIcon) {
                statusIcon.textContent = '✓';
                statusIcon.className = 'status-icon valid';
            }
            // 更新预览
            if (jsonOutput) {
                jsonOutput.innerHTML = this.renderJSONTree(parsed);
            }
        } catch (error) {
            if (statusIcon) {
                statusIcon.textContent = '✗';
                statusIcon.className = 'status-icon invalid';
            }
            if (jsonOutput) {
                jsonOutput.innerHTML = '<div style="color: var(--error-color);">无效的JSON格式</div>';
            }
        }
    }

    // 渲染JSON树形结构
    renderJSONTree(obj, level = 0, key = null) {
        let html = '';

        // 添加键名（如果存在）
        if (key !== null) {
            html += `<span class="json-key">"${key}"</span>: `;
        }

        // 处理不同的数据类型
        if (obj === null) {
            html += `<span class="json-null">null</span>`;
        } else if (typeof obj === 'boolean') {
            html += `<span class="json-boolean">${obj}</span>`;
        } else if (typeof obj === 'number') {
            html += `<span class="json-number">${obj}</span>`;
        } else if (typeof obj === 'string') {
            html += `<span class="json-string">"${this.escapeHtml(obj)}"</span>`;
        } else if (Array.isArray(obj)) {
            html += this.renderArrayStructure(obj, level);
        } else if (typeof obj === 'object') {
            html += this.renderObjectStructure(obj, level);
        }

        return html;
    }

    // 渲染数组结构
    renderArrayStructure(arr, level) {
        if (arr.length === 0) {
            return `<span class="json-bracket">[]</span>`;
        }

        let html = '';

        html += `<span class="json-collapsible" data-collapsible="true">▼</span>`;
        html += `<span class="json-bracket">[</span>`;
        html += `<span style="color: var(--text-muted); margin-left: 8px;">${arr.length} items</span>`;
        html += `<div class="json-collapsible-content" style="margin-left: 20px; border-left: 1px solid var(--border-color); padding-left: 10px;">`;

        arr.forEach((item, index) => {
            html += `<div style="margin: 4px 0;">`;
            html += `<span style="color: var(--text-muted); margin-right: 8px;">[${index}]:</span>`;
            html += this.renderJSONTree(item, level + 1);
            if (index < arr.length - 1) {
                html += '<span class="json-bracket">,</span>';
            }
            html += `</div>`;
        });

        html += `</div>`;
        html += `<span class="json-bracket">]</span>`;

        return html;
    }

    // 渲染对象结构
    renderObjectStructure(obj, level) {
        const keys = Object.keys(obj);

        if (keys.length === 0) {
            return `<span class="json-bracket">{}</span>`;
        }

        let html = '';

        html += `<span class="json-collapsible" data-collapsible="true">▼</span>`;
        html += `<span class="json-bracket">{</span>`;
        html += `<span style="color: var(--text-muted); margin-left: 8px;">${keys.length} ${keys.length === 1 ? 'property' : 'properties'}</span>`;
        html += `<div class="json-collapsible-content" style="margin-left: 20px; border-left: 1px solid var(--border-color); padding-left: 10px;">`;

        keys.forEach((key, index) => {
            html += `<div style="margin: 4px 0;">`;
            html += this.renderJSONTree(obj[key], level + 1, key);
            if (index < keys.length - 1) {
                html += '<span class="json-bracket">,</span>';
            }
            html += `</div>`;
        });

        html += `</div>`;
        html += `<span class="json-bracket">}</span>`;

        return html;
    }

    // 切换内容展开/折叠
    toggleContent(element) {
        // 查找所有的兄弟元素，定位到json-collapsible-content
        let content = null;
        let sibling = element.nextElementSibling;

        while (sibling) {
            if (sibling.classList && sibling.classList.contains('json-collapsible-content')) {
                content = sibling;
                break;
            }
            sibling = sibling.nextElementSibling;
        }

        // 如果没有在兄弟元素中找到，尝试在同一父元素下查找
        if (!content && element.parentNode) {
            content = element.parentNode.querySelector('.json-collapsible-content');
        }

        if (content) {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            element.textContent = isVisible ? '▶' : '▼';
        }
    }

    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // JSON对比
    compareJSON() {
        const leftEditor = document.getElementById('leftJson');
        const rightEditor = document.getElementById('rightJson');
        const resultDiv = document.getElementById('compareResult');

        if (!leftEditor || !rightEditor || !resultDiv) return;

        const leftInput = leftEditor.value.trim();
        const rightInput = rightEditor.value.trim();

        if (!leftInput || !rightInput) {
            this.showError('请在左右两侧都输入JSON数据');
            return;
        }

        try {
            const leftObj = JSON.parse(leftInput);
            const rightObj = JSON.parse(rightInput);

            const differences = this.calculateDifferences(leftObj, rightObj);
            this.displayCompareResult(differences, resultDiv);

            this.updateStatus(`对比完成: 发现 ${differences.length} 处差异`);
        } catch (error) {
            this.showError('对比失败: JSON格式错误');
        }
    }

    // 计算差异
    calculateDifferences(left, right, path = '') {
        const differences = [];

        // 处理null值
        if (left === null || right === null) {
            if (left !== right) {
                differences.push({
                    path: path || 'root',
                    type: left === null ? 'added' : 'removed',
                    leftValue: left,
                    rightValue: right
                });
            }
            return differences;
        }

        // 处理基本类型
        if (typeof left !== 'object' || typeof right !== 'object') {
            if (left !== right) {
                differences.push({
                    path: path || 'root',
                    type: 'modified',
                    leftValue: left,
                    rightValue: right
                });
            }
            return differences;
        }

        // 处理数组
        if (Array.isArray(left) && Array.isArray(right)) {
            const maxLength = Math.max(left.length, right.length);
            for (let i = 0; i < maxLength; i++) {
                const currentPath = path ? `${path}[${i}]` : `[${i}]`;

                if (i >= left.length) {
                    differences.push({
                        path: currentPath,
                        type: 'added',
                        leftValue: undefined,
                        rightValue: right[i]
                    });
                } else if (i >= right.length) {
                    differences.push({
                        path: currentPath,
                        type: 'removed',
                        leftValue: left[i],
                        rightValue: undefined
                    });
                } else {
                    differences.push(...this.calculateDifferences(left[i], right[i], currentPath));
                }
            }
            return differences;
        }

        // 处理对象
        if (typeof left === 'object' && typeof right === 'object') {
            const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);

            for (const key of allKeys) {
                const currentPath = path ? `${path}.${key}` : key;

                if (!(key in left)) {
                    differences.push({
                        path: currentPath,
                        type: 'added',
                        leftValue: undefined,
                        rightValue: right[key]
                    });
                } else if (!(key in right)) {
                    differences.push({
                        path: currentPath,
                        type: 'removed',
                        leftValue: left[key],
                        rightValue: undefined
                    });
                } else {
                    differences.push(...this.calculateDifferences(left[key], right[key], currentPath));
                }
            }
        }

        return differences;
    }

    // 显示对比结果
    displayCompareResult(differences, resultDiv) {
        if (differences.length === 0) {
            resultDiv.innerHTML = '<div class="success">两个JSON完全相同</div>';
            return;
        }

        let html = `<div class="differences-count">发现 ${differences.length} 处差异:</div>`;

        differences.forEach((diff, index) => {
            const typeClass = diff.type === 'added' ? 'added' :
                            diff.type === 'removed' ? 'removed' : 'modified';

            html += `
                <div class="diff-item ${typeClass}">
                    <div class="diff-path">${diff.path}</div>
                    <div class="diff-change">
                        ${diff.type === 'added' ? '+ 新增' :
                          diff.type === 'removed' ? '- 删除' : '~ 修改'}
                    </div>
                    <div class="diff-values">
                        ${diff.leftValue !== undefined ?
                            `<div class="old-value">旧值: ${JSON.stringify(diff.leftValue)}</div>` : ''}
                        ${diff.rightValue !== undefined ?
                            `<div class="new-value">新值: ${JSON.stringify(diff.rightValue)}</div>` : ''}
                    </div>
                </div>
            `;
        });

        resultDiv.innerHTML = html;
    }

    // 清除对比结果
    clearCompareResults() {
        const resultDiv = document.getElementById('compareResult');
        if (resultDiv) {
            resultDiv.innerHTML = '';
        }
    }

    // 数据生成器
    generateData() {
        const template = this.currentTemplate || 'user';
        const count = parseInt(document.getElementById('generateCount')?.value) || 1;
        const generateArray = document.getElementById('generateArray')?.checked || false;
        const locale = document.getElementById('localeSelect')?.value || 'zh_CN';

        const data = this.generateTemplateData(template, count, locale);
        const result = generateArray && count > 1 ? data : data[0];

        const jsonString = JSON.stringify(result, null, 2);
        const outputArea = document.getElementById('generatedOutput');
        if (outputArea) {
            outputArea.value = jsonString;
        }

        this.updateStatus(`已生成 ${count} 条${this.getTemplateName(template)}数据`);
    }

    // 选择模板
    selectTemplate(templateName) {
        // 移除所有模板按钮的active类
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 添加active类到当前选中的按钮
        const currentBtn = document.querySelector(`[data-template="${templateName}"]`);
        if (currentBtn) {
            currentBtn.classList.add('active');
        }

        this.currentTemplate = templateName;
        this.updateStatus(`已选择${this.getTemplateName(templateName)}模板`);
    }

    // 获取模板中文名称
    getTemplateName(templateName) {
        const names = {
            user: '用户信息',
            product: '商品数据',
            order: '订单记录',
            api: 'API响应'
        };
        return names[templateName] || templateName;
    }

    // 生成模板数据
    generateTemplateData(templateName, count, locale) {
        const generators = {
            user: () => this.generateUserData(locale),
            product: () => this.generateProductData(locale),
            order: () => this.generateOrderData(locale),
            api: () => this.generateAPIData(locale)
        };

        const generator = generators[templateName];
        if (!generator) return [];

        const data = [];
        for (let i = 0; i < count; i++) {
            data.push(generator());
        }

        return data;
    }

    // 生成用户数据
    generateUserData(locale) {
        const names = {
            zh_CN: ['张三', '李四', '王五', '赵六', '刘七'],
            en_US: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown']
        };

        const cities = {
            zh_CN: ['北京', '上海', '广州', '深圳', '杭州'],
            en_US: ['New York', 'Los Angeles', 'Chicago', 'Houston']
        };

        const randomName = names[locale][Math.floor(Math.random() * names[locale].length)];
        const randomCity = cities[locale][Math.floor(Math.random() * cities[locale].length)];

        return {
            id: Math.floor(Math.random() * 10000),
            name: randomName,
            email: `user${Math.floor(Math.random() * 10000)}@example.com`,
            age: Math.floor(Math.random() * 50) + 18,
            city: randomCity,
            phone: this.generatePhone(locale),
            createdAt: new Date().toISOString(),
            isActive: Math.random() > 0.5
        };
    }

    // 生成商品数据
    generateProductData(locale) {
        const products = {
            zh_CN: ['苹果手机', '笔记本电脑', '无线耳机', '智能手表'],
            en_US: ['iPhone', 'MacBook', 'AirPods', 'Apple Watch']
        };

        const categories = {
            zh_CN: ['电子产品', '数码配件', '智能设备'],
            en_US: ['Electronics', 'Accessories', 'Smart Devices']
        };

        const randomProduct = products[locale][Math.floor(Math.random() * products[locale].length)];
        const randomCategory = categories[locale][Math.floor(Math.random() * categories[locale].length)];

        return {
            id: Math.floor(Math.random() * 10000),
            name: randomProduct,
            category: randomCategory,
            price: Math.floor(Math.random() * 5000) + 100,
            currency: locale === 'zh_CN' ? 'CNY' : 'USD',
            stock: Math.floor(Math.random() * 1000),
            rating: Math.round((Math.random() * 4 + 1) * 10) / 10
        };
    }

    // 生成订单数据
    generateOrderData(locale) {
        return {
            orderId: 'ORD' + Date.now() + Math.floor(Math.random() * 1000),
            userId: Math.floor(Math.random() * 1000),
            products: [
                {
                    productId: Math.floor(Math.random() * 100),
                    quantity: Math.floor(Math.random() * 5) + 1,
                    price: Math.floor(Math.random() * 1000) + 50
                }
            ],
            totalAmount: Math.floor(Math.random() * 5000) + 100,
            status: ['pending', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 4)],
            orderDate: new Date().toISOString()
        };
    }

    // 生成API响应数据
    generateAPIData(locale) {
        return {
            code: 200,
            message: 'success',
            data: {
                users: [this.generateUserData(locale)],
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 100,
                    hasNext: true
                }
            },
            timestamp: new Date().toISOString(),
            requestId: 'req_' + Math.random().toString(36).substr(2, 9)
        };
    }

    // 生成电话号码
    generatePhone(locale) {
        const formats = {
            zh_CN: () => `1${Math.floor(Math.random() * 9) + 3}${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
            en_US: () => `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`
        };
        return formats[locale]();
    }

    // 使用生成的数据
    useGeneratedData() {
        const generatedOutput = document.getElementById('generatedOutput');
        const jsonInput = document.getElementById('jsonInput');

        if (!generatedOutput || !jsonInput) return;

        const generatedData = generatedOutput.value;
        if (!generatedData) {
            this.showError('没有生成的数据可使用');
            return;
        }

        jsonInput.value = generatedData;
        this.switchMode('formatter');
        this.realTimeValidation(generatedData);
        this.updateStatus('已将生成的数据导入到编辑器');
    }

    // 清除所有内容
    clearAll() {
        if (confirm('确定要清除所有内容吗？')) {
            const editor = document.getElementById('jsonInput');
            if (editor) {
                editor.value = '';
                this.realTimeValidation('');
            }
            this.updateStatus('内容已清除');
        }
    }

    // 标签切换
    switchTab(tabName) {
        // 更新按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // 切换内容区域
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`${tabName}-content`);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        this.currentMode = tabName;
        this.updateStatus(`已切换到${this.getTabName(tabName)}`);
    }

    // 获取标签中文名称
    getTabName(tabName) {
        const names = {
            formatter: '格式化',
            compare: '对比',
            generator: '生成器'
        };
        return names[tabName] || tabName;
    }

    // 快捷键处理
    handleKeyboard(event) {
        // Ctrl/Cmd + Shift + F: 格式化
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
            event.preventDefault();
            this.formatJSON();
        }

        // Ctrl/Cmd + Shift + C: 压缩
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'C') {
            event.preventDefault();
            this.compressJSON();
        }

        // Ctrl/Cmd + Shift + V: 验证
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'V') {
            event.preventDefault();
            this.validateJSON();
        }

        // Ctrl/Cmd + Shift + E: 移除转义符
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'E') {
            event.preventDefault();
            this.removeEscapeCharacters();
        }

        // Ctrl/Cmd + Z: 撤销
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            this.undo();
        }

        // Ctrl/Cmd + Y 或 Ctrl/Cmd + Shift + Z: 重做
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'Z'))) {
            event.preventDefault();
            this.redo();
        }
    }

    // 格式化字节数
    formatBytes(bytes) {
        if (bytes === 0) return '0B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
    }

    // 显示错误
    showError(message) {
        this.updateStatus('错误: ' + message);
        // 在Chrome插件popup中，可以使用简单的通知方式
        console.error(message);
    }

    // 历史记录管理
    addToHistory(content) {
        // 截断未来分支
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push({
            content: content,
            timestamp: new Date().toISOString()
        });

        // 限制历史记录数量
        if (this.history.length > 20) {
            this.history = this.history.slice(-20);
        }

        this.historyIndex = this.history.length - 1;
        this.saveToLocalStorage();
    }

    // 撤销
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const historyItem = this.history[this.historyIndex];
            const editor = document.getElementById('jsonInput');
            if (editor && historyItem) {
                editor.value = historyItem.content;
                this.realTimeValidation(historyItem.content);
                this.updateStatus('已撤销');
            }
        } else {
            this.updateStatus('没有可撤销的操作');
        }
    }

    // 重做
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const historyItem = this.history[this.historyIndex];
            const editor = document.getElementById('jsonInput');
            if (editor && historyItem) {
                editor.value = historyItem.content;
                this.realTimeValidation(historyItem.content);
                this.updateStatus('已重做');
            }
        } else {
            this.updateStatus('没有可重做的操作');
        }
    }

    // 保存到本地存储
    saveToLocalStorage() {
        try {
            const data = {
                history: this.history,
                historyIndex: this.historyIndex,
                theme: this.theme
            };
            localStorage.setItem('json-tool-popup-data', JSON.stringify(data));
        } catch (error) {
            console.warn('保存数据失败:', error);
        }
    }

    // 从本地存储加载
    loadFromLocalStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('json-tool-popup-data') || '{}');
            this.history = data.history || [];
            this.historyIndex = typeof data.historyIndex === 'number' ? data.historyIndex : -1;
            this.theme = data.theme || 'light';
        } catch (error) {
            console.warn('加载数据失败:', error);
        }
    }

    // 更新状态
    updateStatus(message) {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
}

// 当页面加载完成时初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.jsonToolPopup = new JSONToolPopup();
});
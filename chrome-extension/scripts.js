// JSON工具简化版 - 核心应用类
class JSONToolApp {
    constructor() {
        this.currentTab = 'formatter';
        this.history = [];
        this.historyIndex = -1;
        this.theme = localStorage.getItem('json-tool-theme') || 'light';
        this.currentTemplate = null;

        // Compare 输入框的独立历史
        this.compareHistoryLeft = [];
        this.compareHistoryLeftIndex = -1;
        this.compareHistoryRight = [];
        this.compareHistoryRightIndex = -1;
        this._suppressCompareHistory = false;

        this.init();
    }

    // 初始化应用
    init() {
        // 设置全局引用，供HTML事件处理器使用
        window.jsonTool = this;

        this.setupEventListeners();
        this.setupTheme();
        this.loadFromLocalStorage();
        this.updateStatus('应用已就绪');

        // 初始化多分隔栏
        this.initMultiSplit();
    }

    // 设置事件监听器
    setupEventListeners() {
        // 导航标签切换
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 主题切换
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // 格式化功能
        document.getElementById('formatBtn').addEventListener('click', () => {
            this.formatJSON();
        });

        document.getElementById('compressBtn').addEventListener('click', () => {
            this.compressJSON();
        });

        document.getElementById('removeEscapeBtn').addEventListener('click', () => {
            this.removeEscapeCharacters();
        });

        // JSON编辑器实时验证
        const jsonEditor = document.getElementById('jsonEditor');
        jsonEditor.addEventListener('input', (e) => {
            this.updateEditorInfo();
            this.realTimeValidation(e.target.value);
        });
        // 主编辑器行号滚动同步
        jsonEditor.addEventListener('scroll', () => {
            const ln = document.getElementById('jsonEditorLines');
            if (ln) ln.scrollTop = jsonEditor.scrollTop;
        });
        // 初始化行号
        this.updateEditorLineNumbers();

        // 工具栏功能
        document.getElementById('clearAll').addEventListener('click', () => {
            this.clearAll();
        });

        // 预览操作
        document.getElementById('expandAll').addEventListener('click', () => {
            this.expandAll();
        });

        document.getElementById('collapseAll').addEventListener('click', () => {
            this.collapseAll();
        });

        document.getElementById('treeView').addEventListener('click', () => {
            this.toggleTreeView();
        });

        // 错误面板
        document.getElementById('closeError').addEventListener('click', () => {
            this.hideErrorPanel();
        });

        // 对比功能
        document.getElementById('compareBtn').addEventListener('click', async () => {
            const btn = document.getElementById('compareBtn');
            const oldText = btn.textContent;
            try {
                btn.disabled = true;
                btn.textContent = '对比中...';
                await Promise.resolve(this.compareJSON());
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
        // 对比页左右“美化”按钮
        const beautifyLeftBtn = document.getElementById('beautifyLeft');
        const beautifyRightBtn = document.getElementById('beautifyRight');
        if (beautifyLeftBtn) beautifyLeftBtn.addEventListener('click', () => this.beautifyCompareSide('left'));
        if (beautifyRightBtn) beautifyRightBtn.addEventListener('click', () => this.beautifyCompareSide('right'));

        // 对比编辑监听：当用户在左右输入框编辑/聚焦时，自动退出对比模式，并记录历史
        const leftArea = document.getElementById('leftJson');
        const rightArea = document.getElementById('rightJson');
        if (leftArea && rightArea) {
            // 退出对比模式的监听（不再自动对比）
            ['focus', 'paste'].forEach(evt => {
                leftArea.addEventListener(evt, () => this.handleCompareTextChange());
                rightArea.addEventListener(evt, () => this.handleCompareTextChange());
            });
            // 输入时记录历史并刷新行号（不自动对比）
            const leftLines = document.getElementById('leftJsonLines');
            const rightLines = document.getElementById('rightJsonLines');
            leftArea.addEventListener('input', () => {
                this.handleCompareTextChange();
                this.recordCompareHistory('left', leftArea.value);
                if (leftLines) {
                    leftLines.innerHTML = this.generateLineNumbers((leftArea.value.split('\n').length) || 1);
                    leftLines.scrollTop = leftArea.scrollTop;
                }
            });
            rightArea.addEventListener('input', () => {
                this.handleCompareTextChange();
                this.recordCompareHistory('right', rightArea.value);
                if (rightLines) {
                    rightLines.innerHTML = this.generateLineNumbers((rightArea.value.split('\n').length) || 1);
                    rightLines.scrollTop = rightArea.scrollTop;
                }
            });
            leftArea.addEventListener('scroll', () => { const ln = document.getElementById('leftJsonLines'); if (ln) ln.scrollTop = leftArea.scrollTop; });
            rightArea.addEventListener('scroll', () => { const rn = document.getElementById('rightJsonLines'); if (rn) rn.scrollTop = rightArea.scrollTop; });
            // 初始化行号
            if (leftLines) leftLines.innerHTML = this.generateLineNumbers((leftArea.value.split('\n').length) || 1);
            if (rightLines) rightLines.innerHTML = this.generateLineNumbers((rightArea.value.split('\n').length) || 1);
        }

        // 生成器功能
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectTemplate(e.target.dataset.template);
            });
        });

        document.getElementById('generateBtn').addEventListener('click', () => {
            this.generateData();
        });

        document.getElementById('useGenerated').addEventListener('click', () => {
            this.useGeneratedData();
        });

        // 快捷键支持
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // 模态框控制
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modalCancel').addEventListener('click', () => {
            this.closeModal();
        });

        // 侧边栏控制
        document.getElementById('closeSidebar').addEventListener('click', () => {
            this.closeSidebar();
        });

        // 多分隔栏按钮（分隔栏页）
        const addSplitBtn = document.getElementById('addSplitPane');
        const removeSplitBtn = document.getElementById('removeSplitPane');
        if (addSplitBtn) addSplitBtn.addEventListener('click', () => this.addSplitPane());
        if (removeSplitBtn) removeSplitBtn.addEventListener('click', () => this.removeSplitPane());

        // 历史记录按钮
        document.getElementById('historyBtn').addEventListener('click', () => {
            this.showHistory();
        });

        // 设置按钮
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });

        // 帮助按钮
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.showHelp();
        });

        // 撤销重做（根据当前标签页切换目标）
        document.getElementById('undoBtn').addEventListener('click', () => {
            if (this.currentTab === 'compare') {
                this.compareUndo();
            } else {
                this.undo();
            }
        });

        document.getElementById('redoBtn').addEventListener('click', () => {
            if (this.currentTab === 'compare') {
                this.compareRedo();
            } else {
                this.redo();
            }
        });
    }

    // 标签切换
    switchTab(tabName) {
        // 更新导航按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 切换内容区域
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-content`).classList.add('active');

        this.currentTab = tabName;
        this.updateStatus(`已切换到${this.getTabName(tabName)}`);
    }

    // 获取标签中文名称
    getTabName(tabName) {
        const names = {
            formatter: '格式化',
            compare: '对比',
            generator: '生成器',
            split: '分隔栏'
        };
        return names[tabName] || tabName;
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
        themeBtn.textContent = this.theme === 'light' ? '🌙' : '☀️';
    }

    // JSON格式化
    // JSON格式化（支持递归解析JSON字符串）
    formatJSON() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();

        if (!input) {
            // this.showNotification('请输入JSON数据', 'warning');
            return;
        }

        try {
            const parsed = JSON.parse(input);

            // 检查是否启用递归解析
            const deepParseCheckbox = document.getElementById('deepParseCheckbox');
            const shouldDeepParse = deepParseCheckbox ? deepParseCheckbox.checked : false;

            // 根据选项决定是否递归解析JSON字符串
            const result = shouldDeepParse ? this.deepParseJSON(parsed) : parsed;

            const formatted = JSON.stringify(result, null, 2);
            editor.value = formatted;
            this.updatePreview(formatted);
            this.addToHistory(formatted);

            const statusMsg = shouldDeepParse ?
                'JSON格式化完成（已递归解析JSON字符串）' :
                'JSON格式化完成';
            this.updateStatus(statusMsg);
        } catch (error) {
            this.showError('JSON格式化失败', error.message);
        }
    }

    // 递归解析对象中的JSON字符串
    deepParseJSON(obj) {
        if (obj === null || obj === undefined) {
            return obj;
        }

        // 处理数组
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepParseJSON(item));
        }

        // 处理对象
        if (typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    result[key] = this.deepParseJSON(obj[key]);
                }
            }
            return result;
        }

        // 处理字符串 - 尝试解析为JSON
        if (typeof obj === 'string') {
            // 检查是否是JSON字符串（简单判断：以{或[开头，以}或]结尾）
            const trimmed = obj.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    const parsed = JSON.parse(obj);
                    // 递归解析嵌套的JSON字符串
                    return this.deepParseJSON(parsed);
                } catch (e) {
                    // 如果解析失败，保持原字符串
                    return obj;
                }
            }
        }

        // 其他基本类型直接返回
        return obj;
    }

    // JSON压缩
    compressJSON() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();

        if (!input) {
            // this.showNotification('请输入JSON数据', 'warning');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const compressed = JSON.stringify(parsed);
            editor.value = compressed;
            this.updatePreview(compressed);
            this.addToHistory(compressed);
            this.updateStatus('JSON压缩完成');
        } catch (error) {
            this.showError('JSON压缩失败', error.message);
        }
    }

    // 实时验证
    realTimeValidation(input) {
        if (!input.trim()) {
            this.hideErrorPanel();
            this.updatePreview('');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            this.hideErrorPanel();
            const pretty = JSON.stringify(parsed, null, 2);
            this.updatePreview(pretty);
        } catch (error) {
            // 实时验证时不显示错误面板，避免干扰用户输入
        }
    }

    // 更新预览
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

        html += `<span class="json-collapsible" onclick="window.jsonTool.toggleContent(this)">▼</span>`;
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

        html += `<span class="json-collapsible" onclick="window.jsonTool.toggleContent(this)">▼</span>`;
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
        // 查找紧跟在折叠按钮后面的内容区域
        let content = element.nextElementSibling;

        // 跳过括号和属性计数等元素，查找实际的内容区域
        while (content && !content.classList.contains('json-collapsible-content')) {
            content = content.nextElementSibling;
        }

        // 如果没有找到，尝试在父节点中查找
        if (!content) {
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

    // 移除转义符按钮功能
    removeEscapeCharacters() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();

        if (!input) {
            this.updateStatus('请输入JSON数据');
            return;
        }

        try {
            const cleaned = this.processEscapeCharacters(input);
            editor.value = cleaned;
            this.updatePreview(cleaned);
            this.addToHistory(cleaned);
            this.updateEditorInfo();
            this.updateStatus('转义符移除完成');
        } catch (error) {
            this.showError('移除转义符失败', error.message);
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

    // 更新编辑器信息
    updateEditorInfo() {
        const editor = document.getElementById('jsonEditor');
        const content = editor.value;
        const lines = content.split('\n').length;
        const chars = content.length;
        const bytes = new Blob([content]).size;

        document.getElementById('lineCount').textContent = `行: ${lines}`;
        document.getElementById('charCount').textContent = `字符: ${chars}`;
        document.getElementById('sizeInfo').textContent = `大小: ${this.formatBytes(bytes)}`;
        this.updateEditorLineNumbers();
    }

    // 生成行号HTML
    generateLineNumbers(count) {
        let html = '';
        for (let i = 1; i <= count; i++) {
            html += `<div class="line-number">${i}</div>`;
        }
        return html;
    }

    // 更新主编辑器行号
    updateEditorLineNumbers() {
        try {
            const editor = document.getElementById('jsonEditor');
            const gutter = document.getElementById('jsonEditorLines');
            if (!editor || !gutter) return;
            const count = editor.value.split('\n').length || 1;
            gutter.innerHTML = this.generateLineNumbers(count);
            gutter.scrollTop = editor.scrollTop;
        } catch (e) {}
    }

    // 格式化字节数
    formatBytes(bytes) {
        if (bytes === 0) return '0B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
    }

    // 显示错误面板
    showError(title, message) {
        const errorPanel = document.getElementById('errorPanel');
        const errorContent = document.getElementById('errorContent');

        errorContent.innerHTML = `<strong>${title}</strong><br><br>${message.replace(/\n/g, '<br>')}`;
        errorPanel.style.display = 'block';

        this.updateStatus(`错误: ${title}`);
    }

    // 隐藏错误面板
    hideErrorPanel() {
        document.getElementById('errorPanel').style.display = 'none';
    }

    // 清除所有内容
    clearAll() {
        if (confirm('确定要清除所有内容吗？')) {
            document.getElementById('jsonEditor').value = '';
            this.updatePreview('');
            this.updateEditorInfo();
            this.hideErrorPanel();
            // this.showNotification('内容已清除', 'info');
            this.updateStatus('内容已清除');
        }
    }

    // 展开所有节点
    expandAll() {
        const preview = document.getElementById('jsonPreview');
        const collapsibles = preview.querySelectorAll('.json-collapsible');

        collapsibles.forEach(element => {
            element.textContent = '▼';
            const content = element.parentNode.querySelector('.json-collapsible-content');
            if (content) {
                content.style.display = 'block';
            }
        });

        // this.showNotification('已展开所有节点', 'info');
    }

    // 折叠所有节点
    collapseAll() {
        const preview = document.getElementById('jsonPreview');
        const collapsibles = preview.querySelectorAll('.json-collapsible');

        collapsibles.forEach(element => {
            element.textContent = '▶';
            const content = element.parentNode.querySelector('.json-collapsible-content');
            if (content) {
                content.style.display = 'none';
            }
        });

        // this.showNotification('已折叠所有节点', 'info');
    }

    // 切换树形视图
    toggleTreeView() {
        const preview = document.getElementById('jsonPreview');
        const isTreeView = preview.classList.contains('tree-view');

        if (isTreeView) {
            preview.classList.remove('tree-view');
            // this.showNotification('已切换到普通视图', 'info');
        } else {
            preview.classList.add('tree-view');
            // this.showNotification('已切换到树形视图', 'info');
        }

        // 重新渲染当前JSON
        const editor = document.getElementById('jsonEditor');
        if (editor.value.trim()) {
            try {
                const parsed = JSON.parse(editor.value);
                this.updatePreview(JSON.stringify(parsed, null, 2));
            } catch (error) {
                // 忽略错误，保持当前状态
            }
        }
    }

    // 基于JSON结构的深度对比功能（支持静默模式）
    compareJSON(options = {}) {
        const { silent = false } = options;
        const leftJson = document.getElementById('leftJson').value.trim();
        const rightJson = document.getElementById('rightJson').value.trim();

        // 清除之前的显示（平滑过渡重新渲染）
        this.clearComparison();

        if (!leftJson || !rightJson) {
            console.log('[对比] 输入为空');
            return;
        }

        try {
            const leftObj = JSON.parse(leftJson);
            const rightObj = JSON.parse(rightJson);
            console.log('[对比] JSON解析成功');

            // 计算结构化差异
            const diff = this.calculateStructuralDiff(leftObj, rightObj);
            console.log('[对比] 发现差异数:', diff.length, diff);

            // 生成并排对比视图
            this.displayStructuralDiff(diff, leftObj, rightObj);
            console.log('[对比] 显示差异完成');

            if (!silent) this.updateStatus(`对比完成：发现 ${diff.length} 处差异`);
        } catch (error) {
            console.error('[对比] 错误:', error);
            // JSON格式错误
            if (!silent) {
                this.showError('对比失败', '请检查左右两侧 JSON 是否为有效格式');
                this.updateStatus('对比失败：JSON 格式错误');
            }
            return;
        }
    }

    // 计算结构化差异
    calculateStructuralDiff(left, right, path = '') {
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
                    differences.push(...this.calculateStructuralDiff(left[i], right[i], currentPath));
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
                    differences.push(...this.calculateStructuralDiff(left[key], right[key], currentPath));
                }
            }
        }

        return differences;
    }

    // 显示结构化差异
    displayStructuralDiff(differences, leftObj, rightObj) {
        console.log('[显示差异] 开始, 差异数:', differences.length);
        // 生成带差异标记的JSON展示
        const leftDisplay = this.generateDiffDisplay(leftObj, differences, 'left');
        const rightDisplay = this.generateDiffDisplay(rightObj, differences, 'right');

        console.log('[显示差异] 左侧行数:', leftDisplay.length, '差异行:', leftDisplay.filter(l => l.type !== 'same').length);
        console.log('[显示差异] 右侧行数:', rightDisplay.length, '差异行:', rightDisplay.filter(l => l.type !== 'same').length);

        // 更新输入框显示
        this.updateCompareDisplay('leftJson', leftDisplay);
        this.updateCompareDisplay('rightJson', rightDisplay);
    }

    // 生成带差异标记的JSON展示
    generateDiffDisplay(obj, differences, side) {
        const formatted = JSON.stringify(obj, null, 2);
        const lines = formatted.split('\n');

        // 为每行分析差异类型
        const diffLines = lines.map((line, index) => {
            // 分析当前行对应的JSON路径
            const diffType = this.analyzeDiffForLine(line, differences, side, index, lines);
            return {
                content: line,
                type: diffType,
                lineNumber: index + 1
            };
        });

        return diffLines;
    }

    // 分析某行的差异类型
    analyzeDiffForLine(line, differences, side, lineIndex, allLines) {
        // 检查当前行是否包含有差异的键值对

        for (const diff of differences) {
            // 检查不同类型的差异
            if (diff.type === 'added' && side === 'right') {
                // 右侧新增的内容
                if (this.lineMatchesDiff(line, diff, 'right')) {
                    return 'added';
                }
            } else if (diff.type === 'removed' && side === 'left') {
                // 左侧删除的内容
                if (this.lineMatchesDiff(line, diff, 'left')) {
                    return 'removed';
                }
            } else if (diff.type === 'modified') {
                // 修改的内容
                if (this.lineMatchesDiff(line, diff, side)) {
                    return 'modified';
                }
            }
        }

        return 'same';
    }

    // 检查行是否匹配差异
    lineMatchesDiff(line, diff, side) {
        // 提取路径的最后一部分作为键名
        const pathParts = diff.path.split('.');
        const lastKey = pathParts[pathParts.length - 1].replace(/\[\d+\]/, '');

        // 检查是否包含键名
        if (!line.includes(`"${lastKey}"`)) {
            return false;
        }

        // 检查值是否匹配
        const value = side === 'left' ? diff.leftValue : diff.rightValue;

        if (value === undefined) {
            return side === 'left' ? diff.type === 'removed' : diff.type === 'added';
        }

        // 对于基本类型，检查值是否在行中
        if (typeof value === 'string') {
            // 对于字符串，尝试多种匹配方式
            // 1. 直接匹配（短字符串）
            if (line.includes(`"${value}"`)) {
                return true;
            }
            // 2. 匹配转义后的字符串（长字符串或包含特殊字符）
            const escapedValue = JSON.stringify(value);
            if (line.includes(escapedValue)) {
                return true;
            }
            // 3. 只要该行包含该键名，且该键对应的值存在，就认为匹配
            // 这是为了处理很长的字符串值，可能跨多行显示
            const keyPattern = `"${lastKey}"\\s*:\\s*`;
            if (new RegExp(keyPattern).test(line)) {
                return true;
            }
            return false;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            return line.includes(String(value));
        } else if (value === null) {
            return line.includes('null');
        }

        // 对于对象或数组，只检查键名
        return true;
    }

    // 更新对比显示
    updateCompareDisplay(textareaId, diffLines) {
        console.log('[更新显示] textarea:', textareaId, '行数:', diffLines.length);
        const textarea = document.getElementById(textareaId);
        const container = textarea.parentElement;

        // 移除已存在的高亮层
        const existingHighlight = container.querySelector('.highlight-layer');
        if (existingHighlight) {
            console.log('[更新显示] 移除已存在的高亮层');
            existingHighlight.remove();
        }

        // 创建高亮层
        const highlightLayer = document.createElement('div');
        highlightLayer.className = 'highlight-layer';
        highlightLayer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            font-family: var(--font-mono);
            font-size: 14px;
            line-height: 1.5;
            padding: 16px;
            white-space: pre;
            overflow: hidden;
            z-index: 1;
            background: transparent;
            border-radius: var(--border-radius);
        `;

        // 生成高亮内容
        let highlightHTML = '';
        let diffCount = 0;
        diffLines.forEach((diffLine) => {
            const lineContent = this.escapeHtml(diffLine.content);
            const className = this.getHighlightClass(diffLine.type);
            if (diffLine.type !== 'same') {
                diffCount++;
                console.log('[高亮行]', diffLine.lineNumber, diffLine.type, diffLine.content.substring(0, 50));
            }
            highlightHTML += `<div class="${className}">${lineContent}</div>`;
        });

        console.log('[更新显示] 总差异行数:', diffCount);
        highlightLayer.innerHTML = highlightHTML;

        // 确保容器有相对定位
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        container.appendChild(highlightLayer);
        console.log('[更新显示] 高亮层已添加到DOM');

        // 初始滚动同步，避免首次渲染顶部出现位移
        highlightLayer.scrollTop = textarea.scrollTop;
        highlightLayer.scrollLeft = textarea.scrollLeft;

        // 淡入显示高亮层
        requestAnimationFrame(() => {
            if (highlightLayer) highlightLayer.style.opacity = '1';
        });

        // 设置textarea样式 - 关键：让文字完全透明避免重影
        textarea.style.position = 'relative';
        textarea.style.zIndex = '2';
        textarea.style.background = 'transparent';
        textarea.style.color = 'transparent';  // 文字透明，避免与高亮层重叠
        textarea.style.caretColor = 'var(--text-primary)';  // 保持光标可见

        // 同步滚动
        const scrollHandler = () => {
            if (highlightLayer.parentElement) {
                highlightLayer.scrollTop = textarea.scrollTop;
                highlightLayer.scrollLeft = textarea.scrollLeft;
            }
        };

        // 移除之前的滚动监听器
        if (textarea._scrollHandler) {
            textarea.removeEventListener('scroll', textarea._scrollHandler);
        }

        textarea._scrollHandler = scrollHandler;
        textarea.addEventListener('scroll', scrollHandler);
    }

    // 获取高亮样式类名
    getHighlightClass(diffType) {
        switch (diffType) {
            case 'added':
                return 'highlight-added';
            case 'removed':
                return 'highlight-removed';
            case 'modified':
                return 'highlight-modified';
            case 'same':
            default:
                return 'highlight-same';
        }
    }

    // 记录对比输入框历史
    recordCompareHistory(side, content) {
        try {
            if (this._suppressCompareHistory) return;
            const maxLen = 100;
            if (side === 'left') {
                // 避免重复入栈
                if (this.compareHistoryLeft.length === 0 || this.compareHistoryLeft[this.compareHistoryLeft.length - 1] !== content) {
                    // 截断未来分支
                    this.compareHistoryLeft = this.compareHistoryLeft.slice(0, this.compareHistoryLeftIndex + 1);
                    this.compareHistoryLeft.push(content);
                    if (this.compareHistoryLeft.length > maxLen) {
                        this.compareHistoryLeft = this.compareHistoryLeft.slice(-maxLen);
                    }
                    this.compareHistoryLeftIndex = this.compareHistoryLeft.length - 1;
                    this.saveToLocalStorage();
                }
            } else if (side === 'right') {
                if (this.compareHistoryRight.length === 0 || this.compareHistoryRight[this.compareHistoryRight.length - 1] !== content) {
                    this.compareHistoryRight = this.compareHistoryRight.slice(0, this.compareHistoryRightIndex + 1);
                    this.compareHistoryRight.push(content);
                    if (this.compareHistoryRight.length > maxLen) {
                        this.compareHistoryRight = this.compareHistoryRight.slice(-maxLen);
                    }
                    this.compareHistoryRightIndex = this.compareHistoryRight.length - 1;
                    this.saveToLocalStorage();
                }
            }
        } catch (e) {
            // ignore
        }
    }

    // 对比输入框撤销
    compareUndo() {
        try {
            const leftArea = document.getElementById('leftJson');
            const rightArea = document.getElementById('rightJson');
            if (!leftArea || !rightArea) return;

            // 撤销左
            if (this.compareHistoryLeftIndex > 0) {
                this.compareHistoryLeftIndex--;
                const val = this.compareHistoryLeft[this.compareHistoryLeftIndex] ?? '';
                this._suppressCompareHistory = true;
                this.clearComparison();
                leftArea.value = val;
                this._suppressCompareHistory = false;
            }

            // 撤销右
            if (this.compareHistoryRightIndex > 0) {
                this.compareHistoryRightIndex--;
                const val = this.compareHistoryRight[this.compareHistoryRightIndex] ?? '';
                this._suppressCompareHistory = true;
                this.clearComparison();
                rightArea.value = val;
                this._suppressCompareHistory = false;
            }

            this.updateStatus('已撤销（对比）');
            this.saveToLocalStorage();
        } catch (e) {}
    }

    // 对比输入框重做
    compareRedo() {
        try {
            const leftArea = document.getElementById('leftJson');
            const rightArea = document.getElementById('rightJson');
            if (!leftArea || !rightArea) return;

            if (this.compareHistoryLeftIndex < this.compareHistoryLeft.length - 1) {
                this.compareHistoryLeftIndex++;
                const val = this.compareHistoryLeft[this.compareHistoryLeftIndex] ?? '';
                this._suppressCompareHistory = true;
                this.clearComparison();
                leftArea.value = val;
                this._suppressCompareHistory = false;
            }

            if (this.compareHistoryRightIndex < this.compareHistoryRight.length - 1) {
                this.compareHistoryRightIndex++;
                const val = this.compareHistoryRight[this.compareHistoryRightIndex] ?? '';
                this._suppressCompareHistory = true;
                this.clearComparison();
                rightArea.value = val;
                this._suppressCompareHistory = false;
            }

            this.updateStatus('已重做（对比）');
            this.saveToLocalStorage();
        } catch (e) {}
    }

    // （不再使用）自动对比（防抖）
    scheduleAutoCompare(delay = 400) {
        clearTimeout(this._compareDebounceTimer);
        this._compareDebounceTimer = setTimeout(() => {
            const left = document.getElementById('leftJson').value.trim();
            const right = document.getElementById('rightJson').value.trim();
            if (!left || !right) return;
            try {
                JSON.parse(left);
                JSON.parse(right);
            } catch (e) {
                return; // 不触发错误提示，静默跳过
            }
            this.compareJSON({ silent: true });
        }, delay);
    }

    // 清除对比显示
    clearComparison() {
        ['leftJson', 'rightJson'].forEach(id => {
            const textarea = document.getElementById(id);
            if (!textarea) return;
            const container = textarea.parentElement;
            const highlightLayer = container ? container.querySelector('.highlight-layer') : null;

            if (highlightLayer) {
                highlightLayer.remove();
            }

            // 恢复textarea的原始样式
            textarea.style.background = 'var(--bg-primary)';
            textarea.style.position = 'static';
            textarea.style.zIndex = 'auto';
            textarea.style.color = 'var(--text-primary)';  // 恢复文字颜色
            textarea.style.caretColor = 'auto';  // 恢复光标颜色

            // 移除滚动监听器
            if (textarea._scrollHandler) {
                textarea.removeEventListener('scroll', textarea._scrollHandler);
                delete textarea._scrollHandler;
            }
        });
    }

    // 多分隔栏：初始化
    initMultiSplit() {
        this.maxSplitPanes = 5;
        this.defaultSplitPanes = 3;
        this.splitPaneWidths = [];
        this.splitPaneContents = [];

        // 从本地存储恢复
        try {
            const data = JSON.parse(localStorage.getItem('json-tool-data') || '{}');
            if (Array.isArray(data.splitPaneWidths) && data.splitPaneWidths.length) {
                this.splitPaneWidths = data.splitPaneWidths;
            }
            if (Array.isArray(data.splitPaneContents)) {
                this.splitPaneContents = data.splitPaneContents;
            }
        } catch (e) {}

        if (!this.splitPaneWidths.length) {
            this.splitPaneWidths = Array(this.defaultSplitPanes).fill(1 / this.defaultSplitPanes);
        }
        if (!this.splitPaneContents.length) {
            this.splitPaneContents = Array(this.defaultSplitPanes).fill('');
        }

        this.renderMultiSplit();
    }

    // 多分隔栏：渲染
    renderMultiSplit() {
        const container = document.getElementById('multiSplitContainer');
        if (!container) return;

        container.innerHTML = '';
        container.classList.remove('multi-split-resizing');

        const total = this.splitPaneWidths.length;

        for (let i = 0; i < total; i++) {
            // pane
            const pane = document.createElement('div');
            pane.className = 'multi-pane';
            pane.style.flex = `${this.splitPaneWidths[i]} 0 0%`;

            const header = document.createElement('header');
            const title = document.createElement('div');
            title.textContent = `面板 ${i + 1}`;
            const actions = document.createElement('div');
            actions.className = 'pane-actions';
            const beautifyBtn = document.createElement('button');
            beautifyBtn.className = 'pane-action-btn';
            beautifyBtn.title = '美化';
            beautifyBtn.textContent = '美';
            const compressBtn = document.createElement('button');
            compressBtn.className = 'pane-action-btn';
            compressBtn.title = '压缩';
            compressBtn.textContent = '压';
            const delBtn = document.createElement('button');
            delBtn.className = 'pane-delete-btn';
            delBtn.title = '删除分隔栏';
            delBtn.textContent = '×';
            delBtn.addEventListener('click', () => this.removeSplitPane(i));
            actions.appendChild(beautifyBtn);
            actions.appendChild(compressBtn);
            actions.appendChild(delBtn);
            header.appendChild(title);
            header.appendChild(actions);
            pane.appendChild(header);

            const content = document.createElement('div');
            content.className = 'multi-pane-content';
            const gutter = document.createElement('div');
            gutter.className = 'pane-line-numbers';
            const textarea = document.createElement('textarea');
            textarea.className = 'multi-pane-textarea';
            textarea.placeholder = '在此输入或粘贴 JSON...';
            textarea.setAttribute('wrap', 'off');
            textarea.value = this.splitPaneContents[i] || '';
            // 行号初始化与同步
            gutter.innerHTML = this.generateLineNumbers((textarea.value.split('\n').length) || 1);
            textarea.addEventListener('scroll', () => { gutter.scrollTop = textarea.scrollTop; });
            textarea.addEventListener('input', () => {
                this.splitPaneContents[i] = textarea.value;
                gutter.innerHTML = this.generateLineNumbers((textarea.value.split('\n').length) || 1);
                gutter.scrollTop = textarea.scrollTop;
                this.saveSplitLayout();
            });
            textarea.addEventListener('blur', () => {
                const raw = textarea.value.trim();
                if (!raw) return;
                try {
                    const pretty = JSON.stringify(JSON.parse(raw), null, 2);
                    textarea.value = pretty;
                    this.splitPaneContents[i] = pretty;
                    gutter.innerHTML = this.generateLineNumbers((textarea.value.split('\n').length) || 1);
                    gutter.scrollTop = textarea.scrollTop;
                    this.saveSplitLayout();
                } catch (e) {
                    // 保持原样
                }
            });
            // 面板按钮逻辑
            beautifyBtn.addEventListener('click', () => {
                try {
                    const pretty = JSON.stringify(JSON.parse(textarea.value), null, 2);
                    textarea.value = pretty;
                    this.splitPaneContents[i] = pretty;
                    gutter.innerHTML = this.generateLineNumbers((textarea.value.split('\n').length) || 1);
                    gutter.scrollTop = textarea.scrollTop;
                    this.saveSplitLayout();
                } catch (e) {
                    this.showError('美化失败', '当前面板的 JSON 不是有效格式');
                }
            });
            compressBtn.addEventListener('click', () => {
                try {
                    const compact = JSON.stringify(JSON.parse(textarea.value));
                    textarea.value = compact;
                    this.splitPaneContents[i] = compact;
                    gutter.innerHTML = this.generateLineNumbers((textarea.value.split('\n').length) || 1);
                    gutter.scrollTop = textarea.scrollTop;
                    this.saveSplitLayout();
                } catch (e) {
                    this.showError('压缩失败', '当前面板的 JSON 不是有效格式');
                }
            });
            content.appendChild(gutter);
            content.appendChild(textarea);
            pane.appendChild(content);

            container.appendChild(pane);

            // resizer（不要在最后一个后面）
            if (i < total - 1) {
                const resizer = document.createElement('div');
                resizer.className = 'multi-split-resizer';
                resizer.dataset.index = String(i);
                container.appendChild(resizer);
            }
        }

        this.attachResizerEvents(container);
        this.updateSplitButtonsState();
        this.saveSplitLayout();
    }

    // 对比页：单侧美化
    beautifyCompareSide(side) {
        try {
            const textarea = document.getElementById(side === 'left' ? 'leftJson' : 'rightJson');
            const lines = document.getElementById(side === 'left' ? 'leftJsonLines' : 'rightJsonLines');
            const raw = textarea.value;
            if (!raw.trim()) return;
            const pretty = JSON.stringify(JSON.parse(raw), null, 2);
            textarea.value = pretty;
            if (lines) {
                lines.innerHTML = this.generateLineNumbers((pretty.split('\n').length) || 1);
                lines.scrollTop = textarea.scrollTop;
            }
            this.updateStatus(`${side === 'left' ? '左侧' : '右侧'}已美化`);
        } catch (e) {
            this.showError('美化失败', `${side === 'left' ? '左侧' : '右侧'} JSON 不是有效格式`);
        }
    }

    // 多分隔栏：保存布局
    saveSplitLayout() {
        try {
            const data = JSON.parse(localStorage.getItem('json-tool-data') || '{}');
            data.splitPaneWidths = this.splitPaneWidths;
            data.splitPaneContents = this.splitPaneContents;
            localStorage.setItem('json-tool-data', JSON.stringify(data));
        } catch (e) {}
    }

    // 获取当前编辑器的美化文本
    getCurrentEditorFormatted() {
        const editor = document.getElementById('jsonEditor');
        if (!editor) return '';
        const input = editor.value.trim();
        if (!input) return '';
        try {
            const parsed = JSON.parse(input);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            return '';
        }
    }

    // 更新分隔栏显示的文本
    updateFormatterSplit(prettyText) {
        try {
            const container = document.getElementById('multiSplitContainer');
            if (!container) return;
            const contents = container.querySelectorAll('.multi-pane-content');
            contents.forEach(el => {
                el.textContent = prettyText || '';
            });
        } catch (e) {}
    }

    // 多分隔栏：添加面板
    addSplitPane() {
        if (this.splitPaneWidths.length >= this.maxSplitPanes) {
            this.updateStatus(`已达到最大分隔栏数（${this.maxSplitPanes}）`);
            return;
        }
        const n = this.splitPaneWidths.length + 1;
        this.splitPaneWidths = Array(n).fill(1 / n);
        this.splitPaneContents = [...this.splitPaneContents, ''];
        this.renderMultiSplit();
        this.updateStatus(`已添加分隔栏，当前 ${n} 个`);
    }

    // 多分隔栏：删除面板
    removeSplitPane(index = this.splitPaneWidths.length - 1) {
        if (this.splitPaneWidths.length <= 1) {
            this.updateStatus('至少保留 1 个分隔栏');
            return;
        }
        // 删除对应索引的内容
        this.splitPaneContents = this.splitPaneContents.filter((_, i) => i !== index);
        // 等分剩余宽度
        const n = this.splitPaneWidths.length - 1;
        this.splitPaneWidths = Array(n).fill(1 / n);
        this.renderMultiSplit();
        this.updateStatus(`已删除分隔栏，当前 ${n} 个`);
    }

    // 多分隔栏：更新按钮可用态
    updateSplitButtonsState() {
        const addSplitBtn = document.getElementById('addSplitPane');
        const canAdd = this.splitPaneWidths.length < this.maxSplitPanes;
        if (addSplitBtn) addSplitBtn.disabled = !canAdd;
    }

    // 多分隔栏：绑定拖拽事件
    attachResizerEvents(container) {
        const resizers = Array.from(container.querySelectorAll('.multi-split-resizer'));
        if (!resizers.length) return;

        let dragging = false;
        let startX = 0;
        let startWidths = [];
        let leftIndex = 0; // 左侧面板索引

        const minPanePx = 120; // 面板最小像素宽度

        const onMouseDown = (e) => {
            const target = e.currentTarget;
            leftIndex = parseInt(target.dataset.index, 10);
            dragging = true;
            startX = e.clientX;
            startWidths = this.splitPaneWidths.slice();
            container.classList.add('multi-split-resizing');
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!dragging) return;
            const deltaX = e.clientX - startX;

            const containerRect = container.getBoundingClientRect();
            const totalWidth = containerRect.width - (resizers.length * 6); // 扣除分隔条厚度

            // 将起始宽度转为像素
            const pxWidths = startWidths.map(w => w * totalWidth);
            const leftPx = pxWidths[leftIndex];
            const rightPx = pxWidths[leftIndex + 1];

            let newLeft = leftPx + deltaX;
            let newRight = rightPx - deltaX;

            if (newLeft < minPanePx) { newRight -= (minPanePx - newLeft); newLeft = minPanePx; }
            if (newRight < minPanePx) { newLeft -= (minPanePx - newRight); newRight = minPanePx; }
            if (newLeft < minPanePx) newLeft = minPanePx;
            if (newRight < minPanePx) newRight = minPanePx;

            // 回写到比例
            const otherSumPx = pxWidths.reduce((s, v, i) => s + (i === leftIndex || i === leftIndex + 1 ? 0 : v), 0);
            const sumPx = otherSumPx + newLeft + newRight;
            const newWidthsPx = pxWidths.map((v, i) => {
                if (i === leftIndex) return newLeft;
                if (i === leftIndex + 1) return newRight;
                return v;
            });
            const newWidths = newWidthsPx.map(v => v / sumPx);
            this.splitPaneWidths = newWidths;
            // 更新flex
            const panes = container.querySelectorAll('.multi-pane');
            panes.forEach((pane, i) => {
                pane.style.flex = `${this.splitPaneWidths[i]} 0 0%`;
            });
        };

        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            container.classList.remove('multi-split-resizing');
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            this.saveSplitLayout();
        };

        resizers.forEach(r => r.addEventListener('mousedown', onMouseDown));
    }

    // 当对比结果存在时，用户进行编辑/聚焦：仅清理覆盖（不自动对比）
    handleCompareTextChange() {
        try {
            const ids = ['leftJson', 'rightJson'];
            let needClear = false;
            ids.forEach(id => {
                const textarea = document.getElementById(id);
                if (!textarea) return;
                const container = textarea.parentElement;
                if (!container) return;
                if (container.querySelector('.highlight-layer')) {
                    needClear = true;
                }
                const computed = getComputedStyle(textarea);
                if (computed && (computed.color === 'rgba(0, 0, 0, 0)' || textarea.style.color === 'transparent')) {
                    needClear = true;
                }
            });

            if (needClear) {
                this.clearComparison();
            }
        } catch (e) {
            // 忽略
        }
    }


    // 选择数据模板
    selectTemplate(templateName) {
        // 移除所有模板按钮的active类
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 添加active类到当前选中的按钮
        document.querySelector(`[data-template="${templateName}"]`).classList.add('active');

        this.currentTemplate = templateName;
        // this.showNotification(`已选择${this.getTemplateName(templateName)}模板`, 'info');
    }

    // 获取模板中文名称
    getTemplateName(templateName) {
        const names = {
            user: '用户信息',
            product: '商品数据',
            order: '订单记录',
            address: '地址信息',
            company: '公司信息',
            article: '文章内容',
            api: 'API响应',
            config: '配置文件'
        };
        return names[templateName] || templateName;
    }

    // 生成Demo数据
    generateData() {
        if (!this.currentTemplate) {
            // this.showNotification('请先选择一个模板', 'warning');
            return;
        }

        const count = parseInt(document.getElementById('generateCount').value) || 1;
        const generateArray = document.getElementById('generateArray').checked;
        const randomizeFields = document.getElementById('randomizeFields').checked;
        const locale = document.getElementById('localeSelect').value;

        const data = this.generateTemplateData(this.currentTemplate, count, randomizeFields, locale);
        const result = generateArray && count > 1 ? data : data[0];

        const jsonString = JSON.stringify(result, null, 2);
        document.getElementById('generatedJson').value = jsonString;

        // this.showNotification(`已生成${count}条${this.getTemplateName(this.currentTemplate)}数据`, 'success');
    }

    // 生成模板数据
    generateTemplateData(templateName, count, randomize, locale) {
        const generators = {
            user: () => this.generateUserData(locale),
            product: () => this.generateProductData(locale),
            order: () => this.generateOrderData(locale),
            address: () => this.generateAddressData(locale),
            company: () => this.generateCompanyData(locale),
            article: () => this.generateArticleData(locale),
            api: () => this.generateAPIData(locale),
            config: () => this.generateConfigData(locale)
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
            en_US: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown'],
            ja_JP: ['田中太郎', '佐藤花子', '山田一郎', '松本美咲']
        };

        const cities = {
            zh_CN: ['北京', '上海', '广州', '深圳', '杭州'],
            en_US: ['New York', 'Los Angeles', 'Chicago', 'Houston'],
            ja_JP: ['東京', '大阪', '名古屋', '横浜']
        };

        const randomName = names[locale][Math.floor(Math.random() * names[locale].length)];
        const randomCity = cities[locale][Math.floor(Math.random() * cities[locale].length)];

        const emailPrefix = locale === 'zh_CN' ?
            `user${Math.floor(Math.random() * 10000)}` :
            randomName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

        return {
            id: Math.floor(Math.random() * 10000),
            name: randomName,
            email: `${emailPrefix}@example.com`,
            age: Math.floor(Math.random() * 50) + 18,
            city: randomCity,
            phone: this.generatePhone(locale),
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.floor(Math.random() * 1000)}`,
            createdAt: this.generateRandomDate(),
            isActive: Math.random() > 0.5
        };
    }

    // 生成商品数据
    generateProductData(locale) {
        const products = {
            zh_CN: ['苹果手机', '笔记本电脑', '无线耳机', '智能手表', '平板电脑'],
            en_US: ['iPhone', 'MacBook', 'AirPods', 'Apple Watch', 'iPad'],
            ja_JP: ['iPhone', 'MacBook', 'AirPods', 'Apple Watch', 'iPad']
        };

        const categories = {
            zh_CN: ['电子产品', '数码配件', '智能设备'],
            en_US: ['Electronics', 'Accessories', 'Smart Devices'],
            ja_JP: ['電子製品', 'アクセサリー', 'スマートデバイス']
        };

        const randomProduct = products[locale][Math.floor(Math.random() * products[locale].length)];
        const randomCategory = categories[locale][Math.floor(Math.random() * categories[locale].length)];

        return {
            id: Math.floor(Math.random() * 10000),
            name: randomProduct,
            category: randomCategory,
            price: Math.floor(Math.random() * 5000) + 100,
            currency: locale === 'zh_CN' ? 'CNY' : locale === 'ja_JP' ? 'JPY' : 'USD',
            stock: Math.floor(Math.random() * 1000),
            rating: Math.round((Math.random() * 4 + 1) * 10) / 10,
            description: `高质量的${randomProduct}，性能优异，值得拥有。`
        };
    }

    // 生成订单数据
    generateOrderData(locale) {
        return {
            orderId: this.generateOrderId(),
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
            orderDate: this.generateRandomDate(),
            shippingAddress: this.generateAddressData(locale)
        };
    }

    // 生成地址数据
    generateAddressData(locale) {
        const addresses = {
            zh_CN: {
                country: '中国',
                province: ['北京市', '上海市', '广东省', '浙江省'][Math.floor(Math.random() * 4)],
                city: ['北京', '上海', '广州', '杭州'][Math.floor(Math.random() * 4)],
                street: '中山路123号',
                zipCode: '100000'
            },
            en_US: {
                country: 'United States',
                state: ['CA', 'NY', 'TX', 'FL'][Math.floor(Math.random() * 4)],
                city: ['Los Angeles', 'New York', 'Houston', 'Miami'][Math.floor(Math.random() * 4)],
                street: '123 Main St',
                zipCode: '90210'
            },
            ja_JP: {
                country: '日本',
                prefecture: ['東京都', '大阪府', '神奈川県'][Math.floor(Math.random() * 3)],
                city: ['新宿区', '渋谷区', '港区'][Math.floor(Math.random() * 3)],
                street: '1-2-3 新宿',
                zipCode: '160-0022'
            }
        };

        return addresses[locale];
    }

    // 生成公司数据
    generateCompanyData(locale) {
        const companies = {
            zh_CN: ['阿里巴巴', '腾讯', '百度', '字节跳动', '美团'],
            en_US: ['Apple', 'Google', 'Microsoft', 'Amazon', 'Meta'],
            ja_JP: ['ソニー', 'トヨタ', 'ソフトバンク', '楽天', 'KDDI']
        };

        const industries = {
            zh_CN: ['科技', '电商', '金融', '教育', '医疗'],
            en_US: ['Technology', 'E-commerce', 'Finance', 'Education', 'Healthcare'],
            ja_JP: ['技術', 'Eコマース', '金融', '教育', '医療']
        };

        const randomCompany = companies[locale][Math.floor(Math.random() * companies[locale].length)];
        const randomIndustry = industries[locale][Math.floor(Math.random() * industries[locale].length)];

        return {
            id: Math.floor(Math.random() * 10000),
            name: randomCompany,
            industry: randomIndustry,
            employees: Math.floor(Math.random() * 100000) + 100,
            founded: Math.floor(Math.random() * 50) + 1970,
            headquarters: this.generateAddressData(locale),
            website: `https://www.${randomCompany.toLowerCase().replace(/\s+/g, '')}.com`
        };
    }

    // 生成文章数据
    generateArticleData(locale) {
        const titles = {
            zh_CN: ['人工智能的发展前景', '云计算技术解析', '前端开发最佳实践'],
            en_US: ['The Future of AI', 'Understanding Cloud Computing', 'Frontend Development Best Practices'],
            ja_JP: ['AIの将来性', 'クラウドコンピューティング技術', 'フロントエンド開発のベストプラクティス']
        };

        const authors = {
            zh_CN: ['张小明', '李小红', '王小强'],
            en_US: ['John Smith', 'Jane Doe', 'Bob Wilson'],
            ja_JP: ['田中太郎', '佐藤花子', '山田一郎']
        };

        const randomTitle = titles[locale][Math.floor(Math.random() * titles[locale].length)];
        const randomAuthor = authors[locale][Math.floor(Math.random() * authors[locale].length)];

        return {
            id: Math.floor(Math.random() * 10000),
            title: randomTitle,
            author: randomAuthor,
            content: `这是一篇关于${randomTitle}的文章内容...`,
            publishDate: this.generateRandomDate(),
            tags: ['技术', '编程', '开发'],
            viewCount: Math.floor(Math.random() * 10000),
            likeCount: Math.floor(Math.random() * 1000),
            commentCount: Math.floor(Math.random() * 100)
        };
    }

    // 生成API响应数据
    generateAPIData(locale) {
        return {
            code: 200,
            message: 'success',
            data: {
                users: [
                    this.generateUserData(locale),
                    this.generateUserData(locale)
                ],
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 100,
                    hasNext: true
                }
            },
            timestamp: new Date().toISOString(),
            requestId: this.generateRequestId()
        };
    }

    // 生成配置数据
    generateConfigData(locale) {
        return {
            app: {
                name: 'JSON工具',
                version: '1.0.0',
                environment: 'production'
            },
            database: {
                host: 'localhost',
                port: 3306,
                name: 'json_tool',
                charset: 'utf8mb4'
            },
            cache: {
                enabled: true,
                ttl: 3600,
                provider: 'redis'
            },
            api: {
                baseUrl: 'https://api.example.com',
                timeout: 30000,
                retries: 3
            }
        };
    }

    // 辅助函数
    generatePhone(locale) {
        const formats = {
            zh_CN: () => `1${Math.floor(Math.random() * 9) + 3}${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
            en_US: () => `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
            ja_JP: () => `090-${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`
        };
        return formats[locale]();
    }

    generateRandomDate() {
        const start = new Date(2020, 0, 1);
        const end = new Date();
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
    }

    generateOrderId() {
        return 'ORD' + Date.now() + Math.floor(Math.random() * 1000);
    }

    generateRequestId() {
        return 'req_' + Math.random().toString(36).substr(2, 9);
    }

    // 使用生成的数据
    useGeneratedData() {
        const generatedJson = document.getElementById('generatedJson').value;
        if (!generatedJson) {
            // this.showNotification('没有生成的数据可使用', 'warning');
            return;
        }

        document.getElementById('jsonEditor').value = generatedJson;
        this.switchTab('formatter');
        this.updateEditorInfo();
        this.realTimeValidation(generatedJson);
        // this.showNotification('已将生成的数据导入到编辑器', 'success');
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

        // F1: 帮助
        if (event.key === 'F1') {
            event.preventDefault();
            this.showHelp();
        }

        // Esc: 关闭模态框或侧边栏
        if (event.key === 'Escape') {
            this.closeModal();
            this.closeSidebar();
        }

        // Ctrl/Cmd + Z: 撤销
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (this.currentTab === 'compare') {
                this.compareUndo();
            } else {
                this.undo();
            }
        }

        // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y: 重做
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'Z'))) {
            event.preventDefault();
            if (this.currentTab === 'compare') {
                this.compareRedo();
            } else {
                this.redo();
            }
        }
    }

    // 历史记录管理
    addToHistory(content) {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push({
            content: content,
            timestamp: new Date().toISOString()
        });

        if (this.history.length > 50) {
            this.history = this.history.slice(-50);
        }

        this.historyIndex = this.history.length - 1;
        this.saveToLocalStorage();
    }

    // 撤销
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const historyItem = this.history[this.historyIndex];
            document.getElementById('jsonEditor').value = historyItem.content;
            this.updateEditorInfo();
            this.realTimeValidation(historyItem.content);
            // this.showNotification('已撤销', 'info');
        } else {
            // this.showNotification('没有可撤销的操作', 'warning');
        }
    }

    // 重做
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const historyItem = this.history[this.historyIndex];
            document.getElementById('jsonEditor').value = historyItem.content;
            this.updateEditorInfo();
            this.realTimeValidation(historyItem.content);
            // this.showNotification('已重做', 'info');
        } else {
            // this.showNotification('没有可重做的操作', 'warning');
        }
    }

    // 显示历史记录
    showHistory() {
        const content = `
            <div class="history-list">
                <h4>操作历史</h4>
                ${this.history.map((item, index) => `
                    <div class="history-item ${index === this.historyIndex ? 'current' : ''}" data-index="${index}">
                        <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
                        <div class="history-preview">${item.content.substring(0, 100)}...</div>
                    </div>
                `).join('')}
                ${this.history.length === 0 ? '<div class="empty-state">暂无历史记录</div>' : ''}
            </div>
        `;

        this.showSidebar('操作历史', content);

        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.loadFromHistory(index);
            });
        });
    }

    // 从历史记录加载
    loadFromHistory(index) {
        if (index >= 0 && index < this.history.length) {
            this.historyIndex = index;
            const historyItem = this.history[index];
            document.getElementById('jsonEditor').value = historyItem.content;
            this.updateEditorInfo();
            this.realTimeValidation(historyItem.content);
            this.closeSidebar();
            // this.showNotification('已加载历史记录', 'success');
        }
    }

    // 显示设置
    showSettings() {
        const content = `
            <div class="settings-panel">
                <h4>应用设置</h4>

                <div class="setting-group">
                    <h5>主题设置</h5>
                    <label>
                        <input type="radio" name="theme" value="light" ${this.theme === 'light' ? 'checked' : ''}> 亮色主题
                    </label>
                    <label>
                        <input type="radio" name="theme" value="dark" ${this.theme === 'dark' ? 'checked' : ''}> 暗色主题
                    </label>
                </div>

                <div class="setting-group">
                    <h5>编辑器设置</h5>
                    <label>
                        字体大小: <input type="range" id="fontSizeRange" min="10" max="20" value="14">
                        <span id="fontSizeValue">14px</span>
                    </label>
                    <label>
                        <input type="checkbox" id="autoFormat"> 自动格式化
                    </label>
                    <label>
                        <input type="checkbox" id="realTimeValidation" checked> 实时验证
                    </label>
                </div>

                <div class="setting-group">
                    <h5>数据管理</h5>
                    <button class="action-btn secondary" id="clearHistory">清除历史记录</button>
                </div>
            </div>
        `;

        this.showSidebar('设置', content);

        // 设置事件监听
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.theme = e.target.value;
                    this.setupTheme();
                    localStorage.setItem('json-tool-theme', this.theme);
                }
            });
        });

        const fontSizeRange = document.getElementById('fontSizeRange');
        const fontSizeValue = document.getElementById('fontSizeValue');

        fontSizeRange.addEventListener('input', (e) => {
            const size = e.target.value;
            fontSizeValue.textContent = `${size}px`;
            document.getElementById('jsonEditor').style.fontSize = `${size}px`;
        });

        document.getElementById('clearHistory').addEventListener('click', () => {
            if (confirm('确定要清除所有历史记录吗？')) {
                this.history = [];
                this.historyIndex = -1;
                this.saveToLocalStorage();
                // this.showNotification('历史记录已清除', 'success');
            }
        });
    }

    // 显示帮助
    showHelp() {
        const content = `
            <div class="help-content">
                <h4>快捷键</h4>
                <div class="shortcut-list">
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + Shift + F</kbd>
                        <span>格式化JSON</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + Shift + C</kbd>
                        <span>压缩JSON</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + Z</kbd>
                        <span>撤销</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + Y</kbd>
                        <span>重做</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>F1</kbd>
                        <span>显示帮助</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Esc</kbd>
                        <span>关闭弹窗</span>
                    </div>
                </div>

                <h4>功能说明</h4>
                <div class="feature-list">
                    <div class="feature-item">
                        <strong>格式化:</strong> 美化JSON格式，添加缩进和换行
                    </div>
                    <div class="feature-item">
                        <strong>对比:</strong> 比较两个JSON的差异，高亮显示变化
                    </div>
                    <div class="feature-item">
                        <strong>生成器:</strong> 生成各种类型的Demo数据
                    </div>
                </div>

                <h4>版本信息</h4>
                <div class="version-info">
                    <div>版本: 1.0.0 简化版</div>
                    <div>更新时间: 2024-01-01</div>
                    <div>功能: 格式化、对比、数据生成</div>
                </div>
            </div>
        `;

        this.showSidebar('帮助', content);
    }

    // 显示侧边栏
    showSidebar(title, content) {
        const sidebar = document.getElementById('sidebar');
        const sidebarTitle = document.getElementById('sidebarTitle');
        const sidebarContent = document.getElementById('sidebarContent');

        sidebarTitle.textContent = title;
        sidebarContent.innerHTML = content;
        sidebar.classList.add('open');
        sidebar.style.display = 'flex';
    }

    // 关闭侧边栏
    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
        setTimeout(() => {
            sidebar.style.display = 'none';
        }, 300);
    }

    // 显示模态框
    showModal(title, content, onConfirm = null) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modalConfirm = document.getElementById('modalConfirm');

        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modal.classList.add('open');
        modal.style.display = 'flex';

        if (onConfirm) {
            modalConfirm.onclick = () => {
                onConfirm();
                this.closeModal();
            };
        }
    }

    // 关闭模态框
    closeModal() {
        const modal = document.getElementById('modal');
        modal.classList.remove('open');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${this.getNotificationIcon(type)}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;

        notifications.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);

        notification.addEventListener('click', () => {
            notification.remove();
        });
    }

    // 获取通知图标
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // 更新状态
    updateStatus(message) {
        document.getElementById('statusInfo').textContent = message;
    }

    // 保存到本地存储
    saveToLocalStorage() {
        const data = {
            history: this.history,
            historyIndex: this.historyIndex,
            theme: this.theme,
            compareHistoryLeft: this.compareHistoryLeft,
            compareHistoryLeftIndex: this.compareHistoryLeftIndex,
            compareHistoryRight: this.compareHistoryRight,
            compareHistoryRightIndex: this.compareHistoryRightIndex
        };
        localStorage.setItem('json-tool-data', JSON.stringify(data));
    }

    // 从本地存储加载
    loadFromLocalStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('json-tool-data') || '{}');
            this.history = data.history || [];
            this.historyIndex = typeof data.historyIndex === 'number' ? data.historyIndex : -1;
            this.theme = data.theme || 'light';

            this.compareHistoryLeft = Array.isArray(data.compareHistoryLeft) ? data.compareHistoryLeft : [];
            this.compareHistoryLeftIndex = typeof data.compareHistoryLeftIndex === 'number' ? data.compareHistoryLeftIndex : -1;
            this.compareHistoryRight = Array.isArray(data.compareHistoryRight) ? data.compareHistoryRight : [];
            this.compareHistoryRightIndex = typeof data.compareHistoryRightIndex === 'number' ? data.compareHistoryRightIndex : -1;
        } catch (error) {
            console.warn('Failed to load data from localStorage:', error);
        }
    }
}

// 当页面加载完成时初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.jsonToolApp = new JSONToolApp();
});
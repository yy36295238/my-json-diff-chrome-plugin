// JSON工具核心应用类
class JSONToolApp {
    constructor() {
        this.currentTab = 'formatter';
        this.history = [];
        this.historyIndex = -1;
        this.theme = localStorage.getItem('json-tool-theme') || 'light';
        this.jsonData = null;
        this.isValidJson = false;
        this.currentTemplate = null;

        this.init();
    }

    // 初始化应用
    init() {
        this.setupEventListeners();
        this.setupTheme();
        this.loadFromLocalStorage();
        this.updateStatus('应用已就绪');
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


        // JSON编辑器实时验证
        const jsonEditor = document.getElementById('jsonEditor');
        jsonEditor.addEventListener('input', (e) => {
            this.updateEditorInfo();
            this.realTimeValidation(e.target.value);
        });

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
        document.getElementById('compareBtn').addEventListener('click', () => {
            this.compareJSON();
        });

        document.getElementById('swapBtn').addEventListener('click', () => {
            this.swapCompareInputs();
        });

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

        // 撤销重做
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });

        document.getElementById('redoBtn').addEventListener('click', () => {
            this.redo();
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
            generator: '生成器'
        };
        return names[tabName] || tabName;
    }

    // 主题切换
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.setupTheme();
        localStorage.setItem('json-tool-theme', this.theme);
        this.showNotification(`已切换到${this.theme === 'light' ? '亮色' : '暗色'}主题`, 'info');
    }

    // 设置主题
    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeBtn = document.getElementById('themeToggle');
        themeBtn.textContent = this.theme === 'light' ? '🌙' : '☀️';
    }

    // JSON格式化
    formatJSON() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();

        if (!input) {
            this.showNotification('请输入JSON数据', 'warning');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const formatted = JSON.stringify(parsed, null, 2);
            editor.value = formatted;
            this.updatePreview(formatted);
            this.addToHistory(formatted);
            this.showNotification('JSON格式化成功', 'success');
            this.updateStatus('JSON格式化完成');
        } catch (error) {
            this.showError('JSON格式化失败', error.message);
        }
    }

    // JSON压缩
    compressJSON() {
        const editor = document.getElementById('jsonEditor');
        const input = editor.value.trim();

        if (!input) {
            this.showNotification('请输入JSON数据', 'warning');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const compressed = JSON.stringify(parsed);
            editor.value = compressed;
            this.updatePreview(compressed);
            this.addToHistory(compressed);
            this.showNotification('JSON压缩成功', 'success');
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
            this.jsonData = parsed;
            this.isValidJson = true;
            this.hideErrorPanel();
            this.updatePreview(JSON.stringify(parsed, null, 2));
        } catch (error) {
            this.isValidJson = false;
            // 实时验证时不显示错误面板，避免干扰用户输入
        }
    }

    // 格式化JSON错误信息
    formatJSONError(error, input) {
        const lines = input.split('\n');
        const message = error.message;

        // 尝试提取行号信息
        const lineMatch = message.match(/at position (\d+)/);
        if (lineMatch) {
            const position = parseInt(lineMatch[1]);
            let lineNum = 1;
            let charCount = 0;

            for (let i = 0; i < lines.length; i++) {
                if (charCount + lines[i].length >= position) {
                    lineNum = i + 1;
                    break;
                }
                charCount += lines[i].length + 1; // +1 for newline
            }

            return `${message}\n位置: 第 ${lineNum} 行\n\n可能的原因:\n• 缺少引号\n• 多余的逗号\n• 括号不匹配\n• 非法字符`;
        }

        return `${message}\n\n常见错误:\n• 字符串未使用双引号\n• 对象或数组末尾有多余逗号\n• 括号或花括号不匹配`;
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
        const indent = '  '.repeat(level);
        let html = '';

        if (key !== null) {
            html += `<span class="json-key">"${key}"</span>: `;
        }

        if (obj === null) {
            html += `<span class="json-null">null</span>`;
        } else if (typeof obj === 'boolean') {
            html += `<span class="json-boolean">${obj}</span>`;
        } else if (typeof obj === 'number') {
            html += `<span class="json-number">${obj}</span>`;
        } else if (typeof obj === 'string') {
            html += `<span class="json-string">"${this.escapeHtml(obj)}"</span>`;
        } else if (Array.isArray(obj)) {
            html += `<span class="json-bracket">[</span>\n`;
            obj.forEach((item, index) => {
                html += indent + '  ';
                html += this.renderJSONTree(item, level + 1);
                if (index < obj.length - 1) html += ',';
                html += '\n';
            });
            html += indent + `<span class="json-bracket">]</span>`;
        } else if (typeof obj === 'object') {
            html += `<span class="json-bracket">{</span>\n`;
            const keys = Object.keys(obj);
            keys.forEach((k, index) => {
                html += indent + '  ';
                html += this.renderJSONTree(obj[k], level + 1, k);
                if (index < keys.length - 1) html += ',';
                html += '\n';
            });
            html += indent + `<span class="json-bracket">}</span>`;
        }

        return html;
    }

    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            this.showNotification('内容已清除', 'info');
            this.updateStatus('内容已清除');
        }
    }

    // 复制到剪贴板
    async copyToClipboard() {
        const editor = document.getElementById('jsonEditor');
        const content = editor.value;

        if (!content) {
            this.showNotification('没有内容可复制', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(content);
            this.showNotification('已复制到剪贴板', 'success');
        } catch (error) {
            // 降级方案
            editor.select();
            document.execCommand('copy');
            this.showNotification('已复制到剪贴板', 'success');
        }
    }

    // 导入文件
    importFile() {
        document.getElementById('fileInput').click();
    }

    // 处理文件上传
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            document.getElementById('jsonEditor').value = content;
            this.updateEditorInfo();
            this.realTimeValidation(content);
            this.showNotification(`已导入文件: ${file.name}`, 'success');
            this.updateStatus(`已导入文件: ${file.name}`);
        };

        reader.onerror = () => {
            this.showNotification('文件读取失败', 'error');
        };

        reader.readAsText(file);
    }

    // 导出文件
    exportFile() {
        const content = document.getElementById('jsonEditor').value;

        if (!content) {
            this.showNotification('没有内容可导出', 'warning');
            return;
        }

        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = `json-tool-export-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('文件已导出', 'success');
    }

    // 展开所有节点
    expandAll() {
        // 这里可以实现展开JSON树的逻辑
        this.showNotification('已展开所有节点', 'info');
    }

    // 折叠所有节点
    collapseAll() {
        // 这里可以实现折叠JSON树的逻辑
        this.showNotification('已折叠所有节点', 'info');
    }

    // 切换树形视图
    toggleTreeView() {
        // 这里可以实现树形视图切换的逻辑
        this.showNotification('树形视图已切换', 'info');
    }

    // JSON对比功能
    compareJSON() {
        const leftJson = document.getElementById('leftJson').value.trim();
        const rightJson = document.getElementById('rightJson').value.trim();

        if (!leftJson || !rightJson) {
            this.showNotification('请输入两个JSON进行对比', 'warning');
            return;
        }

        try {
            const leftObj = JSON.parse(leftJson);
            const rightObj = JSON.parse(rightJson);

            // 格式化JSON字符串以便行级对比
            const leftFormatted = JSON.stringify(leftObj, null, 2);
            const rightFormatted = JSON.stringify(rightObj, null, 2);

            const diff = this.calculateLineDiff(leftFormatted, rightFormatted);
            this.displayLineDiff(diff, leftFormatted, rightFormatted);
            this.highlightInputAreas(leftFormatted, rightFormatted, diff);
            this.showNotification('对比完成', 'success');

        } catch (error) {
            this.showNotification('JSON格式错误，无法对比', 'error');
        }
    }

    // 计算行级差异
    calculateLineDiff(left, right) {
        const leftLines = left.split('\n');
        const rightLines = right.split('\n');
        const diff = {
            leftDiff: [],
            rightDiff: [],
            stats: { added: 0, removed: 0, modified: 0, same: 0 }
        };

        // 使用LCS算法计算最长公共子序列
        const lcs = this.computeLCS(leftLines, rightLines);

        let leftIndex = 0;
        let rightIndex = 0;
        let lcsIndex = 0;

        while (leftIndex < leftLines.length || rightIndex < rightLines.length) {
            if (lcsIndex < lcs.length &&
                leftIndex < leftLines.length &&
                rightIndex < rightLines.length &&
                leftLines[leftIndex] === lcs[lcsIndex] &&
                rightLines[rightIndex] === lcs[lcsIndex]) {

                // 相同的行
                diff.leftDiff.push({ type: 'same', line: leftLines[leftIndex], lineNumber: leftIndex + 1 });
                diff.rightDiff.push({ type: 'same', line: rightLines[rightIndex], lineNumber: rightIndex + 1 });
                diff.stats.same++;

                leftIndex++;
                rightIndex++;
                lcsIndex++;
            } else if (leftIndex < leftLines.length &&
                      (lcsIndex >= lcs.length || leftLines[leftIndex] !== lcs[lcsIndex])) {

                // 左侧删除的行
                diff.leftDiff.push({ type: 'removed', line: leftLines[leftIndex], lineNumber: leftIndex + 1 });
                diff.stats.removed++;
                leftIndex++;
            } else if (rightIndex < rightLines.length) {

                // 右侧新增的行
                diff.rightDiff.push({ type: 'added', line: rightLines[rightIndex], lineNumber: rightIndex + 1 });
                diff.stats.added++;
                rightIndex++;
            }
        }

        return diff;
    }

    // 计算最长公共子序列
    computeLCS(arr1, arr2) {
        const m = arr1.length;
        const n = arr2.length;
        const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

        // 填充DP表
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (arr1[i - 1] === arr2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        // 回溯构建LCS
        const lcs = [];
        let i = m, j = n;
        while (i > 0 && j > 0) {
            if (arr1[i - 1] === arr2[j - 1]) {
                lcs.unshift(arr1[i - 1]);
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }

        return lcs;
    }

    // 显示行级差异结果
    displayLineDiff(diff, leftFormatted, rightFormatted) {
        const diffResult = document.getElementById('diffResult');
        const diffContent = document.getElementById('diffContent');
        const diffStats = document.getElementById('diffStats');

        // 更新统计信息
        document.getElementById('sameCount').textContent = diff.stats.same;
        document.getElementById('addedCount').textContent = diff.stats.added;
        document.getElementById('removedCount').textContent = diff.stats.removed;
        document.getElementById('modifiedCount').textContent = diff.stats.modified;

        // 生成并排差异视图
        const leftHtml = this.generateDiffHTML(diff.leftDiff, 'left');
        const rightHtml = this.generateDiffHTML(diff.rightDiff, 'right');

        const html = `
            <div class="diff-view-container">
                <div class="diff-column">
                    <div class="diff-column-header">原始JSON (左侧)</div>
                    <div class="diff-line-numbers-container">
                        <div class="diff-line-numbers">${diff.leftDiff.map((item, index) =>
                            `<div class="line-number ${item.type}">${item.lineNumber || ''}</div>`
                        ).join('')}</div>
                        <div class="diff-content">${leftHtml}</div>
                    </div>
                </div>
                <div class="diff-column">
                    <div class="diff-column-header">对比JSON (右侧)</div>
                    <div class="diff-line-numbers-container">
                        <div class="diff-line-numbers">${diff.rightDiff.map((item, index) =>
                            `<div class="line-number ${item.type}">${item.lineNumber || ''}</div>`
                        ).join('')}</div>
                        <div class="diff-content">${rightHtml}</div>
                    </div>
                </div>
            </div>
        `;

        diffContent.innerHTML = html;
        diffStats.style.display = 'block';
        diffResult.style.display = 'block';
    }

    // 生成差异HTML
    generateDiffHTML(diffLines, side) {
        return diffLines.map(item => {
            const escapedLine = this.escapeHtml(item.line);
            const prefix = item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' ';
            return `<div class="diff-line ${item.type}">${prefix} ${escapedLine}</div>`;
        }).join('');
    }

    // 高亮输入区域
    highlightInputAreas(leftFormatted, rightFormatted, diff) {
        // 创建高亮层
        this.createHighlightLayer('leftJson', diff.leftDiff, leftFormatted);
        this.createHighlightLayer('rightJson', diff.rightDiff, rightFormatted);
    }

    // 创建高亮层
    createHighlightLayer(textareaId, diffLines, formattedText) {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;

        const container = textarea.parentElement;

        // 移除已存在的高亮层
        const existingHighlight = container.querySelector('.highlight-layer');
        if (existingHighlight) {
            existingHighlight.remove();
        }

        // 检查是否有差异需要高亮
        const hasDifferences = diffLines.some(line => line.type !== 'same');
        if (!hasDifferences) {
            // 如果没有差异，恢复textarea的正常样式
            textarea.style.background = 'var(--bg-primary)';
            return;
        }

        // 创建新的高亮层
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
        `;

        // 生成高亮内容
        let highlightHTML = '';

        diffLines.forEach((diffLine, index) => {
            const lineContent = this.escapeHtml(diffLine.line || '');
            let className = '';

            switch (diffLine.type) {
                case 'added':
                    className = 'highlight-added';
                    break;
                case 'removed':
                    className = 'highlight-removed';
                    break;
                case 'modified':
                    className = 'highlight-modified';
                    break;
                default:
                    className = 'highlight-same';
            }

            highlightHTML += `<div class="${className}">${lineContent}</div>`;
        });

        highlightLayer.innerHTML = highlightHTML;

        // 确保容器有相对定位
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        container.appendChild(highlightLayer);

        // 将textarea置于高亮层之上，但设置背景透明
        textarea.style.position = 'relative';
        textarea.style.zIndex = '2';
        textarea.style.background = 'transparent';
        textarea.style.color = 'var(--text-primary)';

        // 移除之前的滚动监听器以避免重复绑定
        if (textarea._scrollHandler) {
            textarea.removeEventListener('scroll', textarea._scrollHandler);
        }

        // 创建新的滚动处理器并保存引用
        textarea._scrollHandler = () => {
            if (highlightLayer.parentElement) {
                highlightLayer.scrollTop = textarea.scrollTop;
                highlightLayer.scrollLeft = textarea.scrollLeft;
            }
        };

        // 同步滚动
        textarea.addEventListener('scroll', textarea._scrollHandler);
    }

    // 交换对比输入
    swapCompareInputs() {
        const leftJson = document.getElementById('leftJson');
        const rightJson = document.getElementById('rightJson');

        const temp = leftJson.value;
        leftJson.value = rightJson.value;
        rightJson.value = temp;

        this.showNotification('已交换左右JSON', 'info');
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
        this.showNotification(`已选择${this.getTemplateName(templateName)}模板`, 'info');
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
            this.showNotification('请先选择一个模板', 'warning');
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

        this.showNotification(`已生成${count}条${this.getTemplateName(this.currentTemplate)}数据`, 'success');
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
            description: `高质量的${randomProduct}，性能优异，值得拥有。`,
            images: [
                `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
                `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`
            ],
            specifications: {
                brand: 'Apple',
                model: randomProduct,
                warranty: '1年'
            }
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
            shippingAddress: this.generateAddressData(locale),
            paymentMethod: 'credit_card'
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
            website: `https://www.${randomCompany.toLowerCase().replace(/\s+/g, '')}.com`,
            revenue: Math.floor(Math.random() * 1000000000) + 1000000
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
            commentCount: Math.floor(Math.random() * 100),
            category: '技术文章'
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
            },
            features: {
                authentication: true,
                logging: true,
                monitoring: true
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

    // 复制生成的数据
    async copyGeneratedData() {
        const generatedJson = document.getElementById('generatedJson').value;
        if (!generatedJson) {
            this.showNotification('没有生成的数据可复制', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(generatedJson);
            this.showNotification('已复制生成的数据到剪贴板', 'success');
        } catch (error) {
            // 降级方案
            const textarea = document.getElementById('generatedJson');
            textarea.select();
            document.execCommand('copy');
            this.showNotification('已复制生成的数据到剪贴板', 'success');
        }
    }

    // 使用生成的数据
    useGeneratedData() {
        const generatedJson = document.getElementById('generatedJson').value;
        if (!generatedJson) {
            this.showNotification('没有生成的数据可使用', 'warning');
            return;
        }

        document.getElementById('jsonEditor').value = generatedJson;
        this.switchTab('formatter');
        this.updateEditorInfo();
        this.realTimeValidation(generatedJson);
        this.showNotification('已将生成的数据导入到编辑器', 'success');
    }

    // 数据转换功能
    convertData() {
        const inputFormat = document.getElementById('inputFormat').value;
        const outputFormat = document.getElementById('outputFormat').value;
        const inputData = document.getElementById('inputData').value.trim();

        if (!inputData) {
            this.showNotification('请输入要转换的数据', 'warning');
            return;
        }

        try {
            let data;

            // 解析输入数据
            switch (inputFormat) {
                case 'json':
                    data = JSON.parse(inputData);
                    break;
                case 'xml':
                    data = this.parseXML(inputData);
                    break;
                case 'yaml':
                    data = this.parseYAML(inputData);
                    break;
                case 'csv':
                    data = this.parseCSV(inputData);
                    break;
                case 'url':
                    data = this.parseURLParams(inputData);
                    break;
                default:
                    throw new Error('不支持的输入格式');
            }

            // 转换为目标格式
            let result;
            const prettyOutput = document.getElementById('prettyOutput').checked;

            switch (outputFormat) {
                case 'json':
                    result = prettyOutput ? JSON.stringify(data, null, 2) : JSON.stringify(data);
                    break;
                case 'xml':
                    result = this.toXML(data);
                    break;
                case 'yaml':
                    result = this.toYAML(data);
                    break;
                case 'csv':
                    result = this.toCSV(data);
                    break;
                case 'url':
                    result = this.toURLParams(data);
                    break;
                default:
                    throw new Error('不支持的输出格式');
            }

            document.getElementById('outputData').value = result;
            this.showNotification(`已转换为${this.getFormatName(outputFormat)}格式`, 'success');

        } catch (error) {
            this.showNotification(`转换失败: ${error.message}`, 'error');
        }
    }

    // 格式解析器
    parseXML(xmlString) {
        // 简化的XML解析器
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        return this.xmlToObject(xmlDoc.documentElement);
    }

    xmlToObject(node) {
        const obj = {};

        if (node.attributes) {
            for (let attr of node.attributes) {
                obj[`@${attr.name}`] = attr.value;
            }
        }

        if (node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }

        for (let child of node.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                if (obj[child.nodeName]) {
                    if (!Array.isArray(obj[child.nodeName])) {
                        obj[child.nodeName] = [obj[child.nodeName]];
                    }
                    obj[child.nodeName].push(this.xmlToObject(child));
                } else {
                    obj[child.nodeName] = this.xmlToObject(child);
                }
            }
        }

        return obj;
    }

    parseYAML(yamlString) {
        // 简化的YAML解析器
        const lines = yamlString.split('\n');
        const result = {};
        let currentObj = result;
        const stack = [result];

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;

            const [key, ...valueParts] = line.split(':');
            const value = valueParts.join(':').trim();

            if (value) {
                // 尝试解析值的类型
                if (value === 'true' || value === 'false') {
                    currentObj[key.trim()] = value === 'true';
                } else if (!isNaN(value)) {
                    currentObj[key.trim()] = Number(value);
                } else {
                    currentObj[key.trim()] = value.replace(/^["']|["']$/g, '');
                }
            }
        }

        return result;
    }

    parseCSV(csvString) {
        const lines = csvString.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(',').map(v => v.trim());
            const obj = {};

            headers.forEach((header, index) => {
                let value = values[index] || '';

                // 尝试解析值的类型
                if (!isNaN(value) && value !== '') {
                    value = Number(value);
                } else if (value === 'true' || value === 'false') {
                    value = value === 'true';
                }

                obj[header] = value;
            });

            result.push(obj);
        }

        return result;
    }

    parseURLParams(urlString) {
        const params = {};
        const urlParams = new URLSearchParams(urlString.includes('?') ? urlString.split('?')[1] : urlString);

        for (let [key, value] of urlParams) {
            params[key] = value;
        }

        return params;
    }

    // 格式转换器
    toXML(obj, rootName = 'root') {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>`;

        const objectToXML = (obj, indent = 1) => {
            let result = '';
            const indentStr = '  '.repeat(indent);

            for (let key in obj) {
                const value = obj[key];

                if (Array.isArray(value)) {
                    for (let item of value) {
                        result += `\n${indentStr}<${key}>`;
                        if (typeof item === 'object') {
                            result += objectToXML(item, indent + 1);
                            result += `\n${indentStr}`;
                        } else {
                            result += this.escapeXML(item);
                        }
                        result += `</${key}>`;
                    }
                } else if (typeof value === 'object' && value !== null) {
                    result += `\n${indentStr}<${key}>`;
                    result += objectToXML(value, indent + 1);
                    result += `\n${indentStr}</${key}>`;
                } else {
                    result += `\n${indentStr}<${key}>${this.escapeXML(value)}</${key}>`;
                }
            }

            return result;
        };

        xml += objectToXML(obj);
        xml += `\n</${rootName}>`;

        return xml;
    }

    escapeXML(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    toYAML(obj, indent = 0) {
        const indentStr = '  '.repeat(indent);
        let yaml = '';

        for (let key in obj) {
            const value = obj[key];
            yaml += `${indentStr}${key}:`;

            if (Array.isArray(value)) {
                yaml += '\n';
                for (let item of value) {
                    yaml += `${indentStr}- `;
                    if (typeof item === 'object') {
                        yaml += '\n' + this.toYAML(item, indent + 1);
                    } else {
                        yaml += `${item}\n`;
                    }
                }
            } else if (typeof value === 'object' && value !== null) {
                yaml += '\n' + this.toYAML(value, indent + 1);
            } else {
                yaml += ` ${value}\n`;
            }
        }

        return yaml;
    }

    toCSV(data) {
        if (!Array.isArray(data)) {
            data = [data];
        }

        if (data.length === 0) return '';

        // 获取所有可能的键
        const allKeys = new Set();
        data.forEach(obj => {
            Object.keys(obj).forEach(key => allKeys.add(key));
        });

        const headers = Array.from(allKeys);
        let csv = headers.join(',') + '\n';

        data.forEach(obj => {
            const row = headers.map(header => {
                const value = obj[header] || '';
                // 如果值包含逗号或引号，需要用引号包围
                if (String(value).includes(',') || String(value).includes('"')) {
                    return `"${String(value).replace(/"/g, '""')}"`;
                }
                return value;
            });
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    toURLParams(obj) {
        const params = new URLSearchParams();

        const addParam = (key, value) => {
            if (Array.isArray(value)) {
                value.forEach(v => addParam(key, v));
            } else if (typeof value === 'object' && value !== null) {
                // 将对象展平
                for (let subKey in value) {
                    addParam(`${key}[${subKey}]`, value[subKey]);
                }
            } else {
                params.append(key, String(value));
            }
        };

        for (let key in obj) {
            addParam(key, obj[key]);
        }

        return params.toString();
    }

    getFormatName(format) {
        const names = {
            json: 'JSON',
            xml: 'XML',
            yaml: 'YAML',
            csv: 'CSV',
            url: 'URL参数'
        };
        return names[format] || format;
    }

    // JSON详细验证
    validateJSONDetailed() {
        const input = document.getElementById('validateInput').value.trim();
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const validationDetails = document.getElementById('validationDetails');

        if (!input) {
            statusIndicator.textContent = '⚪';
            statusText.textContent = '等待验证';
            validationDetails.innerHTML = '';
            return;
        }

        try {
            const parsed = JSON.parse(input);
            this.jsonData = parsed;
            this.isValidJson = true;

            statusIndicator.textContent = '✅';
            statusText.textContent = '验证通过';
            statusText.style.color = 'var(--success-color)';

            // 显示详细信息
            const details = this.getJSONDetails(parsed, input);
            validationDetails.innerHTML = this.formatValidationDetails(details);

            this.showNotification('JSON验证通过', 'success');

        } catch (error) {
            this.isValidJson = false;

            statusIndicator.textContent = '❌';
            statusText.textContent = '验证失败';
            statusText.style.color = 'var(--error-color)';

            validationDetails.innerHTML = `<div style="color: var(--error-color);">${this.formatJSONError(error, input)}</div>`;

            this.showNotification('JSON验证失败', 'error');
        }
    }

    // 获取JSON详细信息
    getJSONDetails(obj, jsonString) {
        const details = {
            type: Array.isArray(obj) ? 'Array' : 'Object',
            size: jsonString.length,
            lines: jsonString.split('\n').length,
            depth: this.getMaxDepth(obj),
            keys: this.countKeys(obj),
            values: this.countValues(obj),
            dataTypes: this.analyzeDataTypes(obj)
        };

        return details;
    }

    // 计算最大深度
    getMaxDepth(obj, currentDepth = 0) {
        if (typeof obj !== 'object' || obj === null) {
            return currentDepth;
        }

        let maxDepth = currentDepth;

        for (let key in obj) {
            const depth = this.getMaxDepth(obj[key], currentDepth + 1);
            if (depth > maxDepth) {
                maxDepth = depth;
            }
        }

        return maxDepth;
    }

    // 计算键的数量
    countKeys(obj) {
        let count = 0;

        const traverse = (obj) => {
            if (typeof obj === 'object' && obj !== null) {
                if (Array.isArray(obj)) {
                    obj.forEach(item => traverse(item));
                } else {
                    count += Object.keys(obj).length;
                    Object.values(obj).forEach(value => traverse(value));
                }
            }
        };

        traverse(obj);
        return count;
    }

    // 计算值的数量
    countValues(obj) {
        let count = 0;

        const traverse = (obj) => {
            if (typeof obj === 'object' && obj !== null) {
                if (Array.isArray(obj)) {
                    obj.forEach(item => traverse(item));
                } else {
                    Object.values(obj).forEach(value => traverse(value));
                }
            } else {
                count++;
            }
        };

        traverse(obj);
        return count;
    }

    // 分析数据类型
    analyzeDataTypes(obj) {
        const types = {
            string: 0,
            number: 0,
            boolean: 0,
            null: 0,
            object: 0,
            array: 0
        };

        const traverse = (obj) => {
            if (obj === null) {
                types.null++;
            } else if (Array.isArray(obj)) {
                types.array++;
                obj.forEach(item => traverse(item));
            } else if (typeof obj === 'object') {
                types.object++;
                Object.values(obj).forEach(value => traverse(value));
            } else {
                types[typeof obj]++;
            }
        };

        traverse(obj);
        return types;
    }

    // 格式化验证详情
    formatValidationDetails(details) {
        return `
            <div class="validation-item">
                <strong>数据类型:</strong> ${details.type}
            </div>
            <div class="validation-item">
                <strong>文件大小:</strong> ${this.formatBytes(details.size)}
            </div>
            <div class="validation-item">
                <strong>行数:</strong> ${details.lines}
            </div>
            <div class="validation-item">
                <strong>最大深度:</strong> ${details.depth}
            </div>
            <div class="validation-item">
                <strong>键数量:</strong> ${details.keys}
            </div>
            <div class="validation-item">
                <strong>值数量:</strong> ${details.values}
            </div>
            <div class="validation-item">
                <strong>数据类型分布:</strong>
                <ul style="margin-left: 20px; margin-top: 5px;">
                    <li>字符串: ${details.dataTypes.string}</li>
                    <li>数字: ${details.dataTypes.number}</li>
                    <li>布尔值: ${details.dataTypes.boolean}</li>
                    <li>空值: ${details.dataTypes.null}</li>
                    <li>对象: ${details.dataTypes.object}</li>
                    <li>数组: ${details.dataTypes.array}</li>
                </ul>
            </div>
        `;
    }

    // JSONPath查询
    queryJSONPath() {
        const pathInput = document.getElementById('jsonPath');
        const pathResult = document.getElementById('pathResult');
        const path = pathInput.value.trim();

        if (!this.isValidJson || !this.jsonData) {
            this.showNotification('请先验证JSON数据', 'warning');
            return;
        }

        if (!path) {
            this.showNotification('请输入JSONPath表达式', 'warning');
            return;
        }

        try {
            const result = this.evaluateJSONPath(this.jsonData, path);
            pathResult.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
            this.showNotification('查询成功', 'success');
        } catch (error) {
            pathResult.innerHTML = `<div style="color: var(--error-color);">查询失败: ${error.message}</div>`;
            this.showNotification('JSONPath查询失败', 'error');
        }
    }

    // 简化的JSONPath评估器
    evaluateJSONPath(data, path) {
        // 移除开头的$
        if (path.startsWith('$.')) {
            path = path.substring(2);
        } else if (path === '$') {
            return data;
        }

        const parts = path.split('.');
        let current = data;

        for (let part of parts) {
            if (!part) continue;

            // 处理数组索引
            if (part.includes('[') && part.includes(']')) {
                const [key, indexPart] = part.split('[');
                const index = parseInt(indexPart.replace(']', ''));

                if (key) {
                    current = current[key];
                }

                if (Array.isArray(current) && index >= 0 && index < current.length) {
                    current = current[index];
                } else {
                    throw new Error(`数组索引 ${index} 超出范围`);
                }
            } else {
                if (current && typeof current === 'object' && part in current) {
                    current = current[part];
                } else {
                    throw new Error(`属性 '${part}' 不存在`);
                }
            }
        }

        return current;
    }

    // JSON分析器
    analyzeJSON() {
        const input = document.getElementById('analyzeInput').value.trim();

        if (!input) {
            this.showNotification('请输入需要分析的JSON数据', 'warning');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            this.performAnalysis(parsed, input);
            this.showNotification('分析完成', 'success');
        } catch (error) {
            this.showNotification('JSON格式错误，无法分析', 'error');
        }
    }

    // 执行分析
    performAnalysis(data, jsonString) {
        // 结构分析
        this.performStructureAnalysis(data, jsonString);

        // 统计分析
        this.performStatisticsAnalysis(data);

        // 树形结构分析
        this.performTreeAnalysis(data);

        // 性能分析
        this.performPerformanceAnalysis(jsonString);
    }

    // 结构分析
    performStructureAnalysis(data, jsonString) {
        const metrics = document.getElementById('structureMetrics');
        const details = this.getJSONDetails(data, jsonString);

        metrics.innerHTML = `
            <div class="metric-grid">
                <div class="metric-item">
                    <div class="metric-label">数据类型</div>
                    <div class="metric-value">${details.type}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">最大深度</div>
                    <div class="metric-value">${details.depth}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">键数量</div>
                    <div class="metric-value">${details.keys}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">值数量</div>
                    <div class="metric-value">${details.values}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">文件大小</div>
                    <div class="metric-value">${this.formatBytes(details.size)}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">行数</div>
                    <div class="metric-value">${details.lines}</div>
                </div>
            </div>

            <div class="data-types-chart">
                <h4>数据类型分布</h4>
                <div class="type-bars">
                    ${Object.entries(details.dataTypes).map(([type, count]) => {
                        const percentage = Math.round((count / details.values) * 100);
                        return `
                            <div class="type-bar">
                                <div class="type-label">${this.getTypeLabel(type)}</div>
                                <div class="type-progress">
                                    <div class="type-fill" style="width: ${percentage}%"></div>
                                </div>
                                <div class="type-count">${count} (${percentage}%)</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    getTypeLabel(type) {
        const labels = {
            string: '字符串',
            number: '数字',
            boolean: '布尔值',
            null: '空值',
            object: '对象',
            array: '数组'
        };
        return labels[type] || type;
    }

    // 统计分析
    performStatisticsAnalysis(data) {
        const charts = document.getElementById('statisticsCharts');
        const stats = this.calculateStatistics(data);

        charts.innerHTML = `
            <div class="stats-overview">
                <h4>统计概览</h4>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-title">字符串长度</div>
                        <div class="stat-values">
                            <div>平均: ${stats.stringLength.avg}</div>
                            <div>最长: ${stats.stringLength.max}</div>
                            <div>最短: ${stats.stringLength.min}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">数值范围</div>
                        <div class="stat-values">
                            <div>平均: ${stats.numbers.avg}</div>
                            <div>最大: ${stats.numbers.max}</div>
                            <div>最小: ${stats.numbers.min}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">数组大小</div>
                        <div class="stat-values">
                            <div>平均: ${stats.arraySize.avg}</div>
                            <div>最大: ${stats.arraySize.max}</div>
                            <div>最小: ${stats.arraySize.min}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">对象属性</div>
                        <div class="stat-values">
                            <div>平均: ${stats.objectKeys.avg}</div>
                            <div>最多: ${stats.objectKeys.max}</div>
                            <div>最少: ${stats.objectKeys.min}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 计算统计信息
    calculateStatistics(data) {
        const stats = {
            stringLength: { values: [], avg: 0, max: 0, min: 0 },
            numbers: { values: [], avg: 0, max: 0, min: 0 },
            arraySize: { values: [], avg: 0, max: 0, min: 0 },
            objectKeys: { values: [], avg: 0, max: 0, min: 0 }
        };

        const traverse = (obj) => {
            if (typeof obj === 'string') {
                stats.stringLength.values.push(obj.length);
            } else if (typeof obj === 'number') {
                stats.numbers.values.push(obj);
            } else if (Array.isArray(obj)) {
                stats.arraySize.values.push(obj.length);
                obj.forEach(item => traverse(item));
            } else if (typeof obj === 'object' && obj !== null) {
                const keys = Object.keys(obj);
                stats.objectKeys.values.push(keys.length);
                keys.forEach(key => traverse(obj[key]));
            }
        };

        traverse(data);

        // 计算平均值、最大值、最小值
        Object.keys(stats).forEach(key => {
            const values = stats[key].values;
            if (values.length > 0) {
                stats[key].avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100;
                stats[key].max = Math.max(...values);
                stats[key].min = Math.min(...values);
            }
        });

        return stats;
    }

    // 树形结构分析
    performTreeAnalysis(data) {
        const treeViewer = document.getElementById('treeViewer');
        treeViewer.innerHTML = this.generateTreeHTML(data);
    }

    // 生成树形HTML
    generateTreeHTML(obj, level = 0, key = null) {
        const indent = 20 * level;
        let html = '';

        if (key !== null) {
            html += `<div class="tree-node" style="margin-left: ${indent}px;">`;
            html += `<span class="tree-key">${key}:</span> `;
        } else {
            html += `<div class="tree-node" style="margin-left: ${indent}px;">`;
        }

        if (obj === null) {
            html += `<span class="tree-null">null</span>`;
        } else if (typeof obj === 'boolean') {
            html += `<span class="tree-boolean">${obj}</span>`;
        } else if (typeof obj === 'number') {
            html += `<span class="tree-number">${obj}</span>`;
        } else if (typeof obj === 'string') {
            html += `<span class="tree-string">"${this.escapeHtml(obj)}"</span>`;
        } else if (Array.isArray(obj)) {
            html += `<span class="tree-bracket">[</span> <span class="tree-type">(${obj.length} items)</span>`;
            html += '</div>';
            obj.forEach((item, index) => {
                html += this.generateTreeHTML(item, level + 1, `[${index}]`);
            });
            html += `<div class="tree-node" style="margin-left: ${indent}px;"><span class="tree-bracket">]</span></div>`;
            return html;
        } else if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            html += `<span class="tree-bracket">{</span> <span class="tree-type">(${keys.length} properties)</span>`;
            html += '</div>';
            keys.forEach(k => {
                html += this.generateTreeHTML(obj[k], level + 1, k);
            });
            html += `<div class="tree-node" style="margin-left: ${indent}px;"><span class="tree-bracket">}</span></div>`;
            return html;
        }

        html += '</div>';
        return html;
    }

    // 性能分析
    performPerformanceAnalysis(jsonString) {
        const metrics = document.getElementById('performanceMetrics');

        // 测量解析时间
        const startTime = performance.now();
        try {
            JSON.parse(jsonString);
            const parseTime = performance.now() - startTime;

            // 估算内存使用
            const memoryEstimate = this.estimateMemoryUsage(jsonString);

            metrics.innerHTML = `
                <div class="performance-grid">
                    <div class="perf-metric">
                        <div class="perf-label">解析时间</div>
                        <div class="perf-value">${parseTime.toFixed(2)} ms</div>
                    </div>
                    <div class="perf-metric">
                        <div class="perf-label">文件大小</div>
                        <div class="perf-value">${this.formatBytes(jsonString.length)}</div>
                    </div>
                    <div class="perf-metric">
                        <div class="perf-label">内存估算</div>
                        <div class="perf-value">${this.formatBytes(memoryEstimate)}</div>
                    </div>
                    <div class="perf-metric">
                        <div class="perf-label">压缩比</div>
                        <div class="perf-value">${this.calculateCompressionRatio(jsonString)}%</div>
                    </div>
                </div>

                <div class="performance-recommendations">
                    <h4>性能建议</h4>
                    <ul>
                        ${this.generatePerformanceRecommendations(jsonString, parseTime)}
                    </ul>
                </div>
            `;

        } catch (error) {
            metrics.innerHTML = '<div style="color: var(--error-color);">性能分析失败：JSON格式错误</div>';
        }
    }

    // 估算内存使用
    estimateMemoryUsage(jsonString) {
        // 简化的内存估算：字符串长度 * 2（UTF-16编码）+ 对象开销
        const stringMemory = jsonString.length * 2;
        const objectOverhead = (jsonString.match(/[{}\[\]]/g) || []).length * 50; // 估算对象开销
        return stringMemory + objectOverhead;
    }

    // 计算压缩比
    calculateCompressionRatio(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            const compressed = JSON.stringify(parsed);
            const ratio = ((jsonString.length - compressed.length) / jsonString.length) * 100;
            return Math.max(0, Math.round(ratio));
        } catch (error) {
            return 0;
        }
    }

    // 生成性能建议
    generatePerformanceRecommendations(jsonString, parseTime) {
        const recommendations = [];

        if (parseTime > 100) {
            recommendations.push('<li>解析时间较长，考虑分段处理或使用流式解析</li>');
        }

        if (jsonString.length > 1000000) {
            recommendations.push('<li>文件过大，建议分页加载或压缩传输</li>');
        }

        const compressionRatio = this.calculateCompressionRatio(jsonString);
        if (compressionRatio > 30) {
            recommendations.push('<li>检测到大量冗余空白字符，建议压缩后传输</li>');
        }

        if ((jsonString.match(/null/g) || []).length > 10) {
            recommendations.push('<li>检测到大量null值，考虑使用可选字段减少数据量</li>');
        }

        if (recommendations.length === 0) {
            recommendations.push('<li>JSON结构良好，性能表现优秀</li>');
        }

        return recommendations.join('');
    }

    // 切换分析标签
    switchAnalysisTab(tabName) {
        // 更新标签状态
        document.querySelectorAll('.analysis-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-analysis="${tabName}"]`).classList.add('active');

        // 切换面板
        document.querySelectorAll('.analysis-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${tabName}-analysis`).classList.add('active');
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
            this.undo();
        }

        // Ctrl/Cmd + Shift + Z: 重做
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'Z'))) {
            event.preventDefault();
            this.redo();
        }
    }

    // 历史记录管理
    addToHistory(content) {
        // 移除当前位置之后的历史记录
        this.history = this.history.slice(0, this.historyIndex + 1);

        // 添加新的历史记录
        this.history.push({
            content: content,
            timestamp: new Date().toISOString()
        });

        // 限制历史记录数量
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
            this.showNotification('已撤销', 'info');
        } else {
            this.showNotification('没有可撤销的操作', 'warning');
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
            this.showNotification('已重做', 'info');
        } else {
            this.showNotification('没有可重做的操作', 'warning');
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

        // 添加历史记录点击事件
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
            this.showNotification('已加载历史记录', 'success');
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
                    <button class="action-btn secondary" id="exportSettings">导出设置</button>
                    <button class="action-btn secondary" id="importSettings">导入设置</button>
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
                this.showNotification('历史记录已清除', 'success');
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
                        <kbd>Ctrl/Cmd + Shift + V</kbd>
                        <span>验证JSON</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + S</kbd>
                        <span>导出文件</span>
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
                    <div class="feature-item">
                        <strong>转换器:</strong> 在JSON、XML、YAML、CSV等格式间转换
                    </div>
                    <div class="feature-item">
                        <strong>验证器:</strong> 验证JSON格式并提供详细错误信息
                    </div>
                    <div class="feature-item">
                        <strong>分析器:</strong> 分析JSON结构、统计信息和性能指标
                    </div>
                </div>

                <h4>版本信息</h4>
                <div class="version-info">
                    <div>版本: 1.0.0</div>
                    <div>更新时间: 2024-01-01</div>
                    <div>作者: JSON工具开发团队</div>
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

        // 自动移除通知
        setTimeout(() => {
            notification.remove();
        }, 5000);

        // 点击移除通知
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
            theme: this.theme
        };
        localStorage.setItem('json-tool-data', JSON.stringify(data));
    }

    // 从本地存储加载
    loadFromLocalStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('json-tool-data') || '{}');
            this.history = data.history || [];
            this.historyIndex = data.historyIndex || -1;
            this.theme = data.theme || 'light';
        } catch (error) {
            console.warn('Failed to load data from localStorage:', error);
        }
    }
}

// 当页面加载完成时初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.jsonToolApp = new JSONToolApp();
});
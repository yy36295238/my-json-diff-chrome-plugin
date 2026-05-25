import { Utils } from '../utils.js';

export class CompareManager {
    constructor(app) {
        this.app = app;
        this.historyLeft = [];
        this.historyLeftIndex = -1;
        this.historyRight = [];
        this.historyRightIndex = -1;
        this._suppressHistory = false;
        this._compareDebounceTimer = null;
    }

    init() {
        document.getElementById('compareBtn').addEventListener('click', async () => {
            const btn = document.getElementById('compareBtn');
            try {
                btn.disabled = true;
                await Promise.resolve(this.compareJSON());
            } finally {
                btn.disabled = false;
            }
        });

        document.getElementById('smartCompareBtn').addEventListener('click', () => this.smartCompareJSON());

        const beautifyLeftBtn = document.getElementById('beautifyLeft');
        const beautifyRightBtn = document.getElementById('beautifyRight');
        const minifyLeftBtn = document.getElementById('minifyLeft');
        const minifyRightBtn = document.getElementById('minifyRight');

        if (beautifyLeftBtn) beautifyLeftBtn.addEventListener('click', () => this.beautifySide('left'));
        if (beautifyRightBtn) beautifyRightBtn.addEventListener('click', () => this.beautifySide('right'));
        if (minifyLeftBtn) minifyLeftBtn.addEventListener('click', () => this.minifySide('left'));
        if (minifyRightBtn) minifyRightBtn.addEventListener('click', () => this.minifySide('right'));

        const loadDemoBtn = document.getElementById('loadDemoBtn');
        if (loadDemoBtn) loadDemoBtn.addEventListener('click', () => this.loadDemoData());
        
        const loadDemoBtnRight = document.getElementById('loadDemoBtnRight');
        if (loadDemoBtnRight) loadDemoBtnRight.addEventListener('click', () => this.loadDemoData());

        // Sync Ignore Array Order checkboxes
        const ignoreLeft = document.getElementById('ignoreArrayOrder');
        const ignoreRight = document.getElementById('ignoreArrayOrderRight');
        if (ignoreLeft && ignoreRight) {
            ignoreLeft.addEventListener('change', () => ignoreRight.checked = ignoreLeft.checked);
            ignoreRight.addEventListener('change', () => ignoreLeft.checked = ignoreRight.checked);
        }

        this.initEditors();
    }

    initEditors() {
        const leftArea = document.getElementById('leftJson');
        const rightArea = document.getElementById('rightJson');
        if (!leftArea || !rightArea) return;

        const leftLines = document.getElementById('leftJsonLines');
        const rightLines = document.getElementById('rightJsonLines');

        leftArea.addEventListener('input', () => {
            this.recordHistory('left', leftArea.value);
            this.updateLineNumbers('left', leftArea, leftLines);
            // 清除对比高亮显示，因为数据已改变
            this.clearComparison();
        });

        rightArea.addEventListener('input', () => {
            this.recordHistory('right', rightArea.value);
            this.updateLineNumbers('right', rightArea, rightLines);
            // 清除对比高亮显示，因为数据已改变
            this.clearComparison();
        });

        leftArea.addEventListener('scroll', () => { if (leftLines) leftLines.scrollTop = leftArea.scrollTop; });
        rightArea.addEventListener('scroll', () => { if (rightLines) rightLines.scrollTop = rightArea.scrollTop; });

        // Initial line numbers
        this.updateLineNumbers('left', leftArea, leftLines);
        this.updateLineNumbers('right', rightArea, rightLines);
    }

    updateLineNumbers(side, textarea, gutter) {
        if (!textarea || !gutter) return;
        const count = textarea.value.split('\n').length || 1;
        let html = '';
        for (let i = 1; i <= count; i++) {
            html += `<div class="line-number">${i}</div>`;
        }
        gutter.innerHTML = html;
        gutter.scrollTop = textarea.scrollTop;
    }

    beautifySide(side) {
        try {
            const id = side === 'left' ? 'leftJson' : 'rightJson';
            const area = document.getElementById(id);
            const raw = area.value;
            if (!raw.trim()) return;
            const parsed = Utils.deepParseJSON(JSON.parse(raw));
            const pretty = JSON.stringify(parsed, null, 2);
            area.value = pretty;
            this.updateLineNumbers(side, area, document.getElementById(`${id}Lines`));
            // 清除对比高亮显示，因为数据已改变
            this.clearComparison();
            this.app.layout.updateStatus(`${side === 'left' ? '左侧' : '右侧'}已美化`);
        } catch (e) {
            this.app.layout.showError('美化失败', e.message);
        }
    }

    minifySide(side) {
        try {
            const id = side === 'left' ? 'leftJson' : 'rightJson';
            const area = document.getElementById(id);
            const raw = area.value;
            if (!raw.trim()) return;
            // Parse and deep parse to handle embedded JSON strings if any, then minify
            const parsed = Utils.deepParseJSON(JSON.parse(raw));
            const minified = JSON.stringify(parsed);
            area.value = minified;
            this.updateLineNumbers(side, area, document.getElementById(`${id}Lines`));
            // 清除对比高亮显示，因为数据已改变
            this.clearComparison();
            this.app.layout.updateStatus(`${side === 'left' ? '左侧' : '右侧'}已压缩`);
        } catch (e) {
            this.app.layout.showError('压缩失败', e.message);
        }
    }

    compareJSON(options = {}) {
        const { silent = false } = options;
        const leftText = document.getElementById('leftJson').value;
        const rightText = document.getElementById('rightJson').value;
        const ignoreOrder = document.getElementById('ignoreArrayOrder') ? document.getElementById('ignoreArrayOrder').checked : false;

        this.clearComparison();

        if (!leftText.trim() && !rightText.trim()) {
            this.clearLineNumbers();
            this.app.layout.updateStatus('对比完成：内容为空');
            return;
        }

        let leftObj = null, rightObj = null;
        let leftFormatted = '', rightFormatted = '';

        try {
            if (leftText.trim()) {
                try {
                    // Use deepParseJSON to handle complex formats (nested JSON strings)
                    leftObj = Utils.deepParseJSON(JSON.parse(leftText));
                    if (ignoreOrder) {
                        leftObj = Utils.sortDeep(leftObj);
                    }
                    leftFormatted = JSON.stringify(leftObj, null, 2);
                } catch (e) {
                    throw new Error(`左侧 JSON 错误: ${e.message}`);
                }
            }
            if (rightText.trim()) {
                try {
                    rightObj = Utils.deepParseJSON(JSON.parse(rightText));
                    if (ignoreOrder) {
                        rightObj = Utils.sortDeep(rightObj);
                    }
                    rightFormatted = JSON.stringify(rightObj, null, 2);
                } catch (e) {
                    throw new Error(`右侧 JSON 错误: ${e.message}`);
                }
            }

            document.getElementById('leftJson').value = leftFormatted;
            document.getElementById('rightJson').value = rightFormatted;
            this.updateAllLineNumbers();

            if (!leftFormatted && !rightFormatted) return;

            const diff = this.calculateStructuralDiff(leftObj, rightObj);
            this.updateDiffHighlights(diff, leftFormatted, rightFormatted, leftObj, rightObj);

            if (!silent) {
                this.showDiffSummary(diff);
                this.app.layout.updateStatus(diff.length ? `对比完成：发现 ${diff.length} 处差异` : '对比完成：未发现差异');
            }

        } catch (error) {
            if (!silent) {
                this.app.layout.showError('对比失败', error.message);
                this.app.layout.updateStatus('对比失败：JSON 格式错误');
            }
            this.clearComparison();
        }
    }

    async smartCompareJSON() {
        const leftText = document.getElementById('leftJson').value.trim();
        const rightText = document.getElementById('rightJson').value.trim();

        if (!leftText || !rightText) {
            this.app.layout.showError('对比失败', '左右两侧的 JSON 内容不能为空');
            return;
        }

        const apiKey = localStorage.getItem('zhipu_api_key');
        const zhipuModel = localStorage.getItem('zhipu_model') || 'glm-5.1';
        if (!apiKey) {
            this.app.layout.showError('未配置 API Key', '请点击右上角设置按钮配置智谱AI API Key');
            if (this.app.layout.openSettings) {
                this.app.layout.openSettings();
            }
            return;
        }

        const btn = document.getElementById('smartCompareBtn');
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128a104,104,0,0,1-20.8,61.95L192,170.82a88,88,0,0,0,0-85.64l19.2-19.13A104,104,0,0,1,232,128Z"></path></svg>`;
        this.app.layout.updateStatus('正在调用智谱AI进行智能对比...');

        try {
            // 截断过长文本以防止超出 Token 限制 (简单策略)
            const maxLen = 10000; 
            const l = leftText.length > maxLen ? leftText.substring(0, maxLen) + '...(truncated)' : leftText;
            const r = rightText.length > maxLen ? rightText.substring(0, maxLen) + '...(truncated)' : rightText;

            const response = await fetch('https://open.bigmodel.cn/api/coding/paas/v4/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: zhipuModel,
                    messages: [
                        {
                            "role": "system",
                            "content": "你是一个数据对比专家。请分析两个JSON数据的语义差异。请使用 Markdown 表格展示差异，表格列依次为：字段路径 (Path)、变更类型 (Type)、左侧数据 (Original)、右侧数据 (New)、分析说明 (Description)。\n重要规则：\n1. 仅展示有差异的字段（修改、新增、删除），严禁展示任何未变更的数据。\n2. 字段路径必须保持原始 JSON Key，严禁翻译成中文。\n3. 变更类型包括：修改、新增、删除。\n4. 分析说明请使用中文。\n5. 如果两个JSON在语义上一致，请直接回答“两个 JSON 数据语义一致”。\n请直接输出表格，不要有多余的开头或结尾解释文字。"
                        },
                        {
                            "role": "user",
                            "content": `Left JSON:\n${l}\n\nRight JSON:\n${r}`
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
                const renderedHtml = this.renderMarkdownTable(content);
                const htmlContent = `
                    <div style="padding: 10px; line-height: 1.6;">
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; font-weight: 500;">AI 差异分析报告：</div>
                        <div class="markdown-body">
                            ${renderedHtml}
                        </div>
                    </div>
                `;
                this.app.layout.showSidebar('智能对比结果', htmlContent);
                this.app.layout.updateStatus('智能对比完成');
                if (this.app.layout.showSuccess) {
                    this.app.layout.showSuccess('智能对比完成', '已生成差异分析报告。');
                }
            } else {
                 throw new Error('AI 未返回有效内容');
            }

        } catch (error) {
            console.error('Smart compare failed', error);
            this.app.layout.showError('智能对比失败', error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }

    /**
     * 简单的 Markdown 表格渲染器
     */
    renderMarkdownTable(markdown) {
        const lines = markdown.trim().split('\n');
        if (lines.length < 2) return `<div style="white-space: pre-wrap;">${Utils.escapeHtml(markdown)}</div>`;

        let tableHtml = '<table>';
        let hasHeader = false;
        let bodyStarted = false;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith('|')) {
                // 如果不是表格行，按普通文本处理
                if (trimmedLine) {
                    tableHtml += `</table><p style="margin: 10px 0; font-size: 13px;">${Utils.escapeHtml(trimmedLine)}</p><table>`;
                }
                continue;
            }

            const cells = trimmedLine.split('|')
                .filter((_, index, array) => index > 0 && index < array.length - 1)
                .map(cell => cell.trim());

            // 跳过分割线行 (---|---|---)
            if (trimmedLine.includes('---') && !trimmedLine.match(/[a-zA-Z0-9]/)) {
                continue;
            }

            if (!hasHeader) {
                tableHtml += '<thead><tr>';
                cells.forEach(cell => {
                    tableHtml += `<th>${Utils.escapeHtml(cell)}</th>`;
                });
                tableHtml += '</tr></thead><tbody>';
                hasHeader = true;
                bodyStarted = true;
            } else {
                tableHtml += '<tr>';
                cells.forEach(cell => {
                    tableHtml += `<td>${Utils.escapeHtml(cell)}</td>`;
                });
                tableHtml += '</tr>';
            }
        }

        if (bodyStarted) {
            tableHtml += '</tbody>';
        }
        tableHtml += '</table>';
        return tableHtml;
    }

    /**
     * 递归对比任意 JSON 结构，并为左右两侧分别保留精确路径。
     */
    calculateStructuralDiff(left, right, pathTokens = [], leftPathTokens = pathTokens, rightPathTokens = pathTokens) {
        const differences = [];

        const addDiff = (type, leftValue, rightValue, currentLeftPath = leftPathTokens, currentRightPath = rightPathTokens, currentPath = pathTokens) => {
            differences.push({
                path: this.formatPath(currentPath),
                pathTokens: currentPath,
                leftPath: currentLeftPath ? this.formatPath(currentLeftPath) : null,
                rightPath: currentRightPath ? this.formatPath(currentRightPath) : null,
                leftPathTokens: currentLeftPath,
                rightPathTokens: currentRightPath,
                type,
                leftValue,
                rightValue
            });
        };

        const leftKind = this.getJsonKind(left);
        const rightKind = this.getJsonKind(right);

        if (leftKind !== rightKind) {
            addDiff('modified', left, right);
            return differences;
        }

        if (leftKind === 'primitive' || leftKind === 'null') {
            if (left !== right) {
                addDiff('modified', left, right);
            }
            return differences;
        }

        if (leftKind === 'array') {
            const matched = this.matchArrayElements(left, right);

            matched.matched.forEach(({ leftIndex, rightIndex }) => {
                const displayPath = [...pathTokens, rightIndex];
                differences.push(...this.calculateStructuralDiff(
                    left[leftIndex],
                    right[rightIndex],
                    displayPath,
                    [...leftPathTokens, leftIndex],
                    [...rightPathTokens, rightIndex]
                ));
            });

            matched.unmatched.left.forEach(index => {
                const currentPath = [...leftPathTokens, index];
                addDiff('removed', left[index], undefined, currentPath, null, currentPath);
            });

            matched.unmatched.right.forEach(index => {
                const currentPath = [...rightPathTokens, index];
                addDiff('added', undefined, right[index], null, currentPath, currentPath);
            });

            return differences;
        }

        const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
        for (const key of keys) {
            const currentPath = [...pathTokens, key];
            const currentLeftPath = [...leftPathTokens, key];
            const currentRightPath = [...rightPathTokens, key];
            if (!Object.prototype.hasOwnProperty.call(left, key)) {
                addDiff('added', undefined, right[key], null, currentRightPath, currentPath);
            } else if (!Object.prototype.hasOwnProperty.call(right, key)) {
                addDiff('removed', left[key], undefined, currentLeftPath, null, currentPath);
            } else {
                differences.push(...this.calculateStructuralDiff(left[key], right[key], currentPath, currentLeftPath, currentRightPath));
            }
        }

        return differences;
    }

    /**
     * 智能匹配数组元素，优先处理对象集合里的稳定标识，再回退到索引和相似度。
     */
    matchArrayElements(leftArray, rightArray) {
        const leftLen = leftArray.length;
        const rightLen = rightArray.length;
        const matched = [];
        const unmatchedLeft = new Set([...Array(leftLen).keys()]);
        const unmatchedRight = new Set([...Array(rightLen).keys()]);

        if (leftLen === 0 || rightLen === 0) {
            return {
                matched,
                unmatched: {
                    left: Array.from(unmatchedLeft),
                    right: Array.from(unmatchedRight)
                }
            };
        }

        const takeMatch = (leftIndex, rightIndex, reason, score = 1) => {
            if (!unmatchedLeft.has(leftIndex) || !unmatchedRight.has(rightIndex)) return false;
            matched.push({ leftIndex, rightIndex, reason, score });
            unmatchedLeft.delete(leftIndex);
            unmatchedRight.delete(rightIndex);
            return true;
        };

        for (let i = 0; i < leftLen; i++) {
            if (!unmatchedLeft.has(i)) continue;
            for (let j = 0; j < rightLen; j++) {
                if (!unmatchedRight.has(j)) continue;
                if (this.deepEquals(leftArray[i], rightArray[j])) {
                    takeMatch(i, j, 'exact', 1);
                    break;
                }
            }
        }

        const identityCandidates = [];
        Array.from(unmatchedLeft).forEach(i => {
            Array.from(unmatchedRight).forEach(j => {
                const score = this.calculateIdentityScore(leftArray[i], rightArray[j]);
                if (score > 0) identityCandidates.push({ leftIndex: i, rightIndex: j, score, reason: 'identity' });
            });
        });
        identityCandidates
            .sort((a, b) => b.score - a.score || a.leftIndex - b.leftIndex || a.rightIndex - b.rightIndex)
            .forEach(candidate => takeMatch(candidate.leftIndex, candidate.rightIndex, candidate.reason, candidate.score));

        const similarityCandidates = [];
        Array.from(unmatchedLeft).forEach(i => {
            Array.from(unmatchedRight).forEach(j => {
                const similarity = this.calculateSimilarity(leftArray[i], rightArray[j]);
                if (similarity >= 0.55) {
                    similarityCandidates.push({ leftIndex: i, rightIndex: j, score: similarity, reason: 'similarity' });
                }
            });
        });
        similarityCandidates
            .sort((a, b) => b.score - a.score || a.leftIndex - b.leftIndex || a.rightIndex - b.rightIndex)
            .forEach(candidate => takeMatch(candidate.leftIndex, candidate.rightIndex, candidate.reason, candidate.score));

        Array.from(unmatchedLeft).forEach(i => {
            if (!unmatchedRight.has(i)) return;

            const leftKind = this.getJsonKind(leftArray[i]);
            const rightKind = this.getJsonKind(rightArray[i]);
            const hasStableIdentity = this.hasIdentityField(leftArray[i]) || this.hasIdentityField(rightArray[i]);
            if (leftKind === rightKind && (leftKind !== 'object' || !hasStableIdentity)) {
                takeMatch(i, i, 'index', 0.65);
            }
        });

        return {
            matched,
            unmatched: {
                left: Array.from(unmatchedLeft).sort((a, b) => a - b),
                right: Array.from(unmatchedRight).sort((a, b) => a - b)
            }
        };
    }

    /**
     * 深度相等比较，避免对象字段顺序影响集合元素匹配。
     */
    deepEquals(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return false;
        if (typeof a !== typeof b) return false;
        if (typeof a !== 'object') return a === b;

        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.deepEquals(a[i], b[i])) return false;
            }
            return true;
        }

        if (Array.isArray(a) || Array.isArray(b)) return false;

        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (!(key in b)) return false;
            if (!this.deepEquals(a[key], b[key])) return false;
        }

        return true;
    }

    /**
     * 计算两个值的相似度，用于没有显式 id 的对象集合。
     */
    calculateSimilarity(a, b) {
        if (this.deepEquals(a, b)) return 1;
        if (typeof a !== typeof b) return 0;
        if (typeof a !== 'object' || a === null || b === null) return a === b ? 1 : 0;

        if (!Array.isArray(a) && !Array.isArray(b)) {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            const allKeys = new Set([...keysA, ...keysB]);
            if (allKeys.size === 0) return 1;

            let score = 0;

            for (const key of allKeys) {
                if (key in a && key in b) {
                    score += this.calculateSimilarity(a[key], b[key]);
                }
            }

            return score / allKeys.size;
        }

        if (Array.isArray(a) && Array.isArray(b)) {
            const maxLen = Math.max(a.length, b.length);
            if (maxLen === 0) return 1;

            let exactCount = 0;
            const usedRight = new Set();
            for (const leftItem of a) {
                const rightIndex = b.findIndex((rightItem, index) => !usedRight.has(index) && this.deepEquals(leftItem, rightItem));
                if (rightIndex !== -1) {
                    exactCount += 1;
                    usedRight.add(rightIndex);
                }
            }
            return exactCount / maxLen;
        }

        return 0;
    }

    /**
     * 从常见唯一字段判断两个数组对象是否代表同一条业务记录。
     */
    calculateIdentityScore(leftItem, rightItem) {
        if (this.getJsonKind(leftItem) !== 'object' || this.getJsonKind(rightItem) !== 'object') return 0;

        const idFields = this.getIdentityFields();
        for (const idField of idFields) {
            if (!Object.prototype.hasOwnProperty.call(leftItem, idField)) continue;
            if (!Object.prototype.hasOwnProperty.call(rightItem, idField)) continue;
            if (leftItem[idField] !== null && leftItem[idField] === rightItem[idField]) return 0.98;
        }

        return 0;
    }

    getIdentityFields() {
        return ['id', '_id', 'key', 'code', 'uuid', 'uid', 'name', 'slug', 'sku'];
    }

    hasIdentityField(value) {
        if (this.getJsonKind(value) !== 'object') return false;
        return this.getIdentityFields().some(field => Object.prototype.hasOwnProperty.call(value, field));
    }

    /**
     * 返回 JSON 值类型，区分数组、对象、null 和基础值。
     */
    getJsonKind(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        return 'primitive';
    }

    updateDiffHighlights(differences, leftFormatted, rightFormatted, leftObj, rightObj) {
        const leftLines = this.getDiffLineData(leftFormatted, differences, 'left', leftObj);
        const rightLines = this.getDiffLineData(rightFormatted, differences, 'right', rightObj);
        this.updateCompareDisplay('leftJson', leftLines);
        this.updateCompareDisplay('rightJson', rightLines);
    }

    getDiffLineData(formattedString, differences, side, rootValue) {
        const lines = formattedString.split('\n');
        const diffLines = [];

        const pathToLines = this.buildPathToLineMapping(formattedString, rootValue);

        for (let i = 0; i < lines.length; i++) {
            diffLines.push({ type: 'same', lineNumber: i + 1 });
        }

        for (const diff of differences) {
            const actualPathTokens = side === 'left' ? diff.leftPathTokens : diff.rightPathTokens;
            if (!actualPathTokens) continue;

            const lineRanges = this.findLinesForPath(pathToLines, actualPathTokens);

            lineRanges.forEach(lineIndex => {
                if (lineIndex >= 0 && lineIndex < diffLines.length) {
                    if (diff.type === 'added' && side === 'right') {
                        diffLines[lineIndex].type = 'added';
                    } else if (diff.type === 'removed' && side === 'left') {
                        diffLines[lineIndex].type = 'removed';
                    } else if (diff.type === 'modified') {
                        diffLines[lineIndex].type = 'modified';
                    }
                }
            });
        }

        return diffLines;
    }

    /**
     * 基于 JSON.stringify 的缩进规则构建路径到行号的映射，避免 key 中包含点号或转义字符时误判。
     */
    buildPathToLineMapping(formattedString, rootValue) {
        const lines = formattedString.split('\n');
        const mapping = {};

        const addLine = (path, lineIndex) => {
            const key = this.pathKey(path);
            if (!mapping[key]) mapping[key] = [];
            if (!mapping[key].includes(lineIndex)) mapping[key].push(lineIndex);
        };

        const addRange = (path, start, end) => {
            const key = this.pathKey(path);
            if (!mapping[key]) mapping[key] = [];
            for (let i = start; i <= end; i++) {
                if (!mapping[key].includes(i)) mapping[key].push(i);
            }
        };

        const isInlineValue = value => {
            if (value === null || typeof value !== 'object') return true;
            if (Array.isArray(value)) return value.length === 0;
            return Object.keys(value).length === 0;
        };

        const walk = (value, path, startLine) => {
            addLine(path, startLine);

            if (isInlineValue(value)) return startLine;

            let cursor = startLine + 1;

            if (Array.isArray(value)) {
                for (let index = 0; index < value.length; index++) {
                    const childPath = [...path, index];
                    if (isInlineValue(value[index])) {
                        addLine(childPath, cursor);
                    } else {
                        cursor = walk(value[index], childPath, cursor);
                    }
                    cursor += 1;
                }
            } else {
                for (const key of Object.keys(value)) {
                    const childPath = [...path, key];
                    if (isInlineValue(value[key])) {
                        addLine(childPath, cursor);
                    } else {
                        cursor = walk(value[key], childPath, cursor);
                    }
                    cursor += 1;
                }
            }

            const endLine = Math.min(cursor, lines.length - 1);
            addRange(path, startLine, endLine);
            return endLine;
        };

        if (lines.length > 0) walk(rootValue, [], 0);

        return mapping;
    }

    /**
     * 查找路径对应的行号，找不到精确路径时回退到最近父节点。
     */
    findLinesForPath(pathToLines, targetPathTokens) {
        for (let length = targetPathTokens.length; length >= 0; length--) {
            const key = this.pathKey(targetPathTokens.slice(0, length));
            if (pathToLines[key]) return pathToLines[key];
        }

        return pathToLines[this.pathKey([])] || [];
    }

    pathKey(pathTokens) {
        return JSON.stringify(pathTokens || []);
    }

    formatPath(pathTokens) {
        if (!pathTokens || pathTokens.length === 0) return 'root';

        return pathTokens.reduce((result, token) => {
            if (typeof token === 'number') return `${result}[${token}]`;
            if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(token)) return result ? `${result}.${token}` : token;
            return `${result}[${JSON.stringify(token)}]`;
        }, '');
    }

    getDiffTypeLabel(type) {
        const labels = {
            added: '新增',
            removed: '删除',
            modified: '修改'
        };
        return labels[type] || type;
    }

    formatValuePreview(value) {
        if (value === undefined) return '不存在';
        const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        if (text === undefined) return String(value);
        return text.length > 260 ? `${text.slice(0, 260)}...` : text;
    }

    showDiffSummary(differences) {
        const counts = differences.reduce((result, diff) => {
            result[diff.type] = (result[diff.type] || 0) + 1;
            return result;
        }, { added: 0, removed: 0, modified: 0 });

        const rows = differences.slice(0, 200).map(diff => `
            <tr>
                <td><code>${Utils.escapeHtml(diff.path)}</code></td>
                <td>${this.getDiffTypeLabel(diff.type)}</td>
                <td><pre>${Utils.escapeHtml(this.formatValuePreview(diff.leftValue))}</pre></td>
                <td><pre>${Utils.escapeHtml(this.formatValuePreview(diff.rightValue))}</pre></td>
            </tr>
        `).join('');

        const omitted = differences.length > 200
            ? `<p style="margin-top: 10px; color: var(--text-secondary);">仅展示前 200 条差异，其余 ${differences.length - 200} 条请结合左右高亮查看。</p>`
            : '';

        const htmlContent = `
            <div style="padding: 10px; line-height: 1.5;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                    <span class="diff-pill added">新增 ${counts.added}</span>
                    <span class="diff-pill removed">删除 ${counts.removed}</span>
                    <span class="diff-pill modified">修改 ${counts.modified}</span>
                </div>
                ${differences.length ? `
                    <table class="diff-summary-table">
                        <thead>
                            <tr>
                                <th>路径</th>
                                <th>类型</th>
                                <th>左侧</th>
                                <th>右侧</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                    ${omitted}
                ` : '<p style="color: var(--text-secondary);">两个 JSON 内容一致。</p>'}
            </div>
        `;

        this.app.layout.showSidebar('结构化对比结果', htmlContent);
    }

    updateCompareDisplay(textareaId, diffLines) {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;

        const wrapper = textarea.parentElement; // .editor-wrapper
        if (!wrapper) return;

        const existing = wrapper.querySelector('.highlight-layer');
        if (existing) existing.remove();

        const highlightLayer = document.createElement('div');
        highlightLayer.className = 'highlight-layer';

        // Align highlight layer to the textarea content box (exclude line-number gutter)
        const gutter = wrapper.querySelector('.line-numbers');
        const gutterWidth = gutter ? gutter.offsetWidth : 0;

        const style = getComputedStyle(textarea);
        const lineHeight = Number.parseFloat(style.lineHeight) || 22;
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const paddingRight = Number.parseFloat(style.paddingRight) || 0;
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
        const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;

        highlightLayer.style.left = `${gutterWidth}px`;
        highlightLayer.style.width = `calc(100% - ${gutterWidth}px)`;
        highlightLayer.style.padding = `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`;

        const contentContainer = document.createElement('div');
        contentContainer.className = 'highlight-content';
        contentContainer.style.position = 'relative';
        contentContainer.style.width = '100%';
        contentContainer.style.height = '100%';
        contentContainer.style.willChange = 'transform';

        let html = '';
        diffLines.forEach((diffLine, index) => {
            if (diffLine.type !== 'same') {
                const className = `highlight-${diffLine.type}`;
                const top = index * lineHeight;
                html += `<div class="highlight-line ${className}" style="top: ${top}px; height: ${lineHeight}px;"></div>`;
            }
        });

        contentContainer.innerHTML = html;
        highlightLayer.appendChild(contentContainer);

        if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
        wrapper.appendChild(highlightLayer);

        // Initial sync
        const sync = () => {
            // Only vertical sync needed (highlight spans full width)
            contentContainer.style.transform = `translateY(-${textarea.scrollTop}px)`;
        };

        sync();

        const scrollHandler = () => sync();
        if (textarea._scrollHandler) textarea.removeEventListener('scroll', textarea._scrollHandler);
        textarea._scrollHandler = scrollHandler;
        textarea.addEventListener('scroll', scrollHandler);
    }

    clearComparison() {
        ['leftJson', 'rightJson'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const container = el.parentElement;
            const layer = container ? container.querySelector('.highlight-layer') : null;
            if (layer) layer.remove();
            if (el._scrollHandler) el.removeEventListener('scroll', el._scrollHandler);
        });
    }

    updateAllLineNumbers() {
        this.updateLineNumbers('left', document.getElementById('leftJson'), document.getElementById('leftJsonLines'));
        this.updateLineNumbers('right', document.getElementById('rightJson'), document.getElementById('rightJsonLines'));
    }

    clearLineNumbers() {
        const lg = document.getElementById('leftJsonLines');
        const rg = document.getElementById('rightJsonLines');
        if (lg) lg.innerHTML = '';
        if (rg) rg.innerHTML = '';
    }

    recordHistory(side, content) {
        if (this._suppressHistory) return;
        const max = 100;
        if (side === 'left') {
            if (this.historyLeft.length === 0 || this.historyLeft[this.historyLeft.length - 1] !== content) {
                this.historyLeft = this.historyLeft.slice(0, this.historyLeftIndex + 1);
                this.historyLeft.push(content);
                if (this.historyLeft.length > max) this.historyLeft = this.historyLeft.slice(-max);
                this.historyLeftIndex = this.historyLeft.length - 1;
                this.app.saveToLocalStorage();
            }
        } else {
            if (this.historyRight.length === 0 || this.historyRight[this.historyRight.length - 1] !== content) {
                this.historyRight = this.historyRight.slice(0, this.historyRightIndex + 1);
                this.historyRight.push(content);
                if (this.historyRight.length > max) this.historyRight = this.historyRight.slice(-max);
                this.historyRightIndex = this.historyRight.length - 1;
                this.app.saveToLocalStorage();
            }
        }
    }

    undo() { this.handleHistoryOp('undo'); }
    redo() { this.handleHistoryOp('redo'); }

    handleHistoryOp(op) {
        const isUndo = op === 'undo';
        let changed = false;
        const left = document.getElementById('leftJson');
        const right = document.getElementById('rightJson');

        if (isUndo ? this.historyLeftIndex > 0 : this.historyLeftIndex < this.historyLeft.length - 1) {
            this.historyLeftIndex += isUndo ? -1 : 1;
            left.value = this.historyLeft[this.historyLeftIndex] || '';
            changed = true;
        }
        if (isUndo ? this.historyRightIndex > 0 : this.historyRightIndex < this.historyRight.length - 1) {
            this.historyRightIndex += isUndo ? -1 : 1;
            right.value = this.historyRight[this.historyRightIndex] || '';
            changed = true;
        }

        if (changed) {
            this.app.layout.updateStatus(isUndo ? '已撤销（对比）' : '已重做（对比）');
            this.app.saveToLocalStorage();
            this.compareJSON({ silent: true });
        }
    }

    loadDemoData() {
        const leftData = {
            "orderId": "SO-2026-001",
            "status": "pending",
            "customer": {
                "id": "C1001",
                "name": "张三",
                "tags": ["vip", "north"],
                "profile.extra": {
                    "level": 3,
                    "enabled": true
                }
            },
            "items": [
                {
                    "sku": "A-100",
                    "name": "键盘",
                    "qty": 1,
                    "price": 399,
                    "options": [
                        { "code": "color", "value": "black" },
                        { "code": "switch", "value": "red" }
                    ]
                },
                {
                    "sku": "B-200",
                    "name": "鼠标",
                    "qty": 2,
                    "price": 199
                },
                {
                    "sku": "C-300",
                    "name": "腕托",
                    "qty": 1,
                    "price": 59
                }
            ],
            "payments": [
                { "id": "pay-1", "type": "card", "amount": 500 },
                { "id": "pay-2", "type": "coupon", "amount": 357 }
            ],
            "meta": {
                "source": "web",
                "flags": [true, false, null]
            }
        };
        const rightData = {
            "orderId": "SO-2026-001",
            "status": "paid",
            "customer": {
                "id": "C1001",
                "name": "张三",
                "tags": ["north", "vip", "new"],
                "profile.extra": {
                    "level": 4,
                    "enabled": true
                }
            },
            "items": [
                {
                    "sku": "B-200",
                    "name": "鼠标",
                    "qty": 1,
                    "price": 189
                },
                {
                    "sku": "A-100",
                    "name": "键盘",
                    "qty": 1,
                    "price": 399,
                    "options": [
                        { "code": "switch", "value": "brown" },
                        { "code": "color", "value": "black" }
                    ]
                },
                {
                    "sku": "D-400",
                    "name": "鼠标垫",
                    "qty": 1,
                    "price": 49
                }
            ],
            "payments": [
                { "id": "pay-1", "type": "card", "amount": 637 }
            ],
            "meta": {
                "source": "mobile",
                "flags": [true, null]
            },
            "invoice": {
                "required": true,
                "title": "张三"
            }
        };

        const lStr = JSON.stringify(leftData, null, 2);
        const rStr = JSON.stringify(rightData, null, 2);

        const lArea = document.getElementById('leftJson');
        const rArea = document.getElementById('rightJson');
        lArea.value = lStr;
        rArea.value = rStr;

        this.updateAllLineNumbers();
        this.recordHistory('left', lStr);
        this.recordHistory('right', rStr);
        this.app.layout.updateStatus('已加载复杂集合对比示例数据');
    }
}

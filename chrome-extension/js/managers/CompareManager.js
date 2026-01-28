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
            this.updateDiffHighlights(diff, leftFormatted, rightFormatted);

            if (!silent) this.app.layout.updateStatus(`对比完成：发现 ${diff.length} 处差异`);

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

            const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "glm-4-flash",
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

    calculateStructuralDiff(left, right, path = '') {
        const differences = [];
        if (left === null || right === null) {
            if (left !== right) {
                differences.push({ path: path || 'root', type: left === null ? 'added' : 'removed', leftValue: left, rightValue: right });
            }
            return differences;
        }
        if (typeof left !== 'object' || typeof right !== 'object') {
            if (left !== right) {
                differences.push({ path: path || 'root', type: 'modified', leftValue: left, rightValue: right });
            }
            return differences;
        }
        if (Array.isArray(left) && Array.isArray(right)) {
            // 智能数组对比：尝试通过内容匹配数组元素
            const matched = this.matchArrayElements(left, right);

            // 处理已匹配的元素 - 递归比较内容
            matched.matched.forEach(({ leftIndex, rightIndex }) => {
                const leftPath = path ? `${path}[${leftIndex}]` : `[${leftIndex}]`;
                const rightPath = path ? `${path}[${rightIndex}]` : `[${rightIndex}]`;
                const subDiffs = this.calculateStructuralDiff(left[leftIndex], right[rightIndex], '');

                // 将子差异的路径加上正确的数组索引前缀
                subDiffs.forEach(diff => {
                    differences.push({
                        ...diff,
                        leftPath: leftPath + (diff.path ? '.' + diff.path : ''),
                        rightPath: rightPath + (diff.path ? '.' + diff.path : ''),
                        path: diff.path // 保留原始相对路径用于显示
                    });
                });
            });

            // 处理左侧未匹配的元素（被删除）
            matched.unmatched.left.forEach(index => {
                const currPath = path ? `${path}[${index}]` : `[${index}]`;
                differences.push({
                    path: currPath,
                    leftPath: currPath,
                    rightPath: null,
                    type: 'removed',
                    leftValue: left[index],
                    rightValue: undefined,
                    leftIndex: index
                });
            });

            // 处理右侧未匹配的元素（新增）
            matched.unmatched.right.forEach(index => {
                const currPath = path ? `${path}[${index}]` : `[${index}]`;
                differences.push({
                    path: currPath,
                    leftPath: null,
                    rightPath: currPath,
                    type: 'added',
                    leftValue: undefined,
                    rightValue: right[index],
                    rightIndex: index
                });
            });

            return differences;
        }
        if (typeof left === 'object' && typeof right === 'object') {
            const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
            for (const key of keys) {
                const currPath = path ? `${path}.${key}` : key;
                if (!(key in left)) differences.push({ path: currPath, type: 'added', leftValue: undefined, rightValue: right[key] });
                else if (!(key in right)) differences.push({ path: currPath, type: 'removed', leftValue: left[key], rightValue: undefined });
                else differences.push(...this.calculateStructuralDiff(left[key], right[key], currPath));
            }
        }
        return differences;
    }

    /**
     * 智能匹配数组元素
     * 尝试通过内容相似度找到最佳匹配，而不是简单按索引对比
     */
    matchArrayElements(leftArray, rightArray) {
        const leftLen = leftArray.length;
        const rightLen = rightArray.length;
        const matched = [];
        const unmatchedLeft = new Set([...Array(leftLen).keys()]);
        const unmatchedRight = new Set([...Array(rightLen).keys()]);

        // 如果数组为空，直接返回
        if (leftLen === 0 || rightLen === 0) {
            return {
                matched,
                unmatched: {
                    left: Array.from(unmatchedLeft),
                    right: Array.from(unmatchedRight)
                }
            };
        }

        // 第一遍：完全相等匹配
        for (let i = 0; i < leftLen; i++) {
            if (!unmatchedLeft.has(i)) continue;
            for (let j = 0; j < rightLen; j++) {
                if (!unmatchedRight.has(j)) continue;
                if (this.deepEquals(leftArray[i], rightArray[j])) {
                    matched.push({ leftIndex: i, rightIndex: j });
                    unmatchedLeft.delete(i);
                    unmatchedRight.delete(j);
                    break;
                }
            }
        }

        // 第二遍：对于对象类型，尝试通过唯一标识符匹配（如id字段）
        const leftRemaining = Array.from(unmatchedLeft);
        const rightRemaining = Array.from(unmatchedRight);

        for (const i of leftRemaining) {
            const leftItem = leftArray[i];
            if (typeof leftItem !== 'object' || leftItem === null || Array.isArray(leftItem)) continue;

            // 尝试通过id、_id、key等常见唯一标识符匹配
            const idFields = ['id', '_id', 'key', 'code', 'uuid'];
            let foundMatch = false;

            for (const idField of idFields) {
                if (!(idField in leftItem)) continue;
                const leftId = leftItem[idField];

                for (const j of rightRemaining) {
                    if (!unmatchedRight.has(j)) continue;
                    const rightItem = rightArray[j];
                    if (typeof rightItem !== 'object' || rightItem === null || Array.isArray(rightItem)) continue;

                    if (idField in rightItem && rightItem[idField] === leftId) {
                        matched.push({ leftIndex: i, rightIndex: j });
                        unmatchedLeft.delete(i);
                        unmatchedRight.delete(j);
                        foundMatch = true;
                        break;
                    }
                }
                if (foundMatch) break;
            }
        }

        // 第三遍：对于剩余元素，尝试通过相似度匹配
        const stillUnmatchedLeft = Array.from(unmatchedLeft);
        const stillUnmatchedRight = Array.from(unmatchedRight);

        for (const i of stillUnmatchedLeft) {
            let bestMatch = -1;
            let bestSimilarity = 0.5; // 最低相似度阈值

            for (const j of stillUnmatchedRight) {
                if (!unmatchedRight.has(j)) continue;
                const similarity = this.calculateSimilarity(leftArray[i], rightArray[j]);
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestMatch = j;
                }
            }

            if (bestMatch !== -1) {
                matched.push({ leftIndex: i, rightIndex: bestMatch });
                unmatchedLeft.delete(i);
                unmatchedRight.delete(bestMatch);
            }
        }

        return {
            matched,
            unmatched: {
                left: Array.from(unmatchedLeft),
                right: Array.from(unmatchedRight)
            }
        };
    }

    /**
     * 深度相等比较
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
     * 计算两个值的相似度（0-1之间）
     */
    calculateSimilarity(a, b) {
        if (this.deepEquals(a, b)) return 1;
        if (typeof a !== typeof b) return 0;
        if (typeof a !== 'object' || a === null || b === null) return 0;

        // 对于对象，计算相同字段的比例
        if (!Array.isArray(a) && !Array.isArray(b)) {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            const allKeys = new Set([...keysA, ...keysB]);
            if (allKeys.size === 0) return 1;

            let sameCount = 0;
            let totalCount = allKeys.size;

            for (const key of allKeys) {
                if (key in a && key in b) {
                    if (this.deepEquals(a[key], b[key])) {
                        sameCount += 1;
                    } else {
                        sameCount += 0.5; // 键存在但值不同，给一半分数
                    }
                }
            }

            return sameCount / totalCount;
        }

        return 0;
    }

    updateDiffHighlights(differences, leftFormatted, rightFormatted) {
        console.log('[CompareManager] Updating diff highlights, differences count:', differences.length);
        const leftLines = this.getDiffLineData(leftFormatted, differences, 'left');
        const rightLines = this.getDiffLineData(rightFormatted, differences, 'right');
        console.log('[CompareManager] Left diff lines:', leftLines.filter(l => l.type !== 'same').length);
        console.log('[CompareManager] Right diff lines:', rightLines.filter(l => l.type !== 'same').length);
        this.updateCompareDisplay('leftJson', leftLines);
        this.updateCompareDisplay('rightJson', rightLines);
    }

    getDiffLineData(formattedString, differences, side) {
        const lines = formattedString.split('\n');
        const diffLines = [];

        // 构建路径到行号的映射
        const pathToLines = this.buildPathToLineMapping(formattedString);
        console.log(`[getDiffLineData] ${side} - Path to lines mapping:`, pathToLines);

        // 初始化所有行为'same'
        for (let i = 0; i < lines.length; i++) {
            diffLines.push({ type: 'same', lineNumber: i + 1 });
        }

        // 根据差异标记对应的行
        for (const diff of differences) {
            const targetPath = side === 'left' ? diff.leftPath : diff.rightPath;
            console.log(`[getDiffLineData] ${side} - Processing diff:`, diff.type, 'targetPath:', targetPath, 'path:', diff.path);

            // 如果该侧没有对应的路径（比如左侧删除，右侧为null），跳过
            if (!targetPath && !diff.path) continue;

            // 如果没有leftPath/rightPath，尝试使用path
            const actualPath = targetPath || diff.path;

            // 获取该路径对应的行范围
            const lineRanges = this.findLinesForPath(pathToLines, actualPath, diff.type);
            console.log(`[getDiffLineData] ${side} - Line ranges for path '${actualPath}':`, lineRanges);

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
     * 构建路径到行号的映射
     * 返回格式: { '[0]': [1,2,3,4,5,6,7], '[0].id': [2], '[0].code': [3], ... }
     */
    buildPathToLineMapping(formattedString) {
        const lines = formattedString.split('\n');
        const mapping = {};

        // 统一把根节点映射到所有行，便于处理 diff.path === 'root'
        if (lines.length > 0) {
            mapping.root = Array.from({ length: lines.length }, (_, i) => i);
        }

        const addLine = (path, lineIndex) => {
            if (!path) return;
            if (!mapping[path]) mapping[path] = [];
            mapping[path].push(lineIndex);
        };

        const addRange = (path, start, end) => {
            if (!path) return;
            if (!mapping[path]) mapping[path] = [];
            for (let i = start; i <= end; i++) {
                mapping[path].push(i);
            }
        };

        const joinPath = (base, key) => (base ? `${base}.${key}` : key);

        // frame: { type: 'object'|'array', path: string, startLine: number, nextIndex?: number, isArrayElement?: boolean, parentArray?: frame }
        const stack = [];
        const top = () => (stack.length ? stack[stack.length - 1] : null);

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const trimmed = lines[lineIndex].trim();
            if (!trimmed) continue;

            // 先处理容器结束（该行属于当前容器的范围）
            if (trimmed === '}' || trimmed === '},' || trimmed === ']' || trimmed === '],') {
                const frame = top();
                if (frame) {
                    stack.pop();
                    if (frame.path) addRange(frame.path, frame.startLine, lineIndex);

                    // 如果这个 frame 是数组元素（对象/数组），关闭时推进父数组 index
                    if (frame.isArrayElement && frame.parentArray) {
                        frame.parentArray.nextIndex = (frame.parentArray.nextIndex ?? 0) + 1;
                    }
                }
                continue;
            }

            let frame = top();

            // 根容器开始
            if (!frame) {
                if (trimmed === '{') {
                    stack.push({ type: 'object', path: '', startLine: lineIndex });
                } else if (trimmed === '[') {
                    stack.push({ type: 'array', path: '', startLine: lineIndex, nextIndex: 0 });
                }
                continue;
            }

            // 数组内：处理元素（对象/数组/原始值）
            if (frame.type === 'array') {
                if (trimmed === '{' || trimmed === '[') {
                    const idx = frame.nextIndex ?? 0;
                    const elementPath = frame.path ? `${frame.path}[${idx}]` : `[${idx}]`;
                    stack.push({
                        type: trimmed === '{' ? 'object' : 'array',
                        path: elementPath,
                        startLine: lineIndex,
                        isArrayElement: true,
                        parentArray: frame,
                        nextIndex: trimmed === '[' ? 0 : undefined
                    });
                    continue;
                }

                // 原始值元素（number/string/boolean/null）
                const idx = frame.nextIndex ?? 0;
                const elementPath = frame.path ? `${frame.path}[${idx}]` : `[${idx}]`;
                addLine(elementPath, lineIndex);
                frame.nextIndex = idx + 1;
                continue;
            }

            // 对象内：处理 key 行
            if (frame.type === 'object') {
                const keyMatch = trimmed.match(/^"([^"]+)"\s*:\s*(.*)$/);
                if (keyMatch) {
                    const key = keyMatch[1];
                    const rest = keyMatch[2];
                    const keyPath = joinPath(frame.path, key);

                    // key 所在行先记录
                    addLine(keyPath, lineIndex);

                    // value 是容器并且起始就在同一行："k": { 或 "k": [
                    if (rest.startsWith('{') || rest.startsWith('[')) {
                        const isObj = rest.startsWith('{');
                        stack.push({
                            type: isObj ? 'object' : 'array',
                            path: keyPath,
                            startLine: lineIndex,
                            nextIndex: isObj ? undefined : 0
                        });
                    }
                }
                continue;
            }
        }

        return mapping;
    }

    /**
     * 查找路径对应的行号
     */
    findLinesForPath(pathToLines, targetPath, diffType) {
        // 直接查找完全匹配的路径
        if (pathToLines[targetPath]) {
            return pathToLines[targetPath];
        }

        // 如果是数组元素级别的差异（如[8]、[9]），返回该元素的所有行
        const arrayIndexMatch = targetPath.match(/^\[(\d+)\]$/);
        if (arrayIndexMatch) {
            return pathToLines[targetPath] || [];
        }

        // 对于嵌套路径，尝试查找父路径
        const pathParts = targetPath.split('.');
        for (let i = pathParts.length; i > 0; i--) {
            const partialPath = pathParts.slice(0, i).join('.');
            if (pathToLines[partialPath]) {
                return pathToLines[partialPath];
            }
        }

        return [];
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
            "product": "iPhone 15 Pro",
            "specs": { "screen": "6.1-inch", "chip": "A17 Pro", "storage": "256GB" },
            "price": 9999
        };
        const rightData = {
            "product": "iPhone 15 Pro Max",
            "specs": { "screen": "6.7-inch", "chip": "A17 Pro", "storage": "512GB" },
            "price": 11999
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
        this.app.layout.updateStatus('已加载机型比价示例数据');
    }
}

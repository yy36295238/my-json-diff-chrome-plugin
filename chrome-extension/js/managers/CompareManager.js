import { Utils } from '../utils.js';

export class CompareManager {
    // 超过该大小（约 200KB，按字符数近似）的单条内容不进入持久化历史
    static MAX_PERSIST_ENTRY_SIZE = 200 * 1024;
    // 左右两侧历史上限
    static MAX_HISTORY = 50;

    constructor(app) {
        this.app = app;
        // 内存内完整历史（可能包含超大条目，仅持久化时过滤）
        this._historyLeft = [];
        this.historyLeftIndex = -1;
        this._historyRight = [];
        this.historyRightIndex = -1;
        // recordHistory 的防抖定时器（500ms）
        this._compareDebounceTimer = null;
        // 防抖期间各侧待提交的内容（null 表示无待提交）
        this._pendingHistory = { left: null, right: null };
        // 最后获得焦点/输入的一侧，undo/redo 只作用于该侧
        this._activeSide = 'left';
        // 各侧初始内容，作为历史首条，保证能回退到第一次编辑前的状态
        this._initialContent = { left: '', right: '' };
    }

    /**
     * 对外暴露的历史（供 app.saveToLocalStorage 持久化）：过滤掉超大条目。
     * 超大条目仍保留在内存内历史中，可参与 undo/redo。
     */
    get historyLeft() {
        return this._historyLeft.filter(item => !this._isOversizedEntry(item));
    }

    set historyLeft(list) {
        this._historyLeft = Array.isArray(list) ? list.slice() : [];
    }

    get historyRight() {
        return this._historyRight.filter(item => !this._isOversizedEntry(item));
    }

    set historyRight(list) {
        this._historyRight = Array.isArray(list) ? list.slice() : [];
    }

    _isOversizedEntry(content) {
        return typeof content === 'string' && content.length > CompareManager.MAX_PERSIST_ENTRY_SIZE;
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

        // 记录初始内容，作为历史首条的回退基准
        this._initialContent = { left: leftArea.value, right: rightArea.value };

        // 跟踪最后获得焦点/输入的一侧，undo/redo 只作用于该侧
        leftArea.addEventListener('focus', () => { this._activeSide = 'left'; });
        rightArea.addEventListener('focus', () => { this._activeSide = 'right'; });

        leftArea.addEventListener('input', () => {
            this._activeSide = 'left';
            this.recordHistory('left', leftArea.value);
            this.updateLineNumbers('left', leftArea, leftLines);
            // 清除对比高亮显示，因为数据已改变
            this.clearComparison();
        });

        rightArea.addEventListener('input', () => {
            this._activeSide = 'right';
            this.recordHistory('right', rightArea.value);
            this.updateLineNumbers('right', rightArea, rightLines);
            // 清除对比高亮显示，因为数据已改变
            this.clearComparison();
        });

        // 粘贴后若整体为合法 JSON 则自动美化（非 JSON 静默跳过；内容过大跳过以免卡顿）
        const autoFormatOnPaste = (side, area) => {
            area.addEventListener('paste', () => {
                setTimeout(() => {
                    const val = area.value.trim();
                    if (!val || val.length > 1024 * 1024) return;
                    try { JSON.parse(val); } catch (e) { return; }
                    this.beautifySide(side);
                }, 0);
            });
        };
        autoFormatOnPaste('left', leftArea);
        autoFormatOnPaste('right', rightArea);

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
            // 仅在勾选"递归解析嵌套JSON字符串"时才深度解析
            let parsed = JSON.parse(raw);
            if (document.getElementById('deepParseToggle')?.checked) {
                parsed = Utils.deepParseJSON(parsed);
            }
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
            // 仅在勾选"递归解析嵌套JSON字符串"时才深度解析，再压缩
            let parsed = JSON.parse(raw);
            if (document.getElementById('deepParseToggle')?.checked) {
                parsed = Utils.deepParseJSON(parsed);
            }
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
        const leftArea = document.getElementById('leftJson');
        const rightArea = document.getElementById('rightJson');
        if (!leftArea || !rightArea) return;

        const leftText = leftArea.value;
        const rightText = rightArea.value;
        const ignoreOrder = document.getElementById('ignoreArrayOrder')?.checked || false;
        // 递归解析嵌套 JSON 字符串：仅在用户显式勾选时执行
        const deepParse = document.getElementById('deepParseToggle')?.checked || false;

        this.clearComparison();

        if (!leftText.trim() && !rightText.trim()) {
            this.clearLineNumbers();
            if (!silent) {
                this.app.layout.updateStatus('两侧内容均为空，请先输入需要对比的 JSON');
            }
            return;
        }

        let leftObj = null, rightObj = null;
        let leftFormatted = '', rightFormatted = '';

        try {
            if (leftText.trim()) {
                try {
                    leftObj = JSON.parse(leftText);
                    if (deepParse) {
                        leftObj = Utils.deepParseJSON(leftObj);
                    }
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
                    rightObj = JSON.parse(rightText);
                    if (deepParse) {
                        rightObj = Utils.deepParseJSON(rightObj);
                    }
                    if (ignoreOrder) {
                        rightObj = Utils.sortDeep(rightObj);
                    }
                    rightFormatted = JSON.stringify(rightObj, null, 2);
                } catch (e) {
                    throw new Error(`右侧 JSON 错误: ${e.message}`);
                }
            }

            // 覆写输入框前，先把原始输入立即记入历史（绕过防抖），保证可以 undo 回到对比前的原文
            this.recordHistory('left', leftText, { immediate: true });
            this.recordHistory('right', rightText, { immediate: true });

            leftArea.value = leftFormatted;
            rightArea.value = rightFormatted;

            // 规范化后的结果也立即入历史，使一次 undo 即可回到原文
            this.recordHistory('left', leftFormatted, { immediate: true });
            this.recordHistory('right', rightFormatted, { immediate: true });

            this.updateAllLineNumbers();

            // 一侧为空：另一侧整体视为新增/删除，不再把空侧当 null 参与 diff
            if (!leftText.trim() || !rightText.trim()) {
                this.renderSingleSideDiff(leftFormatted, rightFormatted, silent);
                return;
            }

            const diff = this.calculateStructuralDiff(leftObj, rightObj);
            this.updateDiffHighlights(diff, leftFormatted, rightFormatted, leftObj, rightObj);

            if (!silent) {
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

    /**
     * 一侧为空时的渲染：非空侧整体高亮为新增（左空）或删除（右空），并给出对应统计摘要。
     */
    renderSingleSideDiff(leftFormatted, rightFormatted, silent) {
        const isLeftEmpty = !leftFormatted;
        const sideId = isLeftEmpty ? 'rightJson' : 'leftJson';
        const formatted = isLeftEmpty ? rightFormatted : leftFormatted;
        const type = isLeftEmpty ? 'added' : 'removed';

        const lines = formatted.split('\n');
        const diffLines = lines.map((_, index) => ({ type, lineNumber: index + 1 }));
        this.updateCompareDisplay(sideId, diffLines);

        if (!silent) {
            this.app.layout.updateStatus(isLeftEmpty
                ? `对比完成：左侧为空，右侧 ${lines.length} 行均为新增`
                : `对比完成：右侧为空，左侧 ${lines.length} 行均为删除`);
        }
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
                // 身份字段冲突的元素对已判定为不同记录，不参与相似度兜底
                if (this.hasConflictingIdentity(leftArray[i], rightArray[j])) return;
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
     * 两侧都存在某身份字段时：值相等返回高分；值不相等立刻返回 0（判定为不同记录）。
     * 两侧都没有任何身份字段时返回 0，由相似度匹配兜底。
     */
    calculateIdentityScore(leftItem, rightItem) {
        if (this.getJsonKind(leftItem) !== 'object' || this.getJsonKind(rightItem) !== 'object') return 0;

        const idFields = this.getIdentityFields();
        for (const idField of idFields) {
            if (!Object.prototype.hasOwnProperty.call(leftItem, idField)) continue;
            if (!Object.prototype.hasOwnProperty.call(rightItem, idField)) continue;
            // 双方都为 null 视为无效标识，继续检查下一个字段
            if (leftItem[idField] === null && rightItem[idField] === null) continue;
            // 身份字段值不相等 → 判定为不同记录，立即返回 0
            return leftItem[idField] === rightItem[idField] ? 0.98 : 0;
        }

        return 0;
    }

    getIdentityFields() {
        return ['id', '_id', 'uuid', 'uid', 'key', 'code', 'sku'];
    }

    /**
     * 判断两个对象是否存在"身份字段冲突"（双方都有同名身份字段但值不同）。
     * 冲突的元素对不参与相似度兜底匹配，避免误配对。
     */
    hasConflictingIdentity(leftItem, rightItem) {
        if (this.getJsonKind(leftItem) !== 'object' || this.getJsonKind(rightItem) !== 'object') return false;

        for (const idField of this.getIdentityFields()) {
            if (!Object.prototype.hasOwnProperty.call(leftItem, idField)) continue;
            if (!Object.prototype.hasOwnProperty.call(rightItem, idField)) continue;
            if (leftItem[idField] === null && rightItem[idField] === null) continue;
            return leftItem[idField] !== rightItem[idField];
        }

        return false;
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
     * 查找路径对应的行号。找不到精确路径时回退到最近父节点，
     * 但只取父节点的首行，避免整块区间高亮造成视觉误报。
     */
    findLinesForPath(pathToLines, targetPathTokens) {
        const exact = pathToLines[this.pathKey(targetPathTokens)];
        if (exact) return exact;

        for (let length = targetPathTokens.length - 1; length >= 0; length--) {
            const lines = pathToLines[this.pathKey(targetPathTokens.slice(0, length))];
            if (lines && lines.length) return [Math.min(...lines)];
        }

        return [];
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
        const lineHeight = this.resolveLineHeight(textarea, style);
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

    /**
     * 解析高亮定位所需的行高。computed lineHeight 为 'normal' 等不可解析值时，
     * 用一个临时单行元素（复制 textarea 的字体样式）实测行高，避免写死像素导致错位。
     */
    resolveLineHeight(textarea, style) {
        const parsed = Number.parseFloat(style.lineHeight);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;

        try {
            const probe = document.createElement('div');
            probe.textContent = 'M';
            probe.style.position = 'absolute';
            probe.style.visibility = 'hidden';
            probe.style.whiteSpace = 'pre';
            probe.style.padding = '0';
            probe.style.border = '0';
            probe.style.margin = '0';
            probe.style.fontFamily = style.fontFamily;
            probe.style.fontSize = style.fontSize;
            probe.style.fontWeight = style.fontWeight;
            probe.style.fontStyle = style.fontStyle;
            probe.style.letterSpacing = style.letterSpacing;
            probe.style.lineHeight = style.lineHeight;

            const host = textarea.parentElement || document.body;
            host.appendChild(probe);
            const measured = probe.offsetHeight;
            probe.remove();
            if (measured > 0) return measured;
        } catch (e) {
            // 实测失败时走下方字体大小估算
        }

        const fontSize = Number.parseFloat(style.fontSize);
        return Number.isFinite(fontSize) && fontSize > 0 ? Math.round(fontSize * 1.2) : 22;
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

    /**
     * 记录历史。默认 500ms 防抖（避免每键击触发全量 localStorage 写入）；
     * immediate 为 true 时绕过防抖立即记录（程序化覆写场景，如对比前的快照）。
     */
    recordHistory(side, content, options = {}) {
        const { immediate = false } = options;

        if (immediate) {
            // 先提交防抖期间的待记录内容，保证历史顺序正确
            this.flushHistory();
            if (this.commitHistory(side, content)) {
                this.app.saveToLocalStorage();
            }
            return;
        }

        this._pendingHistory[side] = content;
        if (this._compareDebounceTimer) clearTimeout(this._compareDebounceTimer);
        this._compareDebounceTimer = setTimeout(() => this.flushHistory(), 500);
    }

    /**
     * 提交防抖期间累积的待记录内容。
     */
    flushHistory() {
        if (this._compareDebounceTimer) {
            clearTimeout(this._compareDebounceTimer);
            this._compareDebounceTimer = null;
        }

        let changed = false;
        ['left', 'right'].forEach(side => {
            const content = this._pendingHistory[side];
            if (content === null) return;
            this._pendingHistory[side] = null;
            if (this.commitHistory(side, content)) changed = true;
        });

        if (changed) this.app.saveToLocalStorage();
    }

    /**
     * 把一条内容写入指定侧的内存内历史。返回是否产生了变更。
     */
    commitHistory(side, content) {
        const history = side === 'left' ? this._historyLeft : this._historyRight;
        const indexKey = side === 'left' ? 'historyLeftIndex' : 'historyRightIndex';

        // 历史首条保留初始内容，保证可以回退到第一次编辑前的状态
        if (history.length === 0) {
            const initial = this._initialContent ? (this._initialContent[side] || '') : '';
            if (initial !== content) {
                history.push(initial);
                this[indexKey] = history.length - 1;
            }
        }

        if (history.length > 0 && history[this[indexKey]] === content) return false;

        // 丢弃当前位置之后的 redo 分支
        history.splice(this[indexKey] + 1);
        history.push(content);
        if (history.length > CompareManager.MAX_HISTORY) {
            history.splice(0, history.length - CompareManager.MAX_HISTORY);
        }
        this[indexKey] = history.length - 1;
        return true;
    }

    undo() { this.handleHistoryOp('undo'); }
    redo() { this.handleHistoryOp('redo'); }

    /**
     * undo/redo 只作用于最后获得焦点/输入的一侧；没有活动侧时默认左侧。
     */
    handleHistoryOp(op) {
        const isUndo = op === 'undo';
        // 先提交防抖中的待记录内容，确保撤销基于最新历史
        this.flushHistory();

        const side = this._activeSide === 'right' ? 'right' : 'left';
        const area = document.getElementById(side === 'left' ? 'leftJson' : 'rightJson');
        if (!area) return;

        const history = side === 'left' ? this._historyLeft : this._historyRight;
        const indexKey = side === 'left' ? 'historyLeftIndex' : 'historyRightIndex';
        const canMove = isUndo ? this[indexKey] > 0 : this[indexKey] < history.length - 1;
        const sideLabel = side === 'left' ? '左侧' : '右侧';

        if (!canMove) {
            this.app.layout.updateStatus(isUndo ? `没有可撤销的记录（${sideLabel}）` : `没有可重做的记录（${sideLabel}）`);
            return;
        }

        this[indexKey] += isUndo ? -1 : 1;
        area.value = history[this[indexKey]] ?? '';
        this.updateLineNumbers(side, area, document.getElementById(side === 'left' ? 'leftJsonLines' : 'rightJsonLines'));
        // 内容已变化，旧的对比高亮不再有效；不自动重跑对比，避免再次覆写撤销回来的原文
        this.clearComparison();
        this.app.saveToLocalStorage();
        this.app.layout.updateStatus(isUndo ? `已撤销（${sideLabel}）` : `已重做（${sideLabel}）`);
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
        if (!lArea || !rArea) return;

        // 覆写前先把当前内容立即入历史，保证加载示例后可撤销回原内容
        this.recordHistory('left', lArea.value, { immediate: true });
        this.recordHistory('right', rArea.value, { immediate: true });

        lArea.value = lStr;
        rArea.value = rStr;

        this.updateAllLineNumbers();
        this.recordHistory('left', lStr, { immediate: true });
        this.recordHistory('right', rStr, { immediate: true });
        this.app.layout.updateStatus('已加载复杂集合对比示例数据');
    }
}

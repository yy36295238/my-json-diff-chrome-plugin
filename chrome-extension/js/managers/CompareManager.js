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
        });

        rightArea.addEventListener('input', () => {
            this.recordHistory('right', rightArea.value);
            this.updateLineNumbers('right', rightArea, rightLines);
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
        const leftLines = this.getDiffLineData(leftFormatted, differences, 'left');
        const rightLines = this.getDiffLineData(rightFormatted, differences, 'right');
        this.updateCompareDisplay('leftJson', leftLines);
        this.updateCompareDisplay('rightJson', rightLines);
    }

    getDiffLineData(formattedString, differences, side) {
        const lines = formattedString.split('\n');
        const diffLines = [];

        // 构建路径到行号的映射
        const pathToLines = this.buildPathToLineMapping(formattedString);

        // 初始化所有行为'same'
        for (let i = 0; i < lines.length; i++) {
            diffLines.push({ type: 'same', lineNumber: i + 1 });
        }

        // 根据差异标记对应的行
        for (const diff of differences) {
            const targetPath = side === 'left' ? diff.leftPath : diff.rightPath;

            // 如果该侧没有对应的路径（比如左侧删除，右侧为null），跳过
            if (!targetPath) continue;

            // 获取该路径对应的行范围
            const lineRanges = this.findLinesForPath(pathToLines, targetPath, diff.type);

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
        const stack = [{ path: '', lineStart: 0 }];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 跳过空行
            if (!line) continue;

            // 数组元素开始: "{"
            if (line === '{') {
                // 查找这是数组的第几个元素
                const arrayIndex = this.findArrayIndexAtLine(lines, i);
                if (arrayIndex !== null) {
                    const currentPath = `[${arrayIndex}]`;
                    if (!mapping[currentPath]) mapping[currentPath] = [];
                    // 记录数组元素的起始行
                    stack.push({ path: currentPath, lineStart: i, lineEnd: null });
                }
            }

            // 数组元素结束: "}," 或 "}"
            if (line === '},' || line === '}') {
                if (stack.length > 1) {
                    const item = stack.pop();
                    item.lineEnd = i;
                    // 将整个元素的行范围加入映射
                    if (!mapping[item.path]) mapping[item.path] = [];
                    for (let j = item.lineStart; j <= item.lineEnd; j++) {
                        mapping[item.path].push(j);
                    }
                }
            }

            // 记录具体字段的行号: "key": value
            const keyMatch = line.match(/^"([^"]+)"\s*:/);
            if (keyMatch && stack.length > 1) {
                const key = keyMatch[1];
                const currentElement = stack[stack.length - 1];
                const fieldPath = `${currentElement.path}.${key}`;
                if (!mapping[fieldPath]) mapping[fieldPath] = [];
                mapping[fieldPath].push(i);
            }
        }

        return mapping;
    }

    /**
     * 查找当前行所在的数组索引
     */
    findArrayIndexAtLine(lines, lineIndex) {
        let arrayIndex = -1;
        let braceDepth = 0;

        for (let i = 0; i <= lineIndex; i++) {
            const line = lines[i].trim();
            if (line === '[') {
                arrayIndex = 0;
                continue;
            }
            if (line === '{') {
                if (braceDepth === 0 && i > 0) {
                    // 检查前一个非空行
                    for (let j = i - 1; j >= 0; j--) {
                        const prevLine = lines[j].trim();
                        if (prevLine === '[' || prevLine === ',') {
                            if (prevLine === ',') arrayIndex++;
                            break;
                        }
                    }
                }
                braceDepth++;
            }
            if (line === '},' || line === '}') {
                braceDepth--;
                if (braceDepth === 0 && line === '},') {
                    arrayIndex++;
                }
            }
        }

        return arrayIndex >= 0 ? arrayIndex : null;
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
        const container = textarea.parentElement;
        const existing = container.querySelector('.highlight-layer');
        if (existing) existing.remove();

        const highlightLayer = document.createElement('div');
        highlightLayer.className = 'highlight-layer';
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'highlight-content';
        contentContainer.style.position = 'absolute';
        contentContainer.style.top = '0';
        contentContainer.style.left = '0';
        contentContainer.style.width = '100%';
        contentContainer.style.willChange = 'transform';
        
        let html = '';
        const lineHeight = 22; 
        const paddingTop = 10; 

        diffLines.forEach((diffLine, index) => {
            if (diffLine.type !== 'same') {
                const className = `highlight-${diffLine.type}`;
                const top = paddingTop + (index * lineHeight);
                html += `<div class="highlight-line ${className}" style="top: ${top}px;"></div>`;
            }
        });

        contentContainer.innerHTML = html;
        highlightLayer.appendChild(contentContainer);

        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        container.appendChild(highlightLayer);
        
        // Initial sync
        contentContainer.style.transform = `translateY(-${textarea.scrollTop}px)`;

        const scrollHandler = () => {
            contentContainer.style.transform = `translateY(-${textarea.scrollTop}px)`;
        };
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

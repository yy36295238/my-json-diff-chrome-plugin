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
        if (beautifyLeftBtn) beautifyLeftBtn.addEventListener('click', () => this.beautifySide('left'));
        if (beautifyRightBtn) beautifyRightBtn.addEventListener('click', () => this.beautifySide('right'));

        const loadDemoBtn = document.getElementById('loadDemoBtn');
        if (loadDemoBtn) loadDemoBtn.addEventListener('click', () => this.loadDemoData());

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
            const pretty = JSON.stringify(JSON.parse(raw), null, 2);
            area.value = pretty;
            this.updateLineNumbers(side, area, document.getElementById(`${id}Lines`));
            this.app.layout.updateStatus(`${side === 'left' ? '左侧' : '右侧'}已美化`);
        } catch (e) {
            this.app.layout.showError('美化失败', e.message);
        }
    }

    compareJSON(options = {}) {
        const { silent = false } = options;
        const leftText = document.getElementById('leftJson').value;
        const rightText = document.getElementById('rightJson').value;

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
                    leftObj = JSON.parse(leftText);
                    leftFormatted = JSON.stringify(leftObj, null, 2);
                } catch (e) {
                    throw new Error(`左侧 JSON 错误: ${e.message}`);
                }
            }
            if (rightText.trim()) {
                try {
                    rightObj = JSON.parse(rightText);
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
            const max = Math.max(left.length, right.length);
            for (let i = 0; i < max; i++) {
                const currPath = path ? `${path}[${i}]` : `[${i}]`;
                if (i >= left.length) differences.push({ path: currPath, type: 'added', leftValue: undefined, rightValue: right[i] });
                else if (i >= right.length) differences.push({ path: currPath, type: 'removed', leftValue: left[i], rightValue: undefined });
                else differences.push(...this.calculateStructuralDiff(left[i], right[i], currPath));
            }
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

    updateDiffHighlights(differences, leftFormatted, rightFormatted) {
        const leftLines = this.getDiffLineData(leftFormatted, differences, 'left');
        const rightLines = this.getDiffLineData(rightFormatted, differences, 'right');
        this.updateCompareDisplay('leftJson', leftLines);
        this.updateCompareDisplay('rightJson', rightLines);
    }

    getDiffLineData(formattedString, differences, side) {
        const lines = formattedString.split('\n');
        const diffLines = [];
        for (let i = 0; i < lines.length; i++) {
            const type = this.analyzeDiffForLine(lines[i], differences, side);
            diffLines.push({ type, lineNumber: i + 1 });
        }
        return diffLines;
    }

    analyzeDiffForLine(line, differences, side) {
        for (const diff of differences) {
            if (diff.type === 'added' && side === 'right') {
                if (this.lineMatchesDiff(line, diff, 'right')) return 'added';
            } else if (diff.type === 'removed' && side === 'left') {
                if (this.lineMatchesDiff(line, diff, 'left')) return 'removed';
            } else if (diff.type === 'modified') {
                if (this.lineMatchesDiff(line, diff, side)) return 'modified';
            }
        }
        return 'same';
    }

    lineMatchesDiff(line, diff, side) {
        const pathParts = diff.path.split('.');
        // Fix: Correctly escape backslashes for regex string
        const lastKey = pathParts[pathParts.length - 1].replace(/[\[\]\d+]/g, '');
        
        // Simple includes check first
        if (line.includes(`"${lastKey}"`)) return true;
        
        const value = side === 'left' ? diff.leftValue : diff.rightValue;
        if (value === undefined) return side === 'left' ? diff.type === 'removed' : diff.type === 'added';
        
        if (typeof value === 'string') {
            if (line.includes(`"${value}"`)) return true;
            if (line.includes(JSON.stringify(value))) return true;
            const keyPattern = `"${lastKey}"\\s*:\\s*`;
            if (new RegExp(keyPattern).test(line)) return true;
            
            return false;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            return line.includes(String(value));
        } else if (value === null) {
            return line.includes('null');
        }
        return true;
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
        const lineHeight = 21; 
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

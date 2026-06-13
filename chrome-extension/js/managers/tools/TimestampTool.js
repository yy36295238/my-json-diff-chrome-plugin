/**
 * 时间戳转换工具
 */
export class TimestampTool {
    constructor(app) {
        this.app = app;
        this.toolId = 'timestamp';
    }

    /**
     * 初始化工具
     */
    init() {
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const tsInput = document.getElementById('timestampInput');
        const dateInput = document.getElementById('dateInput');
        const tsToDateBtn = document.getElementById('tsToDateBtn');
        const dateToTsBtn = document.getElementById('dateToTsBtn');
        const useCurrentTimeBtn = document.getElementById('useCurrentTimeBtn');
        const clearTimeBtn = document.getElementById('clearTimeBtn');

        if (tsToDateBtn) {
            tsToDateBtn.addEventListener('click', () => this.convertTsToDate());
        }

        if (dateToTsBtn) {
            dateToTsBtn.addEventListener('click', () => this.convertDateToTs());
        }

        if (useCurrentTimeBtn) {
            useCurrentTimeBtn.addEventListener('click', () => {
                const now = new Date();
                if (tsInput) tsInput.value = now.getTime();
                if (dateInput) dateInput.value = this.formatDate(now);
                this.showResult(`当前时间: ${this.formatDate(now)} / ${now.getTime()}`);
            });
        }

        if (clearTimeBtn) {
            clearTimeBtn.addEventListener('click', () => {
                if (tsInput) tsInput.value = '';
                if (dateInput) dateInput.value = '';
                this.hideResult();
            });
        }

        // 结果元素点击即复制
        const resultText = document.getElementById('timeResultText');
        if (resultText) {
            resultText.style.cursor = 'pointer';
            resultText.title = '点击复制';
            resultText.addEventListener('click', async () => {
                const text = resultText.textContent;
                if (!text) return;
                try {
                    await navigator.clipboard.writeText(text);
                    this.app.layout.showToast('已复制到剪贴板', 'success');
                } catch (e) {
                    this.app.layout.showError('复制失败: ' + e.message);
                }
            });
        }
    }

    /**
     * 时间戳转日期
     */
    convertTsToDate() {
        const tsInput = document.getElementById('timestampInput');
        const dateInput = document.getElementById('dateInput');

        if (!tsInput || !tsInput.value.trim()) {
            this.app.layout.showError('请输入时间戳');
            return;
        }

        const raw = tsInput.value.trim();
        const num = Number(raw);

        if (raw === '' || !Number.isFinite(num)) {
            this.app.layout.showError('无效的时间戳格式');
            return;
        }

        // 按数值量级自动检测单位（支持负时间戳，即1970年之前）
        const abs = Math.abs(num);
        let ms;
        let unit;
        if (abs < 1e11) {
            // 秒级时间戳
            ms = num * 1000;
            unit = '秒';
        } else if (abs < 1e14) {
            // 毫秒级时间戳
            ms = num;
            unit = '毫秒';
        } else if (abs < 1e17) {
            // 微秒级时间戳，除以1000转为毫秒
            ms = Math.round(num / 1000);
            unit = '微秒';
        } else {
            this.app.layout.showError('时间戳数值过大，无法识别单位');
            return;
        }

        const date = new Date(ms);
        if (isNaN(date.getTime())) {
            this.app.layout.showError('无效的时间戳');
            return;
        }

        const formatted = this.formatDate(date);
        const utcFormatted = this.formatUTCDate(date);
        if (dateInput) dateInput.value = formatted;
        this.showResult(`识别单位: ${unit}\n本地时间: ${formatted}\nUTC时间: ${utcFormatted}`);
    }

    /**
     * 日期转时间戳
     */
    convertDateToTs() {
        const dateInput = document.getElementById('dateInput');
        const tsInput = document.getElementById('timestampInput');

        if (!dateInput || !dateInput.value.trim()) {
            this.app.layout.showError('请输入日期时间');
            return;
        }

        const dateStr = dateInput.value.trim();
        const date = new Date(dateStr);

        if (date.toString() === 'Invalid Date') {
            this.app.layout.showError('无效的日期格式 (推荐: YYYY-MM-DD HH:mm:ss)');
            return;
        }

        const ts = date.getTime();
        if (tsInput) tsInput.value = ts;
        this.showResult(`时间戳(毫秒): ${ts}\n时间戳(秒): ${Math.floor(ts / 1000)}\nUTC时间: ${this.formatUTCDate(date)}`);
    }

    /**
     * 格式化日期
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * 格式化UTC日期
     */
    formatUTCDate(date) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * 显示结果
     */
    showResult(text) {
        const panel = document.getElementById('timeResultPanel');
        const p = document.getElementById('timeResultText');
        if (panel && p) {
            p.textContent = text;
            // 支持多行结果展示
            p.style.whiteSpace = 'pre-line';
            panel.style.display = 'block';
        }
    }

    /**
     * 隐藏结果
     */
    hideResult() {
        const panel = document.getElementById('timeResultPanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    /**
     * 销毁工具
     */
    destroy() {
        // 清理事件监听器（如果需要）
    }
}

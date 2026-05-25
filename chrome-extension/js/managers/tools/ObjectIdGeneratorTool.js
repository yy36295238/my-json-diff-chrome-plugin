/**
 * BSON ObjectId 生成工具
 * 生成标准 MongoDB ObjectId（24位十六进制字符串）
 */
export class ObjectIdGeneratorTool {
    constructor(app) {
        this.app = app;
        this.toolId = 'objectid';
        this.maxCount = 1000;
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
        const generateBtn = document.getElementById('generateObjectIdBtn');
        const clearBtn = document.getElementById('clearObjectIdBtn');
        const copyBtn = document.getElementById('copyObjectIdBtn');
        const countInput = document.getElementById('objectIdCount');

        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generate());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clear());
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyAll());
        }

        if (countInput) {
            // 回车键生成
            countInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.generate();
                }
            });
        }
    }

    /**
     * 生成 ObjectId
     */
    generate() {
        const countInput = document.getElementById('objectIdCount');
        const output = document.getElementById('objectIdOutput');
        const stats = document.getElementById('objectIdStats');

        if (!countInput) return;

        let count = parseInt(countInput.value, 10);

        // 验证输入
        if (isNaN(count) || count < 1) {
            this.app.layout.showError('请输入有效的数量（最小1）');
            return;
        }

        // 限制最大数量
        if (count > this.maxCount) {
            count = this.maxCount;
            countInput.value = this.maxCount;
            this.app.layout.showToast(`数量已限制为最大 ${this.maxCount} 个`);
        }

        try {
            const objectIds = [];
            for (let i = 0; i < count; i++) {
                objectIds.push(this.generateObjectId());
            }

            if (output) {
                output.value = objectIds.join('\n');
            }

            if (stats) {
                stats.textContent = `已生成 ${count} 个 ObjectId`;
            }

            this.app.layout.showToast(`成功生成 ${count} 个 ObjectId`);
        } catch (error) {
            this.app.layout.showError('生成失败: ' + error.message);
        }
    }

    /**
     * 生成单个 MongoDB ObjectId
     * 标准格式：4字节时间戳 + 3字节机器标识 + 2字节进程ID + 3字节计数器
     */
    generateObjectId() {
        const timestamp = Math.floor(Date.now() / 1000);
        const timestampHex = timestamp.toString(16).padStart(8, '0');

        // 生成随机部分（机器标识 + 进程ID + 计数器）
        const randomBytes = new Uint8Array(8);
        crypto.getRandomValues(randomBytes);

        let randomHex = '';
        for (let i = 0; i < randomBytes.length; i++) {
            randomHex += randomBytes[i].toString(16).padStart(2, '0');
        }

        return (timestampHex + randomHex).toLowerCase();
    }

    /**
     * 清空输入和结果
     */
    clear() {
        const countInput = document.getElementById('objectIdCount');
        const output = document.getElementById('objectIdOutput');
        const stats = document.getElementById('objectIdStats');

        if (countInput) countInput.value = '1';
        if (output) output.value = '';
        if (stats) stats.textContent = '';
    }

    /**
     * 复制全部结果
     */
    copyAll() {
        const output = document.getElementById('objectIdOutput');

        if (!output || !output.value.trim()) {
            this.app.layout.showError('没有可复制的内容');
            return;
        }

        navigator.clipboard.writeText(output.value).then(() => {
            this.app.layout.showToast('已复制到剪贴板');
        }).catch(() => {
            this.app.layout.showError('复制失败');
        });
    }

    /**
     * 销毁工具
     */
    destroy() {
        // 清理事件监听器（如果需要）
    }
}
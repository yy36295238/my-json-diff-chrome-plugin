/**
 * URL 编解码工具
 * 解码: urlInput(URL编码) → urlOutput(文本)
 * 编码: urlOutput(文本) → urlInput(URL编码)
 * 基于底层 encodeURIComponent / decodeURIComponent，按 UTF-8 处理
 */
export class UrlCodecTool {
    constructor(app) {
        this.app = app;
        this.toolId = 'url';
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
        const decodeBtn = document.getElementById('urlDecodeBtn');
        const encodeBtn = document.getElementById('urlEncodeBtn');
        const clearBtn = document.getElementById('clearUrlBtn');
        const copyBtn = document.getElementById('copyUrlOutput');
        const swapBtn = document.getElementById('swapUrlIO');

        if (decodeBtn) decodeBtn.addEventListener('click', () => this.urlDecode());
        if (encodeBtn) encodeBtn.addEventListener('click', () => this.urlEncode());

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const input = document.getElementById('urlInput');
                const output = document.getElementById('urlOutput');
                if (input) input.value = '';
                if (output) output.value = '';
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const output = document.getElementById('urlOutput');
                if (output && output.value) {
                    try {
                        await navigator.clipboard.writeText(output.value);
                        this.app.layout.showToast('已复制到剪贴板', 'success');
                    } catch (e) {
                        this.app.layout.showError('复制失败: ' + e.message);
                    }
                } else {
                    this.app.layout.showError('没有可复制的内容');
                }
            });
        }

        if (swapBtn) {
            swapBtn.addEventListener('click', () => {
                const input = document.getElementById('urlInput');
                const output = document.getElementById('urlOutput');
                if (input && output) {
                    const temp = input.value;
                    input.value = output.value;
                    output.value = temp;
                }
            });
        }
    }

    /**
     * URL 解码: urlInput → urlOutput
     */
    urlDecode() {
        const input = document.getElementById('urlInput');
        const output = document.getElementById('urlOutput');

        if (!input || !input.value.trim()) {
            this.app.layout.showError('请在上方输入框输入 URL 编码文本');
            return;
        }

        try {
            // 兼容表单编码：+ 代表空格
            const text = input.value.replace(/\+/g, ' ');
            const decoded = decodeURIComponent(text);
            if (output) {
                output.value = decoded;
                this.app.layout.showToast('解码成功', 'success');
            }
        } catch (error) {
            // decodeURIComponent 遇到非法 %xx 转义会抛 URIError
            this.app.layout.showError('解码失败：包含非法的 % 转义序列');
        }
    }

    /**
     * URL 编码: urlOutput → urlInput
     */
    urlEncode() {
        const input = document.getElementById('urlInput');
        const output = document.getElementById('urlOutput');

        if (!output || !output.value.trim()) {
            this.app.layout.showError('请在下方文本框输入要编码的文本');
            return;
        }

        try {
            const encoded = encodeURIComponent(output.value);
            if (input) {
                input.value = encoded;
                this.app.layout.showToast('编码成功', 'success');
            }
        } catch (error) {
            this.app.layout.showError('编码失败: ' + error.message);
        }
    }

    /**
     * 销毁工具
     */
    destroy() {
        // 清理事件监听器（如果需要）
    }
}

/**
 * Base64 加解码工具
 * 解码: b64Input(Base64) → b64Output(文本)
 * 编码: b64Output(文本) → b64Input(Base64)
 */
export class Base64Tool {
    constructor(app) {
        this.app = app;
        this.toolId = 'base64';
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
        const decodeBtn = document.getElementById('b64DecodeBtn');
        const encodeBtn = document.getElementById('b64EncodeBtn');
        const clearBtn = document.getElementById('clearB64Btn');
        const copyBtn = document.getElementById('copyB64Output');
        const swapBtn = document.getElementById('swapB64IO');
        const formatBtn = document.getElementById('formatB64Output');

        if (decodeBtn) {
            decodeBtn.addEventListener('click', () => this.base64Decode());
        }

        if (encodeBtn) {
            encodeBtn.addEventListener('click', () => this.base64Encode());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const input = document.getElementById('b64Input');
                const output = document.getElementById('b64Output');
                if (input) input.value = '';
                if (output) output.value = '';
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const output = document.getElementById('b64Output');
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
                const input = document.getElementById('b64Input');
                const output = document.getElementById('b64Output');
                if (input && output) {
                    const temp = input.value;
                    input.value = output.value;
                    output.value = temp;
                }
            });
        }

        if (formatBtn) {
            formatBtn.addEventListener('click', () => this.formatOutput());
        }
    }

    /**
     * Base64 解码: b64Input(Base64) → b64Output(文本)
     */
    base64Decode() {
        const input = document.getElementById('b64Input');
        const output = document.getElementById('b64Output');
        const charset = document.getElementById('b64Charset');

        if (!input || !input.value.trim()) {
            this.app.layout.showError('请在上方输入框输入 Base64 文本');
            return;
        }

        try {
            // 去除空白字符，并兼容 URL-safe Base64（-_ → +/）
            let b64Str = input.value.replace(/[\s]/g, '');
            b64Str = b64Str.replace(/-/g, '+').replace(/_/g, '/');

            // 校验是否为合法的 Base64 字符
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64Str)) {
                this.app.layout.showError('输入包含非 Base64 字符');
                return;
            }

            // 补齐缺失的 = 填充，避免 atob 报错
            const remainder = b64Str.length % 4;
            if (remainder === 1) {
                this.app.layout.showError('Base64 长度非法');
                return;
            }
            if (remainder > 0) {
                b64Str += '='.repeat(4 - remainder);
            }

            // atob 得到的是二进制字符串（每个字符为一个字节），转成字节数组后按指定编码解码
            const binary = atob(b64Str);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const charsetValue = charset ? charset.value : 'utf-8';
            const { text: decoded, usedCharset } = this.decodeBytes(bytes, charsetValue);

            if (output) {
                output.value = decoded;
                // 实际编码与所选编码不一致时（自动回退），额外提示用户
                if (usedCharset !== charsetValue) {
                    this.app.layout.showToast(`检测到非${charsetValue.toUpperCase()}内容，已用${usedCharset.toUpperCase()}解码`, 'warning');
                }
                this.app.layout.showToast(`解码成功 (${bytes.length}字节 → ${decoded.length}字符)`, 'success');
            }
        } catch (error) {
            this.app.layout.showError('解码失败: ' + error.message);
        }
    }

    /**
     * 按指定编码将字节解码为文本，带智能回退
     * 选 UTF-8 时若字节非合法 UTF-8（常见于后端用 GBK 编码的中文），自动回退到 GBK，
     * 避免出现乱码；GBK 也失败则退回 UTF-8 尽力解码（容错模式）
     * @returns {{text: string, usedCharset: string}} 解码结果及实际使用的编码
     */
    decodeBytes(bytes, charsetValue) {
        // 非 UTF-8（用户明确指定其它编码）：直接按该编码容错解码
        if (charsetValue !== 'utf-8') {
            try {
                return { text: new TextDecoder(charsetValue).decode(bytes), usedCharset: charsetValue };
            } catch (e) {
                // 不支持的编码退回 UTF-8
                return { text: new TextDecoder('utf-8').decode(bytes), usedCharset: 'utf-8' };
            }
        }

        // UTF-8：先用严格模式校验，非法则回退 GBK
        try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            return { text, usedCharset: 'utf-8' };
        } catch (e) {
            try {
                const text = new TextDecoder('gbk', { fatal: true }).decode(bytes);
                return { text, usedCharset: 'gbk' };
            } catch (e2) {
                // GBK 也非法（可能是二进制数据），UTF-8 容错模式尽力解码
                return { text: new TextDecoder('utf-8').decode(bytes), usedCharset: 'utf-8' };
            }
        }
    }

    /**
     * 文本编码为 Base64: b64Output(文本) → b64Input(Base64)
     * 注意：编码仅支持 UTF-8（TextEncoder 限制）
     */
    base64Encode() {
        const input = document.getElementById('b64Input');
        const output = document.getElementById('b64Output');
        const charset = document.getElementById('b64Charset');

        if (!output || !output.value.trim()) {
            this.app.layout.showError('请在下方文本框输入要编码的文本');
            return;
        }

        try {
            const charsetValue = charset ? charset.value : 'utf-8';
            if (charsetValue !== 'utf-8') {
                this.app.layout.showToast('编码功能仅支持UTF-8，已按UTF-8编码', 'warning');
            }

            const text = output.value;
            const bytes = new TextEncoder().encode(text);

            // 字节数组转二进制字符串再用 btoa 编码，避免中文等多字节字符乱码
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const b64Str = btoa(binary);

            if (input) {
                input.value = b64Str;
                this.app.layout.showToast(`编码成功 (${text.length}字符 → ${bytes.length}字节)`, 'success');
            }
        } catch (error) {
            this.app.layout.showError('编码失败: ' + error.message);
        }
    }

    /**
     * 格式化输出结果（JSON/XML）
     */
    formatOutput() {
        const output = document.getElementById('b64Output');

        if (!output || !output.value.trim()) {
            this.app.layout.showError('没有可格式化的内容');
            return;
        }

        try {
            const content = output.value.trim();

            if (content.startsWith('{') || content.startsWith('[')) {
                try {
                    const parsed = JSON.parse(content);
                    output.value = JSON.stringify(parsed, null, 2);
                    this.app.layout.showToast('JSON格式化成功', 'success');
                    return;
                } catch (e) {
                    // 不是有效的 JSON，继续尝试 XML
                }
            }

            if (content.startsWith('<?xml') || content.startsWith('<')) {
                try {
                    output.value = this.formatXML(content);
                    this.app.layout.showToast('XML格式化成功', 'success');
                    return;
                } catch (e) {
                    this.app.layout.showError('XML格式化失败: ' + e.message);
                    return;
                }
            }

            this.app.layout.showError('无法识别内容格式（仅支持JSON和XML）');
        } catch (error) {
            this.app.layout.showError('格式化失败: ' + error.message);
        }
    }

    /**
     * 格式化XML字符串
     */
    formatXML(xml) {
        const PADDING = '  ';
        const reg = /(>)(<)(\/*)/g;
        let pad = 0;

        xml = xml.replace(reg, '$1\n$2$3');

        return xml.split('\n').map((node) => {
            let indent = 0;
            if (node.match(/.+<\/\w[^>]*>$/)) {
                indent = 0;
            } else if (node.match(/^<\/\w/) && pad > 0) {
                pad -= 1;
            } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                indent = 1;
            } else {
                indent = 0;
            }

            pad += indent;

            return PADDING.repeat(pad - indent) + node;
        }).join('\n');
    }

    /**
     * 销毁工具
     */
    destroy() {
        // 清理事件监听器（如果需要）
    }
}

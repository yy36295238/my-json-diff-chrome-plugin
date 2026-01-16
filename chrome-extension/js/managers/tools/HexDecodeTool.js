/**
 * 16进制编解码工具
 */
export class HexDecodeTool {
    constructor(app) {
        this.app = app;
        this.toolId = 'hexdecode';
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
        const hexDecodeBtn = document.getElementById('hexDecodeBtn');
        const hexEncodeBtn = document.getElementById('hexEncodeBtn');
        const clearHexBtn = document.getElementById('clearHexBtn');
        const copyHexOutput = document.getElementById('copyHexOutput');
        const swapHexIO = document.getElementById('swapHexIO');
        const formatHexOutput = document.getElementById('formatHexOutput');

        if (hexDecodeBtn) {
            hexDecodeBtn.addEventListener('click', () => this.hexDecode());
        }

        if (hexEncodeBtn) {
            hexEncodeBtn.addEventListener('click', () => this.hexEncode());
        }

        if (clearHexBtn) {
            clearHexBtn.addEventListener('click', () => {
                const hexInput = document.getElementById('hexInput');
                const hexOutput = document.getElementById('hexOutput');
                if (hexInput) hexInput.value = '';
                if (hexOutput) hexOutput.value = '';
            });
        }

        if (copyHexOutput) {
            copyHexOutput.addEventListener('click', () => {
                const hexOutput = document.getElementById('hexOutput');
                if (hexOutput && hexOutput.value) {
                    navigator.clipboard.writeText(hexOutput.value).then(() => {
                        this.app.layout.showToast('已复制到剪贴板');
                    }).catch(() => {
                        this.app.layout.showError('复制失败');
                    });
                } else {
                    this.app.layout.showError('没有可复制的内容');
                }
            });
        }

        if (swapHexIO) {
            swapHexIO.addEventListener('click', () => {
                const hexInput = document.getElementById('hexInput');
                const hexOutput = document.getElementById('hexOutput');
                if (hexInput && hexOutput) {
                    const temp = hexInput.value;
                    hexInput.value = hexOutput.value;
                    hexOutput.value = temp;
                }
            });
        }

        if (formatHexOutput) {
            formatHexOutput.addEventListener('click', () => this.formatHexOutput());
        }
    }

    /**
     * 16进制解码
     */
    hexDecode() {
        const hexInput = document.getElementById('hexInput');
        const hexOutput = document.getElementById('hexOutput');
        const charset = document.getElementById('hexCharset');

        if (!hexInput || !hexInput.value.trim()) {
            this.app.layout.showError('请输入16进制文本');
            return;
        }

        try {
            let hexStr = hexInput.value.trim();

            // 移除常见的分隔符和前缀
            // 1. 移除0x或\x前缀
            hexStr = hexStr.replace(/0x|\\x/gi, '');
            // 2. 移除所有空格、换行、制表符、逗号
            hexStr = hexStr.replace(/[\s,]/g, '');

            // 验证是否为有效的16进制字符串
            if (!/^[0-9a-fA-F]+$/.test(hexStr)) {
                this.app.layout.showError('输入包含非16进制字符');
                return;
            }

            // 确保长度为偶数
            if (hexStr.length % 2 !== 0) {
                this.app.layout.showError('16进制字符串长度必须为偶数');
                return;
            }

            // 将16进制转换为字节数组
            const bytes = [];
            for (let i = 0; i < hexStr.length; i += 2) {
                bytes.push(parseInt(hexStr.substr(i, 2), 16));
            }

            // 使用TextDecoder解码
            const charsetValue = charset ? charset.value : 'utf-8';
            let decoder;

            try {
                decoder = new TextDecoder(charsetValue);
            } catch (e) {
                // 如果不支持该编码，回退到UTF-8
                this.app.layout.showToast(`不支持${charsetValue}编码，使用UTF-8`);
                decoder = new TextDecoder('utf-8');
            }

            const uint8Array = new Uint8Array(bytes);
            const decoded = decoder.decode(uint8Array);

            if (hexOutput) {
                hexOutput.value = decoded;

                // 统计信息
                const byteCount = bytes.length;
                const charCount = decoded.length;
                this.app.layout.showToast(`解码成功 (${byteCount}字节 → ${charCount}字符)`);
            }
        } catch (error) {
            this.app.layout.showError('解码失败: ' + error.message);
        }
    }

    /**
     * 文本编码为16进制
     */
    hexEncode() {
        const hexInput = document.getElementById('hexInput');
        const hexOutput = document.getElementById('hexOutput');
        const charset = document.getElementById('hexCharset');

        if (!hexOutput || !hexOutput.value.trim()) {
            this.app.layout.showError('请在结果区域输入要编码的文本');
            return;
        }

        try {
            const text = hexOutput.value;
            const charsetValue = charset ? charset.value : 'utf-8';

            let encoder;
            try {
                encoder = new TextEncoder();
                // TextEncoder只支持UTF-8
                if (charsetValue !== 'utf-8') {
                    this.app.layout.showError('编码功能仅支持UTF-8');
                }
            } catch (e) {
                this.app.layout.showError('编码器初始化失败');
                return;
            }

            // 将文本编码为字节数组
            const bytes = encoder.encode(text);

            // 将字节数组转换为16进制字符串
            let hexStr = '';
            for (let i = 0; i < bytes.length; i++) {
                const hex = bytes[i].toString(16).padStart(2, '0').toUpperCase();
                hexStr += hex;
                // 每两个字节添加一个空格，便于阅读
                if ((i + 1) % 2 === 0 && i < bytes.length - 1) {
                    hexStr += ' ';
                }
            }

            if (hexInput) {
                hexInput.value = hexStr;
                this.app.layout.showToast('编码成功');
            }
        } catch (error) {
            this.app.layout.showError('编码失败: ' + error.message);
        }
    }

    /**
     * 格式化输出结果（JSON/XML）
     */
    formatHexOutput() {
        const hexOutput = document.getElementById('hexOutput');

        if (!hexOutput || !hexOutput.value.trim()) {
            this.app.layout.showError('没有可格式化的内容');
            return;
        }

        try {
            const content = hexOutput.value.trim();

            // 尝试检测内容类型并格式化
            if (content.startsWith('{') || content.startsWith('[')) {
                // 可能是JSON
                try {
                    const parsed = JSON.parse(content);
                    hexOutput.value = JSON.stringify(parsed, null, 2);
                    this.app.layout.showToast('JSON格式化成功');
                    return;
                } catch (e) {
                    // 不是有效的JSON，继续尝试XML
                }
            }

            if (content.startsWith('<?xml') || content.startsWith('<')) {
                // 可能是XML
                try {
                    const formatted = this.formatXML(content);
                    hexOutput.value = formatted;
                    this.app.layout.showToast('XML格式化成功');
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
        const PADDING = '  '; // 缩进字符
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

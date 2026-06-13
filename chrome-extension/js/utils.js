export const Utils = {
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // 转义 key 以便嵌入 JSONPath 单引号字符串 $['...']：
    // 先转义反斜杠再转义单引号，保证与 getValueByPath 的解析互逆
    escapePath(path) {
        return path.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0B';
        const negative = bytes < 0;
        const abs = Math.abs(bytes);
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        // 钳制单位下标：小于 1 字节时停在 B，超过最大单位时停在最后一个
        const i = Math.min(Math.max(Math.floor(Math.log(abs) / Math.log(k)), 0), sizes.length - 1);
        return (negative ? '-' : '') + parseFloat((abs / Math.pow(k, i)).toFixed(2)) + sizes[i];
    },

    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    singularize(str) {
        if (str.endsWith('s') && str.length > 1) {
            return str.slice(0, -1);
        }
        return str;
    },

    deepParseJSON(obj) {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) return obj.map(item => this.deepParseJSON(item));
        if (typeof obj === 'object') {
            const result = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    result[key] = this.deepParseJSON(obj[key]);
                }
            }
            return result;
        }
        if (typeof obj === 'string') {
            const trimmed = obj.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    const parsed = JSON.parse(obj);
                    return this.deepParseJSON(parsed);
                } catch (e) {
                    return obj;
                }
            }
        }
        return obj;
    },

    getValueByPath(obj, path) {
        if (!obj || !path) return undefined;
        if (path === '$') return obj;

        // Strip leading $ if present
        if (path.startsWith('$')) {
            path = path.slice(1);
        }

        // Regex to match segments: .key OR ['key'] OR ["key"] OR [index]
        // 单引号段支持 \' 与 \\ 转义（与 escapePath 配套）
        const segments = [];
        const regex = /\.([a-zA-Z_$][a-zA-Z0-9_$]*)|\['((?:\\.|[^'\\])*)'\]|\["([^"]*)"\]|\[(\d+)\]/g;

        let match;
        while ((match = regex.exec(path)) !== null) {
            if (match[1]) {
                segments.push(match[1]); // .key
            } else if (match[2] !== undefined) {
                segments.push(match[2].replace(/\\(.)/g, '$1')); // ['key']，还原转义
            } else if (match[3] !== undefined) {
                segments.push(match[3]); // ["key"]
            } else if (match[4]) {
                segments.push(parseInt(match[4], 10)); // [index]
            }
        }

        let current = obj;
        for (const segment of segments) {
            if (current === null || current === undefined) return undefined;
            current = current[segment];
        }
        return current;
    },

    sortDeep(obj) {
        if (Array.isArray(obj)) {
            // 先一次性为每个元素算好序列化 key 再排序（decorate-sort-undecorate），
            // 避免比较器中重复执行 O(n log n) 次完整序列化
            const decorated = obj.map(item => {
                const sorted = this.sortDeep(item);
                return { sorted, key: JSON.stringify(sorted) ?? '' };
            });
            decorated.sort((a, b) => a.key.localeCompare(b.key));
            return decorated.map(d => d.sorted);
        } else if (typeof obj === 'object' && obj !== null) {
            const sortedObj = {};
            Object.keys(obj).sort().forEach(key => {
                sortedObj[key] = this.sortDeep(obj[key]);
            });
            return sortedObj;
        }
        return obj;
    }
};
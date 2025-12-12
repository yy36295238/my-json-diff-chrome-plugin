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

    escapePath(path) {
        return path.replace(/'/g, "'\'");
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
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

        // Regex to match segments: .key OR ['key'] OR [index]
        const segments = [];
        const regex = /\.([a-zA-Z_$][a-zA-Z0-9_$]*)|\[(?:'([^']*)'|"([^"]*)")\]|\[(\d+)\]/g;
        
        let match;
        while ((match = regex.exec(path)) !== null) {
            if (match[1]) {
                segments.push(match[1]); // .key
            } else if (match[2]) {
                segments.push(match[2]); // ['key']
            } else if (match[3]) {
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
            // Deep sort items first
            const sortedItems = obj.map(item => this.sortDeep(item));
            // Then sort the array itself based on string representation
            return sortedItems.sort((a, b) => {
                return JSON.stringify(a).localeCompare(JSON.stringify(b));
            });
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
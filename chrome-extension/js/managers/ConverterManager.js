import { Utils } from '../utils.js';

export class ConverterManager {
    constructor(app) {
        this.app = app;
    }

    init() {
        const formatBtn = document.getElementById('converterFormatInput');
        if (formatBtn) formatBtn.addEventListener('click', () => this.formatInput());

        const convertBtn = document.getElementById('convertBtn');
        if (convertBtn) convertBtn.addEventListener('click', () => this.convertData());

        const copyBtn = document.getElementById('copyConverterOutput');
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyOutput());

        const modeSelect = document.getElementById('converterMode');
        if (modeSelect) modeSelect.addEventListener('change', (e) => this.handleModeChange(e.target.value));
    }

    formatInput() {
        const input = document.getElementById('converterInput');
        try {
            const val = input.value.trim();
            if (!val) return;
            const parsed = JSON.parse(val);
            input.value = JSON.stringify(parsed, null, 2);
        } catch (e) {
            this.app.layout.showError('格式化失败', '非有效 JSON');
        }
    }

    handleModeChange(mode) {
        const javaOpts = document.getElementById('javaOptions');
        const sqlOpts = document.getElementById('sqlOptions');
        const inputTitle = document.getElementById('converterInputTitle');
        const outputTitle = document.getElementById('converterOutputTitle');

        if (mode === 'json2java') {
            javaOpts.style.display = 'block';
            sqlOpts.style.display = 'none';
            inputTitle.textContent = '输入 (JSON)';
            outputTitle.textContent = '输出 (Java)';
        } else if (mode === 'json2sql') {
            javaOpts.style.display = 'none';
            sqlOpts.style.display = 'block';
            inputTitle.textContent = '输入 (JSON Array)';
            outputTitle.textContent = '输出 (SQL Insert)';
        } else if (mode === 'sql2json') {
            javaOpts.style.display = 'none';
            sqlOpts.style.display = 'none';
            inputTitle.textContent = '输入 (SQL Insert)';
            outputTitle.textContent = '输出 (JSON)';
        }
    }

    convertData() {
        const mode = document.getElementById('converterMode').value;
        const input = document.getElementById('converterInput').value.trim();
        const outputArea = document.getElementById('converterOutput');

        if (!input) {
            this.app.layout.updateStatus('请输入内容');
            return;
        }

        try {
            let result = '';
            if (mode === 'json2java') {
                const className = document.getElementById('javaClassName').value || 'RootObject';
                const json = JSON.parse(input);
                result = this.jsonToJava(json, className);
            } else if (mode === 'json2sql') {
                const tableName = document.getElementById('sqlTableName').value || 'table_name';
                const json = JSON.parse(input);
                result = this.jsonToSql(json, tableName);
            } else if (mode === 'sql2json') {
                result = this.sqlToJson(input);
            }
            outputArea.value = result;
            this.app.layout.updateStatus('转换成功');
        } catch (e) {
            this.app.layout.showError('转换失败', e.message);
        }
    }

    jsonToJava(json, rootClassName) {
        const classes = [];
        
        if (Array.isArray(json)) {
            if (json.length > 0) this.generateRecursive(rootClassName, json[0], classes);
            else return '// 空数组';
        } else {
            this.generateRecursive(rootClassName, json, classes);
        }

        return `import lombok.Data;\nimport java.util.List;\n\n` + classes.reverse().join('\n');
    }

    generateRecursive(name, obj, classList) {
        const className = Utils.capitalize(name);
        let content = `@Data\npublic class ${className} {\n`;
        
        // Check if obj is valid object
        if (!obj || typeof obj !== 'object') {
             classList.push(`@Data\npublic class ${className} {}\n`);
             return;
        }

        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
            
            const val = obj[key];
            let type = 'Object';
            
            if (val === null) {
                type = 'Object';
            } else if (typeof val === 'object' && !Array.isArray(val)) {
                const nName = Utils.capitalize(key);
                this.generateRecursive(nName, val, classList);
                type = nName;
            } else if (Array.isArray(val)) {
                if (val.length > 0) {
                    const itemVal = val[0];
                    if (typeof itemVal === 'object' && itemVal !== null && !Array.isArray(itemVal)) {
                        const iName = Utils.capitalize(Utils.singularize(key));
                        this.generateRecursive(iName, itemVal, classList);
                        type = `List<${iName}>`;
                    } else {
                        type = this.getJavaType(key, val, []);
                    }
                } else {
                    type = 'List<Object>';
                }
            } else {
                type = this.getJavaType(key, val, []);
            }
            content += `    private ${type} ${key};\n`;
        }
        content += `}\n`;
        classList.push(content);
    }

    getJavaType(key, val, classList) {
        if (val === null) return 'Object';
        const type = typeof val;
        if (type === 'string') return 'String';
        if (type === 'number') {
            return Number.isInteger(val) ? (val > 2147483647 ? 'Long' : 'Integer') : 'Double';
        }
        if (type === 'boolean') return 'Boolean';
        
        if (Array.isArray(val)) {
            if (val.length === 0) return 'List<Object>';
            // For primitive arrays or arrays handled here
            const firstItem = val[0];
            if (typeof firstItem !== 'object' || firstItem === null) {
                 const itemType = this.getJavaType(Utils.singularize(key), firstItem, classList);
                 return `List<${itemType}>`;
            }
            // Objects in arrays should have been handled in generateRecursive, 
            // but if we reach here, fallback to Object or recurse if structure allows
            return 'List<Object>'; 
        }
        
        return 'Object';
    }

    jsonToSql(json, tableName) {
        const data = Array.isArray(json) ? json : [json];
        if (data.length === 0) return '';
        const keys = new Set();
        data.forEach(item => Object.keys(item || {}).forEach(k => keys.add(k)));
        const cols = Array.from(keys);
        if (cols.length === 0) return '';

        let sql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES\n`;
        const vals = data.map(item => {
            const row = cols.map(col => {
                const val = item[col];
                if (val === null || val === undefined) return 'NULL';
                if (typeof val === 'number') return val;
                if (typeof val === 'boolean') return val ? 1 : 0;
                return `'${String(val).replace(/'/g, "''")}'`;
            });
            return `(${row.join(', ')})`;
        });
        return sql + vals.join(',\n') + ';';
    }

    sqlToJson(sql) {
        // 简单的正则解析，仅支持标准的 INSERT INTO table (cols) VALUES (vals)
        // 提取列名
        const colMatch = sql.match(/INSERT\s+INTO\s+\S+\s*\((.*?)\)/i);
        if (!colMatch) throw new Error('无法解析列名，请确保格式为 INSERT INTO table (col1, col2) ...');
        
        const columns = colMatch[1].split(',').map(s => s.trim().replace(/^['"`]|['"`]$/g, ''));
        
        // 提取 VALUES 后面的内容
        const valuesPartMatch = sql.match(/VALUES\s*([\s\S]*);?/i);
        if (!valuesPartMatch) throw new Error('无法找到 VALUES 部分');
        
        const valuesPart = valuesPartMatch[1].trim();
        
        // 粗略分割每一行数据：寻找匹配的括号 ()
        // 这是一个简化的解析器，不支持嵌套括号或复杂字符串内的括号
        const rows = [];
        let current = '';
        let inQuote = false;
        let depth = 0;
        
        for (let i = 0; i < valuesPart.length; i++) {
            const char = valuesPart[i];
            if (char === "'" && (i === 0 || valuesPart[i-1] !== '\\')) {
                inQuote = !inQuote;
            }
            
            if (!inQuote) {
                if (char === '(') {
                    if (depth === 0) current = ''; // 开始新的一行
                    depth++;
                } else if (char === ')') {
                    depth--;
                    if (depth === 0) {
                        // 结束一行
                        current += char;
                        rows.push(current);
                        current = '';
                        continue; 
                    }
                } else if (char === ',' && depth === 0) {
                    continue; // 行之间的逗号
                }
            }
            if (depth > 0) current += char;
        }

        const result = rows.map(rowStr => {
            // 去掉首尾括号
            const content = rowStr.slice(1, -1);
            // 分割值
            // 这里同样需要简单的状态机来处理带逗号的字符串
            const vals = [];
            let valBuffer = '';
            let vInQuote = false;
            for (let j = 0; j < content.length; j++) {
                const c = content[j];
                if (c === "'") vInQuote = !vInQuote;
                if (c === ',' && !vInQuote) {
                    vals.push(valBuffer.trim());
                    valBuffer = '';
                } else {
                    valBuffer += c;
                }
            }
            vals.push(valBuffer.trim());

            const obj = {};
            columns.forEach((col, idx) => {
                let rawVal = vals[idx];
                let val = null;
                if (!rawVal || rawVal.toUpperCase() === 'NULL') {
                    val = null;
                } else if (rawVal.startsWith("'") && rawVal.endsWith("'")) {
                    val = rawVal.slice(1, -1).replace(/''/g, "'"); // 处理转义的单引号
                } else if (!isNaN(rawVal)) {
                    val = Number(rawVal);
                } else {
                    val = rawVal;
                }
                obj[col] = val;
            });
            return obj;
        });

        return JSON.stringify(result, null, 2);
    }

    copyOutput() {
        const output = document.getElementById('converterOutput');
        if (output && output.value) {
            output.select();
            document.execCommand('copy');
            this.app.layout.updateStatus('已复制');
        }
    }
}

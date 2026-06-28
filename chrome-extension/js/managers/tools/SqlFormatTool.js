/**
 * SQL 格式化工具
 * 纯前端实现，无第三方依赖。基于分词器处理字符串/注释/标识符，按子句换行缩进。
 * 支持 MySQL（反引号标识符、# 注释）、PostgreSQL（双引号标识符、$$ 块）及标准 SQL。
 */
export class SqlFormatTool {
    constructor(app) {
        this.app = app;
        this.toolId = 'sql-format';
        this.INDENT = '  '; // 缩进单位（两空格）
        this.initKeywords();
    }

    /**
     * 初始化各类关键字集合
     */
    initKeywords() {
        // 多词关键字：合并成单 token，便于布局与统一大写（长的优先匹配）
        this.multiWord = [
            'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN',
            'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'OUTER JOIN',
            'GROUP BY', 'ORDER BY', 'UNION ALL', 'INSERT INTO', 'DELETE FROM',
            'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'PRIMARY KEY', 'FOREIGN KEY',
            'ON DELETE', 'ON UPDATE'
        ].sort((a, b) => b.split(' ').length - a.split(' ').length);

        // 顶级子句：另起一行回到当前块基准缩进，其后内容缩进 +1
        this.topLevel = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'VALUES', 'SET', 'RETURNING', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'WITH']);
        // 集合运算：独占一行
        this.unionLike = new Set(['UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT', 'MINUS']);
        // 换行关键字：在当前子句缩进处另起一行
        this.newlineKw = new Set(['AND', 'OR', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'OUTER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'ON']);
        // '(' 前需要空格的关键字（区别于函数调用紧贴括号）
        this.spaceBeforeParen = new Set(['IN', 'EXISTS', 'VALUES', 'ALL', 'ANY', 'SOME', 'BETWEEN', 'AND', 'OR', 'NOT', 'ON', 'OVER', 'USING']);
        // 保留字：美化时统一大写
        this.reserved = new Set([
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'ILIKE', 'BETWEEN', 'EXISTS', 'ANY', 'ALL', 'SOME',
            'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON', 'USING',
            'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'EXCEPT', 'INTERSECT', 'MINUS', 'DISTINCT', 'AS', 'ASC', 'DESC',
            'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'ADD', 'COLUMN', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA',
            'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'CONSTRAINT', 'UNIQUE', 'CHECK', 'AUTO_INCREMENT', 'SERIAL',
            'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'COALESCE', 'NULLIF', 'WITH', 'RETURNING', 'OVER', 'PARTITION', 'ROW_NUMBER',
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'TRUE', 'FALSE', 'IF', 'EXPLAIN', 'ANALYZE',
            'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'BOOLEAN', 'BOOL', 'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'ENUM', 'JSON', 'BLOB',
            // MySQL 常用关键字
            'COMMENT', 'UNSIGNED', 'ZEROFILL', 'ENGINE', 'CHARSET', 'COLLATE', 'CURRENT_TIMESTAMP', 'MODIFY', 'CHANGE', 'FIRST', 'AFTER', 'USING', 'BTREE', 'HASH', 'INTERVAL', 'NOW', 'DATE_SUB', 'DATE_ADD'
        ]);
    }

    /**
     * 初始化：绑定事件
     */
    init() {
        this.initSamples();
        this.populateSamples();
        this.bindEvents();
    }

    /**
     * 内置常用 SQL 示例（故意保留紧凑/凌乱排版，便于演示格式化效果）
     */
    initSamples() {
        // 统一以 MySQL 方言为例，DDL 字段均带 COMMENT 注释
        this.samples = [
            { label: '查询 - 多表 JOIN', sql: "select u.id,u.name,o.amount from users u left join orders o on u.id=o.user_id where u.status='active' and o.amount>100 order by o.amount desc limit 20;" },
            { label: '查询 - 子查询/分组', sql: "select dept_id,count(*) as cnt,avg(salary) as avg_sal from employees where dept_id in (select id from departments where active=1) group by dept_id having count(*)>5 order by cnt desc;" },
            { label: '新增 - INSERT', sql: "insert into users(name,email,age,created_at) values('张三','zhangsan@test.com',25,now()),('李四','lisi@test.com',30,now());" },
            { label: '修改 - UPDATE', sql: "update users set status='inactive',updated_at=now() where last_login<'2024-01-01' and status='active';" },
            { label: '删除 - DELETE', sql: "delete from logs where created_at<date_sub(now(),interval 30 day) and level='debug';" },
            { label: '创建表 - CREATE TABLE', sql: "create table orders(id bigint unsigned not null auto_increment comment '主键ID',user_id bigint unsigned not null comment '用户ID',amount decimal(10,2) not null default 0.00 comment '订单金额',status varchar(20) not null default 'pending' comment '订单状态:pending/paid/cancelled',created_at timestamp not null default current_timestamp comment '创建时间',primary key(id),key idx_user_id(user_id)) engine=innodb default charset=utf8mb4 comment='订单表';" },
            { label: '添加字段 - ADD COLUMN', sql: "alter table users add column phone varchar(20) not null default '' comment '手机号' after email,add column gender tinyint not null default 0 comment '性别:0未知1男2女';" },
            { label: '修改字段 - MODIFY COLUMN', sql: "alter table users modify column name varchar(100) not null comment '用户名',change column phone mobile varchar(20) not null default '' comment '手机号';" },
            { label: '删除字段 - DROP COLUMN', sql: "alter table users drop column gender,drop column mobile;" },
            { label: '添加索引 - ADD INDEX', sql: "alter table users add index idx_status_created(status,created_at),add unique index uk_email(email) comment '邮箱唯一索引';" }
        ];
    }

    /**
     * 将示例填充到下拉框
     */
    populateSamples() {
        const select = document.getElementById('sqlSample');
        if (!select) return;
        // 首项为占位提示
        select.innerHTML = '<option value="">选择示例SQL...</option>';
        this.samples.forEach((s, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            opt.textContent = s.label;
            select.appendChild(opt);
        });
    }

    /**
     * 绑定 UI 事件
     */
    bindEvents() {
        const formatBtn = document.getElementById('formatSqlBtn');
        const compressBtn = document.getElementById('compressSqlBtn');
        const clearBtn = document.getElementById('clearSqlBtn');
        const copyBtn = document.getElementById('copySqlBtn');
        const sampleSelect = document.getElementById('sqlSample');

        if (formatBtn) formatBtn.addEventListener('click', () => this.run('format'));
        if (compressBtn) compressBtn.addEventListener('click', () => this.run('compress'));

        if (sampleSelect) {
            sampleSelect.addEventListener('change', (e) => {
                const idx = e.target.value;
                if (idx === '') return;
                const sample = this.samples[Number(idx)];
                const input = document.getElementById('sqlInput');
                if (sample && input) input.value = sample.sql;
                // 重置为占位项，便于再次选择同一示例
                e.target.value = '';
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const input = document.getElementById('sqlInput');
                if (input) input.value = '';
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const input = document.getElementById('sqlInput');
                if (input && input.value) {
                    try {
                        await navigator.clipboard.writeText(input.value);
                        this.app.layout.showToast('已复制到剪贴板', 'success');
                    } catch (e) {
                        this.app.layout.showError('复制失败: ' + e.message);
                    }
                } else {
                    this.app.layout.showError('没有可复制的内容');
                }
            });
        }
    }

    /**
     * 执行格式化 / 压缩（结果原地写回同一输入框）
     */
    run(mode) {
        const input = document.getElementById('sqlInput');

        if (!input || !input.value.trim()) {
            this.app.layout.showError('请输入要处理的 SQL');
            return;
        }

        try {
            input.value = mode === 'compress' ? this.compress(input.value) : this.format(input.value);
            this.app.layout.showToast(mode === 'compress' ? '压缩成功' : '格式化成功', 'success');
        } catch (error) {
            this.app.layout.showError((mode === 'compress' ? '压缩' : '格式化') + '失败: ' + error.message);
        }
    }

    /**
     * 分词器：将 SQL 拆分为带类型的 token（自动适配多方言，无需指定数据库）
     * 同时识别：'' 字符串、反引号/双引号标识符、$$/$tag$ 块、$n 占位符、
     * -- 与 # 行注释、块注释、-> ->> #> #>> 等运算符
     */
    tokenize(sql) {
        const tokens = [];
        const n = sql.length;
        let i = 0;
        const ops3 = ['->>', '#>>'];                                    // 三字符运算符（长的优先）
        const ops2 = ['->', '#>', '>=', '<=', '<>', '!=', '||', '::', ':=']; // 双字符运算符
        while (i < n) {
            const ch = sql[i];

            if (/\s/.test(ch)) {
                let j = i + 1; while (j < n && /\s/.test(sql[j])) j++;
                tokens.push({ type: 'ws', value: sql.slice(i, j) }); i = j; continue;
            }
            // -- 行注释
            if (ch === '-' && sql[i + 1] === '-') {
                let j = i + 1; while (j < n && sql[j] !== '\n') j++;
                tokens.push({ type: 'line_comment', value: sql.slice(i, j) }); i = j; continue;
            }
            // 块注释 /* */
            if (ch === '/' && sql[i + 1] === '*') {
                let j = i + 2; while (j < n && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
                j = Math.min(n, j + 2);
                tokens.push({ type: 'block_comment', value: sql.slice(i, j) }); i = j; continue;
            }
            // 字符串字面量 '...'（支持 '' 与 \' 转义）
            if (ch === "'") {
                let j = i + 1;
                while (j < n) {
                    if (sql[j] === '\\') { j += 2; continue; }
                    if (sql[j] === "'") { if (sql[j + 1] === "'") { j += 2; continue; } j++; break; }
                    j++;
                }
                tokens.push({ type: 'string', value: sql.slice(i, j) }); i = j; continue;
            }
            // 美元符：$$/$tag$ 块字符串 或 $n 占位符（PostgreSQL）
            if (ch === '$') {
                const tagMatch = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
                if (tagMatch) {
                    const tag = tagMatch[0];
                    const end = sql.indexOf(tag, i + tag.length);
                    const j = end === -1 ? n : end + tag.length;
                    tokens.push({ type: 'string', value: sql.slice(i, j) }); i = j; continue;
                }
                const paramMatch = sql.slice(i).match(/^\$[0-9]+/);
                if (paramMatch) {
                    tokens.push({ type: 'ident', value: paramMatch[0] }); i += paramMatch[0].length; continue;
                }
            }
            // 反引号标识符
            if (ch === '`') {
                let j = i + 1; while (j < n && sql[j] !== '`') j++; j = Math.min(n, j + 1);
                tokens.push({ type: 'ident', value: sql.slice(i, j) }); i = j; continue;
            }
            // 标准/PG 双引号标识符
            if (ch === '"') {
                let j = i + 1;
                while (j < n) { if (sql[j] === '"') { if (sql[j + 1] === '"') { j += 2; continue; } j++; break; } j++; }
                tokens.push({ type: 'ident', value: sql.slice(i, j) }); i = j; continue;
            }
            // 数字
            if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
                const m = sql.slice(i).match(/^(0[xX][0-9a-fA-F]+|[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?)/);
                const v = m ? m[0] : ch;
                tokens.push({ type: 'number', value: v }); i += v.length; continue;
            }
            // 标识符 / 关键字
            if (/[A-Za-z_-￿]/.test(ch)) {
                let j = i + 1; while (j < n && /[A-Za-z0-9_$-￿]/.test(sql[j])) j++;
                tokens.push({ type: 'word', value: sql.slice(i, j) }); i = j; continue;
            }
            // 多字符运算符（含 JSON 运算符，需在 # 行注释之前判断）
            const three = sql.substr(i, 3);
            if (ops3.includes(three)) { tokens.push({ type: 'op', value: three }); i += 3; continue; }
            const two = sql.substr(i, 2);
            if (ops2.includes(two)) { tokens.push({ type: 'op', value: two }); i += 2; continue; }
            // # 行注释（MySQL；JSON 运算符 #> #>> 已在上面消费）
            if (ch === '#') {
                let j = i + 1; while (j < n && sql[j] !== '\n') j++;
                tokens.push({ type: 'line_comment', value: sql.slice(i, j) }); i = j; continue;
            }
            // 单字符标点 / 运算符
            const type = ch === '(' ? 'open' : ch === ')' ? 'close' : ch === ',' ? 'comma' : ch === ';' ? 'semicolon' : 'op';
            tokens.push({ type, value: ch }); i++;
        }
        return tokens;
    }

    /**
     * 合并多词关键字为单 token（canon 为规范大写形式）
     */
    mergeKeywords(tokens) {
        const res = [];
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.type !== 'word') { res.push(t); continue; }
            let matched = null;
            for (const mw of this.multiWord) {
                const parts = mw.split(' ');
                let ok = true;
                for (let k = 0; k < parts.length; k++) {
                    const tk = tokens[i + k];
                    if (!tk || tk.type !== 'word' || tk.value.toUpperCase() !== parts[k]) { ok = false; break; }
                }
                if (ok) { matched = mw; i += parts.length - 1; break; }
            }
            if (matched) res.push({ type: 'word', value: matched, canon: matched });
            else res.push(t);
        }
        return res;
    }

    /**
     * 判断 '(' 是否为子查询起始（其后第一个有效 token 是 SELECT/WITH）
     */
    isSubqueryOpen(toks, idx) {
        for (let j = idx + 1; j < toks.length; j++) {
            const t = toks[j];
            if (t.type === 'block_comment' || t.type === 'line_comment') continue;
            const u = t.type === 'word' ? (t.canon || t.value.toUpperCase()) : null;
            return u === 'SELECT' || u === 'WITH';
        }
        return false;
    }

    /**
     * 判断 cur 前是否需要空格
     */
    needSpace(prev, cur, compact) {
        if (!prev) return false;
        if (cur.type === 'comma' || cur.type === 'semicolon' || cur.type === 'close') return false;
        if (cur.value === '.' || prev.value === '.') return false;
        if (cur.value === '::' || prev.value === '::') return false;
        if (prev.type === 'open') return false;
        // '(' 前：函数调用紧贴，关键字后留空格
        if (cur.type === 'open') {
            if (compact) return false;
            if (prev.type === 'word') {
                const pu = prev.canon || prev.value.toUpperCase();
                return this.spaceBeforeParen.has(pu);
            }
            return !(prev.type === 'ident' || prev.type === 'number' || prev.type === 'close');
        }
        // 逗号后：美化留空格，压缩不留
        if (prev.type === 'comma') return !compact;
        return true;
    }

    /**
     * 美化 SQL
     */
    format(sql) {
        const toks = this.mergeKeywords(this.tokenize(sql).filter(t => t.type !== 'ws'));
        const I = this.INDENT;
        let out = '';
        let blockIndent = 0;          // 当前块基准缩进
        let lineIndent = 0;           // 当前行缩进层级（用于括号闭合对齐）
        const parenStack = [];        // {type:'block'|'inline', closeIndent, prevBlock}
        let pending = null;           // 待执行的换行缩进层级
        let prev = null;
        let expectTableDef = false;   // 是否处于 CREATE TABLE 后等待列定义括号

        const trimTail = () => { out = out.replace(/[ \t]+$/, ''); };
        const nl = (lvl) => { lvl = Math.max(0, lvl); lineIndent = lvl; trimTail(); out += '\n' + I.repeat(lvl); };
        const clause = () => blockIndent + 1;

        const disp = (t) => {
            if (t.type === 'word') {
                if (t.canon) return t.canon;
                if (this.reserved.has(t.value.toUpperCase())) return t.value.toUpperCase();
            }
            return t.value;
        };

        for (let idx = 0; idx < toks.length; idx++) {
            const t = toks[idx];
            const U = t.type === 'word' ? (t.canon || t.value.toUpperCase()) : null;

            if (t.type === 'semicolon') {
                trimTail(); out += ';'; blockIndent = 0; parenStack.length = 0; pending = null; nl(0); prev = t; continue;
            }
            if (t.type === 'line_comment') {
                if (pending !== null) nl(pending);
                else if (out && !/\n[ \t]*$/.test(out)) out += ' ';
                out += t.value; pending = clause(); prev = t; continue;
            }
            if (t.type === 'block_comment') {
                if (pending !== null) { nl(pending); pending = null; }
                else if (this.needSpace(prev, t, false)) out += ' ';
                out += t.value; prev = t; continue;
            }
            if (U && this.topLevel.has(U)) { expectTableDef = (U === 'CREATE TABLE'); nl(blockIndent); out += disp(t); pending = clause(); prev = t; continue; }
            if (U && this.unionLike.has(U)) { expectTableDef = false; nl(blockIndent); out += disp(t); pending = null; prev = t; continue; }
            if (U && this.newlineKw.has(U)) { nl(clause()); out += disp(t); pending = null; prev = t; continue; }

            if (t.type === 'open') {
                if (pending !== null) { nl(pending); pending = null; }
                else if (expectTableDef && prev && !/\s$/.test(out)) out += ' '; // 列定义括号前留空格
                else if (this.needSpace(prev, t, false)) out += ' ';
                out += '(';
                if (expectTableDef) {
                    // CREATE TABLE 列定义块：每个列定义独占一行
                    expectTableDef = false;
                    parenStack.push({ type: 'block', isDef: true, closeIndent: lineIndent, prevBlock: blockIndent });
                    blockIndent = lineIndent + 1;
                    pending = blockIndent; // 首列换行
                } else if (this.isSubqueryOpen(toks, idx)) {
                    // 子查询：闭合括号对齐到 '(' 所在行，内部内容再缩进一层
                    parenStack.push({ type: 'block', closeIndent: lineIndent, prevBlock: blockIndent });
                    blockIndent = lineIndent + 1;
                } else {
                    parenStack.push({ type: 'inline' });
                }
                prev = t; continue;
            }
            if (t.type === 'close') {
                const frame = parenStack.pop() || { type: 'inline' };
                if (frame.type === 'block') { blockIndent = frame.prevBlock; nl(frame.closeIndent); out += ')'; }
                else { out += ')'; }
                pending = null; prev = t; continue;
            }
            if (t.type === 'comma') {
                trimTail(); out += ',';
                const top = parenStack[parenStack.length - 1];
                if (top && top.type === 'inline') pending = null;       // 函数参数：保持同行
                else if (top && top.isDef) pending = blockIndent;        // 列定义：对齐到块基准
                else pending = clause();                                 // SELECT 列表等：子句缩进
                prev = t; continue;
            }

            // 普通内容 token
            if (pending !== null) { nl(pending); pending = null; }
            else if (this.needSpace(prev, t, false)) out += ' ';
            out += disp(t);
            prev = t;
        }

        return out.replace(/^\n+/, '').replace(/[ \t\n]+$/, '').replace(/\n{3,}/g, '\n\n');
    }

    /**
     * 压缩 SQL：去除多余空白与换行，合并为单行
     * 注意：行注释会注释掉同行后续内容，压缩时移除
     */
    compress(sql) {
        const toks = this.tokenize(sql);
        let out = '';
        let prev = null;
        for (const t of toks) {
            if (t.type === 'ws' || t.type === 'line_comment') continue;
            if (this.needSpace(prev, t, true)) out += ' ';
            out += t.value;
            prev = t;
        }
        return out.trim();
    }

    /**
     * 销毁工具
     */
    destroy() {
        // 清理事件监听器（如果需要）
    }
}

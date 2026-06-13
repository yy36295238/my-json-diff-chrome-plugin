import { Utils } from '../utils.js';

/**
 * 便签卡片管理器 (Canvas Mode)
 * 自由画布便利贴：Pointer Events 拖拽/缩放（带边缘自动滚动）、钉住置顶、
 * 颜色筛选、搜索免重建过滤、导入导出备份、跨页签互通（存为便签/发送到格式化）
 */
export class NotesManager {
    constructor(app) {
        this.app = app;
        this.notes = [];
        this.STORAGE_KEY = 'json-tool-notes';

        // 拖拽/缩放统一状态：null 表示空闲。集中存放可避免 isDragging/isResizing 两个布尔位互相打架
        this.dragState = null;
        this.autoScrollRaf = null;
        // 指针距画布视口边缘多少像素时触发自动滚动，以及每帧滚动速度
        this.EDGE_SCROLL_THRESHOLD = 30;
        this.EDGE_SCROLL_SPEED = 14;

        this.zIndexCounter = 100;
        // 钉住的卡片统一加这个偏移，保证永远压在普通卡片（zIndexCounter 量级）之上
        this.PIN_Z_BOOST = 100000;

        // Spawn position tracking
        this.lastSpawnX = 50;
        this.lastSpawnY = 50;

        // Undo State
        this.deletedNotesStack = [];
        this.undoCountdownTimer = null;
        this.undoDeadline = 0;
        this.UNDO_WINDOW_MS = 15000;

        this.saveDebounceTimer = null;
        this.SAVE_DEBOUNCE_MS = 400;
        // 防抖期间被编辑过的便签 id，落盘时统一刷新页脚相对时间，避免每次键击都操作 DOM
        this.pendingFooterIds = new Set();

        this.searchDebounceTimer = null;
        this.SEARCH_DEBOUNCE_MS = 200;
        // 卡片最小尺寸：头部一排有 8 个操作按钮（约 220px）+ 拖柄 + 标题，
        // 宽度低于此值按钮会溢出卡片，缩放/导入/老数据迁移统一用这两个常量钳制
        this.MIN_NOTE_WIDTH = 330;
        this.MIN_NOTE_HEIGHT = 150;
        // 颜色筛选：null 表示不过滤；与文本搜索是 AND 关系
        this.colorFilter = null;

        // 复用单个 TextEncoder 计算字节数，替代每次键击 new Blob 的高开销做法
        this.textEncoder = new TextEncoder();
        this.relativeFmt = null;

        // 配色方案：使用低饱和现代色板，避免大面积高亮色影响阅读。
        this.COLORS = [
            '#FDE68A', // 麦穗黄
            '#FED7AA', // 暖杏橙
            '#FECACA', // 柔雾红
            '#FBCFE8', // 淡玫粉
            '#DDD6FE', // 云雾紫
            '#BFDBFE', // 湖水蓝
            '#A7F3D0', // 清透绿
            '#CBD5E1'  // 石板灰
        ];
        this.lastColorIndex = 0; // 轮询颜色索引
    }

    // ===== 基础工具 =====

    getByteSize(str) {
        return this.textEncoder.encode(str || '').length;
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 时间戳 + 随机后缀，避免快速连建/批量导入时 Date.now() 撞车
    createNoteId() {
        return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    pad2(n) {
        return String(n).padStart(2, '0');
    }

    // 短时间戳用于自动生成的便签标题，如 "格式化 06-13 14:30"
    formatShortTime(date) {
        return `${this.pad2(date.getMonth() + 1)}-${this.pad2(date.getDate())} ${this.pad2(date.getHours())}:${this.pad2(date.getMinutes())}`;
    }

    formatFullTime(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '未知';
        return date.toLocaleString('zh-CN', { hour12: false });
    }

    // 相对时间展示：7 天内用 Intl.RelativeTimeFormat，更久直接给日期（相对值反而难读）
    formatRelativeTime(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        const diffMs = Math.max(0, Date.now() - date.getTime());
        const DAY = 86400000;
        if (diffMs > 7 * DAY) {
            return `${date.getFullYear()}-${this.pad2(date.getMonth() + 1)}-${this.pad2(date.getDate())}`;
        }
        if (!this.relativeFmt) {
            this.relativeFmt = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });
        }
        const sec = Math.round(diffMs / 1000);
        let label;
        if (sec < 60) {
            label = '刚刚';
        } else if (sec < 3600) {
            label = this.relativeFmt.format(-Math.floor(sec / 60), 'minute');
        } else if (sec < 86400) {
            label = this.relativeFmt.format(-Math.floor(sec / 3600), 'hour');
        } else {
            label = this.relativeFmt.format(-Math.floor(sec / 86400), 'day');
        }
        return `${label}更新`;
    }

    footerTimeTitle(note) {
        return `创建：${this.formatFullTime(note.created)}\n更新：${this.formatFullTime(note.updatedAt)}`;
    }

    // 内容/标题被编辑时统一刷新更新时间，updated 字段保留以兼容旧版本数据
    touchNote(note) {
        note.updatedAt = new Date().toISOString();
        note.updated = note.updatedAt;
    }

    effectiveZIndex(note) {
        return (note.zIndex || 10) + (note.pinned ? this.PIN_Z_BOOST : 0);
    }

    init() {
        this.loadNotes();
        this.bindEvents();
        this.renderColorFilterBar();
        this.render();
    }

    bindEvents() {
        const addNoteBtn = document.getElementById('addNoteBtn');
        const clearNotesBtn = document.getElementById('clearNotesBtn');
        const searchNotes = document.getElementById('searchNotes');
        const arrangeNotesBtn = document.getElementById('arrangeNotesBtn');
        const undoNotesBtn = document.getElementById('undoNotesBtn');
        const exportNotesBtn = document.getElementById('exportNotesBtn');
        const importNotesBtn = document.getElementById('importNotesBtn');
        const importNotesInput = document.getElementById('importNotesInput');
        const canvas = document.getElementById('notesCanvas');

        if (addNoteBtn) {
            addNoteBtn.addEventListener('click', () => this.addNote());
        }

        if (clearNotesBtn) {
            clearNotesBtn.addEventListener('click', async () => {
                const confirmed = await this.app.layout.confirm({
                    title: '清空便签',
                    message: '确定要清空所有便签吗？清空后可在 15 秒内撤回。',
                    confirmText: '清空',
                    danger: true
                });
                if (confirmed) {
                    this.clearAllNotes();
                }
            });
        }

        if (searchNotes) {
            // 搜索 200ms 防抖；过滤只切换显隐不重建 DOM，正在编辑的 textarea 不会丢光标
            searchNotes.addEventListener('input', () => {
                if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = setTimeout(() => {
                    this.searchDebounceTimer = null;
                    this.applyFilters();
                }, this.SEARCH_DEBOUNCE_MS);
            });
        }

        if (arrangeNotesBtn) {
            arrangeNotesBtn.addEventListener('click', () => this.autoArrange());
        }

        if (undoNotesBtn) {
            undoNotesBtn.addEventListener('click', () => this.undoDelete());
        }

        if (exportNotesBtn) {
            exportNotesBtn.addEventListener('click', () => this.exportNotes());
        }

        if (importNotesBtn && importNotesInput) {
            importNotesBtn.addEventListener('click', () => importNotesInput.click());
            importNotesInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) this.importNotesFromFile(file);
                // 清掉 value，允许连续导入同一个文件
                e.target.value = '';
            });
        }

        if (canvas) {
            // 双击画布空白处直接在该位置新建便签；卡片上的双击（如 textarea 选词）要排除
            canvas.addEventListener('dblclick', (e) => {
                if (e.target.closest('.note-card')) return;
                const rect = canvas.getBoundingClientRect();
                const x = Math.max(0, e.clientX - rect.left + canvas.scrollLeft);
                const y = Math.max(0, e.clientY - rect.top + canvas.scrollTop);
                this.addNote({ x, y });
            });
        }

        // 跨页签入口：格式化/对比页的"存为便签"按钮归便签模块管，集中绑定方便维护
        const saveAsNoteBtn = document.getElementById('saveAsNoteBtn');
        if (saveAsNoteBtn) {
            saveAsNoteBtn.addEventListener('click', () => this.saveEditorAsNote('jsonEditor', '格式化'));
        }
        const saveLeftAsNoteBtn = document.getElementById('saveLeftAsNoteBtn');
        if (saveLeftAsNoteBtn) {
            saveLeftAsNoteBtn.addEventListener('click', () => this.saveEditorAsNote('leftJson', '对比-左'));
        }
        const saveRightAsNoteBtn = document.getElementById('saveRightAsNoteBtn');
        if (saveRightAsNoteBtn) {
            saveRightAsNoteBtn.addEventListener('click', () => this.saveEditorAsNote('rightJson', '对比-右'));
        }

        // Pointer Events 替代 mouse 事件：配合 setPointerCapture，
        // 指针拖出窗口外松手也能收到 pointerup，根治"卡片继续跟手"
        document.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        document.addEventListener('pointermove', (e) => this.onPointerMove(e));
        document.addEventListener('pointerup', (e) => this.endPointerInteraction(e));
        document.addEventListener('pointercancel', (e) => this.endPointerInteraction(e));

        window.addEventListener('beforeunload', () => this.flushPendingSave());
    }

    // ===== 颜色筛选工具栏 =====

    renderColorFilterBar() {
        const bar = document.getElementById('notesColorFilter');
        if (!bar) return;
        const dots = this.COLORS.map(color => `
            <button class="notes-filter-dot" data-color="${color}" style="background-color: ${color};" title="只看该颜色便签"></button>
        `).join('');
        bar.innerHTML = `<button class="notes-filter-all active" data-color="" title="显示全部颜色">全部</button>${dots}`;

        bar.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-color]');
            if (!btn) return;
            const color = btn.dataset.color || null;
            // 再点同一个色点视为取消筛选
            this.colorFilter = (color && this.colorFilter !== color) ? color : null;
            this.updateColorFilterBar();
            this.applyFilters();
        });
    }

    updateColorFilterBar() {
        const bar = document.getElementById('notesColorFilter');
        if (!bar) return;
        bar.querySelectorAll('.notes-filter-dot').forEach(dot => {
            dot.classList.toggle('active', dot.dataset.color === this.colorFilter);
        });
        const allBtn = bar.querySelector('.notes-filter-all');
        if (allBtn) allBtn.classList.toggle('active', !this.colorFilter);
    }

    // ===== 持久化 =====

    loadNotes() {
        try {
            // 恢复上次使用的颜色索引
            const savedIndex = localStorage.getItem(this.STORAGE_KEY + '-color-index');
            this.lastColorIndex = savedIndex ? parseInt(savedIndex) : 0;

            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                this.notes = JSON.parse(raw);
                this.notes.forEach((note, index) => {
                    if (!note.title) note.title = '无标题便签';
                    if (note.x === undefined || note.y === undefined) {
                        const col = index % 3;
                        const row = Math.floor(index / 3);
                        note.x = 20 + col * 340;
                        note.y = 20 + row * 320;
                    }
                    // 钳制到最小尺寸：老版本允许缩到 200px，会导致头部按钮溢出
                    note.width = Math.max(this.MIN_NOTE_WIDTH, note.width || 360);
                    note.height = Math.max(this.MIN_NOTE_HEIGHT, note.height || 300);
                    if (!note.zIndex) note.zIndex = 10;
                    // 老数据迁移：没有 updatedAt 的沿用已有时间字段
                    if (!note.updatedAt) {
                        note.updatedAt = note.updated || note.created || new Date().toISOString();
                    }
                    note.pinned = !!note.pinned;

                    // 历史数据颜色升级
                    const isOldColor = !this.COLORS.includes(note.color);
                    if (!note.color || note.color === 'default' || isOldColor) {
                        note.color = this.COLORS[index % this.COLORS.length];
                    }

                    if (note.zIndex > this.zIndexCounter) this.zIndexCounter = note.zIndex;
                });
            }
        } catch (e) {
            console.error('加载便签失败', e);
            this.notes = [];
        }
    }

    saveNotes() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.notes));
            // 保存当前颜色索引
            localStorage.setItem(this.STORAGE_KEY + '-color-index', this.lastColorIndex.toString());
        } catch (e) {
            console.error('保存便签失败', e);
            // 保存失败必须显式告知用户，静默丢数据是最糟的体验
            const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22);
            const message = isQuota
                ? '便签保存失败：存储空间不足，请删除部分便签或导出备份'
                : '便签保存失败：' + (e && e.message ? e.message : '未知错误');
            this.app.layout.showToast(message, 'error');
        }
    }

    // 输入过程中延迟写入 localStorage，避免长内容便签每次按键都触发同步存储卡顿。
    scheduleSaveNotes(noteId = null) {
        if (noteId) this.pendingFooterIds.add(noteId);
        if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
        this.saveDebounceTimer = setTimeout(() => {
            this.saveDebounceTimer = null;
            this.saveNotes();
            // 与保存同节奏刷新被编辑卡片的页脚相对时间
            this.pendingFooterIds.forEach(id => this.refreshNoteFooter(id));
            this.pendingFooterIds.clear();
        }, this.SAVE_DEBOUNCE_MS);
    }

    // 页面关闭前补齐最后一次防抖保存，降低刚输入内容丢失的风险。
    flushPendingSave() {
        if (!this.saveDebounceTimer) return;
        clearTimeout(this.saveDebounceTimer);
        this.saveDebounceTimer = null;
        this.pendingFooterIds.clear();
        this.saveNotes();
    }

    // ===== 新建便签 =====

    isSpawnOccupied(x, y) {
        return this.notes.some(n => Math.abs(n.x - x) <= 10 && Math.abs(n.y - y) <= 10);
    }

    computeSpawnPosition() {
        const canvas = document.getElementById('notesCanvas');
        const scrollX = canvas ? canvas.scrollLeft : 0;
        const scrollY = canvas ? canvas.scrollTop : 0;
        // 便签页隐藏时 clientWidth 为 0（跨页签"存为便签"场景），退回默认视口尺寸
        const containerWidth = (canvas && canvas.clientWidth) ? canvas.clientWidth : 800;
        const containerHeight = (canvas && canvas.clientHeight) ? canvas.clientHeight : 600;

        const baseX = scrollX + 50;
        const baseY = scrollY + 50;
        const OFFSET_STEP = 30;

        if (this.notes.length === 0) {
            this.lastSpawnX = baseX;
            this.lastSpawnY = baseY;
        } else {
            this.lastSpawnX += OFFSET_STEP;
            this.lastSpawnY += OFFSET_STEP;
            if (this.lastSpawnX > baseX + containerWidth - 350 || this.lastSpawnY > baseY + containerHeight - 300) {
                this.lastSpawnX = baseX;
                this.lastSpawnY = baseY;
            }
        }

        if (this.lastSpawnX < baseX) this.lastSpawnX = baseX;
        if (this.lastSpawnY < baseY) this.lastSpawnY = baseY;

        // 防堆叠：±10px 内已有卡片时继续级联偏移；回卷时用错位步长避免与上一轮级联像素级重叠
        let attempts = 0;
        while (this.isSpawnOccupied(this.lastSpawnX, this.lastSpawnY) && attempts < 50) {
            attempts++;
            this.lastSpawnX += OFFSET_STEP;
            this.lastSpawnY += OFFSET_STEP;
            if (this.lastSpawnX > baseX + containerWidth - 350 || this.lastSpawnY > baseY + containerHeight - 300) {
                this.lastSpawnX = baseX + (attempts * 17) % 120;
                this.lastSpawnY = baseY + (attempts * 11) % 90;
            }
        }

        return { x: this.lastSpawnX, y: this.lastSpawnY };
    }

    /**
     * 统一的便签创建入口：addNote（工具栏/双击）和跨页签"存为便签"共用，
     * 后者不抢焦点、不滚动（用户还停留在原页签）
     */
    insertNote({ title = '无标题便签', content = '', x = null, y = null, focus = false } = {}) {
        this.lastColorIndex = (this.lastColorIndex + 1) % this.COLORS.length;

        let spawnX = x;
        let spawnY = y;
        if (spawnX === null || spawnY === null) {
            const pos = this.computeSpawnPosition();
            spawnX = pos.x;
            spawnY = pos.y;
        }

        const now = new Date().toISOString();
        const newNote = {
            id: this.createNoteId(),
            title,
            content,
            color: this.COLORS[this.lastColorIndex],
            created: now,
            updated: now,
            updatedAt: now,
            pinned: false,
            x: Math.max(0, spawnX),
            y: Math.max(0, spawnY),
            width: 360,
            height: 300,
            zIndex: ++this.zIndexCounter
        };

        this.notes.push(newNote);
        this.saveNotes();
        this.render();

        if (focus) {
            const cardEl = document.querySelector(`.note-card[data-id="${newNote.id}"]`);
            if (cardEl) {
                cardEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
                // 短暂高亮让用户立刻定位到新卡片
                cardEl.classList.add('note-card-flash');
                setTimeout(() => cardEl.classList.remove('note-card-flash'), 1000);
                const textarea = cardEl.querySelector('textarea');
                if (textarea) setTimeout(() => textarea.focus(), 100);
            }
        }
        return newNote;
    }

    addNote(pos = null) {
        // 搜索/颜色筛选激活时先恢复全量视图，否则新卡片可能被过滤条件直接隐藏
        const searchInput = document.getElementById('searchNotes');
        if (searchInput && searchInput.value) {
            searchInput.value = '';
            if (this.searchDebounceTimer) {
                clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = null;
            }
        }
        if (this.colorFilter) {
            this.colorFilter = null;
            this.updateColorFilterBar();
        }
        this.insertNote({ x: pos ? pos.x : null, y: pos ? pos.y : null, focus: true });
    }

    // 跨页签"存为便签"：把指定编辑器内容保存为新便签，不切换页签
    saveEditorAsNote(editorId, titlePrefix) {
        const editorEl = document.getElementById(editorId);
        if (!editorEl) return;
        const content = editorEl.value || '';
        if (!content.trim()) {
            this.app.layout.showToast('内容为空，无法存为便签', 'warning');
            return;
        }
        this.insertNote({
            title: `${titlePrefix} ${this.formatShortTime(new Date())}`,
            content,
            focus: false
        });
        this.app.layout.showToast('已存为便签', 'success');
    }

    // ===== 内容更新 =====

    updateNoteContent(id, content) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.content = content;
            this.touchNote(note);
            this.scheduleSaveNotes(id);
            this.updateNoteStats(id, content);
        }
    }

    updateNoteStats(id, content) {
        const card = document.querySelector(`.note-card[data-id="${id}"]`);
        if (!card) return;
        const statsEl = card.querySelector('.note-stats');
        if (statsEl) {
            statsEl.textContent = `Len: ${content.length} | Size: ${this.formatSize(this.getByteSize(content))}`;
        }
        this.updateJsonDot(card, content);
    }

    // JSON 有效性圆点：只对疑似 JSON 的内容（{ 或 [ 开头）做校验提示，普通文本不打扰
    updateJsonDot(card, content) {
        const dot = card.querySelector('.note-json-dot');
        if (!dot) return;
        const trimmed = (content || '').trim();
        if (!trimmed || !(trimmed.startsWith('{') || trimmed.startsWith('['))) {
            dot.className = 'note-json-dot';
            dot.title = '';
            return;
        }
        let valid = false;
        try {
            JSON.parse(trimmed);
            valid = true;
        } catch (e) { /* 非法 JSON 走红点提示 */ }
        dot.className = 'note-json-dot ' + (valid ? 'valid' : 'invalid');
        dot.title = valid ? 'JSON 有效' : 'JSON 无效';
    }

    refreshNoteFooter(id) {
        const note = this.notes.find(n => n.id === id);
        const card = document.querySelector(`.note-card[data-id="${id}"]`);
        if (!note || !card) return;
        const timeEl = card.querySelector('.note-time');
        if (timeEl) {
            timeEl.textContent = this.formatRelativeTime(note.updatedAt);
            timeEl.title = this.footerTimeTitle(note);
        }
    }

    updateNoteTitle(id, title) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.title = title || '无标题便签';
            this.touchNote(note);
            this.scheduleSaveNotes(id);
        }
    }

    // 换色只做局部 DOM 更新，不整体重建，避免输入焦点丢失
    updateNoteColor(id, color) {
        if (!this.COLORS.includes(color)) return;
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        note.color = color;
        this.touchNote(note);
        this.saveNotes();

        const card = document.querySelector(`.note-card[data-id="${id}"]`);
        if (card) {
            const header = card.querySelector('.note-header');
            if (header) header.style.backgroundColor = color;
            const dot = card.querySelector('.color-dot');
            if (dot) dot.style.backgroundColor = color;
            card.querySelectorAll('.note-color-swatch').forEach(swatch => {
                swatch.classList.toggle('active', swatch.dataset.color === color);
            });
            this.refreshNoteFooter(id);
        }
        // 颜色筛选激活时换色可能改变该卡片的可见性
        this.applyFilters();
    }

    updateNoteGeometry(id, x, y, width, height) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            if (x !== null) note.x = x;
            if (y !== null) note.y = y;
            if (width !== null) note.width = width;
            if (height !== null) note.height = height;
            this.saveNotes();
        }
    }

    async clearNoteContent(id) {
        const confirmed = await this.app.layout.confirm({
            title: '清空便签内容',
            message: '确定要清空此便签内容吗？',
            confirmText: '清空',
            danger: true
        });
        if (!confirmed) {
            return;
        }

        this.updateNoteContent(id, '');
        const textarea = document.querySelector(`.note-card[data-id="${id}"] textarea`);
        if (textarea) textarea.value = '';
        this.app.layout.showToast('便签内容已清空', 'success');
    }

    // ===== 删除与撤回 =====

    deleteNote(id) {
        const index = this.notes.findIndex(n => n.id === id);
        if (index === -1) return;

        this.deletedNotesStack.push({
            type: 'single',
            notes: [this.notes[index]]
        });
        this.notes.splice(index, 1);
        this.saveNotes();
        this.render();
        this.showUndoButton();
    }

    showUndoButton() {
        // 撤回按钮带剩余秒数倒计时，到期自动收回并丢弃快照
        this.undoDeadline = Date.now() + this.UNDO_WINDOW_MS;
        this.updateUndoButton();
        if (this.undoCountdownTimer) clearInterval(this.undoCountdownTimer);
        this.undoCountdownTimer = setInterval(() => {
            if (Date.now() >= this.undoDeadline) {
                this.clearUndoStack();
                return;
            }
            this.updateUndoButton();
        }, 1000);
    }

    updateUndoButton() {
        const btn = document.getElementById('undoNotesBtn');
        if (!btn) return;
        const lastEntry = this.deletedNotesStack[this.deletedNotesStack.length - 1];
        if (!lastEntry) return;
        const secs = Math.max(0, Math.ceil((this.undoDeadline - Date.now()) / 1000));
        const action = lastEntry.type === 'bulk' ? '撤回清空' : '撤回删除';
        const countSuffix = this.deletedNotesStack.length > 1 ? ` ×${this.deletedNotesStack.length}` : '';
        const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128a8,8,0,0,1-8,8H72a8,8,0,0,1,0-16H224A8,8,0,0,1,232,128Zm-80-80a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16ZM72,192H192a8,8,0,0,0,0-16H72a8,8,0,0,0,0,16ZM42.34,122.34l24-24a8,8,0,0,0-11.31-11.31l-32,32a8,8,0,0,0,0,11.31l32,32a8,8,0,0,0,11.31-11.31Z"></path></svg>`;
        btn.innerHTML = `${iconSvg} ${action}${countSuffix} (${secs}s)`;
        btn.style.display = 'flex';
    }

    hideUndoButton() {
        const btn = document.getElementById('undoNotesBtn');
        if (btn) btn.style.display = 'none';
        if (this.undoCountdownTimer) {
            clearInterval(this.undoCountdownTimer);
            this.undoCountdownTimer = null;
        }
    }

    clearUndoStack() {
        this.deletedNotesStack = [];
        this.hideUndoButton();
    }

    undoDelete() {
        if (this.deletedNotesStack.length === 0) return;
        const entryToRestore = this.deletedNotesStack.pop();
        this.notes.push(...entryToRestore.notes);
        this.saveNotes();
        this.render();

        if (this.deletedNotesStack.length > 0) {
            this.showUndoButton();
        } else {
            this.clearUndoStack();
        }

        this.app.layout.showToast(entryToRestore.type === 'bulk' ? '已撤回清空' : '已撤回删除', 'success');
    }

    clearAllNotes() {
        if (this.notes.length === 0) return;
        // 清空属于高风险批量操作，先保存快照以便 15 秒内整体恢复。
        this.deletedNotesStack.push({
            type: 'bulk',
            notes: this.notes.map(note => ({ ...note }))
        });
        this.notes = [];
        this.saveNotes();
        this.render();
        this.showUndoButton();
        this.app.layout.showToast('便签已清空，可撤回', 'success');
    }

    // ===== 单卡片操作 =====

    copyNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        if (!note.content) {
            this.app.layout.showToast('内容为空', 'warning');
            return;
        }
        navigator.clipboard.writeText(note.content).then(() => {
            this.app.layout.showToast('复制成功', 'success');
        }).catch((err) => {
            console.error('Clipboard write failed', err);
            this.app.layout.showToast('复制失败：无法写入剪贴板', 'error');
        });
    }

    togglePin(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        note.pinned = !note.pinned;
        // 切换钉住的同时把它提到同层级最前，视觉反馈更直接
        note.zIndex = ++this.zIndexCounter;
        this.saveNotes();

        const card = document.querySelector(`.note-card[data-id="${id}"]`);
        if (card) {
            card.style.zIndex = this.effectiveZIndex(note);
            card.classList.toggle('note-pinned', note.pinned);
            const pinBtn = card.querySelector('.pin-btn');
            if (pinBtn) {
                pinBtn.classList.toggle('pinned', note.pinned);
                pinBtn.title = note.pinned ? '取消钉住' : '钉住（保持最上层）';
            }
        }
        this.app.layout.showToast(note.pinned ? '已钉住，便签将保持最上层' : '已取消钉住', 'success');
    }

    // 把便签内容送进格式化页编辑器并切换页签
    sendToFormatter(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        if (!note.content || !note.content.trim()) {
            this.app.layout.showToast('内容为空，无法发送', 'warning');
            return;
        }
        const editor = document.getElementById('jsonEditor');
        if (!editor) {
            this.app.layout.showToast('未找到格式化编辑器', 'error');
            return;
        }
        editor.value = note.content;
        if (this.app.formatter) {
            if (typeof this.app.formatter.updatePreview === 'function') {
                this.app.formatter.updatePreview(note.content);
            }
            if (typeof this.app.formatter.updateEditorInfo === 'function') {
                this.app.formatter.updateEditorInfo();
            }
        }
        this.app.layout.switchTab('formatter');
        this.app.layout.showToast('已发送到格式化', 'success');
    }

    formatNoteJSON(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note || !note.content) return;

        try {
            const parsed = JSON.parse(note.content);
            const formatted = JSON.stringify(parsed, null, 2);
            note.content = formatted;
            this.touchNote(note);
            this.saveNotes();

            const textarea = document.querySelector(`.note-card[data-id="${id}"] textarea`);
            if (textarea) textarea.value = formatted;
            this.updateNoteStats(id, formatted);
            this.refreshNoteFooter(id);

            this.app.layout.showToast('JSON 格式化成功', 'success');
        } catch (e) {
            this.app.layout.showToast('格式化失败：无效的 JSON', 'error');
        }
    }

    compressNoteJSON(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note || !note.content) return;

        try {
            const parsed = JSON.parse(note.content);
            const compressed = JSON.stringify(parsed);
            note.content = compressed;
            this.touchNote(note);
            this.saveNotes();

            const textarea = document.querySelector(`.note-card[data-id="${id}"] textarea`);
            if (textarea) textarea.value = compressed;
            this.updateNoteStats(id, compressed);
            this.refreshNoteFooter(id);

            this.app.layout.showToast('JSON 压缩成功', 'success');
        } catch (e) {
            this.app.layout.showToast('压缩失败：无效的 JSON', 'error');
        }
    }

    // ===== 导出 / 导入 =====

    exportNotes() {
        if (this.notes.length === 0) {
            this.app.layout.showToast('没有可导出的便签', 'warning');
            return;
        }
        // 导出前先把防抖中的修改落盘，保证备份是最新内容
        this.flushPendingSave();
        try {
            const payload = {
                version: 1,
                exportedAt: new Date().toISOString(),
                notes: this.notes
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const d = new Date();
            const dateStr = `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = `notes-backup-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.app.layout.showToast(`已导出 ${this.notes.length} 条便签`, 'success');
        } catch (e) {
            this.app.layout.showToast('导出失败：' + (e && e.message ? e.message : '未知错误'), 'error');
        }
    }

    async importNotesFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            // 兼容标准备份格式 {version, notes} 与裸数组
            const list = Array.isArray(data) ? data : (data && Array.isArray(data.notes) ? data.notes : null);
            if (!list) throw new Error('文件中没有 notes 数组');

            const existingIds = new Set(this.notes.map(n => n.id));
            let imported = 0;
            list.forEach((raw, index) => {
                if (!raw || typeof raw !== 'object') return;
                const note = this.normalizeImportedNote(raw, index);
                // 合并策略：id 冲突时重新生成新 id，两份内容都保留
                if (!note.id || existingIds.has(note.id)) note.id = this.createNoteId();
                existingIds.add(note.id);
                this.notes.push(note);
                imported++;
            });

            if (imported === 0) {
                this.app.layout.showToast('导入失败：文件中没有有效便签', 'error');
                return;
            }
            this.saveNotes();
            this.render();
            this.app.layout.showToast(`成功导入 ${imported} 条便签`, 'success');
        } catch (e) {
            this.app.layout.showToast('导入失败：' + (e && e.message ? e.message : '文件解析错误'), 'error');
        }
    }

    // 外部数据不可信：逐字段校验类型并补默认值，防止脏数据破坏渲染
    normalizeImportedNote(raw, index) {
        const now = new Date().toISOString();
        const col = index % 3;
        const row = Math.floor(index / 3);
        const created = typeof raw.created === 'string' ? raw.created : now;
        const updatedAt = (typeof raw.updatedAt === 'string' && raw.updatedAt) ? raw.updatedAt
            : (typeof raw.updated === 'string' && raw.updated) ? raw.updated
            : created;
        return {
            id: typeof raw.id === 'string' ? raw.id : '',
            title: (typeof raw.title === 'string' && raw.title) ? raw.title : '无标题便签',
            content: typeof raw.content === 'string' ? raw.content : '',
            color: this.COLORS.includes(raw.color) ? raw.color : this.COLORS[index % this.COLORS.length],
            created,
            updated: updatedAt,
            updatedAt,
            pinned: !!raw.pinned,
            x: Number.isFinite(raw.x) ? Math.max(0, raw.x) : 20 + col * 340,
            y: Number.isFinite(raw.y) ? Math.max(0, raw.y) : 20 + row * 320,
            width: Number.isFinite(raw.width) ? Math.max(this.MIN_NOTE_WIDTH, raw.width) : 360,
            height: Number.isFinite(raw.height) ? Math.max(this.MIN_NOTE_HEIGHT, raw.height) : 300,
            zIndex: ++this.zIndexCounter
        };
    }

    // ===== 整理 =====

    autoArrange() {
        const searchText = this.getCurrentSearchText();
        // 只排列当前可见（命中搜索/颜色筛选）的便签，被隐藏的卡片位置保持不动
        const targets = this.notes.filter(n => this.noteMatchesFilters(n, searchText));
        if (targets.length === 0) {
            this.app.layout.showToast('没有可整理的便签', 'warning');
            return;
        }

        const CANVAS_PADDING = 20;
        const GAP = 20;
        const container = document.getElementById('notesCanvas');
        const containerWidth = container ? container.clientWidth : 1000;

        let x = CANVAS_PADDING;
        let y = CANVAS_PADDING;
        let rowHeight = 0;
        const maxRight = Math.max(CANVAS_PADDING, containerWidth - CANVAS_PADDING);

        // 按现有卡片尺寸做流式排布，避免整理时覆盖用户手动调整过的宽高。
        targets.forEach((note, index) => {
            const width = note.width || 320;
            const height = note.height || 300;
            if (index > 0 && x + width > maxRight) {
                x = CANVAS_PADDING;
                y += rowHeight + GAP;
                rowHeight = 0;
            }
            note.x = x;
            note.y = y;
            x += width + GAP;
            rowHeight = Math.max(rowHeight, height);
        });

        this.saveNotes();
        this.render(true);
        this.app.layout.showToast('整理完成（已保留卡片尺寸）', 'success');
    }

    // ===== 拖拽 / 缩放（Pointer Events） =====

    onPointerDown(e) {
        const card = e.target.closest('.note-card');
        // 卡片上任意位置按下都置顶（包括 textarea/input/按钮），让"正在操作的卡片在最上面"成为稳定预期
        if (card) this.bringToFront(card);

        // 只响应主键/触摸，避免右键菜单触发拖拽
        if (e.button !== undefined && e.button !== 0) return;

        const resizeHandle = e.target.closest('.resize-handle');
        if (resizeHandle && card) {
            e.preventDefault();
            this.startInteraction(e, card, 'resize');
            return;
        }

        const dragHandle = e.target.closest('.drag-handle');
        if (dragHandle && card) {
            e.preventDefault();
            this.startInteraction(e, card, 'drag');
        }
    }

    startInteraction(e, card, mode) {
        const canvas = document.getElementById('notesCanvas');
        this.dragState = {
            mode,
            card,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            lastClientX: e.clientX,
            lastClientY: e.clientY,
            initialLeft: parseFloat(card.style.left) || 0,
            initialTop: parseFloat(card.style.top) || 0,
            initialWidth: parseFloat(card.style.width) || 320,
            initialHeight: parseFloat(card.style.height) || 150,
            // 记录起始滚动位置：边缘自动滚动期间，卡片位移 = 指针位移 + 滚动位移
            initialScrollLeft: canvas ? canvas.scrollLeft : 0,
            initialScrollTop: canvas ? canvas.scrollTop : 0,
            scrollVx: 0,
            scrollVy: 0
        };
        card.classList.add(mode === 'drag' ? 'dragging' : 'resizing');
        // 捕获指针后，移出窗口/iframe 也能收到 move 和 up，松手即停
        try {
            card.setPointerCapture(e.pointerId);
        } catch (err) { /* 个别环境不支持时退化为普通事件流，行为同旧版 */ }
    }

    onPointerMove(e) {
        const s = this.dragState;
        if (!s || e.pointerId !== s.pointerId) return;
        e.preventDefault();
        s.lastClientX = e.clientX;
        s.lastClientY = e.clientY;

        if (s.mode === 'drag') {
            this.updateAutoScrollVector(e);
            this.updateDragPosition();
        } else {
            const newWidth = Math.max(this.MIN_NOTE_WIDTH, s.initialWidth + (e.clientX - s.startX));
            const newHeight = Math.max(this.MIN_NOTE_HEIGHT, s.initialHeight + (e.clientY - s.startY));
            s.card.style.width = `${newWidth}px`;
            s.card.style.height = `${newHeight}px`;
        }
    }

    updateDragPosition() {
        const s = this.dragState;
        if (!s || s.mode !== 'drag') return;
        const canvas = document.getElementById('notesCanvas');
        const scrollDx = canvas ? canvas.scrollLeft - s.initialScrollLeft : 0;
        const scrollDy = canvas ? canvas.scrollTop - s.initialScrollTop : 0;
        // 左/上钳制到 0；右/下不钳制：.notes-canvas 是 overflow:auto 且内容范围随卡片扩展，
        // 卡片放多远都能滚动到达，只有负坐标才会造成永久不可达
        const newX = Math.max(0, s.initialLeft + (s.lastClientX - s.startX) + scrollDx);
        const newY = Math.max(0, s.initialTop + (s.lastClientY - s.startY) + scrollDy);
        s.card.style.left = `${newX}px`;
        s.card.style.top = `${newY}px`;
    }

    updateAutoScrollVector(e) {
        const s = this.dragState;
        const canvas = document.getElementById('notesCanvas');
        if (!s || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const EDGE = this.EDGE_SCROLL_THRESHOLD;
        const SPEED = this.EDGE_SCROLL_SPEED;
        s.scrollVx = e.clientX < rect.left + EDGE ? -SPEED : (e.clientX > rect.right - EDGE ? SPEED : 0);
        s.scrollVy = e.clientY < rect.top + EDGE ? -SPEED : (e.clientY > rect.bottom - EDGE ? SPEED : 0);
        if (s.scrollVx || s.scrollVy) this.startAutoScrollLoop();
    }

    startAutoScrollLoop() {
        if (this.autoScrollRaf) return;
        const step = () => {
            this.autoScrollRaf = null;
            const s = this.dragState;
            if (!s || s.mode !== 'drag' || (!s.scrollVx && !s.scrollVy)) return;
            const canvas = document.getElementById('notesCanvas');
            if (!canvas) return;

            const beforeLeft = canvas.scrollLeft;
            const beforeTop = canvas.scrollTop;
            canvas.scrollLeft += s.scrollVx;
            canvas.scrollTop += s.scrollVy;

            // 向右/下滚到内容边缘时滚动会被浏览器钳住，此时直接推卡片基准位扩展内容，
            // 下一帧滚动空间就出来了（向左/上滚到 0 即是真实边界，无需扩展）
            if (s.scrollVx > 0) {
                const moved = canvas.scrollLeft - beforeLeft;
                if (moved < s.scrollVx) s.initialLeft += (s.scrollVx - moved);
            }
            if (s.scrollVy > 0) {
                const moved = canvas.scrollTop - beforeTop;
                if (moved < s.scrollVy) s.initialTop += (s.scrollVy - moved);
            }

            this.updateDragPosition();
            this.autoScrollRaf = requestAnimationFrame(step);
        };
        this.autoScrollRaf = requestAnimationFrame(step);
    }

    stopAutoScrollLoop() {
        if (this.autoScrollRaf) {
            cancelAnimationFrame(this.autoScrollRaf);
            this.autoScrollRaf = null;
        }
    }

    endPointerInteraction(e) {
        const s = this.dragState;
        if (!s || e.pointerId !== s.pointerId) return;
        const card = s.card;
        const id = card.dataset.id;

        if (s.mode === 'drag') {
            this.updateNoteGeometry(id, parseFloat(card.style.left), parseFloat(card.style.top), null, null);
            card.classList.remove('dragging');
        } else {
            this.updateNoteGeometry(id, null, null, parseFloat(card.style.width), parseFloat(card.style.height));
            card.classList.remove('resizing');
        }

        try {
            card.releasePointerCapture(s.pointerId);
        } catch (err) { /* 捕获可能已被浏览器自动释放 */ }
        this.dragState = null;
        this.stopAutoScrollLoop();
    }

    bringToFront(card) {
        const note = this.notes.find(n => n.id === card.dataset.id);
        this.zIndexCounter++;
        if (note) {
            note.zIndex = this.zIndexCounter;
            card.style.zIndex = this.effectiveZIndex(note);
            // 层级是用户可感知的状态，需要持久化（防抖写入即可）
            this.scheduleSaveNotes();
        } else {
            card.style.zIndex = this.zIndexCounter;
        }
    }

    // ===== 渲染 =====

    /**
     * 全量渲染只在结构性变化（增删/导入/撤回/整理）时调用；
     * 搜索与颜色筛选走 applyFilters 切换显隐，不重建 DOM
     */
    render(animate = false) {
        const container = document.getElementById('notesCanvas');
        if (!container) return;

        if (animate) {
            // 整理动画：复用现有 DOM 平移到新位置，避免重建闪烁
            const cards = container.querySelectorAll('.note-card');
            cards.forEach(card => {
                const note = this.notes.find(n => n.id === card.dataset.id);
                if (note) {
                    card.classList.add('animating');
                    card.style.left = `${note.x}px`;
                    card.style.top = `${note.y}px`;
                    card.style.width = `${note.width}px`;
                    card.style.height = `${note.height}px`;
                    setTimeout(() => card.classList.remove('animating'), 300);
                }
            });
            return;
        }

        container.innerHTML = '';

        if (this.notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text">点击 "新建便签" 或双击画布空白处创建便利贴</div>
                </div>
            `;
            return;
        }

        this.notes.forEach(note => container.appendChild(this.createCard(note)));
        this.applyFilters();
    }

    createCard(note) {
        const card = document.createElement('div');
        card.className = 'note-card' + (note.pinned ? ' note-pinned' : '');
        card.dataset.id = note.id;
        card.style.left = `${note.x}px`;
        card.style.top = `${note.y}px`;
        card.style.width = `${note.width}px`;
        card.style.height = `${note.height}px`;
        card.style.zIndex = this.effectiveZIndex(note);

        const headerStyle = note.color ? `style="background-color: ${note.color};"` : '';
        const statsText = `Len: ${note.content ? note.content.length : 0} | Size: ${this.formatSize(this.getByteSize(note.content || ''))}`;
        // title 属性里的换行用 &#10; 表达
        const timeTitle = Utils.escapeHtml(this.footerTimeTitle(note)).replace(/\n/g, '&#10;');

        card.innerHTML = `
            <div class="note-header" ${headerStyle}>
                <div class="drag-handle" title="按住拖拽">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Zm176,112H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg>
                </div>
                <input type="text" class="note-title-input" value="${Utils.escapeHtml(note.title || '无标题便签')}" placeholder="无标题">
                <div class="note-actions">
                    <button class="icon-btn-sm pin-btn${note.pinned ? ' pinned' : ''}" title="${note.pinned ? '取消钉住' : '钉住（保持最上层）'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M222.14,69.17,186.83,33.86a20,20,0,0,0-28.28,0L122.21,70.2,72.68,82.58a12,12,0,0,0-5.57,20.13l36.18,36.18-59.78,59.77a8,8,0,0,0,11.31,11.32l59.78-59.78,36.18,36.18a12,12,0,0,0,20.13-5.57l12.38-49.53,36.34-36.34A20,20,0,0,0,222.14,69.17Z"></path></svg>
                    </button>
                    <div class="note-color-wrapper">
                        <button class="icon-btn-sm color-btn" title="更换颜色">
                            <span class="color-dot" style="background-color: ${note.color || this.COLORS[0]};"></span>
                        </button>
                        <div class="note-color-menu">
                            ${this.renderColorSwatches(note)}
                        </div>
                    </div>
                    <button class="icon-btn-sm format-btn" title="格式化 JSON">
                       <span style="font-size: 10px; font-weight: bold;">{ }</span>
                    </button>
                    <button class="icon-btn-sm compress-btn" title="压缩 JSON">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,117.66a8,8,0,0,1-11.32,0L168,91.31V164.69l26.34-26.35a8,8,0,0,1,11.32,11.32l-40,40a8,8,0,0,1-11.32,0l-40-40a8,8,0,0,1,11.32-11.32L152,164.69V91.31L125.66,117.66a8,8,0,0,1-11.32-11.32l40-40a8,8,0,0,1,11.32,0l40,40A8,8,0,0,1,205.66,117.66ZM88,112H40a8,8,0,0,0,0,16H88a8,8,0,0,0,0-16Zm0,64H40a8,8,0,0,0,0,16H88a8,8,0,0,0,0-16Zm0-128H40a8,8,0,0,0,0,16H88a8,8,0,0,0,0-16Z"></path></svg>
                    </button>
                    <button class="icon-btn-sm copy-btn" title="复制内容">
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Zm-8,128H176V88a8,8,0,0,0-8-8H96V48H208Z"></path></svg>
                    </button>
                    <button class="icon-btn-sm send-formatter-btn" title="发送到格式化">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M224,104a8,8,0,0,1-16,0V67.31l-66.34,66.35a8,8,0,0,1-11.32-11.32L196.69,56H160a8,8,0,0,1,0-16h56a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"></path></svg>
                    </button>
                    <button class="icon-btn-sm clear-content-btn" title="清空内容">
                       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M227.32,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H163.31L227.32,96A16,16,0,0,0,227.32,73.37ZM48,163.31l88-88L180.69,120l-88,88H48Zm123.31,44.69L126.63,163.31,171.31,118.63,216,163.31Z"></path></svg>
                    </button>
                    <button class="icon-btn-sm delete-btn" title="删除便签">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path></svg>
                    </button>
                </div>
            </div>
            <div class="note-search-preview" style="display: none;"></div>
            <div class="note-body">
                <textarea class="note-editor" placeholder="在此输入内容...">${Utils.escapeHtml(note.content || '')}</textarea>
            </div>
            <div class="note-footer">
                <span class="note-stats">${statsText}</span>
                <span class="note-footer-right">
                    <span class="note-json-dot"></span>
                    <span class="note-time" title="${timeTitle}">${this.formatRelativeTime(note.updatedAt)}</span>
                </span>
                <div class="resize-handle" title="调整大小"></div>
            </div>
        `;

        const titleInput = card.querySelector('.note-title-input');
        if (titleInput) titleInput.addEventListener('input', (e) => this.updateNoteTitle(note.id, e.target.value));
        const contentInput = card.querySelector('.note-editor');
        if (contentInput) contentInput.addEventListener('input', (e) => this.updateNoteContent(note.id, e.target.value));

        card.querySelectorAll('.note-color-swatch').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.updateNoteColor(note.id, e.currentTarget.dataset.color);
            });
        });
        const colorWrapper = card.querySelector('.note-color-wrapper');
        if (colorWrapper) {
            // 颜色菜单是悬停展开的，展开前先置顶卡片，避免菜单被相邻卡片盖住
            colorWrapper.addEventListener('pointerenter', () => this.bringToFront(card));
        }

        const bindAction = (selector, handler) => {
            const el = card.querySelector(selector);
            if (el) {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handler();
                });
            }
        };
        bindAction('.pin-btn', () => this.togglePin(note.id));
        bindAction('.format-btn', () => this.formatNoteJSON(note.id));
        bindAction('.compress-btn', () => this.compressNoteJSON(note.id));
        bindAction('.copy-btn', () => this.copyNote(note.id));
        bindAction('.send-formatter-btn', () => this.sendToFormatter(note.id));
        bindAction('.clear-content-btn', () => this.clearNoteContent(note.id));
        bindAction('.delete-btn', () => this.deleteNote(note.id));

        this.updateJsonDot(card, note.content || '');
        return card;
    }

    // ===== 过滤（搜索 + 颜色，AND 关系） =====

    noteMatchesFilters(note, searchText) {
        const text = (searchText || '').toLowerCase();
        const matchesText = !text
            || (note.title || '').toLowerCase().includes(text)
            || (note.content || '').toLowerCase().includes(text);
        const matchesColor = !this.colorFilter || note.color === this.colorFilter;
        return matchesText && matchesColor;
    }

    /**
     * 对已渲染卡片切换显隐 + 更新摘要条，不重建 DOM，
     * 搜索过程中正在编辑的 textarea 焦点与光标都不受影响
     */
    applyFilters() {
        const container = document.getElementById('notesCanvas');
        if (!container) return;
        const searchText = this.getCurrentSearchText();
        let visibleCount = 0;

        container.querySelectorAll('.note-card').forEach(card => {
            const note = this.notes.find(n => n.id === card.dataset.id);
            if (!note) return;
            const matches = this.noteMatchesFilters(note, searchText);
            card.classList.toggle('note-hidden', !matches);

            const preview = card.querySelector('.note-search-preview');
            if (preview) {
                const html = (matches && searchText) ? this.renderSearchPreviewRows(note, searchText) : '';
                preview.innerHTML = html;
                preview.style.display = html ? '' : 'none';
            }
            if (matches) visibleCount++;
        });

        this.updateSearchEmptyState(container, visibleCount, searchText);
    }

    updateSearchEmptyState(container, visibleCount, searchText) {
        let emptyEl = container.querySelector('.notes-search-empty');
        const shouldShow = this.notes.length > 0 && visibleCount === 0;
        if (!shouldShow) {
            if (emptyEl) emptyEl.remove();
            return;
        }
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state notes-search-empty';
            container.appendChild(emptyEl);
        }
        const reason = searchText
            ? `没有匹配“${Utils.escapeHtml(searchText)}”的便签`
            : '没有符合当前颜色筛选的便签';
        emptyEl.innerHTML = `
            <div class="empty-icon">未找到</div>
            <div class="empty-text">${reason}</div>
        `;
    }

    getCurrentSearchText() {
        const searchNotes = document.getElementById('searchNotes');
        return searchNotes ? searchNotes.value.trim() : '';
    }

    renderColorSwatches(note) {
        return this.COLORS.map(color => `
            <button
                class="note-color-swatch${note.color === color ? ' active' : ''}"
                data-color="${color}"
                style="background-color: ${color};"
                title="切换为该颜色"
            ></button>
        `).join('');
    }

    // 摘要条内容（标题/内容命中行，带关键词高亮），返回内部行的 HTML
    renderSearchPreviewRows(note, filterText) {
        const title = note.title || '';
        const content = note.content || '';
        const titleMatch = title.toLowerCase().includes(filterText.toLowerCase());
        const contentSnippet = this.getSearchSnippet(content, filterText);
        const rows = [];

        if (titleMatch) {
            rows.push(`<div class="note-search-line">标题：${this.highlightText(title, filterText)}</div>`);
        }
        if (contentSnippet) {
            rows.push(`<div class="note-search-line">内容：${this.highlightText(contentSnippet, filterText)}</div>`);
        }

        return rows.join('');
    }

    getSearchSnippet(text, filterText) {
        const lowerText = text.toLowerCase();
        const lowerFilter = filterText.toLowerCase();
        const matchIndex = lowerText.indexOf(lowerFilter);
        if (matchIndex === -1) return '';

        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(text.length, matchIndex + filterText.length + 80);
        const prefix = start > 0 ? '...' : '';
        const suffix = end < text.length ? '...' : '';
        return `${prefix}${text.slice(start, end)}${suffix}`;
    }

    highlightText(text, filterText) {
        if (!filterText) return Utils.escapeHtml(text);

        // 先按原文切片再转义，避免搜索词包含 HTML 特殊字符时破坏高亮结果。
        const lowerText = text.toLowerCase();
        const lowerFilter = filterText.toLowerCase();
        let cursor = 0;
        let html = '';
        let matchIndex = lowerText.indexOf(lowerFilter, cursor);

        while (matchIndex !== -1) {
            html += Utils.escapeHtml(text.slice(cursor, matchIndex));
            html += `<mark>${Utils.escapeHtml(text.slice(matchIndex, matchIndex + filterText.length))}</mark>`;
            cursor = matchIndex + filterText.length;
            matchIndex = lowerText.indexOf(lowerFilter, cursor);
        }

        html += Utils.escapeHtml(text.slice(cursor));
        return html;
    }
}

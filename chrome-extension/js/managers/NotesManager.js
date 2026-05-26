import { Utils } from '../utils.js';

/**
 * 便签卡片管理器 (Canvas Mode with Resizing & Colors & JSON Format & Multi-Undo)
 * 负责管理自由画布上的便签，支持拖拽、调整大小、轮询取色、JSON格式化及多级撤回
 */
export class NotesManager {
    constructor(app) {
        this.app = app;
        this.notes = [];
        this.STORAGE_KEY = 'json-tool-notes';
        
        // Interaction State
        this.isDragging = false;
        this.isResizing = false;
        this.activeCard = null;
        
        // Tracking variables
        this.startX = 0;
        this.startY = 0;
        this.initialLeft = 0;
        this.initialTop = 0;
        this.initialWidth = 0;
        this.initialHeight = 0;
        
        this.zIndexCounter = 100;
        
        // Spawn position tracking
        this.lastSpawnX = 50;
        this.lastSpawnY = 50;

        // Undo State
        this.deletedNotesStack = [];
        this.undoTimeout = null;
        this.saveDebounceTimer = null;
        this.SAVE_DEBOUNCE_MS = 400;

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

    getByteSize(str) {
        return new Blob([str]).size;
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    init() {
        this.loadNotes();
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        const addNoteBtn = document.getElementById('addNoteBtn');
        const clearNotesBtn = document.getElementById('clearNotesBtn');
        const searchNotes = document.getElementById('searchNotes');
        const arrangeNotesBtn = document.getElementById('arrangeNotesBtn');
        const undoNotesBtn = document.getElementById('undoNotesBtn');

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
            searchNotes.addEventListener('input', (e) => {
                this.render(e.target.value.trim());
            });
        }

        if (arrangeNotesBtn) {
            arrangeNotesBtn.addEventListener('click', () => this.autoArrange());
        }

        if (undoNotesBtn) {
            undoNotesBtn.addEventListener('click', () => this.undoDelete());
        }

        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('beforeunload', () => this.flushPendingSave());
    }

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
                    if (!note.width) note.width = 320;
                    if (!note.height) note.height = 300;
                    if (!note.zIndex) note.zIndex = 10;
                    
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
        }
    }

    // 输入过程中延迟写入 localStorage，避免长内容便签每次按键都触发同步存储卡顿。
    scheduleSaveNotes() {
        if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
        this.saveDebounceTimer = setTimeout(() => {
            this.saveDebounceTimer = null;
            this.saveNotes();
        }, this.SAVE_DEBOUNCE_MS);
    }

    // 页面关闭前补齐最后一次防抖保存，降低刚输入内容丢失的风险。
    flushPendingSave() {
        if (!this.saveDebounceTimer) return;
        clearTimeout(this.saveDebounceTimer);
        this.saveDebounceTimer = null;
        this.saveNotes();
    }

    addNote() {
        const canvas = document.getElementById('notesCanvas');
        const scrollX = canvas ? canvas.scrollLeft : 0;
        const scrollY = canvas ? canvas.scrollTop : 0;
        const containerWidth = canvas ? canvas.clientWidth : 800;
        const containerHeight = canvas ? canvas.clientHeight : 600;
        
        let startX = scrollX + 50;
        let startY = scrollY + 50;
        const OFFSET_STEP = 30;
        
        if (this.notes.length === 0) {
            this.lastSpawnX = startX;
            this.lastSpawnY = startY;
        } else {
            this.lastSpawnX += OFFSET_STEP;
            this.lastSpawnY += OFFSET_STEP;
            
            if (this.lastSpawnX > startX + containerWidth - 350 || this.lastSpawnY > startY + containerHeight - 300) {
                this.lastSpawnX = startX;
                this.lastSpawnY = startY;
            }
        }
        
        if (this.lastSpawnX < startX) this.lastSpawnX = startX;
        if (this.lastSpawnY < startY) this.lastSpawnY = startY;

        // 轮询获取下一个颜色
        this.lastColorIndex = (this.lastColorIndex + 1) % this.COLORS.length;

        const newNote = {
            id: Date.now().toString(),
            title: '无标题便签',
            content: '',
            color: this.COLORS[this.lastColorIndex], // 轮询取色
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            x: this.lastSpawnX,
            y: this.lastSpawnY,
            width: 320,
            height: 300,
            zIndex: ++this.zIndexCounter
        };
        
        this.notes.push(newNote);
        this.saveNotes();
        this.render();
        
        setTimeout(() => {
            const textarea = document.querySelector(`.note-card[data-id="${newNote.id}"] textarea`);
            if (textarea) textarea.focus();
        }, 100);
    }

    updateNoteContent(id, content) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.content = content;
            note.updated = new Date().toISOString();
            this.scheduleSaveNotes();
            this.updateNoteStats(id, content);
        }
    }
    
    updateNoteStats(id, content) {
        const card = document.querySelector(`.note-card[data-id="${id}"]`);
        if (card) {
            const statsEl = card.querySelector('.note-stats');
            if (statsEl) {
                const len = content.length;
                const size = this.getByteSize(content);
                statsEl.textContent = `Len: ${len} | Size: ${this.formatSize(size)}`;
            }
        }
    }

    updateNoteTitle(id, title) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.title = title || '无标题便签';
            note.updated = new Date().toISOString();
            this.scheduleSaveNotes();
        }
    }

    // 用户手动改色后立即保存并刷新当前搜索视图，保证颜色菜单状态同步。
    updateNoteColor(id, color) {
        if (!this.COLORS.includes(color)) return;
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.color = color;
            note.updated = new Date().toISOString();
            this.saveNotes();
            this.render(this.getCurrentSearchText());
        }
    }

    updateNoteGeometry(id, x, y, width, height) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            if (x !== null) note.x = x;
            if (y !== null) note.y = y;
            if (width !== null) note.width = width;
            if (height !== null) note.height = height;
            
            note.zIndex = ++this.zIndexCounter;
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
        if (this.app.layout.showToast) this.app.layout.showToast('便签内容已清空');
    }

    deleteNote(id) {
        const index = this.notes.findIndex(n => n.id === id);
        if (index === -1) return;

        this.deletedNotesStack.push({
            type: 'single',
            notes: [this.notes[index]]
        });
        this.notes.splice(index, 1);
        this.saveNotes();
        this.render(this.getCurrentSearchText());
        this.showUndoButton();
    }
    
    showUndoButton() {
        const btn = document.getElementById('undoNotesBtn');
        if (btn) {
            const lastEntry = this.deletedNotesStack[this.deletedNotesStack.length - 1];
            const count = lastEntry?.notes?.length || this.deletedNotesStack.length;
            const label = lastEntry?.type === 'bulk' ? `撤回清空 (${count})` : `撤回删除 (${this.deletedNotesStack.length})`;
            const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128a8,8,0,0,1-8,8H72a8,8,0,0,1,0-16H224A8,8,0,0,1,232,128Zm-80-80a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16ZM72,192H192a8,8,0,0,0,0-16H72a8,8,0,0,0,0,16ZM42.34,122.34l24-24a8,8,0,0,0-11.31-11.31l-32,32a8,8,0,0,0,0,11.31l32,32a8,8,0,0,0,11.31-11.31Z"></path></svg>`;
            btn.innerHTML = `${iconSvg} ${label}`;
            btn.style.display = 'flex';
        }
        
        if (this.undoTimeout) clearTimeout(this.undoTimeout);
        this.undoTimeout = setTimeout(() => {
            this.clearUndoStack();
        }, 15000);
    }
    
    hideUndoButton() {
        const btn = document.getElementById('undoNotesBtn');
        if (btn) btn.style.display = 'none';
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
        this.render(this.getCurrentSearchText());
        
        if (this.deletedNotesStack.length > 0) {
            this.showUndoButton();
        } else {
            this.clearUndoStack();
        }
        
        if (this.app.layout.showToast) {
            this.app.layout.showToast(entryToRestore.type === 'bulk' ? '已撤回清空' : '已撤回删除');
        }
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
        this.render(this.getCurrentSearchText());
        this.showUndoButton();
        if (this.app.layout.showToast) {
            this.app.layout.showToast('便签已清空，可撤回');
        }
    }

    copyNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (note && note.content) {
            navigator.clipboard.writeText(note.content).then(() => {
                if (this.app.layout.showToast) this.app.layout.showToast('复制成功');
            });
        }
    }

    formatNoteJSON(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note || !note.content) return;

        try {
            const parsed = JSON.parse(note.content);
            const formatted = JSON.stringify(parsed, null, 2);
            note.content = formatted;
            note.updated = new Date().toISOString();
            this.saveNotes();
            
            const textarea = document.querySelector(`.note-card[data-id="${id}"] textarea`);
            if (textarea) textarea.value = formatted;
            this.updateNoteStats(id, formatted);
            
            if (this.app.layout.showToast) this.app.layout.showToast('JSON 格式化成功');
        } catch (e) {
            this.app.layout.showError('格式化失败: 无效的 JSON');
        }
    }

    compressNoteJSON(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note || !note.content) return;

        try {
            const parsed = JSON.parse(note.content);
            const compressed = JSON.stringify(parsed);
            note.content = compressed;
            note.updated = new Date().toISOString();
            this.saveNotes();
            
            const textarea = document.querySelector(`.note-card[data-id="${id}"] textarea`);
            if (textarea) textarea.value = compressed;
            this.updateNoteStats(id, compressed);
            
            if (this.app.layout.showToast) this.app.layout.showToast('JSON 压缩成功');
        } catch (e) {
            this.app.layout.showError('压缩失败: 无效的 JSON');
        }
    }

    autoArrange() {
        const CANVAS_PADDING = 20;
        const GAP = 20;
        const container = document.getElementById('notesCanvas');
        const containerWidth = container ? container.clientWidth : 1000;

        let x = CANVAS_PADDING;
        let y = CANVAS_PADDING;
        let rowHeight = 0;
        const maxRight = Math.max(CANVAS_PADDING, containerWidth - CANVAS_PADDING);

        // 按现有卡片尺寸做流式排布，避免整理时覆盖用户手动调整过的宽高。
        this.notes.forEach((note, index) => {
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
        this.render(document.getElementById('searchNotes').value.trim(), true);
        if (this.app.layout.showToast) this.app.layout.showToast('整理完成（已保留卡片尺寸）');
    }

    // Interaction Logic
    onMouseDown(e) {
        const resizeHandle = e.target.closest('.resize-handle');
        if (resizeHandle) {
            const card = resizeHandle.closest('.note-card');
            if (card) {
                e.preventDefault();
                this.startResize(e, card);
                return;
            }
        }

        const dragHandle = e.target.closest('.drag-handle');
        if (dragHandle) {
            const card = dragHandle.closest('.note-card');
            if (card) {
                e.preventDefault();
                this.startDrag(e, card);
                return;
            }
        }
        
        const cardBody = e.target.closest('.note-card');
        if (cardBody && !e.target.closest('button') && !e.target.closest('textarea') && !e.target.closest('input')) {
             this.bringToFront(cardBody);
        }
    }
    
    bringToFront(card) {
        card.style.zIndex = ++this.zIndexCounter;
        const note = this.notes.find(n => n.id === card.dataset.id);
        if (note) note.zIndex = this.zIndexCounter;
    }

    startDrag(e, card) {
        this.isDragging = true;
        this.activeCard = card;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.initialLeft = parseFloat(card.style.left) || 0;
        this.initialTop = parseFloat(card.style.top) || 0;
        this.bringToFront(card);
        card.classList.add('dragging');
    }

    startResize(e, card) {
        this.isResizing = true;
        this.activeCard = card;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.initialWidth = parseFloat(card.style.width) || 320;
        this.initialHeight = parseFloat(card.style.height) || 300;
        this.bringToFront(card);
        card.classList.add('resizing');
    }

    onMouseMove(e) {
        if (!this.activeCard) return;

        if (this.isDragging) {
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            let newX = Math.max(0, this.initialLeft + dx);
            let newY = Math.max(0, this.initialTop + dy);
            this.activeCard.style.left = `${newX}px`;
            this.activeCard.style.top = `${newY}px`;
        } 
        else if (this.isResizing) {
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            let newWidth = Math.max(200, this.initialWidth + dx);
            let newHeight = Math.max(150, this.initialHeight + dy);
            this.activeCard.style.width = `${newWidth}px`;
            this.activeCard.style.height = `${newHeight}px`;
        }
    }

    onMouseUp(e) {
        if (!this.activeCard) return;
        const id = this.activeCard.dataset.id;
        if (this.isDragging) {
            this.updateNoteGeometry(id, parseFloat(this.activeCard.style.left), parseFloat(this.activeCard.style.top), null, null);
            this.activeCard.classList.remove('dragging');
        } else if (this.isResizing) {
            this.updateNoteGeometry(id, null, null, parseFloat(this.activeCard.style.width), parseFloat(this.activeCard.style.height));
            this.activeCard.classList.remove('resizing');
        }
        this.isDragging = false;
        this.isResizing = false;
        this.activeCard = null;
    }

    render(filterText = '', animate = false) {
        const container = document.getElementById('notesCanvas');
        if (!container) return;
        const normalizedFilter = filterText.trim();

        if (animate) {
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
        const filteredNotes = normalizedFilter 
            ? this.notes.filter(n => 
                (n.content || '').toLowerCase().includes(normalizedFilter.toLowerCase()) || 
                (n.title && n.title.toLowerCase().includes(normalizedFilter.toLowerCase()))
              )
            : this.notes;

        if (this.notes.length > 0 && filteredNotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state notes-search-empty">
                    <div class="empty-icon">未找到</div>
                    <div class="empty-text">没有匹配“${Utils.escapeHtml(normalizedFilter)}”的便签</div>
                </div>
            `;
            return;
        }

        filteredNotes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.dataset.id = note.id;
            card.style.left = `${note.x}px`;
            card.style.top = `${note.y}px`;
            card.style.width = `${note.width}px`;
            card.style.height = `${note.height}px`;
            card.style.zIndex = note.zIndex || 10;

            const dateStr = new Date(note.updated).toLocaleString();
            const headerStyle = note.color ? `style="background-color: ${note.color};"` : '';
            const size = this.getByteSize(note.content || '');
            const statsText = `Len: ${note.content ? note.content.length : 0} | Size: ${this.formatSize(size)}`;
            const searchPreview = normalizedFilter ? this.renderSearchPreview(note, normalizedFilter) : '';

            card.innerHTML = `
                <div class="note-header" ${headerStyle}>
                    <div class="drag-handle" title="按住拖拽">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Zm176,112H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg>
                    </div>
                    <input type="text" class="note-title-input" value="${Utils.escapeHtml(note.title || '无标题便签')}" placeholder="无标题">
                    <div class="note-actions">
                        <div class="note-color-wrapper">
                            <button class="icon-btn-sm color-btn" title="更换颜色">
                                <span class="color-dot" style="background-color: ${note.color || this.COLORS[0]};"></span>
                            </button>
                            <div class="note-color-menu">
                                ${this.renderColorSwatches(note)}
                            </div>
                        </div>
                        <button class="icon-btn-sm format-btn" title="格式化 JSON">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M72,64V208a8,8,0,0,1-16,0V64a8,8,0,0,1,16,0Zm128,0V208a8,8,0,0,1-16,0V64a8,8,0,0,1,16,0Z" opacity="0.2"></path><path d="M66.34,69.66,42.34,93.66a8,8,0,0,0,0,11.31l24,24A8,8,0,0,0,80,123.31V75.31A8,8,0,0,0,66.34,69.66Zm-2.34,40L53.66,99.31,64,89Zm125.66,80L213.66,166l-24-24A8,8,0,0,0,176,147.31v48a8,8,0,0,0,13.66,5.66ZM192,189.66V152l10.34,10.34ZM112,64a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V72A8,8,0,0,0,112,64Zm32,0a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V72A8,8,0,0,0,144,64Z"></path></svg>
                           <span style="font-size: 10px; font-weight: bold;">{ }</span>
                        </button>
                        <button class="icon-btn-sm compress-btn" title="压缩 JSON">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,117.66a8,8,0,0,1-11.32,0L168,91.31V164.69l26.34-26.35a8,8,0,0,1,11.32,11.32l-40,40a8,8,0,0,1-11.32,0l-40-40a8,8,0,0,1,11.32-11.32L152,164.69V91.31L125.66,117.66a8,8,0,0,1-11.32-11.32l40-40a8,8,0,0,1,11.32,0l40,40A8,8,0,0,1,205.66,117.66ZM88,112H40a8,8,0,0,0,0,16H88a8,8,0,0,0,0-16Zm0,64H40a8,8,0,0,0,0,16H88a8,8,0,0,0,0-16Zm0-128H40a8,8,0,0,0,0,16H88a8,8,0,0,0,0-16Z"></path></svg>
                        </button>
                        <button class="icon-btn-sm copy-btn" title="复制内容">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Zm-8,128H176V88a8,8,0,0,0-8-8H96V48H208Z"></path></svg>
                        </button>
                        <button class="icon-btn-sm clear-content-btn" title="清空内容">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M227.32,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H216a8,8,0,0,0,0-16H163.31L227.32,96A16,16,0,0,0,227.32,73.37ZM48,163.31l88-88L180.69,120l-88,88H48Zm123.31,44.69L126.63,163.31,171.31,118.63,216,163.31Z"></path></svg>
                        </button>
                        <button class="icon-btn-sm delete-btn" title="删除便签">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path></svg>
                        </button>
                    </div>
                </div>
                ${searchPreview}
                <div class="note-body">
                    <textarea class="note-editor" placeholder="在此输入内容...">${Utils.escapeHtml(note.content || '')}</textarea>
                </div>
                <div class="note-footer">
                    <span class="note-stats">${statsText}</span>
                    <span class="note-time" title="${dateStr}">${dateStr.split(' ')[0]}</span>
                    <div class="resize-handle" title="调整大小"></div>
                </div>
            `;

            const titleInput = card.querySelector('.note-title-input');
            const contentInput = card.querySelector('.note-editor');
            titleInput.addEventListener('input', (e) => this.updateNoteTitle(note.id, e.target.value));
            contentInput.addEventListener('input', (e) => this.updateNoteContent(note.id, e.target.value));
            card.querySelectorAll('.note-color-swatch').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.updateNoteColor(note.id, e.currentTarget.dataset.color);
                });
            });
            card.querySelector('.format-btn').addEventListener('click', (e) => { e.stopPropagation(); this.formatNoteJSON(note.id); });
            card.querySelector('.compress-btn').addEventListener('click', (e) => { e.stopPropagation(); this.compressNoteJSON(note.id); });
            card.querySelector('.copy-btn').addEventListener('click', (e) => { e.stopPropagation(); this.copyNote(note.id); });
            card.querySelector('.clear-content-btn').addEventListener('click', (e) => { e.stopPropagation(); this.clearNoteContent(note.id); });
            card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); this.deleteNote(note.id); });

            container.appendChild(card);
        });
        
        if (this.notes.length === 0) {
             container.innerHTML = `
                <div class="empty-state" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                    <div class="empty-icon">📝</div>
                    <div class="empty-text">点击 "新建便签" 在画布上创建便利贴</div>
                </div>
            `;
        }
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

    renderSearchPreview(note, filterText) {
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

        return rows.length ? `<div class="note-search-preview">${rows.join('')}</div>` : '';
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

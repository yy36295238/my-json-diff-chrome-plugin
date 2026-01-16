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

        // 配色方案
        this.COLORS = [
            '#FFF59D', // 柠檬黄
            '#FFCC80', // 杏子橙
            '#FFAB91', // 蜜桃红
            '#F48FB1', // 樱花粉
            '#CE93D8', // 香芋紫
            '#90CAF9', // 天空蓝
            '#80CBC4', // 薄荷绿
            '#B0BEC5'  // 蓝灰色
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
            clearNotesBtn.addEventListener('click', () => {
                if (confirm('确定要清空所有便签吗？此操作无法撤销。')) {
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
            this.saveNotes();
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
            this.saveNotes();
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

    clearNoteContent(id) {
        if (confirm('确定要清空此便签内容吗？')) {
            this.updateNoteContent(id, '');
            const textarea = document.querySelector(`.note-card[data-id="${id}"] textarea`);
            if (textarea) textarea.value = '';
            if (this.app.layout.showToast) this.app.layout.showToast('便签内容已清空');
        }
    }

    deleteNote(id) {
        const index = this.notes.findIndex(n => n.id === id);
        if (index === -1) return;

        this.deletedNotesStack.push(this.notes[index]);
        this.notes.splice(index, 1);
        this.saveNotes();
        this.render();
        this.showUndoButton();
    }
    
    showUndoButton() {
        const btn = document.getElementById('undoNotesBtn');
        if (btn) {
            const count = this.deletedNotesStack.length;
            const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232,128a8,8,0,0,1-8,8H72a8,8,0,0,1,0-16H224A8,8,0,0,1,232,128Zm-80-80a8,8,0,0,1,0,16H72a8,8,0,0,1,0-16ZM72,192H192a8,8,0,0,0,0-16H72a8,8,0,0,0,0,16ZM42.34,122.34l24-24a8,8,0,0,0-11.31-11.31l-32,32a8,8,0,0,0,0,11.31l32,32a8,8,0,0,0,11.31-11.31Z"></path></svg>`;
            btn.innerHTML = `${iconSvg} 撤回删除 (${count})`;
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
        const noteToRestore = this.deletedNotesStack.pop();
        this.notes.push(noteToRestore);
        this.saveNotes();
        this.render();
        
        if (this.deletedNotesStack.length > 0) {
            this.showUndoButton();
        } else {
            this.clearUndoStack();
        }
        
        if (this.app.layout.showToast) {
            this.app.layout.showToast('已撤回删除');
        }
    }

    clearAllNotes() {
        this.notes = [];
        this.saveNotes();
        this.render();
        if (this.app.layout.showToast) {
            this.app.layout.showToast('便签已清空');
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
        const COL_WIDTH = 340; 
        const ROW_HEIGHT = 320; 
        const CANVAS_PADDING = 20;
        const container = document.getElementById('notesCanvas');
        const containerWidth = container ? container.clientWidth : 1000;
        
        const cols = Math.max(1, Math.floor((containerWidth - CANVAS_PADDING * 2) / COL_WIDTH));

        this.notes.forEach((note, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            note.x = CANVAS_PADDING + col * COL_WIDTH;
            note.y = CANVAS_PADDING + row * ROW_HEIGHT;
            note.width = 320;
            note.height = 300;
        });

        this.saveNotes();
        this.render(document.getElementById('searchNotes').value.trim(), true);
        if (this.app.layout.showToast) this.app.layout.showToast('整理完成 (已重置尺寸)');
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
        const filteredNotes = filterText 
            ? this.notes.filter(n => 
                n.content.toLowerCase().includes(filterText.toLowerCase()) || 
                (n.title && n.title.toLowerCase().includes(filterText.toLowerCase()))
              )
            : this.notes;

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

            card.innerHTML = `
                <div class="note-header" ${headerStyle}>
                    <div class="drag-handle" title="按住拖拽">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Zm176,112H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg>
                    </div>
                    <input type="text" class="note-title-input" value="${note.title || '无标题便签'}" placeholder="无标题">
                    <div class="note-actions">
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
                <div class="note-body">
                    <textarea class="note-editor" placeholder="在此输入内容...">${note.content}</textarea>
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
}
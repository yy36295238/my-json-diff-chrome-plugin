import { Utils } from '../utils.js';

export class LayoutManager {
    constructor(app) {
        this.app = app;
        this.splitPaneWidths = [];
        this.splitPaneContents = [];
        this.maxSplitPanes = 5;
    }

    init() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('themeToggle').addEventListener('click', () => this.app.toggleTheme());
        document.getElementById('closeError').addEventListener('click', () => this.hideErrorPanel());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('closeSidebar').addEventListener('click', () => this.closeSidebar());

        const addSplitBtn = document.getElementById('addSplitPane');
        if (addSplitBtn) addSplitBtn.addEventListener('click', () => this.addSplitPane());

        const multiSplitContainer = document.getElementById('multiSplitContainer');
        if (multiSplitContainer) {
            multiSplitContainer.addEventListener('click', (e) => {
                const target = e.target;
                if (target.classList.contains('pane-action-btn')) {
                    const index = parseInt(target.dataset.index, 10);
                    this.formatPane(index);
                } else if (target.classList.contains('pane-delete-btn')) {
                    const index = parseInt(target.dataset.index, 10);
                    this.removeSplitPane(index);
                }
            });
            multiSplitContainer.addEventListener('input', (e) => {
                const target = e.target;
                if (target.classList.contains('multi-pane-textarea')) {
                    const index = parseInt(target.dataset.index, 10);
                    this.updatePaneContent(index, target.value);
                }
            });
        }

        this.initMultiSplit();
        this.initFormatterResizer(); // Call formatter resizer init
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetBtn) targetBtn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const targetContent = document.getElementById(`${tabName}-content`);
        if (targetContent) targetContent.classList.add('active');

        this.app.currentTab = tabName;
        this.updateStatus(`已切换到${this.getTabName(tabName)}`);
    }

    getTabName(name) {
        const map = { formatter: '格式化', compare: '对比', generator: '生成器', converter: '转换', split: '分隔栏' };
        return map[name] || name;
    }

    updateStatus(msg) {
        const el = document.getElementById('statusInfo');
        if (el) el.textContent = msg;
    }

    showError(title, message) {
        const panel = document.getElementById('errorPanel');
        const content = document.getElementById('errorContent');
        content.innerHTML = `<strong>${title}</strong><br><br>${message.replace(/\n/g, '<br>')}`;
        panel.style.display = 'block';
        this.updateStatus(`错误: ${title}`);
    }

    hideErrorPanel() {
        document.getElementById('errorPanel').style.display = 'none';
    }

    showSidebar(title, contentHTML) {
        document.getElementById('sidebarTitle').textContent = title;
        document.getElementById('sidebarContent').innerHTML = contentHTML;
        document.getElementById('sidebar').style.display = 'block';
    }

    closeSidebar() {
        document.getElementById('sidebar').style.display = 'none';
    }

    showModal(title, bodyHTML, onConfirm) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHTML;
        document.getElementById('modal').style.display = 'flex';
        
        const confirmBtn = document.getElementById('modalConfirm');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            this.closeModal();
        });
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }

    // Multi Split Logic
    initMultiSplit() {
        try {
            const data = JSON.parse(localStorage.getItem('json-tool-data') || '{}');
            if (data.splitPaneWidths) this.splitPaneWidths = data.splitPaneWidths;
            if (data.splitPaneContents) this.splitPaneContents = data.splitPaneContents;
        } catch (e) {}

        if (!this.splitPaneWidths.length) {
            this.splitPaneWidths = Array(3).fill(1/3);
            this.splitPaneContents = Array(3).fill('');
        }
        this.renderMultiSplit();
    }

    initFormatterResizer() {
        const resizer = document.getElementById('formatterResizer');
        if (!resizer) return;

        const layout = document.getElementById('formatterLayout');
        const leftPanel = layout.querySelector('.editor-panel');
        const rightPanel = layout.querySelector('.preview-panel');

        let isDragging = false;
        let startX, startLeftWidth, startRightWidth;

        resizer.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            
            // Use getBoundingClientRect for precise pixel widths
            startLeftWidth = leftPanel.getBoundingClientRect().width;
            startRightWidth = rightPanel.getBoundingClientRect().width;
            
            resizer.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const dx = e.clientX - startX;
            const totalWidth = startLeftWidth + startRightWidth;
            
            let newLeftWidth = startLeftWidth + dx;
            let newRightWidth = startRightWidth - dx;

            // Min width constraints
            const minWidth = 200;
            if (newLeftWidth < minWidth) {
                newLeftWidth = minWidth;
                newRightWidth = totalWidth - minWidth;
            } else if (newRightWidth < minWidth) {
                newRightWidth = minWidth;
                newLeftWidth = totalWidth - minWidth;
            }

            // Flex-grow ratio based on pixel width
            // Actually for flex layout, setting flex-basis or just flex-grow is tricky if we want pixel precision.
            // A robust way is to set flex-grow proportional to width
            
            leftPanel.style.flex = `${newLeftWidth} 1 0%`;
            rightPanel.style.flex = `${newRightWidth} 1 0%`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    renderMultiSplit() {
        const container = document.getElementById('multiSplitContainer');
        if (!container) return;
        container.innerHTML = '';
        
        this.splitPaneWidths.forEach((width, i) => {
            const pane = document.createElement('div');
            pane.className = 'multi-pane';
            pane.style.flex = `${width} 0 0%`;
            pane.innerHTML = `
                <header>
                    <div>面板 ${i + 1}</div>
                    <div class="pane-actions">
                        <button class="pane-action-btn" data-index="${i}">美</button>
                        <button class="pane-delete-btn" data-index="${i}">×</button>
                    </div>
                </header>
                <div class="multi-pane-content">
                    <textarea class="multi-pane-textarea" data-index="${i}">${Utils.escapeHtml(this.splitPaneContents[i] || '')}</textarea>
                </div>
            `;
            container.appendChild(pane);
            
            // Add Resizer logic
            if (i < this.splitPaneWidths.length - 1) {
                const resizer = document.createElement('div');
                resizer.className = 'multi-split-resizer';
                
                // Attach Drag Logic
                let isDragging = false;
                let startX;
                let startWidths = [];

                const onMouseDown = (e) => {
                    isDragging = true;
                    startX = e.clientX;
                    startWidths = this.splitPaneWidths.slice(); // Copy current state
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    resizer.classList.add('dragging');

                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                };

                const onMove = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();
                    
                    const containerWidth = container.getBoundingClientRect().width;
                    const dx = e.clientX - startX;
                    const deltaPercent = dx / containerWidth;

                    // Adjust width of current pane (i) and next pane (i+1)
                    const newCurrentW = Math.max(0.05, startWidths[i] + deltaPercent);
                    const newNextW = Math.max(0.05, startWidths[i+1] - deltaPercent);

                    // Check bounds implicitly by ensuring neither goes below threshold
                    if (newCurrentW >= 0.05 && newNextW >= 0.05) {
                        this.splitPaneWidths[i] = newCurrentW;
                        this.splitPaneWidths[i+1] = newNextW;
                        
                        // Update DOM directly for performance
                        const panes = container.querySelectorAll('.multi-pane');
                        panes[i].style.flex = `${newCurrentW} 0 0%`;
                        panes[i+1].style.flex = `${newNextW} 0 0%`;
                    }
                };

                const onUp = () => {
                    if (isDragging) {
                        isDragging = false;
                        resizer.classList.remove('dragging');
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        
                        this.saveSplitLayout();
                    }
                };

                resizer.addEventListener('mousedown', onMouseDown);
                container.appendChild(resizer);
            }
        });
        this.saveSplitLayout();
    }

    addSplitPane() {
        if (this.splitPaneWidths.length >= this.maxSplitPanes) return;
        const n = this.splitPaneWidths.length + 1;
        this.splitPaneWidths = Array(n).fill(1/n);
        this.splitPaneContents.push('');
        this.renderMultiSplit();
    }

    removeSplitPane(index) {
        if (this.splitPaneWidths.length <= 1) return;
        this.splitPaneContents.splice(index, 1);
        const n = this.splitPaneWidths.length - 1;
        this.splitPaneWidths = Array(n).fill(1/n);
        this.renderMultiSplit();
    }

    updatePaneContent(index, value) {
        this.splitPaneContents[index] = value;
        this.saveSplitLayout();
    }

    formatPane(index) {
        try {
            const val = this.splitPaneContents[index];
            const pretty = JSON.stringify(JSON.parse(val), null, 2);
            this.splitPaneContents[index] = pretty;
            this.renderMultiSplit();
        } catch(e) {}
    }

    saveSplitLayout() {
        const data = { splitPaneWidths: this.splitPaneWidths, splitPaneContents: this.splitPaneContents };
        localStorage.setItem('json-tool-data', JSON.stringify(data));
    }
}

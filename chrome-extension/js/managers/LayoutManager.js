import { Utils } from '../utils.js';
import { JSONRenderer } from '../JSONRenderer.js';

export class LayoutManager {
    constructor(app) {
        this.app = app;
        this.splitPaneWidths = [];
        this.splitPaneContents = [];
        this.splitPaneTitles = []; // Initialize titles
        this.maxSplitPanes = 5;
        this._errorTimeout = null; // Initialize error timeout
    }

    init() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('themeToggle').addEventListener('click', () => this.app.toggleTheme());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('closeError').addEventListener('click', () => this.hideErrorPanel());
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('closeSidebar').addEventListener('click', () => this.closeSidebar());

        const addSplitBtn = document.getElementById('addSplitPane');
        if (addSplitBtn) addSplitBtn.addEventListener('click', () => this.addSplitPane());

        const clearAllSplitBtn = document.getElementById('clearAllSplitPanes');
        if (clearAllSplitBtn) clearAllSplitBtn.addEventListener('click', () => this.clearAllSplitPanes());

        const multiSplitContainer = document.getElementById('multiSplitContainer');
        if (multiSplitContainer) {
            multiSplitContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                const collapsible = e.target.closest('.json-collapsible');
                
                if (btn) {
                    if (btn.classList.contains('pane-action-btn')) {
                        const index = parseInt(btn.dataset.index, 10);
                        this.formatPane(index);
                    } else if (btn.classList.contains('pane-delete-btn')) {
                        const index = parseInt(btn.dataset.index, 10);
                        this.removeSplitPane(index);
                    } else if (btn.classList.contains('pane-view-btn')) {
                        const index = parseInt(btn.dataset.index, 10);
                        this.togglePaneView(index, btn);
                    }
                } else if (collapsible) {
                    JSONRenderer.toggleContent(collapsible);
                }
            });
            multiSplitContainer.addEventListener('input', (e) => {
                const target = e.target;
                if (target.classList.contains('multi-pane-textarea')) {
                    const index = parseInt(target.dataset.index, 10);
                    this.updatePaneContent(index, target.value);
                } else if (target.classList.contains('pane-title-input')) {
                    const index = parseInt(target.dataset.index, 10);
                    this.updatePaneTitle(index, target.value);
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

        // Hide error panel when switching tabs
        this.hideErrorPanel();

        this.app.currentTab = tabName;
        this.updateStatus(`已切换到${this.getTabName(tabName)}`);
    }

    getTabName(name) {
        const map = { formatter: '格式化', compare: '对比', converter: '转换', split: '分隔栏', 'other-tools': '其他工具' };
        return map[name] || name;
    }

    updateStatus(msg) {
        const el = document.getElementById('statusInfo');
        if (el) el.textContent = msg;
    }

    showError(title, message) {
        const panel = document.getElementById('errorPanel');
        const content = document.getElementById('errorContent');
        const icon = panel.querySelector('.error-icon');
        
        // Reset to error style
        panel.style.borderLeftColor = 'var(--danger)';
        if (icon) icon.textContent = '⚠️';

        content.innerHTML = `<strong>${title}</strong><br><br>${message.replace(/\n/g, '<br>')}`;
        panel.style.display = 'flex';
        this.updateStatus(`错误: ${title}`);

        // Automatically hide after 5 seconds
        if (this._errorTimeout) {
            clearTimeout(this._errorTimeout);
        }
        this._errorTimeout = setTimeout(() => {
            this.hideErrorPanel();
            this._errorTimeout = null;
        }, 5000); 
    }

    showSuccess(title, message) {
        const panel = document.getElementById('errorPanel');
        const content = document.getElementById('errorContent');
        const icon = panel.querySelector('.error-icon');
        
        // Set to success style
        panel.style.borderLeftColor = 'var(--success)';
        if (icon) icon.textContent = '✅';

        content.innerHTML = `<strong>${title}</strong><br><br>${message.replace(/\n/g, '<br>')}`;
        panel.style.display = 'flex';
        this.updateStatus(`成功: ${title}`);

        // Automatically hide after 3 seconds
        if (this._errorTimeout) {
            clearTimeout(this._errorTimeout);
        }
        this._errorTimeout = setTimeout(() => {
            this.hideErrorPanel();
            this._errorTimeout = null;
        }, 3000); 
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

    openSettings() {
        const apiKey = localStorage.getItem('zhipu_api_key') || '';
        const html = `
            <div class="settings-form" style="padding: 10px;">
                <div class="config-group">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">智谱AI API Key</label>
                    <input type="password" id="zhipuApiKey" class="input-field" value="${apiKey}" placeholder="请输入 API Key" style="width: 100%;">
                    <p class="help-text" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                        用于智能修复 JSON 功能。请访问 <a href="https://open.bigmodel.cn/" target="_blank" style="color: var(--primary-color);">智谱AI开放平台</a> 获取。
                        <br>API Key 仅保存在本地浏览器中。
                    </p>
                </div>
                <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button class="tool-btn primary" id="saveSettingsBtn">保存设置</button>
                </div>
            </div>
        `;
        
        this.showSidebar('设置', html);
        
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            const key = document.getElementById('zhipuApiKey').value.trim();
            if (key) {
                localStorage.setItem('zhipu_api_key', key);
                this.updateStatus('设置已保存');
                this.closeSidebar();
            } else {
                localStorage.removeItem('zhipu_api_key');
                this.updateStatus('API Key 已清除');
                this.closeSidebar();
            }
        });
    }

    // Multi Split Logic
    initMultiSplit() {
        try {
            const data = JSON.parse(localStorage.getItem('json-tool-data') || '{}');
            if (data.splitPaneWidths) this.splitPaneWidths = data.splitPaneWidths;
            if (data.splitPaneContents) this.splitPaneContents = data.splitPaneContents;
            if (data.splitPaneTitles) this.splitPaneTitles = data.splitPaneTitles;
        } catch (e) {}

        if (!this.splitPaneWidths.length) {
            this.splitPaneWidths = Array(3).fill(1/3);
            this.splitPaneContents = Array(3).fill('');
            this.splitPaneTitles = ['面板 1', '面板 2', '面板 3'];
        }
        // Ensure titles array matches width array length (migration handling)
        if (this.splitPaneTitles.length < this.splitPaneWidths.length) {
             for (let i = this.splitPaneTitles.length; i < this.splitPaneWidths.length; i++) {
                 this.splitPaneTitles.push(`面板 ${i + 1}`);
             }
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
                    <input type="text" class="pane-title-input" data-index="${i}" value="${Utils.escapeHtml(this.splitPaneTitles[i] || `面板 ${i + 1}`)}" spellcheck="false">
                    <div class="pane-actions">
                        <button class="pane-view-btn" data-index="${i}" title="切换视图/编辑">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9.04,123.97,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231,128C226.69,135.52,197.29,182.4,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"></path></svg>
                        </button>
                        <button class="pane-action-btn" data-index="${i}" title="格式化">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,136a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h40A8,8,0,0,1,216,136Zm-8,56H144a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm8-128H168a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16ZM213.38,27.57a8.09,8.09,0,0,0-8.19.94L132,80.44,58.81,7.25a8,8,0,0,0-11.32,11.31L106.34,80,33.19,153.19A8,8,0,0,0,32,164.69a7.93,7.93,0,0,0,5.66,2.34,8,8,0,0,0,5.65-2.34L117.66,91.31,190.81,164.5A8,8,0,0,0,202.12,153.19l-58.81-58.82,73.19-51.94A8.1,8.1,0,0,0,213.38,27.57Z"></path></svg>
                        </button>
                        <button class="pane-delete-btn" data-index="${i}" title="删除">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>
                        </button>
                    </div>
                </header>
                <div class="multi-pane-content">
                    <textarea class="multi-pane-textarea" data-index="${i}">${Utils.escapeHtml(this.splitPaneContents[i] || '')}</textarea>
                    <div class="multi-pane-view" data-index="${i}" style="display: none;"></div>
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

    togglePaneView(index, btn) {
        const container = document.getElementById('multiSplitContainer');
        const panes = container.querySelectorAll('.multi-pane');
        if (!panes[index]) return;

        const textarea = panes[index].querySelector('.multi-pane-textarea');
        const view = panes[index].querySelector('.multi-pane-view');
        
        if (view.style.display === 'none') {
            // Switch to View
            const content = textarea.value.trim();
            if (!content) {
                view.innerHTML = '<span style="color: var(--text-muted); font-style: italic; padding: 10px;">无内容</span>';
            } else {
                try {
                    const parsed = JSON.parse(content);
                    view.innerHTML = JSONRenderer.renderJSONTree(parsed);
                } catch (e) {
                    this.showError('无法切换视图', 'JSON 格式无效: ' + e.message);
                    return;
                }
            }
            textarea.style.display = 'none';
            view.style.display = 'block';
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152.05a16,16,0,0,0-4.69,11.31v44.69A16,16,0,0,0,48,224H92.69a16,16,0,0,0,11.31-4.69L227.31,96A16,16,0,0,0,227.31,73.37ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"></path></svg>'; // Edit icon
            btn.title = "切换编辑模式";
        } else {
            // Switch to Edit
            view.style.display = 'none';
            textarea.style.display = 'block';
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9.04,123.97,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231,128C226.69,135.52,197.29,182.4,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"></path></svg>'; // Eye icon
            btn.title = "切换视图模式";
        }
    }

    addSplitPane() {
        if (this.splitPaneWidths.length >= this.maxSplitPanes) return;
        const n = this.splitPaneWidths.length + 1;
        this.splitPaneWidths = Array(n).fill(1/n);
        this.splitPaneContents.push('');
        this.splitPaneTitles.push(`面板 ${n}`);
        this.renderMultiSplit();
    }

    removeSplitPane(index) {
        if (this.splitPaneWidths.length <= 1) return;
        this.splitPaneContents.splice(index, 1);
        this.splitPaneTitles.splice(index, 1);
        const n = this.splitPaneWidths.length - 1;
        this.splitPaneWidths = Array(n).fill(1/n);
        this.renderMultiSplit();
    }

    updatePaneContent(index, value) {
        this.splitPaneContents[index] = value;
        this.saveSplitLayout();
    }

    updatePaneTitle(index, value) {
        this.splitPaneTitles[index] = value;
        this.saveSplitLayout();
    }

    formatPane(index) {
        try {
            const container = document.getElementById('multiSplitContainer');
            if (!container) return;
            
            const panes = container.querySelectorAll('.multi-pane');
            if (!panes[index]) return;

            const textarea = panes[index].querySelector('.multi-pane-textarea');
            const val = textarea.value; 
            if (!val.trim()) return;

            const parsed = JSON.parse(val);
            const pretty = JSON.stringify(parsed, null, 2);
            
            // Update Model
            this.splitPaneContents[index] = pretty;
            
            // Update View
            textarea.value = pretty;
            
            // Also update view mode if active
            const view = panes[index].querySelector('.multi-pane-view');
            if (view.style.display !== 'none') {
                view.innerHTML = JSONRenderer.renderJSONTree(parsed);
            }

            this.saveSplitLayout();
            this.updateStatus(`面板 ${index + 1} 已格式化`);
        } catch(e) {
            this.showError('格式化失败', e.message);
        }
    }

    saveSplitLayout() {
        const data = {
            splitPaneWidths: this.splitPaneWidths,
            splitPaneContents: this.splitPaneContents,
            splitPaneTitles: this.splitPaneTitles
        };
        localStorage.setItem('json-tool-data', JSON.stringify(data));
    }

    /**
     * 清空所有分隔栏的数据内容
     */
    clearAllSplitPanes() {
        // 确认操作
        if (!confirm('确定要清空所有分隔栏的数据吗？此操作不可撤销。')) {
            return;
        }

        // 清空所有内容
        this.splitPaneContents = this.splitPaneContents.map(() => '');

        // 重新渲染
        this.renderMultiSplit();

        // 保存到本地存储
        this.saveSplitLayout();

        // 更新状态
        this.updateStatus('已清空所有分隔栏数据');
    }
}

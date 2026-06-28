import { HexDecodeTool } from './HexDecodeTool.js';
import { Base64Tool } from './Base64Tool.js';
import { UrlCodecTool } from './UrlCodecTool.js';

/**
 * 解码工具
 * 聚合多种解码/编码子功能（16进制、Base64、URL），通过子 tab 切换
 */
export class DecodeTool {
    constructor(app) {
        this.app = app;
        this.toolId = 'decode';
        // 子功能工具实例
        this.hexTool = new HexDecodeTool(app);
        this.base64Tool = new Base64Tool(app);
        this.urlTool = new UrlCodecTool(app);
        this.currentSubTab = 'hex';
    }

    /**
     * 初始化：初始化各子工具并绑定子 tab 切换
     */
    init() {
        this.hexTool.init();
        this.base64Tool.init();
        this.urlTool.init();
        this.bindSubTabEvents();
    }

    /**
     * 绑定子 tab 切换事件
     */
    bindSubTabEvents() {
        document.querySelectorAll('.decode-subtab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSubTab(e.currentTarget.dataset.subtab);
            });
        });
    }

    /**
     * 切换子功能 tab（hex / base64）
     */
    switchSubTab(subTabId) {
        if (!subTabId) return;

        document.querySelectorAll('.decode-subtab').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.decode-subtab[data-subtab="${subTabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        document.querySelectorAll('.decode-subview').forEach(v => v.classList.remove('active'));
        const activeView = document.getElementById(`decode-${subTabId}`);
        if (activeView) activeView.classList.add('active');

        this.currentSubTab = subTabId;
    }

    /**
     * 销毁工具
     */
    destroy() {
        if (typeof this.hexTool.destroy === 'function') this.hexTool.destroy();
        if (typeof this.base64Tool.destroy === 'function') this.base64Tool.destroy();
        if (typeof this.urlTool.destroy === 'function') this.urlTool.destroy();
    }
}

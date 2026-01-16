import { TimestampTool } from './tools/TimestampTool.js';
import { HexDecodeTool } from './tools/HexDecodeTool.js';

/**
 * 其他工具管理器
 * 负责协调和管理所有子工具
 */
export class OtherToolsManager {
    constructor(app) {
        this.app = app;
        this.tools = new Map(); // 存储所有工具实例
        this.currentTool = null; // 当前激活的工具
    }

    /**
     * 初始化管理器
     */
    init() {
        this.registerTools();
        this.bindNavigationEvents();
        this.initializeTools();
    }

    /**
     * 注册所有工具
     */
    registerTools() {
        // 注册时间戳转换工具
        this.registerTool('timestamp', new TimestampTool(this.app));

        // 注册16进制解码工具
        this.registerTool('hexdecode', new HexDecodeTool(this.app));

        // 未来可以在这里添加更多工具
        // this.registerTool('base64', new Base64Tool(this.app));
        // this.registerTool('url-encode', new UrlEncodeTool(this.app));
    }

    /**
     * 注册单个工具
     */
    registerTool(toolId, toolInstance) {
        this.tools.set(toolId, toolInstance);
    }

    /**
     * 初始化所有工具
     */
    initializeTools() {
        for (const [toolId, tool] of this.tools) {
            try {
                tool.init();
                console.log(`工具 ${toolId} 初始化成功`);
            } catch (error) {
                console.error(`工具 ${toolId} 初始化失败:`, error);
            }
        }

        // 默认激活第一个工具
        this.currentTool = 'timestamp';
    }

    /**
     * 绑定导航事件
     */
    bindNavigationEvents() {
        document.querySelectorAll('.tool-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toolId = e.currentTarget.dataset.tool;
                this.switchTool(toolId);
            });
        });
    }

    /**
     * 切换工具
     */
    switchTool(toolId) {
        // 验证工具是否存在
        if (!this.tools.has(toolId)) {
            console.warn(`工具 ${toolId} 不存在`);
            return;
        }

        // 更新导航状态
        document.querySelectorAll('.tool-nav-item').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.tool-nav-item[data-tool="${toolId}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // 更新视图状态
        document.querySelectorAll('.tool-view').forEach(view => view.classList.remove('active'));
        const activeView = document.getElementById(`tool-${toolId}`);
        if (activeView) activeView.classList.add('active');

        // 更新当前工具
        this.currentTool = toolId;

        // 可以在这里添加工具切换的钩子
        this.onToolSwitch(toolId);
    }

    /**
     * 工具切换钩子
     */
    onToolSwitch(toolId) {
        // 工具切换时的额外逻辑
        // 例如：清理前一个工具的状态、加载新工具的默认数据等
        console.log(`切换到工具: ${toolId}`);
    }

    /**
     * 获取当前工具实例
     */
    getCurrentTool() {
        return this.tools.get(this.currentTool);
    }

    /**
     * 获取指定工具实例
     */
    getTool(toolId) {
        return this.tools.get(toolId);
    }

    /**
     * 销毁所有工具
     */
    destroy() {
        for (const [toolId, tool] of this.tools) {
            if (typeof tool.destroy === 'function') {
                try {
                    tool.destroy();
                    console.log(`工具 ${toolId} 销毁成功`);
                } catch (error) {
                    console.error(`工具 ${toolId} 销毁失败:`, error);
                }
            }
        }
        this.tools.clear();
    }
}

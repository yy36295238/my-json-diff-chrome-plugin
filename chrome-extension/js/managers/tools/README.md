# 其他工具模块化架构文档

## 📁 文件结构

```
chrome-extension/js/managers/
├── OtherToolsManager.js          # 工具管理协调器
└── tools/                         # 工具子模块目录
    ├── TimestampTool.js          # 时间戳转换工具
    └── HexDecodeTool.js          # 16进制编解码工具
```

## 🏗️ 架构设计

### 1. 管理器模式
采用**管理器-工具**的两层架构：
- **OtherToolsManager**: 顶层管理协调器，负责工具的注册、初始化、切换和生命周期管理
- **Tool类**: 独立的工具模块，各自封装完整的功能逻辑

### 2. 工具接口规范
每个工具类都需要实现以下标准接口：

```javascript
class SomeTool {
    constructor(app) {
        this.app = app;          // 主应用实例引用
        this.toolId = 'toolId';  // 工具唯一标识
    }

    init() {
        // 初始化工具，绑定事件
    }

    destroy() {
        // 清理资源（可选）
    }
}
```

## 🔧 现有工具

### 1. TimestampTool - 时间戳转换
**文件**: `tools/TimestampTool.js`
**功能**:
- 时间戳 → 日期时间
- 日期时间 → 时间戳
- 使用当前时间
- 自动检测秒/毫秒

**DOM元素**:
- `timestampInput` - 时间戳输入框
- `dateInput` - 日期输入框
- `tsToDateBtn` - 转换按钮
- `dateToTsBtn` - 转换按钮

### 2. HexDecodeTool - 16进制编解码
**文件**: `tools/HexDecodeTool.js`
**功能**:
- 16进制 → 文本解码
- 文本 → 16进制编码
- XML/JSON格式化
- 支持多种字符编码（UTF-8, GBK, GB2312, ASCII）

**DOM元素**:
- `hexInput` - 16进制输入框
- `hexOutput` - 解码结果输出框
- `hexCharset` - 字符编码选择器
- `hexDecodeBtn` - 解码按钮
- `hexEncodeBtn` - 编码按钮
- `formatHexOutput` - 格式化按钮

## ➕ 如何添加新工具

### 步骤1: 创建工具类文件
在 `tools/` 目录下创建新文件，例如 `Base64Tool.js`:

```javascript
/**
 * Base64编解码工具
 */
export class Base64Tool {
    constructor(app) {
        this.app = app;
        this.toolId = 'base64';
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 绑定按钮事件
        const encodeBtn = document.getElementById('base64EncodeBtn');
        if (encodeBtn) {
            encodeBtn.addEventListener('click', () => this.encode());
        }
    }

    encode() {
        // 实现编码逻辑
    }

    decode() {
        // 实现解码逻辑
    }

    destroy() {
        // 清理工作（可选）
    }
}
```

### 步骤2: 在HTML中添加UI
在 `index.html` 的 `other-tools-content` 部分添加：

```html
<!-- 导航按钮 -->
<button class="tool-nav-item" data-tool="base64">
    <svg>...</svg>
    Base64 编解码
</button>

<!-- 工具视图 -->
<div class="tool-view" id="tool-base64">
    <!-- 工具的UI界面 -->
</div>
```

### 步骤3: 在管理器中注册
在 `OtherToolsManager.js` 中注册新工具：

```javascript
import { Base64Tool } from './tools/Base64Tool.js';

registerTools() {
    this.registerTool('timestamp', new TimestampTool(this.app));
    this.registerTool('hexdecode', new HexDecodeTool(this.app));
    this.registerTool('base64', new Base64Tool(this.app));  // 新增
}
```

## ✨ 优势

### 1. 模块隔离
- ✅ 每个工具独立文件，代码隔离
- ✅ 工具间互不影响，易于维护
- ✅ 单个工具出错不会影响其他工具

### 2. 易于扩展
- ✅ 添加新工具只需3步：创建类 → 添加UI → 注册
- ✅ 不需要修改现有工具代码
- ✅ 统一的接口规范

### 3. 便于测试
- ✅ 可以单独测试每个工具
- ✅ 清晰的依赖关系
- ✅ 易于mock和单元测试

### 4. 统一管理
- ✅ 集中式工具注册和初始化
- ✅ 统一的生命周期管理
- ✅ 方便添加全局钩子和中间件

## 🔄 工具生命周期

```
注册 → 初始化 → 激活 → 使用 → 切换 → 销毁
  ↓       ↓       ↓      ↓      ↓      ↓
register init  switch  use  switch destroy
```

## 📝 最佳实践

1. **命名规范**: 工具类以 `Tool` 结尾，如 `TimestampTool`
2. **文件位置**: 所有工具放在 `tools/` 目录下
3. **DOM ID**: 使用工具名作为前缀，如 `hexDecodeBtn`
4. **错误处理**: 使用 `this.app.layout.showError()` 统一错误提示
5. **成功提示**: 使用 `this.app.layout.showToast()` 统一成功提示
6. **清理资源**: 在 `destroy()` 中清理事件监听器和定时器

## 🎯 未来扩展方向

可以添加的工具示例：
- Base64 编解码
- URL 编解码
- MD5/SHA 哈希计算
- UUID 生成器
- 正则表达式测试
- 颜色转换器
- 单位转换器

## 📞 工具通信

工具可以通过 `this.app` 访问主应用：
```javascript
// 显示错误
this.app.layout.showError('错误信息');

// 显示提示
this.app.layout.showToast('成功消息');

// 更新状态栏
this.app.layout.updateStatus('状态信息');

// 访问其他管理器
this.app.formatter.someMethod();
```

## 🐛 调试

在控制台查看工具初始化日志：
```
工具 timestamp 初始化成功
工具 hexdecode 初始化成功
切换到工具: hexdecode
```

---

**创建时间**: 2026-01-13
**架构版本**: v1.0
**维护者**: JSON Editor Pro Team

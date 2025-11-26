# JSON Editor Pro - 专业级JSON处理 Chrome 扩展

🔧 **JSON Editor Pro** 是一款专为 Chrome 浏览器打造的强大 JSON 处理工具。集成了格式化、深度对比、Java/SQL 转换、模拟数据生成以及多窗格工作区等高级功能，所有操作均在本地完成，安全高效。

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome_Extension-blue.svg)](chrome-extension)

## ✨ 主要特性

### 1. 🚀 智能 JSON 格式化 (Formatter)
- **递归解析**：自动识别并解析 JSON 字符串中的嵌套 JSON（例如 API 返回的转义 JSON 字符串）。
- **实时校验**：输入时即时检测语法错误并定位行号。
- **多种视图**：支持代码视图和可折叠的树形视图。
- **路径提取**：点击任意节点即可自动生成并复制 JSONPath。
- **辅助工具**：一键压缩、去转义、复制结果。
- **布局调整**：支持拖拽调整输入框与预览框的宽度。

### 2. ⚖️ 深度 JSON 对比 (Compare)
- **结构化差异分析**：不仅仅是文本 diff，而是基于 JSON 结构的深度比较。
- **差异高亮**：清晰标记新增（绿色）、删除（红色）和修改（黄色）的字段。
- **双向同步**：左右两侧均支持独立格式化与编辑，行号自动对齐。

### 3. 🔄 强大的代码转换 (Converter)
- **JSON 转 Java**：一键生成对应的 Java 实体类，支持 Lombok `@Data` 注解，自动识别类型。
- **JSON 转 SQL**：生成标准的 SQL `INSERT` 语句。
- **SQL 转 JSON**：解析 `INSERT` 语句还原为 JSON 数据。
- **灵活布局**：优化的转换面板，支持全屏查看大量转换结果。

### 4. 🎲 模拟数据生成器 (Generator)
- **多模板支持**：内置用户、商品、订单、公司等多种常用数据模板。
- **批量生成**：支持一次性生成多条数据。
- **多语言**：支持生成中文、英文、日文的模拟数据。

### 5. 🪟 多窗格工作区 (Split View)
- **多任务处理**：动态添加多个独立编辑器窗口。
- **自由布局**：支持拖拽调整每个窗格的宽度，满足不同对比需求。
- **独立操作**：每个窗格均支持单独的格式化与压缩。

## 📦 安装指南

本扩展目前支持以"开发者模式"加载。

1. **下载代码**：
   克隆或下载本项目到本地。
   ```bash
   git clone https://github.com/your-repo/json-editor-pro.git
   ```

2. **打开 Chrome 扩展管理页面**：
   在浏览器地址栏输入 `chrome://extensions/` 并回车。

3. **开启开发者模式**：
   点击页面右上角的 **"开发者模式"** 开关。

4. **加载已解压的扩展程序**：
   点击左上角的 **"加载已解压的扩展程序"** 按钮，选择项目目录下的 `chrome-extension` 文件夹。

5. **开始使用**：
   点击浏览器工具栏出现的 🔧 图标即可打开工具。

## 🔨 开发与打包

### 项目结构
```
my-json-diff-chrome-plugin/
├── chrome-extension/        # 扩展核心源码
│   ├── manifest.json        # V3 配置清单
│   ├── background.js        # Service Worker
│   ├── index.html           # 主应用入口
│   ├── styles-simple.css    # 样式文件
│   ├── js/                  # 模块化脚本
│   │   ├── app.js           # 主逻辑
│   │   ├── utils.js         # 工具函数
│   │   └── managers/        # 功能管理器
│   │       ├── FormatterManager.js
│   │       ├── CompareManager.js
│   │       ├── ConverterManager.js
│   │       ├── GeneratorManager.js
│   │       └── LayoutManager.js
│   └── icons/               # 图标资源
├── build-chrome-extension.sh # 打包脚本
└── README.md                # 项目说明
```

### 打包发布
运行根目录下的打包脚本，将在 `dist/` 目录生成可上传至 Chrome Web Store 的 `.zip` 文件。

```bash
./build-chrome-extension.sh
```

## 🔒 隐私与安全

- **本地运行**：所有数据处理均在浏览器本地完成，不会上传至任何服务器。
- **内容安全策略 (CSP)**：严格遵循 Chrome 扩展 V3 安全规范。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进这个工具！

## 📄 许可证

[MIT License](LICENSE)
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个专业级 JSON 处理工具的 Chrome 扩展（Manifest V3）。点击扩展图标后在新标签页打开完整应用。所有实际代码位于 `chrome-extension/` 目录，项目根目录只有构建脚本和文档。

## 核心架构

### 文件结构（全部在 chrome-extension/ 下）
- `manifest.json` - 扩展配置（Manifest V3）
- `index.html` - 主 UI 入口（单页应用，无构建步骤，原生 ES Modules）
- `background.js` - Service Worker，处理图标点击（聚焦已有工具页或新开标签）
- `content.js` - 内容脚本，支持 Ctrl+Shift+J 在网页上呼出迷你 JSON 面板、提取页面 JSON
- `styles-simple.css` - 核心设计系统（CSS 变量、亮/暗主题）
- `styles-extra.css` / `styles-extra-pane.css` / `styles-actions.css` - 便签、多窗格等附加样式
- `js/app.js` - 主类 `JSONToolApp`：模块组装、主题、全局历史、localStorage 持久化（防抖 + 配额兜底）、全局快捷键
- `js/utils.js` - 通用工具（HTML 转义、JSONPath 生成/取值、深度解析、深度排序）
- `js/JSONRenderer.js` - JSON 树渲染（含大数据量保护：单节点 500 子项 / 总量 20000 节点截断）
- `js/managers/FormatterManager.js` - 格式化页签（美化/压缩/去转义，输入 300ms 防抖，>1MB 跳过自动预览）
- `js/managers/CompareManager.js` - 结构化 diff（身份字段 + 相似度的数组智能匹配、按侧独立 undo/redo、行级高亮）
- `js/managers/ConverterManager.js` - JSON↔Java/SQL/Map toString 转换
- `js/managers/LayoutManager.js` - 页签切换、toast/错误面板、模态框、设置侧栏、多窗格布局
- `js/managers/NotesManager.js` - 便签画布（拖拽/缩放/15 秒删除撤回）
- `js/managers/OtherToolsManager.js` + `js/managers/tools/` - 时间戳转换、16 进制编解码、ObjectId 生成

### 页签
格式化、对比、多窗格（最多 5 个分栏）、转换、便签、其他工具。

## 开发命令

```bash
# 本地运行（ES Modules 必须走 HTTP，file:// 会被 CORS 拦截）
cd chrome-extension && python3 -m http.server 8080
# 访问 http://localhost:8080/index.html

# 语法检查
for f in chrome-extension/js/**/*.js; do node --check "$f"; done

# 加载扩展到 Chrome
# chrome://extensions/ → 开发者模式 → 加载已解压的扩展程序 → 选择 chrome-extension 文件夹

# 打包
./build-chrome-extension.sh
```

## 代码规约

- 原生 ES6+ 与 class 结构，无构建工具、无第三方依赖
- 中文注释、camelCase 命名、事件处理用箭头函数、异步用 async/await
- 所有插入 innerHTML 的动态内容必须经 `Utils.escapeHtml` 转义
- 用户反馈统一走 `layout.showToast(message, type)`（轻提示）或 `layout.showError/showSuccess(title, message)`（面板，兼容单参数）
- 高危操作用 `layout.confirm({...})`（Promise 风格统一弹窗）
- 复制一律用 `navigator.clipboard.writeText`
- 持久化写 localStorage 必须防抖，超大内容（>200KB）不入持久化历史

## 关键约定

- 主题唯一来源是 localStorage 的 `json-tool-theme`，通过 `data-theme` 属性切换，主题图标由 CSS 控制（不要用 JS 覆盖按钮内容）
- 对比页 textarea 为 `wrap="off"`，差异高亮依赖"行号 × 行高"定位
- 对比的"递归解析嵌套 JSON"是可选项（`#deepParseToggle`，默认关）
- 所有数据处理均在本地完成，不向任何外部服务器发送数据（无任何远程请求）
- 快捷键：Cmd/Ctrl+Enter 执行当前页签主操作；Tab 在代码编辑区插入空格；Esc 关闭模态框/侧栏

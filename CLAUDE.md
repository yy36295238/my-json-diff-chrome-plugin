# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个专业级JSON处理工具，支持格式化、对比、数据生成等功能。项目包含两个主要部分：
1. **Web应用** - 基于HTML5的完整JSON工具
2. **Chrome扩展** - 浏览器插件版本

## 核心架构

### 主要文件结构
- `index.html` - 主应用入口，使用标签页式布局
- `scripts.js` - 核心应用逻辑，包含`JSONToolApp`主类
- `styles-simple.css` / `styles.css` - 样式文件，支持亮色/暗色主题
- `chrome-extension/` - Chrome浏览器扩展版本

### 核心应用类 (JSONToolApp)
主应用类负责：
- 标签页管理（格式化、对比、生成器、分隔栏）
- 主题切换和持久化
- 历史记录管理（支持撤销/重做）
- JSON验证和实时语法检查
- 对比功能的差异高亮

### 功能模块
1. **JSON格式化器** - 美化和压缩JSON
2. **JSON对比工具** - 深度对比两个JSON的差异
3. **数据生成器** - 基于模板生成测试数据
4. **多分隔栏** - 同时处理多个JSON文档

## 开发命令

### 运行应用
```bash
# 直接在浏览器中打开
open index.html

# 或使用本地服务器
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

### 测试
```bash
# 打开测试页面
open test.html

# 运行特定功能测试
open test-enhanced-compare.html
open test-preview.html
```

### Chrome扩展开发
```bash
# 加载扩展到Chrome
# 1. 在 chrome://extensions/ 开启开发者模式
# 2. 点击"加载已解压的扩展程序"
# 3. 选择 chrome-extension 文件夹
```

## 代码规约

### JavaScript风格
- 使用ES6+语法和类结构
- 函数名和变量使用camelCase
- 事件处理器使用箭头函数
- 异步操作使用async/await

### CSS主题支持
- 支持`light`和`dark`两种主题
- 主题设置存储在localStorage中
- 使用CSS变量进行主题切换

### 文件组织
- 测试文件以`test-`前缀命名
- HTML测试页面直接可在浏览器中运行
- Chrome扩展文件独立在`chrome-extension/`目录

## 关键特性

### 实时验证
- JSON编辑器支持实时语法验证
- 错误信息显示具体位置和修复建议
- 行号显示和滚动同步

### 历史记录
- 支持撤销/重做操作
- 对比功能的左右输入框有独立历史
- 历史记录持久化到localStorage

### 主题系统
- 响应式设计，支持移动端
- 主题切换动画效果
- 设置自动保存和恢复

### 文件处理
- 支持拖拽上传JSON文件
- 文件导入/导出功能
- 大文件性能优化

## 扩展开发

### Manifest V3
Chrome扩展使用最新的Manifest V3规范：
- Service Worker替代background page
- 权限控制更严格
- 内容脚本和弹窗分离

### 权限需求
- `storage` - 保存用户设置
- `tabs` - 访问当前标签页
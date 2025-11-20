# JSON工具 - 专业级JSON处理平台

🔧 一个功能强大的JSON处理工具，提供格式化、对比、数据生成和多分隔栏功能。支持Web应用和Chrome浏览器扩展两种使用方式。

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-orange.svg)](chrome-extension)

<img width="1912" height="937" alt="JSON工具主界面" src="https://github.com/user-attachments/assets/4417c643-b654-442f-86ba-bb2121df2bd0" />

<img width="1904" height="930" alt="JSON对比功能" src="https://github.com/user-attachments/assets/32b32689-8e4f-4ba4-8563-3f3564795846" />

## 📑 目录

- [功能特色](#-功能特色)
- [快速开始](#-快速开始)
- [使用指南](#-使用指南)
- [Chrome扩展](#-chrome扩展)
- [项目结构](#-项目结构)
- [开发说明](#️-开发说明)
- [更新日志](#-更新日志)

## ✨ 功能特色

### 🎯 核心功能

#### 1. JSON格式化器
- ✅ JSON美化和压缩
- ✅ **递归解析JSON字符串** - 自动将字符串值中的JSON解析为对象/数组
- ✅ 实时语法验证和错误提示
- ✅ 树形视图（展开/折叠）
- ✅ 行号显示和滚动同步
- ✅ 字符/行数/大小统计
- ✅ 移除转义符功能

**递归解析示例：**
```json
// 输入
{"data": "[{\"id\":1},{\"id\":2}]"}

// 输出（递归解析后）
{
  "data": [
    {"id": 1},
    {"id": 2}
  ]
}
```

#### 2. JSON对比工具
- ✅ 深度对比两个JSON文档
- ✅ 差异高亮显示（新增🟢/删除🔴/修改🟡）
- ✅ 行号同步和双栏显示
- ✅ 支持大文件对比
- ✅ 左右独立美化功能

#### 3. 数据生成器
- ✅ 8种预设模板：用户信息、商品数据、订单记录、地址信息、公司信息、文章内容、API响应、配置文件
- ✅ 自定义生成数量（1-1000）
- ✅ 数组/对象格式选择
- ✅ 随机字段选项
- ✅ 多语言支持（中文、英文、日文）

#### 4. 多分隔栏
- ✅ 同时处理多个JSON文档
- ✅ 可拖拽调整窗格大小
- ✅ 每个窗格独立操作（美化/压缩）
- ✅ 动态添加/删除分隔栏

### 🎨 界面特性
- **响应式设计** - 完美适配桌面和移动设备
- **双主题支持** - 亮色/暗色主题自由切换
- **标签页布局** - 清晰的功能分区和导航
- **实时预览** - 即时显示格式化结果

### 🔧 高级功能
- **历史记录** - 支持撤销/重做操作
- **本地存储** - 设置和数据自动保存
- **快捷操作** - 工具栏和快捷键支持
- **性能优化** - 大文件处理优化

## 🚀 快速开始

### 方式1：Web应用（直接使用）

#### 在线使用
直接在浏览器中打开 `index.html` 文件即可使用所有功能。

```bash
# 方法1：直接打开
open index.html

# 方法2：使用本地服务器
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

### 方式2：Chrome扩展（推荐）

#### 安装步骤
1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启右上角的"**开发者模式**"
3. 点击"**加载已解压的扩展程序**"
4. 选择 `chrome-extension` 文件夹

#### 使用方法
- 点击浏览器工具栏的 **🔧** 图标
- 自动在新标签页打开完整功能
- 享受所有高级特性

#### 打包发布
```bash
./build-chrome-extension.sh
# 生成的ZIP文件位于 dist/ 目录
```

## 📖 使用指南

### JSON格式化器

1. **基础使用**
   - 在左侧编辑器中输入或粘贴JSON数据
   - 勾选"递归解析JSON字符串"（处理嵌套JSON字符串）
   - 点击"美化"按钮格式化，或"压缩"按钮压缩
   - 右侧预览区域实时显示结果

2. **高级功能**
   - 展开/折叠：快速查看JSON结构
   - 树形视图：切换不同的可视化模式
   - 错误提示：智能提示JSON语法错误
   - 移除转义符：清理字符串中的转义字符

### JSON对比工具

1. 在左右两个编辑器中分别输入JSON数据
2. 点击"对比"按钮开始分析
3. 差异颜色说明：
   - 🟢 **绿色** - 右侧新增的内容
   - 🔴 **红色** - 左侧删除的内容
   - 🟡 **黄色** - 内容被修改
4. 使用"美化"按钮格式化左右两侧的JSON

### 数据生成器

1. 选择数据模板（如"用户信息"）
2. 设置生成选项：
   - 数量：1-1000
   - 生成数组：输出数组格式
   - 随机字段：增加字段多样性
   - 语言：中文/英文/日文
3. 点击"生成数据"
4. 点击"使用"将数据导入格式化器

### 多分隔栏

1. 点击"添加分隔栏"创建新窗格
2. 拖拽分隔线调整大小
3. 每个窗格独立编辑和操作
4. 点击"×"删除不需要的窗格

## 🔌 Chrome扩展

### 特点
- ✅ **零弹窗** - 点击图标直接打开完整功能
- ✅ **体积小** - 仅37KB
- ✅ **功能全** - Web版所有功能
- ✅ **速度快** - 本地运行，无需网络

### 安装包信息
- **文件**: `dist/json-tool-extension-20251120_123033.zip`
- **大小**: 37KB
- **版本**: 2.0.0
- **Manifest**: V3（最新规范）

### 快速测试

测试递归解析功能：

```json
{
  "cost_affiliation": "[{\"category\":2,\"id\":\"688c14e3dc71cc0e5302baed\"}]",
  "cost_info": "{\"cost_list\":[{\"id\":123}]}"
}
```

点击"美化"后，JSON字符串会被解析为真实的对象/数组。

### 文件结构
```
chrome-extension/
├── manifest.json          # 扩展配置（V3）
├── background.js          # 后台服务
├── index.html             # 主页面
├── scripts.js             # 完整逻辑
├── styles-simple.css      # 样式文件
└── icons/
    └── icon.svg           # 扩展图标
```

## 📁 项目结构

```
json-tool/
├── index.html              # Web应用主页
├── scripts.js              # 核心应用逻辑（JSONToolApp类）
├── styles-simple.css       # 主样式文件
├── styles.css              # 备用样式
├── chrome-extension/       # Chrome扩展版本
│   ├── manifest.json       # 扩展配置（V3）
│   ├── background.js       # 后台服务
│   ├── index.html          # 扩展主页
│   ├── scripts.js          # 扩展逻辑
│   ├── content.js          # 内容脚本
│   └── icons/              # 图标资源
├── dist/                   # 打包输出
├── build-chrome-extension.sh  # 打包脚本
├── CLAUDE.md               # 开发指南
└── README.md               # 项目说明
```

## 🛠️ 开发说明

### 技术栈
- **前端**: HTML5 + CSS3 + ES6+ JavaScript
- **架构**: 面向对象编程（JSONToolApp主类）
- **样式**: CSS变量 + 主题系统
- **存储**: localStorage持久化
- **扩展**: Chrome Extension Manifest V3

### 核心类结构
```javascript
class JSONToolApp {
    // 主应用类，负责：
    // - 标签页管理和切换
    // - 主题系统控制
    // - 历史记录管理（撤销/重做）
    // - JSON验证和格式化
    // - 对比功能和差异高亮
    // - 数据生成
    // - 分隔栏管理
}
```

### 开发命令

```bash
# Web应用
open index.html                  # 打开主应用

# Chrome扩展
./build-chrome-extension.sh      # 打包扩展

# 在Chrome中加载扩展
# 1. chrome://extensions/
# 2. 开启"开发者模式"
# 3. 加载 chrome-extension 文件夹
```

### 代码规范
- 使用ES6+语法和类结构
- 函数名采用camelCase命名
- 事件处理器使用箭头函数
- 异步操作使用async/await
- 遵循CSP内容安全策略

### 主要功能实现

#### 递归解析JSON字符串
```javascript
deepParseJSON(obj) {
    // 递归遍历对象
    // 检测字符串值是否为JSON格式
    // 自动解析并继续递归
    // 支持多层嵌套
}
```

#### JSON对比算法
```javascript
calculateStructuralDiff(left, right, path = '') {
    // 深度遍历两个JSON对象
    // 记录差异路径和类型
    // 支持对象、数组、基本类型
    // 生成差异报告
}
```

## 🎨 主题系统

### 支持的主题
- **亮色主题** - 适合日间使用
- **暗色主题** - 适合夜间使用

### 主题切换
点击右上角的 🌙/☀️ 按钮即可切换主题，设置会自动保存。

### 自定义主题
通过修改CSS变量自定义颜色：
```css
:root {
    --primary-color: #007bff;
    --background-color: #ffffff;
    --text-color: #333333;
    /* 更多变量... */
}
```

## 🔒 安全特性

- **内容安全策略(CSP)** - 严格的脚本执行限制
- **输入验证** - 完整的JSON语法验证
- **XSS防护** - 安全的内容渲染机制
- **隐私保护** - 所有数据本地处理，不上传服务器
- **权限最小化** - Chrome扩展仅申请必要权限

## 📱 浏览器兼容性

| 浏览器 | 版本要求 | 支持状态 |
|--------|----------|----------|
| Chrome | 88+ | ✅ 完全支持 |
| Edge | 88+ | ✅ 完全支持 |
| Firefox | 78+ | ✅ 基本支持 |
| Safari | 14+ | ✅ 基本支持 |

*Chrome扩展需要Chromium内核浏览器（Chrome、Edge等）*

## 📝 更新日志

### v2.0.0 (2025-11-20)
- ✅ **递归解析JSON字符串** - 自动解析嵌套的JSON字符串
- ✅ 简化Chrome扩展为单一完整模式
- ✅ 修复对比功能差异高亮显示bug
- ✅ 优化打包体积（37KB）
- ✅ 更新为Manifest V3规范
- ✅ 移除弹窗模式，统一用户体验
- ✅ 添加调试日志便于问题排查

### v1.0.0 (2024-09-23)
- ✨ 初始版本发布
- 🎯 实现格式化、对比、生成、分隔栏功能
- 🎨 支持亮色/暗色双主题
- 🔌 提供Chrome浏览器扩展
- 📱 响应式设计
- 🔧 历史记录和撤销重做

## 🎯 使用场景

- **开发调试** - 格式化API响应，查看JSON结构
- **数据对比** - 比较不同版本的配置文件差异
- **测试数据** - 快速生成符合格式的测试数据
- **文档编写** - 生成示例JSON数据
- **数据转换** - 递归解析嵌套的JSON字符串
- **协同工作** - 多窗格并排编辑不同JSON文件

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork本项目
2. 创建特性分支：`git checkout -b feature/新功能`
3. 提交更改：`git commit -m "添加新功能"`
4. 推送分支：`git push origin feature/新功能`
5. 创建Pull Request

### 开发建议
- 遵循现有的代码风格
- 为新功能添加测试
- 更新相关文档
- 确保向后兼容

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 📞 联系与支持

- **问题反馈**: [GitHub Issues](https://github.com/your-repo/issues)
- **功能建议**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **项目主页**: [GitHub Repository](https://github.com/your-repo)

## 🙏 致谢

感谢所有贡献者和使用者的支持！

---

⭐ **如果这个项目对你有帮助，请给我们一个Star！**

**快速链接**：
- [安装Chrome扩展](#方式2chrome扩展推荐)
- [查看功能特色](#-功能特色)
- [阅读使用指南](#-使用指南)
- [参与贡献](#-贡献指南)

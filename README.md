# JSON工具 - 专业级JSON处理平台

🔧 一个功能强大的JSON处理工具，提供格式化、对比、数据生成和多分隔栏功能，支持Web应用和Chrome浏览器扩展。

<img width="1912" height="937" alt="image" src="https://github.com/user-attachments/assets/4417c643-b654-442f-86ba-bb2121df2bd0" />

## ✨ 功能特色

### 🎯 核心功能
- **JSON格式化器** - 美化和压缩JSON数据，支持语法高亮和错误检测
- **JSON对比工具** - 深度对比两个JSON文档的差异，可视化高亮显示
- **数据生成器** - 基于预设模板生成测试数据，支持多种数据类型
- **多分隔栏** - 同时处理多个JSON文档，支持拖拽调整大小

### 🎨 界面特性
- **响应式设计** - 完美适配桌面和移动设备
- **双主题支持** - 亮色/暗色主题自由切换
- **标签页布局** - 清晰的功能分区和导航
- **实时预览** - 即时显示格式化结果

### 🔧 高级功能
- **历史记录** - 支持撤销/重做操作，操作历史持久化
- **文件处理** - 支持拖拽上传和导入/导出JSON文件
- **语法验证** - 实时JSON语法检查和错误提示
- **性能优化** - 大文件处理优化，流畅的用户体验

## 🚀 快速开始

### 💻 Web应用使用

1. **直接使用**
   ```bash
   # 在浏览器中打开主文件
   open index.html
   ```

2. **本地服务器**
   ```bash
   # 启动本地HTTP服务器
   python3 -m http.server 8080
   # 访问 http://localhost:8080
   ```

### 🔌 Chrome扩展安装

1. **从源码安装**
   ```bash
   # 1. 在Chrome浏览器中访问 chrome://extensions/
   # 2. 开启右上角的"开发者模式"
   # 3. 点击"加载已解压的扩展程序"
   # 4. 选择项目中的 chrome-extension 文件夹
   ```

2. **打包扩展**
   ```bash
   # 使用构建脚本打包扩展
   ./build-chrome-extension.sh
   ```

## 📁 项目结构

```
├── index.html              # 主应用入口文件
├── scripts.js              # 核心应用逻辑(JSONToolApp类)
├── styles-simple.css       # 主样式文件(支持双主题)
├── styles.css              # 备用样式文件
├── chrome-extension/       # Chrome扩展版本
│   ├── manifest.json       # 扩展配置文件
│   ├── popup.html          # 扩展弹窗界面
│   ├── popup.js            # 扩展弹窗逻辑
│   ├── background.js       # 后台服务脚本
│   ├── content.js          # 内容脚本
│   └── icons/              # 扩展图标
├── test-*.html             # 功能测试页面
├── dist/                   # 构建输出目录
└── CLAUDE.md              # 项目开发说明
```

## 🎮 使用指南

### JSON格式化器
1. 在左侧编辑器中输入或粘贴JSON数据
2. 点击"美化"按钮格式化JSON，或"压缩"按钮压缩JSON
3. 右侧预览区域实时显示格式化结果
4. 支持展开/折叠和树形视图切换

### JSON对比工具
1. 在左右两个编辑器中分别输入要对比的JSON数据
2. 点击"对比"按钮开始对比分析
3. 差异会以不同颜色高亮显示：
   - 🟢 绿色：新增内容
   - 🔴 红色：删除内容
   - 🟡 黄色：修改内容

### 数据生成器
1. 选择预设的数据模板（用户信息、商品数据、订单记录等）
2. 配置生成选项（数量、数组格式、随机字段、语言等）
3. 点击"生成数据"创建测试数据
4. 可将生成的数据导入到格式化器中使用

### 多分隔栏
1. 点击"添加分隔栏"创建新的编辑区域
2. 拖拽分隔线调整各区域大小
3. 每个区域都是独立的JSON编辑器
4. 支持同时处理多个不同的JSON文档

## 🛠️ 开发说明

### 技术栈
- **前端框架**：原生HTML5 + CSS3 + ES6+ JavaScript
- **架构模式**：面向对象编程，单一JSONToolApp主类
- **样式方案**：CSS变量实现主题切换
- **存储方案**：localStorage实现数据持久化

### 核心类结构
```javascript
class JSONToolApp {
    // 主应用类，负责：
    // - 标签页管理和切换
    // - 主题系统控制
    // - 历史记录管理
    // - JSON验证和格式化
    // - 对比功能实现
}
```

### 开发命令
```bash
# 运行功能测试
open test.html                    # 基础功能测试
open test-enhanced-compare.html   # 对比功能测试
open test-preview.html            # 预览功能测试

# Chrome扩展开发
open chrome-extension/popup.html  # 测试扩展弹窗
./build-chrome-extension.sh       # 构建扩展包
```

### 代码规范
- 使用ES6+语法和类结构
- 函数名和变量采用camelCase命名
- 事件处理器使用箭头函数
- 异步操作使用async/await
- 支持严格的CSP内容安全策略

## 🎨 主题系统

### 主题配置
- **亮色主题(light)** - 默认主题，适合日间使用
- **暗色主题(dark)** - 护眼主题，适合夜间使用
- **自动保存** - 主题选择自动保存到localStorage
- **平滑切换** - 支持CSS过渡动画效果

### 自定义主题
可通过修改CSS变量来自定义主题颜色：
```css
:root {
    --primary-color: #your-color;
    --background-color: #your-background;
    --text-color: #your-text-color;
}
```

## 🔒 安全特性

- **内容安全策略(CSP)** - 严格的脚本执行限制
- **输入验证** - 完整的JSON语法验证
- **XSS防护** - 安全的内容渲染机制
- **隐私保护** - 所有数据本地处理，不上传服务器

## 📱 浏览器兼容性

| 浏览器 | 版本要求 | 支持状态 |
|--------|----------|----------|
| Chrome | 88+ | ✅ 完全支持 |
| Firefox | 78+ | ✅ 完全支持 |
| Safari | 14+ | ✅ 完全支持 |
| Edge | 88+ | ✅ 完全支持 |

## 🤝 贡献指南

1. Fork本项目到你的GitHub账号
2. 创建特性分支：`git checkout -b feature/新功能`
3. 提交更改：`git commit -m "添加新功能"`
4. 推送分支：`git push origin feature/新功能`
5. 创建Pull Request

### 开发建议
- 遵循现有的代码风格和命名规范
- 为新功能添加相应的测试用例
- 更新相关文档说明
- 确保向后兼容性

## 📝 更新日志

### v1.0.0 (2024-09-23)
- ✨ 初始版本发布
- 🎯 实现JSON格式化、对比、生成和多分隔栏功能
- 🎨 支持亮色/暗色双主题
- 🔌 提供Chrome浏览器扩展版本
- 📱 响应式设计，完美适配移动设备
- 🔧 历史记录和撤销重做功能
- 🛡️ 完整的安全防护和性能优化

## 📄 许可证

本项目采用 MIT 许可证，详情请参阅 [LICENSE](LICENSE) 文件。

## 📞 联系方式

- **项目主页**：[GitHub Repository]
- **问题反馈**：[GitHub Issues]
- **功能建议**：[GitHub Discussions]

---

⭐ 如果这个项目对你有帮助，请给我们一个Star！

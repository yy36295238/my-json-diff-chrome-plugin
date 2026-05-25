# BSON ObjectId 生成工具设计文档

## 概述

在 JSON Editor Pro Chrome 插件的"其他"tab中，增加一个 BSON ObjectId 生成工具，支持用户输入需要生成的 ObjectId 个数，并以每行一个的格式输出结果。

## 需求确认

- **目标用户**：开发者和测试人员，需要批量生成 MongoDB ObjectId 用于测试数据
- **ObjectId 格式**：标准 MongoDB ObjectId（24位十六进制字符串）
- **输出格式**：每行一个 ObjectId 的文本列表
- **使用场景**：生成测试数据、批量插入 MongoDB 文档前的 ID 准备

## 架构设计

### 组件结构

沿用现有工具模式：

```
OtherToolsManager
├── TimestampTool
├── HexDecodeTool
└── ObjectIdGeneratorTool (新增)
```

### 新增文件

1. `chrome-extension/js/managers/tools/ObjectIdGeneratorTool.js` - 工具逻辑实现
2. 修改 `chrome-extension/index.html` - 添加侧边栏导航和工具视图
3. 修改 `chrome-extension/js/managers/OtherToolsManager.js` - 注册新工具

### UI 布局

参考 `TimestampTool` 的简洁风格：

- **顶部区域**：输入控制
  - 数量输入框（number 类型，min=1, max=1000）
  - "生成"按钮（primary 样式）
  - "清空"按钮
- **结果区域**：
  - 文本区域显示生成的 ObjectId（每行一个）
  - "复制全部"按钮
  - 生成数量统计

### 交互流程

1. 用户切换到 "其他" tab
2. 点击左侧 "ObjectId生成" 导航项
3. 在数量输入框中输入数字（默认1）
4. 点击"生成"按钮
5. 下方文本区域显示生成的 ObjectId 列表
6. 用户可以点击"复制全部"将结果复制到剪贴板
7. 点击"清空"清除输入和结果

### ObjectId 生成算法

标准的 MongoDB ObjectId 由 12 字节组成：
- 4字节：时间戳（秒级 Unix 时间）
- 3字节：机器标识符
- 2字节：进程ID
- 3字节：计数器

实现方式：使用 Web Crypto API 生成随机值，确保分布均匀。

## 错误处理

- 输入非数字或小于1时，显示错误提示
- 输入超过1000时，自动限制为1000
- 复制失败时显示错误提示

## 界面文本（中文）

- 导航项：ObjectId生成
- 输入标签：生成数量
- 按钮：生成 / 清空 / 复制全部
- 提示信息：已生成 X 个 ObjectId

## 限制

- 单次最大生成数量：1000 个
- 默认生成数量：1 个

## 实现计划

1. 创建 `ObjectIdGeneratorTool.js` 文件
2. 在 `index.html` 中添加导航项和工具视图 HTML
3. 在 `OtherToolsManager.js` 中注册新工具
4. 测试验证功能正常

#!/bin/bash

# Chrome扩展打包脚本
# 使用方法: ./build-chrome-extension.sh

set -e

# 配置
EXTENSION_DIR="chrome-extension"
OUTPUT_DIR="dist"
EXTENSION_NAME="json-tool-extension"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "🚀 开始打包Chrome扩展..."

# 检查扩展目录是否存在
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ 错误: 找不到Chrome扩展目录 '$EXTENSION_DIR'"
    exit 1
fi

# 检查manifest.json是否存在
if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
    echo "❌ 错误: 找不到manifest.json文件"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 清理之前的打包文件
rm -f "$OUTPUT_DIR"/*.zip "$OUTPUT_DIR"/*.crx 2>/dev/null || true

echo "📦 正在打包扩展文件..."

# 创建ZIP包 (用于Chrome Web Store上传)
cd "$EXTENSION_DIR"
zip -r "../$OUTPUT_DIR/${EXTENSION_NAME}-${TIMESTAMP}.zip" . \
    -x "*.DS_Store" "*/.*" "README.md" "安装说明.md" "create-icons.js" "generate-icon.html"
cd ..

echo "✅ 扩展已打包完成!"
echo "📁 输出目录: $OUTPUT_DIR"
echo "📦 ZIP文件: ${EXTENSION_NAME}-${TIMESTAMP}.zip"

# 显示文件信息
echo ""
echo "📋 打包文件信息:"
ls -lh "$OUTPUT_DIR"/${EXTENSION_NAME}-${TIMESTAMP}.zip

echo ""
echo "🔧 安装说明:"
echo "1. 打开Chrome浏览器，访问 chrome://extensions/"
echo "2. 开启右上角的"开发者模式""
echo "3. 点击"加载已解压的扩展程序""
echo "4. 选择 '$EXTENSION_DIR' 目录"
echo ""
echo "📤 发布说明:"
echo "使用生成的ZIP文件上传到Chrome Web Store发布"
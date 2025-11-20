#!/usr/bin/env python3
"""
生成Chrome扩展所需的PNG图标 - 改进版
"""

from PIL import Image, ImageDraw, ImageFont
import os

def interpolate_color(color1, color2, factor):
    """在两个颜色之间插值"""
    return tuple(int(c1 + (c2 - c1) * factor) for c1, c2 in zip(color1, color2))

def create_gradient_background(size):
    """创建渐变背景"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 渐变颜色
    color_start = (102, 126, 234)  # #667eea
    color_end = (118, 75, 162)     # #764ba2

    # 逐行绘制渐变
    for y in range(size):
        factor = y / size
        color = interpolate_color(color_start, color_end, factor)
        draw.line([(0, y), (size, y)], fill=color)

    # 创建圆角蒙版
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(size * 0.15625)  # 20/128
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=radius, fill=255)

    # 应用蒙版
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(img, (0, 0), mask)

    return result

def create_icon(size):
    """创建指定尺寸的图标"""
    # 创建渐变背景
    img = create_gradient_background(size)
    draw = ImageDraw.Draw(img)

    # 绘制内部装饰矩形
    inner_margin = int(size * 0.1)
    inner_size = int(size * 0.8)
    inner_radius = int(size * 0.15)

    # 创建半透明白色覆盖层
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rounded_rectangle(
        [(inner_margin, inner_margin), (inner_margin + inner_size, inner_margin + inner_size)],
        radius=inner_radius,
        fill=(255, 255, 255, 25)  # rgba(255,255,255,0.1)
    )
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # 计算文字位置
    left_x = int(size * 0.25)
    right_x = int(size * 0.75)
    center_x = int(size * 0.5)
    y_center = int(size * 0.55)

    # 尝试加载字体
    font_large = None
    font_small = None
    font_size_large = int(size * 0.45)
    font_size_small = int(size * 0.22)

    # macOS 字体路径
    font_paths = [
        '/System/Library/Fonts/Courier.dfont',
        '/System/Library/Fonts/Monaco.dfont',
        '/Library/Fonts/Courier New.ttf',
    ]

    for font_path in font_paths:
        try:
            if os.path.exists(font_path):
                font_large = ImageFont.truetype(font_path, font_size_large)
                font_small = ImageFont.truetype(font_path, font_size_small)
                break
        except:
            continue

    # 如果没找到字体，绘制简单的图形代替
    if not font_large:
        # 绘制大括号路径
        bracket_width = int(size * 0.08)
        bracket_height = int(size * 0.3)
        bracket_y_top = int(size * 0.25)

        # 左大括号
        draw.arc([(left_x - bracket_width, bracket_y_top),
                  (left_x, bracket_y_top + bracket_height)],
                 start=90, end=270, fill=(255, 255, 255), width=int(size * 0.05))

        # 右大括号
        draw.arc([(right_x, bracket_y_top),
                  (right_x + bracket_width, bracket_y_top + bracket_height)],
                 start=270, end=90, fill=(255, 255, 255), width=int(size * 0.05))

        # 中间的圆形装饰
        circle_radius = int(size * 0.1)
        draw.ellipse([(center_x - circle_radius, y_center - circle_radius),
                     (center_x + circle_radius, y_center + circle_radius)],
                     outline=(255, 215, 0), width=int(size * 0.03))
    else:
        # 绘制文字 - 左大括号
        draw.text((left_x, y_center), '{', fill=(255, 255, 255), font=font_large, anchor='mm')
        # 右大括号
        draw.text((right_x, y_center), '}', fill=(255, 255, 255), font=font_large, anchor='mm')
        # 中间的JSON符号
        draw.text((center_x, y_center), '{ }', fill=(255, 215, 0), font=font_small, anchor='mm')

    # 绘制装饰点
    dot_radius = max(2, int(size * 0.03125))
    dot_color = (255, 255, 255, 153)  # rgba(255,255,255,0.6)

    # 上方三个点
    dots_top = [
        (int(size * 0.35), int(size * 0.3)),
        (int(size * 0.5), int(size * 0.28)),
        (int(size * 0.65), int(size * 0.3))
    ]

    # 下方三个点
    dots_bottom = [
        (int(size * 0.35), int(size * 0.74)),
        (int(size * 0.5), int(size * 0.76)),
        (int(size * 0.65), int(size * 0.74))
    ]

    for x, y in dots_top + dots_bottom:
        draw.ellipse([(x - dot_radius, y - dot_radius),
                     (x + dot_radius, y + dot_radius)],
                     fill=dot_color)

    return img

def main():
    """生成所有尺寸的图标"""
    sizes = [16, 32, 48, 128]
    output_dir = 'chrome-extension/icons'

    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    print('🎨 开始生成JSON工具图标...\n')

    for size in sizes:
        print(f'生成 {size}x{size} 图标...')
        img = create_icon(size)
        output_path = os.path.join(output_dir, f'icon{size}.png')
        img.save(output_path, 'PNG')
        file_size = os.path.getsize(output_path)
        print(f'✓ 已保存: {output_path} ({file_size} bytes)')

    print('\n✅ 所有图标生成完成!')
    print('\n📋 生成的图标列表:')
    for size in sizes:
        print(f'  - icon{size}.png')

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Generate modern icons for the JSON Diff Chrome Extension.
Design: Indigo background (App Primary) with White brackets and colored accents.
Matches the 'Modern Design System' of the application.
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    """Create an icon of the specified size."""
    
    # 1. Setup Canvas & Background
    # Draw at 4x scale for anti-aliasing
    scale_factor = 4
    canvas_size = size * scale_factor
    
    img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background Color: Primary Indigo from CSS
    # --primary: hsl(230, 70%, 50%) -> approx #4f46e5
    # Let's use a vibrant Indigo.
    bg_color = (79, 70, 229) # #4f46e5
    
    # Draw Rounded Rectangle Background
    # Radius ~ 22% of size (Matches CSS .radius-lg roughly relative to icon size)
    radius = int(canvas_size * 0.22)
    draw.rounded_rectangle(
        [(0, 0), (canvas_size, canvas_size)],
        radius=radius,
        fill=bg_color
    )
    
    # 2. Draw Brackets { }
    # Color: White (Text on Primary)
    bracket_color = (255, 255, 255)
    
    stroke_width = int(canvas_size * 0.1)
    
    # Bracket Geometry
    cx, cy = canvas_size / 2, canvas_size / 2
    offset_x = canvas_size * 0.22
    bracket_height = canvas_size * 0.5
    bracket_width = canvas_size * 0.2
    
    def draw_bracket_poly(draw_obj, x_center, y_center, w, h, stroke, color, is_right):
        """Draws a polygonal bracket representation."""
        direction = 1 if is_right else -1
        
        # Points for a angular bracket (Tech/Code look)
        # Top Tip, Middle Point, Bottom Tip
        
        # Top
        p1 = (x_center - (w/2 * direction), y_center - h/2)
        # Mid (Point)
        p2 = (x_center + (w/2 * direction), y_center)
        # Bottom
        p3 = (x_center - (w/2 * direction), y_center + h/2)
        
        # To give it thickness, we draw a line with width
        # Using joint='curve' makes the corners rounded
        draw_obj.line([p1, p2, p3], fill=color, width=int(stroke), joint='curve')

    # Draw Left Bracket < (representing {)
    draw_bracket_poly(draw, cx - offset_x, cy, bracket_width, bracket_height, stroke_width, bracket_color, is_right=False)
    
    # Draw Right Bracket > (representing })
    draw_bracket_poly(draw, cx + offset_x, cy, bracket_width, bracket_height, stroke_width, bracket_color, is_right=True)

    # 3. Draw Central Accents (The "Diff" or "JSON" content)
    # Two dots: One Magenta (Key), One Green (Value)
    # Representing the colorful syntax highlighting in the app
    
    dot_radius = int(canvas_size * 0.07)
    dot_spacing = int(canvas_size * 0.0) # Vertical spacing from center
    
    # Magenta Dot (Top - Key)
    # color: #d946ef -> (217, 70, 239)
    color_accent_1 = (217, 70, 239)
    
    # Green Dot (Bottom - Value)
    # color: #22c55e -> (34, 197, 94)
    color_accent_2 = (34, 197, 94)
    
    # Draw dots in the vertical center space between brackets
    # Top dot
    draw.ellipse(
        [(cx - dot_radius, cy - dot_radius * 2.5), 
         (cx + dot_radius, cy - dot_radius * 0.5)],
        fill=color_accent_1
    )
    
    # Bottom dot
    draw.ellipse(
        [(cx - dot_radius, cy + dot_radius * 0.5), 
         (cx + dot_radius, cy + dot_radius * 2.5)],
        fill=color_accent_2
    )

    # 4. Downsample to target size
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img

def main():
    """Generate all icons."""
    sizes = [16, 32, 48, 128]
    output_dir = 'chrome-extension/icons'
    os.makedirs(output_dir, exist_ok=True)
    
    print("🎨 Generating Modern Design System icons...")
    
    for size in sizes:
        try:
            img = create_icon(size)
            filename = f"icon{size}.png"
            path = os.path.join(output_dir, filename)
            img.save(path, "PNG")
            print(f"  ✓ Generated {filename}")
        except Exception as e:
            print(f"  ✗ Error generating {size}x{size}: {e}")

    print("\n✅ Done! Icons updated to match app theme.")

if __name__ == "__main__":
    main()
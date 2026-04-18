from PIL import Image, ImageDraw, ImageFont
import os

sizes = [16, 48, 128]
output_dir = "src/assets/icons"
os.makedirs(output_dir, exist_ok=True)

# Colors: forest green to teal gradient
# We'll approximate gradient by drawing vertical bars
# Background: #16a34a (grove green) to #006D77 (deep teal)
color_start = (0x16, 0xA3, 0x4A)
color_end = (0x00, 0x6D, 0x77)

for size in sizes:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = size // 4

    # Draw gradient background within rounded rect
    for y in range(size):
        ratio = y / max(size - 1, 1)
        r = int(color_start[0] + (color_end[0] - color_start[0]) * ratio)
        g = int(color_start[1] + (color_end[1] - color_start[1]) * ratio)
        b = int(color_start[2] + (color_end[2] - color_start[2]) * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mask to rounded rectangle
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    img.putalpha(mask)

    # Draw white "K" in center
    # Try to load a font, fallback to default
    try:
        font = ImageFont.truetype("arial.ttf", size=int(size * 0.55))
    except Exception:
        try:
            font = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                size=int(size * 0.55),
            )
        except Exception:
            font = ImageFont.load_default()

    text = "K"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))

    out_path = os.path.join(output_dir, f"icon{size}.png")
    img.save(out_path)
    print(f"Saved {out_path}")

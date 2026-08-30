from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_PATH = os.path.join(BASE_DIR, 'public', 'images', 'Electric-Mirage.jpg')
OUTPUT_PATH = os.path.join(BASE_DIR, 'public', 'images', 'share-cover.png')

W, H = 1200, 630

# Load album cover
album = Image.open(INPUT_PATH).convert('RGB')

# Crop to 1.91:1 aspect ratio from center
src_w, src_h = album.size
src_ratio = src_w / src_h
target_ratio = W / H

if src_ratio > target_ratio:
    # Source is wider: crop width
    new_w = int(src_h * target_ratio)
    left = (src_w - new_w) // 2
    album = album.crop((left, 0, left + new_w, src_h))
else:
    # Source is taller: crop height
    new_h = int(src_w / target_ratio)
    top = (src_h - new_h) // 2
    album = album.crop((0, top, src_w, top + new_h))

# Resize to target
album = album.resize((W, H), Image.Resampling.LANCZOS)

# Apply darkening gradient overlay
overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

# Top-to-bottom darkening gradient
for y in range(H):
    alpha = int(80 + 100 * (y / H))  # darker at bottom
    draw.line([(0, y), (W, y)], fill=(0, 0, 0, alpha))

# Side vignette
for x in range(W // 2):
    alpha = int(60 * (1 - x / (W / 2)))
    draw.line([(x, 0), (x, H)], fill=(0, 0, 0, alpha))
    draw.line([(W - 1 - x, 0), (W - 1 - x, H)], fill=(0, 0, 0, alpha))

album = Image.alpha_composite(album.convert('RGBA'), overlay)

# Add subtle glow orbs
for cx, cy, radius, color, alpha in [
    (150, 500, 350, (176, 38, 255), 40),
    (1050, 120, 300, (255, 0, 110), 35),
]:
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    for r in range(radius, 0, -8):
        a = int(alpha * (1 - r / radius))
        gdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, a))
    album = Image.alpha_composite(album, glow)

# Add text
font_dir = 'C:/Windows/Fonts'
try:
    font_title = ImageFont.truetype(os.path.join(font_dir, 'arial.ttf'), 80)
    font_subtitle = ImageFont.truetype(os.path.join(font_dir, 'arial.ttf'), 30)
    font_tagline = ImageFont.truetype(os.path.join(font_dir, 'arial.ttf'), 18)
except Exception:
    font_title = ImageFont.load_default()
    font_subtitle = ImageFont.load_default()
    font_tagline = ImageFont.load_default()

# Create text layer for shadow/glow
text_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
tdraw = ImageDraw.Draw(text_layer)

# Title
bbox = tdraw.textbbox((0, 0), 'XANTHANL', font=font_title)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
tx = (W - tw) // 2
ty = H // 2 - 50

# Glow shadow
for offset in range(15, 0, -3):
    tdraw.text((tx, ty), 'XANTHANL', font=font_title, fill=(176, 38, 255, max(10, 50 - offset * 3)))
# Main text
tdraw.text((tx, ty), 'XANTHANL', font=font_title, fill=(255, 255, 255, 255))

# Subtitle
bbox = tdraw.textbbox((0, 0), 'ELECTRIC MIRAGE', font=font_subtitle)
tw = bbox[2] - bbox[0]
tx = (W - tw) // 2
ty = H // 2 + 50
tdraw.text((tx, ty), 'ELECTRIC MIRAGE', font=font_subtitle, fill=(255, 255, 255, 230))

# Tagline
bbox = tdraw.textbbox((0, 0), 'SYNTH-POP  ·  NEO-PSYCHEDELIC', font=font_tagline)
tw = bbox[2] - bbox[0]
tx = (W - tw) // 2
ty = H // 2 + 100
tdraw.text((tx, ty), 'SYNTH-POP  ·  NEO-PSYCHEDELIC', font=font_tagline, fill=(255, 255, 255, 150))

album = Image.alpha_composite(album, text_layer)

# Save final
album.convert('RGB').save(OUTPUT_PATH, 'PNG')
print(f'Saved share cover to {OUTPUT_PATH}')

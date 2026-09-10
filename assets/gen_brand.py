# -*- coding: utf-8 -*-
"""GAME LAB 品牌资产生成：favicon（多尺寸 PNG + SVG）。

设计语言与站点一致——石墨底 + 液态玻璃（45° 双端高光 / 内缩暗环 / 1px 描边）
+ 2×2 小格子。全部 PIL 手绘，无外部依赖，可重复执行。

本文件同时充当绘图原语库（渐变 / 遮罩 / 高光 / 内阴影 / 字距），
分享缩略图从 assets/share_card.py 复用它。

    venv python assets/gen_brand.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BG = os.path.join(HERE, "bg")

# ── 调色（与 assets/index.css 的暗色 token 对齐）─────────────────────────────
GRAPHITE_TOP = (46, 46, 52)
GRAPHITE_BOT = (17, 17, 20)
GLASS_WHITE = (255, 255, 255)
CELL_LIGHT = (242, 242, 240)
CELL_MID = (142, 142, 146)
CELL_DARK = (74, 74, 78)


def rounded_mask(size, box, radius):
    """圆角矩形的 L 模式遮罩，用于把各图层裁进主体形状。"""
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def vgrad(size, top, bottom):
    """垂直线性渐变。"""
    w, h = size
    im = Image.new("RGB", size)
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return im


def diag_sheen(size, stops=(0.0, 0.22, 0.78, 1.0), blur=4):
    """45° 双端白色高光遮罩：两端亮、中段透明——液态感的来源。"""
    w, h = size
    big = int(max(w, h) * 1.6)
    g = Image.new("L", (big, 1))
    px = g.load()
    for x in range(big):
        t = x / (big - 1)
        if t <= stops[1]:
            v = 255 * (1 - t / stops[1]) if stops[1] else 0
        elif t >= stops[2]:
            v = 255 * ((t - stops[2]) / (1 - stops[2])) if stops[2] < 1 else 255
        else:
            v = 0
        px[x, 0] = int(v)
    g = g.resize((big, big))
    g = g.rotate(45, resample=Image.BICUBIC, center=(big // 2, big // 2))
    g = g.crop(((big - w) // 2, (big - h) // 2, (big + w) // 2, (big + h) // 2))
    return g.filter(ImageFilter.GaussianBlur(blur))


def inner_shadow(mask, offset, blur, alpha):
    """内投影：把遮罩收缩并下移后取反，得到贴边的暗环（玻璃厚度感）。"""
    w, h = mask.size
    shrunk = mask.transform(
        (w, h), Image.AFFINE, (1, 0, -offset, 0, 1, -offset)
    ).filter(ImageFilter.GaussianBlur(1.2))
    shifted = shrunk.transform((w, h), Image.AFFINE, (1, 0, 0, 0, 1, offset))
    inv = Image.eval(shifted, lambda v: 255 - v)
    ring = Image.composite(Image.new("L", (w, h), alpha), Image.new("L", (w, h), 0), inv)
    return ring.filter(ImageFilter.GaussianBlur(blur))


def build_icon(size=512, supersample=4):
    """玻璃方块 + 2×2 格子：明暗自左上向右下递进，呼应 45° 光向。"""
    S = size * supersample
    pad = round(S * 0.055)
    box = [pad, pad, S - pad, S - pad]
    radius = round((S - 2 * pad) * 0.26)
    shape = rounded_mask((S, S), box, radius)

    # 1) 石墨渐变底 + 玻璃白雾（yzrt 原版是白 4%）
    body = vgrad((S, S), GRAPHITE_TOP, GRAPHITE_BOT)
    body = Image.blend(body, Image.new("RGB", (S, S), GLASS_WHITE), 0.05)

    # 2) 45° 双端高光
    sheen = diag_sheen((S, S), blur=round(S * 0.012))
    body.paste(GLASS_WHITE, (0, 0), Image.eval(sheen, lambda v: int(v * 0.72)))

    # 3) 内缩暗环（折射厚度）
    body.paste(Image.new("RGB", (S, S), (0, 0, 0)), (0, 0), inner_shadow(shape, round(S * 0.012), round(S * 0.022), 210))

    # 4) 1px 内描边
    rim = Image.new("L", (S, S), 0)
    ImageDraw.Draw(rim).rounded_rectangle(box, radius=radius, outline=72, width=round(S * 0.006))
    body.paste(GLASS_WHITE, (0, 0), Image.eval(rim, lambda v: int(v * 0.55)))

    # 5) 2×2 格子：左上最亮 → 右下最暗
    inner = S - 2 * pad
    cell = round(inner * 0.205)
    gap = round(inner * 0.075)
    grid_w = cell * 2 + gap
    x0 = (S - grid_w) // 2
    y0 = (S - grid_w) // 2
    d = ImageDraw.Draw(body)
    cr = round(cell * 0.24)
    tones = [CELL_LIGHT, CELL_MID, CELL_MID, CELL_DARK]
    for i, tone in enumerate(tones):
        cx = x0 + (i % 2) * (cell + gap)
        cy = y0 + (i // 2) * (cell + gap)
        d.rounded_rectangle([cx, cy, cx + cell, cy + cell], radius=cr, fill=tone)

    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(body, (0, 0), shape)

    # 6) 外阴影（玻璃浮起）
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sy = round(S * 0.022)
    sd.rounded_rectangle([box[0], box[1] + sy, box[2], box[3] + sy], radius=radius, fill=(0, 0, 0, 92))
    shadow = shadow.filter(ImageFilter.GaussianBlur(round(S * 0.026)))
    base = Image.alpha_composite(shadow, out)

    return base.resize((size, size), Image.LANCZOS)


ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2e2e34"/><stop offset="1" stop-color="#111114"/>
    </linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".72"/>
      <stop offset=".22" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".78" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".72"/>
    </linearGradient>
    <clipPath id="c"><rect x="28" y="28" width="456" height="456" rx="118"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect x="28" y="28" width="456" height="456" fill="url(#g)"/>
    <rect x="28" y="28" width="456" height="456" fill="#fff" opacity=".05"/>
    <rect x="28" y="28" width="456" height="456" fill="url(#s)"/>
    <rect x="34" y="40" width="444" height="444" rx="112" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="14" filter="blur(9px)"/>
    <rect x="31" y="31" width="450" height="450" rx="117" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3"/>
    <g>
      <rect x="154" y="154" width="94" height="94" rx="23" fill="#f2f2f0"/>
      <rect x="264" y="154" width="94" height="94" rx="23" fill="#8e8e92"/>
      <rect x="154" y="264" width="94" height="94" rx="23" fill="#8e8e92"/>
      <rect x="264" y="264" width="94" height="94" rx="23" fill="#4a4a4e"/>
    </g>
  </g>
</svg>
"""


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def tracked(draw, xy, text, fnt, fill, tracking, anchor_x="left"):
    """带字距的文本绘制，返回总宽度。"""
    x, y = xy
    total = sum(draw.textlength(ch, font=fnt) for ch in text) + tracking * (len(text) - 1)
    if anchor_x == "center":
        x -= total / 2
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return total


def main():
    icon = build_icon(512)
    targets = {"favicon-32.png": 32, "favicon-48.png": 48,
               "favicon-180.png": 180, "favicon-512.png": 512}
    for name, s in targets.items():
        icon.resize((s, s), Image.LANCZOS).save(os.path.join(HERE, name))
        print(name, s)

    # ICO 容器塞 16/32/48，兼容老浏览器与部分 RSS 阅读器
    icon.save(os.path.join(HERE, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print("favicon.ico")

    with open(os.path.join(HERE, "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(ICON_SVG)
    print("favicon.svg")

    # 分享图已并入 assets/gen_share_cards.py（正方形纯中文设计系统），本文件只画图标。


if __name__ == "__main__":
    main()

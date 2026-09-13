# -*- coding: utf-8 -*-
"""GAME LAB 品牌资产生成：favicon（多尺寸 PNG + SVG）。

设计语言 = 站点默认皮肤「电光蓝 / Electric Blue」（<html data-style="hermes">）。
配色不是想象的，取自 assets/index.css 里那套实测 token：

    --hm-blue     #0000f2   电光蓝，满版（官网 body 背景实测 rgb(0,0,242)）
    --hm-paper    #ffffff   白纸面板
    --hm-acid     #edff45   酸黄，只给极小的标注与高亮
    米白正文       #f5f5f5
    --hm-shadow   rgba(0,0,22,.34)   白纸卡片的硬偏移落影
    --hm-hair     rgba(0,0,242,.18)  白纸上的 1px 蓝细线

所以这里**没有**液态玻璃那套（45° 双端高光 / 内缩折射暗环 / 模糊柔光）——
那是另一套皮肤的语言。电光蓝是：满版蓝 + 白纸 + 硬落影 + 1px 细线 + 一枚酸黄。
2×2 格子保留（品牌连续性），改成「三格白纸 + 右下那枚酸黄」，
酸黄是全图标唯一的彩色，对应官网「只给极小标注与高亮」的用法。

全部 PIL 手绘，无外部依赖，可重复执行。
下方 diag_sheen / inner_shadow 是液态玻璃皮肤用的通用原语，本图标不再调用。

    venv python assets/gen_brand.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BG = os.path.join(HERE, "bg")

# ── 调色（与 assets/index.css 的「电光蓝」皮肤 token 对齐）───────────────────
BLUE_TOP = (12, 12, 255)      # --hm-blue #0000f2，顶边抬一丝只为撑起体积
BLUE_BOT = (0, 0, 208)
PAPER = (255, 255, 255)       # --hm-paper 白纸面板
ACID = (237, 255, 69)         # --hm-acid 酸黄，唯一的彩色
OFFWHITE = (245, 245, 245)    # 米白：1px 内描边
HARD_SHADOW = (0, 0, 22)      # --hm-shadow 的墨色
# 以下三个是液态玻璃皮肤用的原语配色，电光蓝图标不再使用
GRAPHITE_TOP = (46, 46, 52)
GRAPHITE_BOT = (17, 17, 20)
GLASS_WHITE = (255, 255, 255)


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
    """电光蓝方块 + 2×2 白纸格（右下那枚酸黄）+ 硬偏移落影。

    没有高光、没有内缩折射暗环 —— 电光蓝皮肤里不存在模糊。
    落影是白纸卡片那种硬边偏移（--hm-shadow），只给极小模糊免得锯齿。
    """
    S = size * supersample
    pad = round(S * 0.055)
    box = [pad, pad, S - pad, S - pad]
    radius = round((S - 2 * pad) * 0.26)
    shape = rounded_mask((S, S), box, radius)

    def overlay(base, draw_fn):
        """把一层半透明绘制合成到 RGBA 底图上。"""
        ov = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        draw_fn(ImageDraw.Draw(ov))
        return Image.alpha_composite(base, ov)

    # 1) 电光蓝满版 —— 不给玻璃白雾，官网就是一整块纯蓝
    body = vgrad((S, S), BLUE_TOP, BLUE_BOT).convert("RGBA")

    # 2) 1px 米白内描边：描在 box 上，外半边随后被 shape 裁掉，只留内侧那条
    body = overlay(body, lambda d: d.rounded_rectangle(
        box, radius=radius, outline=OFFWHITE + (140,), width=round(S * 0.007)))

    # 3) 2×2 格子：三格白纸（左上最实），右下那枚酸黄是全图标唯一的彩色
    inner = S - 2 * pad
    cell = round(inner * 0.205)
    gap = round(inner * 0.075)
    grid_w = cell * 2 + gap
    x0 = (S - grid_w) // 2
    y0 = (S - grid_w) // 2
    cr = round(cell * 0.24)
    tones = [(PAPER, 255), (PAPER, 199), (PAPER, 199), (ACID, 255)]

    def cells(d):
        for i, (tone, alpha) in enumerate(tones):
            cx = x0 + (i % 2) * (cell + gap)
            cy = y0 + (i // 2) * (cell + gap)
            d.rounded_rectangle([cx, cy, cx + cell, cy + cell], radius=cr, fill=tone + (alpha,))
    body = overlay(body, cells)

    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(body, (0, 0), shape)

    # 4) 硬偏移落影：白纸卡片那种不带柔化的边（--hm-shadow 约 34%）
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sy = round(S * 0.022)
    ImageDraw.Draw(shadow).rounded_rectangle(
        [box[0], box[1] + sy, box[2], box[3] + sy], radius=radius, fill=HARD_SHADOW + (92,))
    shadow = shadow.filter(ImageFilter.GaussianBlur(round(S * 0.006)))
    base = Image.alpha_composite(shadow, out)

    return base.resize((size, size), Image.LANCZOS)


ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0c0cff"/><stop offset="1" stop-color="#0000d0"/>
    </linearGradient>
    <clipPath id="c"><rect x="28" y="28" width="456" height="456" rx="118"/></clipPath>
  </defs>
  <!-- 硬偏移落影：白纸卡片那种不带柔化的边（--hm-shadow rgba(0,0,22,.34)） -->
  <rect x="28" y="45" width="456" height="456" rx="118" fill="#000016" opacity=".36"/>
  <g clip-path="url(#c)">
    <rect x="28" y="28" width="456" height="456" fill="url(#b)"/>
    <rect x="31" y="31" width="450" height="450" rx="117" fill="none" stroke="#f5f5f5" stroke-opacity=".55" stroke-width="3"/>
    <g>
      <rect x="154" y="154" width="94" height="94" rx="23" fill="#ffffff"/>
      <rect x="264" y="154" width="94" height="94" rx="23" fill="#ffffff" opacity=".78"/>
      <rect x="154" y="264" width="94" height="94" rx="23" fill="#ffffff" opacity=".78"/>
      <rect x="264" y="264" width="94" height="94" rx="23" fill="#edff45"/>
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

# -*- coding: utf-8 -*-
"""分享缩略图工具箱：字体 + 纹理 + 光栅原语。

这里**不含任何统一模板** —— 每个项目在 assets/gen_share_cards.py 里自己排版，
用自己站点真实的底色 / 主色 / 字体气质（取值见 .workbuddy/shots/probe-style.js 的采集）。

本机可用的中文字体（PIL 只能读 ttf/ttc，读不了 woff2）：
    NotoSansSC-VF / NotoSerifSC-VF   可变字重 100–900（主力）
    simhei 黑 / simsun 宋 / simkai 楷 / simfang 仿宋 / SIMLI 隶 / SIMYOU 幼圆
    msyh / msyhbd 微软雅黑 / Deng 等线 / consola 等宽
"""
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FD = "C:/Windows/Fonts/"
SANS_VF = FD + "NotoSansSC-VF.ttf"
SERIF_VF = FD + "NotoSerifSC-VF.ttf"
HEI = FD + "simhei.ttf"
SONG = FD + "simsun.ttc"
KAI = FD + "simkai.ttf"
FANG = FD + "simfang.ttf"
LI = FD + "SIMLI.TTF"
YOU = FD + "SIMYOU.TTF"
YAHEI_BD = FD + "msyhbd.ttc"
DENG = FD + "Dengb.ttf"
MONO = FD + "consolab.ttf"

_fc = {}


def font(path, size, weight=None):
    """带缓存的字体；可变字体按 weight 设定。"""
    key = (path, int(size), weight)
    f = _fc.get(key)
    if f is None:
        f = ImageFont.truetype(path, int(size))
        if weight is not None:
            try:
                f.set_variation_by_axes([weight])
            except Exception:
                pass
        _fc[key] = f
    return f


def sans(size, weight=700):
    return font(SANS_VF, size, weight)


def serif(size, weight=600):
    return font(SERIF_VF, size, weight)


# ------------------------------------------------------------------ 文字
def ink_center(draw, ch, f, cx, cy, fill):
    """按字形墨迹框居中（CJK 的 em 框上下不对称，anchor=mm 会偏下）。"""
    b = draw.textbbox((0, 0), ch, font=f)
    w, h = b[2] - b[0], b[3] - b[1]
    draw.text((cx - b[0] - w / 2, cy - b[1] - h / 2), ch, font=f, fill=fill)


def tracked(draw, cx, cy, text, f, fill, tracking=0, left=False, anchor_y="ink"):
    """带字距的一行字；(cx, cy) 默认是整行**墨迹框**中心，left=True 时 cx 为左端。"""
    b = draw.textbbox((0, 0), text, font=f)
    total = sum(draw.textlength(c, font=f) for c in text) + tracking * (len(text) - 1)
    x = cx if left else cx - total / 2
    if anchor_y == "ink":
        y = cy - b[1] - (b[3] - b[1]) / 2
    else:                                  # 按行高（更接近 CSS 的文本框）
        y = cy - (b[3] - b[1]) / 2 - b[1]
    for c in text:
        draw.text((x, y), c, font=f, fill=fill)
        x += draw.textlength(c, font=f) + tracking
    return total


def stack(draw, cx, y0, lines, f, fill, tracking=0, lead=None):
    """多行居中，返回最后一行的墨迹底边。"""
    b = draw.textbbox((0, 0), "汉", font=f)
    lh = lead or (b[3] - b[1]) * 1.22
    y = y0
    for ln in lines:
        tracked(draw, cx, y + (b[3] - b[1]) / 2, ln, f, fill, tracking)
        y += lh
    return y


def fit_font(maker, text, target, tracking_ratio=0.0, lo=20, hi=420):
    """二分找一个字号，让 text（含字距）正好等于 target 像素宽。"""
    best = maker(lo)
    for _ in range(24):
        mid = (lo + hi) / 2
        f = maker(mid)
        w = sum(f.getlength(c) for c in text) + f.getlength("汉") * tracking_ratio * max(len(text) - 1, 0)
        if w <= target:
            best, lo = f, mid
        else:
            hi = mid
    return best


# ------------------------------------------------------------------ 底与纹理
def vgrad(size, top, bottom, bias=1.0):
    w, h = size
    t = (np.arange(h, dtype=np.float32) / max(h - 1, 1)) ** bias
    arr = np.empty((h, w, 3), np.float32)
    for i in range(3):
        arr[:, :, i] = (top[i] + (bottom[i] - top[i]) * t)[:, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def radial_mask(size, radius, power=1.6, cx=None, cy=None):
    cx = size / 2 if cx is None else cx
    cy = size / 2 if cy is None else cy
    ys, xs = np.mgrid[0:size, 0:size]
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    return Image.fromarray((np.clip(1 - d / radius, 0, 1) ** power * 255).astype(np.uint8), "L")


def wash(img, cx, cy, radius, color, alpha, power=1.6):
    """在 (cx,cy) 打一团柔光。"""
    size = img.width
    m = radial_mask(size, radius, power, cx, cy)
    m = Image.eval(m, lambda v: int(v * alpha))
    return Image.composite(Image.new("RGB", img.size, color), img, m)


def vignette(img, strength=0.42, radius=0.78, power=1.15):
    v = np.asarray(radial_mask(img.width, img.width * radius, power), np.float32) / 255.0
    a = np.asarray(img, np.float32) * (1 - strength + strength * v)[:, :, None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def grain(img, amount=4.0, seed=7):
    rng = np.random.default_rng(seed)
    a = np.asarray(img, np.float32)
    n = rng.normal(0, amount, a.shape[:2])[:, :, None]
    return Image.fromarray(np.clip(a + n, 0, 255).astype(np.uint8), "RGB")


def specks(img, seed=3, n=2600, colors=((120, 100, 70),), alpha=26, rmax=1.7):
    """纸纹 / 颗粒：细小的深浅斑点。"""
    rng = random.Random(seed)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w, h = img.size
    for _ in range(n):
        x, y = rng.random() * w, rng.random() * h
        r = rng.uniform(0.4, rmax)
        c = colors[rng.randrange(len(colors))]
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (rng.randint(8, alpha),))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def stars(img, n, seed=11, color=(255, 255, 255), rmax=1.9, alpha=(50, 235)):
    rng = random.Random(seed)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w, h = img.size
    for _ in range(n):
        x, y = rng.random() * w, rng.random() * h
        r = rng.uniform(0.35, rmax)
        a = rng.randint(*alpha)
        d.ellipse([x - r, y - r, x + r, y + r], fill=color + (a,))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def soft_shape(img, draw_fn, blur=0, color=None, alpha=255):
    """把一组绘制操作画进 RGBA 图层再合成（便于做半透明 / 模糊的线）。"""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    if blur:
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def glow_text_layer(size, text_cx, text_cy, ch, f, color, radius, alpha):
    """一个字的柔光（用于恐怖 / 霓虹）。"""
    layer = Image.new("L", (size, size), 0)
    ink_center(ImageDraw.Draw(layer), ch, f, text_cx, text_cy, 255)
    layer = layer.filter(ImageFilter.GaussianBlur(radius))
    layer = Image.eval(layer, lambda v: int(v * alpha))
    return layer, color


def pixel_text_mask(text, f, cell, out_h):
    """把文字压成「像素字」：先大尺寸渲染，降到低分辨率再用 NEAREST 放大回去。"""
    tmp = Image.new("L", (10, 10))
    b = ImageDraw.Draw(tmp).textbbox((0, 0), text, font=f)
    m = Image.new("L", (b[2] - b[0] + 4, b[3] - b[1] + 4), 0)
    ImageDraw.Draw(m).text((2 - b[0], 2 - b[1]), text, font=f, fill=255)
    low_h = max(6, round(out_h / cell))
    low_w = max(6, round(m.width * low_h / m.height))
    m = m.resize((low_w, low_h), Image.BOX)
    return m.resize((low_w * cell, low_h * cell), Image.NEAREST)


def rounded_mask(size, box, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def colorize(mask, color):
    """L 掩码 → RGBA 单色图。"""
    img = Image.new("RGBA", mask.size, color + (0,))
    img.putalpha(mask)
    return img

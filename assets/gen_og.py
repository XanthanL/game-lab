# -*- coding: utf-8 -*-
"""OG 缩略图生成器 —— 与 assets/gen_share_cards.py 风格统一但只生全站本体 + 共振纪元。

调用：
    venv python assets/gen_og.py

输出：
    assets/og-gamelab.jpg             1200x1200  全站本体（电光蓝 + 实验合集）
    resonance-era/assets/og-resonance-era.jpg   1200x1200  共振纪元（克莱因蓝 + 酸黄）

设计原则（与 gen_share_cards 一脉）：
- 每张图按自己的母题画（不让"全站"和"共振纪元"长得一样）。
- 标题纯中文，副标可中英混排。
- 字体走 PIL 可读 ttf：C:/Windows/Fonts/NotoSansSC-VF / NotoSerifSC-VF / simhei。
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = 1200

FD = "C:/Windows/Fonts/"
SANS_VF = FD + "NotoSansSC-VF.ttf"
SERIF_VF = FD + "NotoSerifSC-VF.ttf"
HEI = FD + "simhei.ttf"


def font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight is not None:
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass
    return f


def tracked(draw, cx, cy, text, f, fill, tracking=0, anchor_y="ink"):
    """带字距的一行字；(cx, cy) 默认整行墨迹框中心。"""
    b = draw.textbbox((0, 0), text, font=f)
    total = sum(draw.textlength(c, font=f) for c in text) + tracking * (len(text) - 1)
    x = cx - total / 2
    if anchor_y == "ink":
        y = cy - b[1] - (b[3] - b[1]) / 2
    else:
        y = cy - (b[3] - b[1]) / 2 - b[1]
    for c in text:
        draw.text((x, y), c, font=f, fill=fill)
        x += draw.textlength(c, font=f) + tracking
    return total


def vgrad(size, top, bot):
    """上下垂直渐变；size=(w,h)"""
    im = Image.new("RGB", size, top)
    w, h = size
    for y in range(h):
        t = y / h
        r = round(top[0] + (bot[0] - top[0]) * t)
        g = round(top[1] + (bot[1] - top[1]) * t)
        b = round(top[2] + (bot[2] - top[2]) * t)
        ImageDraw.Draw(im).line([(0, y), (w, y)], fill=(r, g, b))
    return im


def grain(im, intensity=3.0, seed=5):
    """加颗粒噪声"""
    import random
    rnd = random.Random(seed)
    n_range = int(intensity * 8)
    px = im.load()
    for _ in range(im.size[0] * im.size[1] // 80):
        x = rnd.randrange(im.size[0])
        y = rnd.randrange(im.size[1])
        r, g, b = px[x, y][:3]
        n = rnd.randint(-n_range, n_range)
        px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return im


def mark2x2(im, cx, cy, cell=27, gap=8):
    """2x2 标记 —— 三格白纸 + 右下酸黄（与 favicon 同款）"""
    tones = [((255, 255, 255), 255), ((255, 255, 255), 199),
             ((255, 255, 255), 199), ((237, 255, 69), 255)]
    d = ImageDraw.Draw(im)
    for i, (t, a) in enumerate(tones):
        x = cx - cell - gap / 2 + (i % 2) * (cell + gap)
        y = cy - cell - gap / 2 + (i // 2) * (cell + gap)
        d.rounded_rectangle([x, y, x + cell, y + cell],
                            radius=round(cell * 0.26), fill=t + (a,))
    return im


# ------------------------------------------------------------------ 全站
def scene_site(size=SZ):
    """电光蓝满版 + 米白 + 酸黄点缀。
    同心环 = 首页 hero「光轮」的抽象（缩略图小，看不见花哨，所以只留 3 圈细线）。
    副标更新：游戏 · 作品 · 实验（4 部作品 + 4 组实验）。"""
    im = vgrad((size, size), (12, 12, 255), (0, 0, 208))
    im = grain(im, 3.0, seed=5)
    ink = (245, 245, 245)
    acid = (237, 255, 69)
    dim = (138, 138, 238)

    d = ImageDraw.Draw(im)
    for r in (150, 214, 278):
        d.ellipse([size / 2 - r, 232 - r, size / 2 + r, 232 + r],
                  outline=ink + (60,), width=2)
    d.line([(120, 232), (size - 120, 232)], fill=ink + (100,), width=1)
    d.line([(120, 1004), (size - 120, 1004)], fill=ink + (100,), width=1)
    d.line([(468, 706), (732, 706)], fill=acid + (255,), width=4)
    mark2x2(im, size / 2, 232)

    d = ImageDraw.Draw(im)
    tracked(d, size / 2, 552, "实验合集", font(SERIF_VF, 208, 600), ink, 26)
    tracked(d, size / 2, 848, "游戏 · 作品 · 实验", font(SANS_VF, 40, 350), dim, 18)
    tracked(d, size / 2, 928, "GAME LAB", font(SANS_VF, 26, 350), dim + (110,), 14)
    return im


# ------------------------------------------------------------------ 共振纪元
def scene_resonance(size=SZ):
    """克莱因蓝 (IKB #002FA7) 顶满 + 酸黄 (#EDFF45) 作唯一的彩色。
    视觉母题：
      - 中央一个大圆环（= 共振环 / 12.7Hz 的隐喻 —— 一圈频率就锁住一整层）；
      - 环外一圈一圈向内收（= 声音从外向内塌缩）；
      - 圆环上下各一道酸黄细横线（= 横向的两个节点 / 频段边界）；
      - 左下角一个指甲大小的「12.7Hz」小字（细、克制、不显眼 —— 让看见的人记住它）。
    标题"共振纪元"中粗体偏 ink 副色（米白）。"""
    ikb = (0, 47, 167)        # 国际克莱因蓝
    ikb_deep = (0, 18, 96)    # 克莱因蓝深处（做暗角）
    ink = (232, 236, 248)     # 米白偏冷
    acid = (237, 255, 69)     # 酸黄（共振环上的"那一颗"）

    im = vgrad((size, size), ikb, ikb_deep)
    im = grain(im, 2.6, seed=11)

    d = ImageDraw.Draw(im)

    # 中央同心环（5 圈：外到内，淡到实；最内一圈是酸黄）
    cx, cy = size / 2, size * 0.46
    for i, (r, alpha) in enumerate([(360, 24), (300, 36), (240, 56), (180, 90), (120, 0)]):
        if r == 120:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=acid + (255,), width=3)
        else:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ink + (alpha,), width=2)
    # 上下酸黄细线（节点 / 频段边界）
    d.line([(cx - 360, cy - 380), (cx + 360, cy - 380)], fill=acid + (180,), width=2)
    d.line([(cx - 360, cy + 380), (cx + 360, cy + 380)], fill=acid + (180,), width=2)
    # 中心一颗极小的酸黄圆点（频率的"零号样本"）
    d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=acid)

    # 横线分隔
    d.line([(120, 760), (size - 120, 760)], fill=ink + (90,), width=1)
    d.line([(120, 1010), (size - 120, 1010)], fill=ink + (90,), width=1)

    # 标题"共振纪元" —— 大字
    d2 = ImageDraw.Draw(im)
    tracked(d2, size / 2, 850, "共振纪元", font(SERIF_VF, 152, 700), ink, 8)
    # 副标 RESONANCE ERA + 描述
    tracked(d2, size / 2, 950, "RESONANCE ERA", font(SANS_VF, 36, 600), ink + (180,), 14)
    tracked(d2, size / 2, 1010, "硬科幻长篇 · 25 章", font(SANS_VF, 28, 350), ink + (160,), 12)

    # 左下角：克制的"12.7 Hz"小字
    d3 = ImageDraw.Draw(im)
    d3.text((120, size - 90), "12.7 Hz", font=font(SANS_VF, 26, 600), fill=ink + (150,))
    d3.text((120, size - 60), "纪元 1018 · 六层级社会", font=font(SANS_VF, 22, 350), fill=ink + (130,))

    # 右下角：克制的"GAME LAB"小字
    d4 = ImageDraw.Draw(im)
    # 用 LTRIM 锚右端（从右侧算起 60px），避免 url 溢出
    url = "xanthanl.github.io/game-lab"
    bw = d4.textlength(url, font=font(SANS_VF, 20, 350))
    d4.text((size - 60 - int(bw), size - 60), url, font=font(SANS_VF, 20, 350), fill=ink + (130,))
    gl = "GAME LAB"
    gw = d4.textlength(gl, font=font(SANS_VF, 26, 600))
    d4.text((size - 60 - int(gw), size - 90), gl, font=font(SANS_VF, 26, 600), fill=ink + (150,))

    return im


# ------------------------------------------------------------------ 输出
OUT = [
    ("assets/og-gamelab.jpg",                                    scene_site),
    ("resonance-era/assets/og-resonance-era.jpg",                scene_resonance),
]


def main():
    for rel, fn in OUT:
        img = fn()
        out = os.path.join(REPO, rel)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        img.save(out, "JPEG", quality=85, optimize=True, progressive=True)
        print("wrote %-50s %s  %d KB" % (rel, img.size, os.path.getsize(out) // 1024))


if __name__ == "__main__":
    main()
# -*- coding: utf-8 -*-
"""GAME LAB 全站分享缩略图（微信 / Open Graph）生成器。

一套**刻意不统一**的设计：每张图都按自己项目真实的样子画 —— 底色 / 主色 / 字体气质
取自各站点自己的 CSS（采集方法见 .workbuddy/shots/probe-style.js）：

    实验合集      石墨 + 暖白衬线 + 细分隔线（站点自身几乎没有彩色，这里也不给）
    奇点回响      虚空黑 + 暖纸白 + 星野 + 一枚红刻度
    微软大战代码  浅灰桌面 + 白窗 + 绿按钮（它首屏那个安装向导）
    植物大战僵尸  草坪条纹 + 太阳 + 绿色硬阴影标题
    强渡火星      暗赭地层剖面，越往下越烫，地核在发光
    怨宅          纯黑 + 血红 + 咒印 + 雨丝
    欧陆风云      羊皮纸 + 罗盘 + 金线
    吸血鬼幸存者  暗紫 + 荧光粉 + 像素血条
    像素舞台剧    白纸 + 真·像素字（降采样后 NEAREST 放大）
    文字工坊      近黑 + 暖白 + ASCII 密度斜坡 + 一点橙
    树言 · 旅记   米黄纸 + 棕墨 + 一条对角线（那趟徒步）

共同点只有两条：正方形 1200×1200、标题纯中文。

    venv python assets/gen_share_cards.py            # 全部重画
    venv python assets/gen_share_cards.py --preview  # 另出核对图
"""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

import share_kit as K

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = 1200


# ------------------------------------------------------------------ 小工具
def layer(im, fn, blur=0):
    """把一组半透明绘制合成到图上。"""
    return K.soft_shape(im, fn, blur=blur)


def hair(im, pts, color, alpha=40, w=1, blur=0):
    return layer(im, lambda d: d.line(pts, fill=color + (alpha,), width=w, joint="curve"), blur=blur)


def ink_glow(im, cx, cy, text, f, tracking, color, radius, alpha):
    """给一行字加柔光（恐怖 / 霓虹用）。"""
    g = Image.new("L", im.size, 0)
    K.tracked(ImageDraw.Draw(g), cx, cy, text, f, 255, tracking)
    g = Image.eval(g.filter(ImageFilter.GaussianBlur(radius)), lambda v: int(v * alpha))
    return Image.composite(Image.new("RGB", im.size, color), im, g)


def mark2x2(im, cx, cy, cell=27, gap=8, alpha=225):
    """favicon 的 2×2 玻璃格标记。"""
    tones = [(242, 242, 240), (142, 142, 146), (142, 142, 146), (74, 74, 78)]

    def fn(d):
        for i, t in enumerate(tones):
            x = cx - cell - gap / 2 + (i % 2) * (cell + gap)
            y = cy - cell - gap / 2 + (i // 2) * (cell + gap)
            d.rounded_rectangle([x, y, x + cell, y + cell],
                                radius=round(cell * 0.26), fill=t + (alpha,))
    return layer(im, fn)


# ------------------------------------------------------------------ 1. 实验合集
def scene_site(size=SZ):
    im = K.vgrad((size, size), (17, 17, 20), (8, 8, 10))
    im = K.wash(im, size / 2, size * 0.40, size * 0.66, (72, 68, 60), 0.42)
    im = K.grain(im, 3.0, seed=5)
    ink = (242, 239, 233)

    def rules(d):
        for y in (232, 1004):
            d.line([(120, y), (size - 120, y)], fill=ink + (34,), width=1)
        d.line([(468, 706), (732, 706)], fill=ink + (110,), width=2)

    im = layer(im, rules)
    im = mark2x2(im, size / 2, 232)

    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 552, "实验合集", K.serif(208, 600), ink, 26)
    K.tracked(d, size / 2, 848, "游戏 · 实验 · 站点", K.sans(40, 350), (128, 124, 116), 18)
    return K.vignette(im, 0.40)


# ------------------------------------------------------------------ 2. 奇点回响
def scene_se(size=SZ):
    im = K.vgrad((size, size), (9, 11, 15), (3, 4, 6))
    im = K.wash(im, size * 0.5, size * 0.30, size * 0.60, (120, 116, 104), 0.16)
    im = K.stars(im, 1100, seed=11, color=(240, 236, 226), rmax=1.7, alpha=(28, 210))
    im = K.stars(im, 26, seed=12, color=(255, 255, 255), rmax=2.6, alpha=(150, 255))
    im = K.grain(im, 3.0, seed=9)
    paper = (232, 226, 212)

    def art(d):
        # 游戏 favicon 的箭标：右尖 / 左下 / 中间凹口 / 左上（viewBox 32 里的 (28,16)(6,27)(11,16)(6,5)）
        k, cx0, cy0 = 3.4, 600, 288
        pts = [(28, 16), (6, 27), (11, 16), (6, 5)]
        d.polygon([(cx0 + (x - 17) * k, cy0 + (y - 16) * k) for x, y in pts],
                  outline=paper + (215,), width=3)
        d.rounded_rectangle([336, 762, 864, 854], radius=4, outline=paper + (46,), width=2)

    im = layer(im, art)
    im = hair(im, [(600, 372), (600, 414)], (230, 110, 80), 170, 2)

    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 592, "奇点回响", K.sans(196, 700), paper, 26)
    K.tracked(d, size / 2, 808, "星域弹幕射击 · 无尽漂移", K.sans(36, 350), (168, 159, 143), 9)
    return K.vignette(im, 0.52)


# ------------------------------------------------------------------ 3. 微软大战代码
def scene_mvs(size=SZ):
    im = K.vgrad((size, size), (239, 236, 229), (222, 219, 210))
    im = layer(im, lambda d: [d.ellipse([x - 1.4, y - 1.4, x + 1.4, y + 1.4],
                                        fill=(150, 146, 136, 26))
                              for x in range(12, size, 34) for y in range(12, size, 34)])
    box = [188, 226, size - 188, 986]
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([box[0], box[1] + 10, box[2], box[3] + 10],
                                         radius=8, fill=(90, 84, 70, 70))
    im = Image.alpha_composite(im.convert("RGBA"),
                               sh.filter(ImageFilter.GaussianBlur(18))).convert("RGB")
    im = layer(im, lambda d: d.rounded_rectangle(box, radius=6, fill=(252, 251, 248, 255)))
    im = layer(im, lambda d: d.rounded_rectangle(box, radius=6, outline=(200, 195, 183, 255), width=2))
    im = K.grain(im, 2.2, seed=4)

    d = ImageDraw.Draw(im)
    d.rounded_rectangle([250, 288, 274, 312], radius=3, fill=(142, 240, 122))
    K.tracked(d, size / 2, 452, "微软大战代码", K.serif(126, 700), (26, 26, 24), 4)
    K.tracked(d, size / 2, 578, "程序员恶搞塔防 · 十章", K.sans(36, 350), (110, 105, 95), 8)
    d.rounded_rectangle([254, 690, 946, 764], radius=6, fill=(142, 240, 122))
    d.rounded_rectangle([254, 690, 946, 764], radius=6, outline=(92, 158, 78), width=2)
    K.tracked(d, size / 2, 727, "开始", K.sans(46, 700), (5, 20, 15), 10)
    im = hair(im, [(254, 838), (946, 838)], (60, 55, 45), 40)
    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 888, "梗图改编 · 五章十关 · 手机可玩", K.sans(32, 350), (128, 123, 113), 8)
    return im


# ------------------------------------------------------------------ 4. 植物大战僵尸
def outlined(d, cx, cy, text, f, fill, outline, tracking=0, w=5):
    """带描边的标题：先按 8 个方向画描边色，再把填充色盖上去。"""
    import math as _m
    for i in range(8):
        a = _m.radians(i * 45)
        K.tracked(d, cx + _m.cos(a) * w, cy + _m.sin(a) * w, text, f, outline, tracking)
    K.tracked(d, cx, cy, text, f, fill, tracking)


def scene_pvz(size=SZ):
    """草坪 + 太阳 + 描边标题 + 一排种子卡（它首屏就是这块草地和这套 HUD）。"""
    im = K.vgrad((size, size), (7, 14, 5), (11, 22, 8))
    lawn_y = 604
    band = (size - lawn_y) / 5
    d = ImageDraw.Draw(im)
    for i in range(6):
        y0 = lawn_y + i * band
        d.rectangle([0, y0, size, y0 + band],
                    fill=(76, 140, 44) if i % 2 == 0 else (96, 166, 54))

    def lawn_grid(dd):
        for x in range(0, size + 1, 150):
            dd.line([(x, lawn_y), (x, size)], fill=(38, 82, 22, 54), width=2)
        for i in range(6):
            dd.line([(0, round(lawn_y + i * band)), (size, round(lawn_y + i * band))],
                    fill=(38, 82, 22, 54), width=2)

    im = layer(im, lawn_grid)
    im = layer(im, lambda dd: dd.rectangle([0, lawn_y, size, size], fill=(0, 0, 0, 8)))
    im = K.wash(im, 228, 190, 330, (255, 224, 132), 0.60)
    im = K.grain(im, 3.4, seed=13)

    d = ImageDraw.Draw(im)
    sun = (255, 233, 156)
    for i in range(12):
        a = math.radians(i * 30)
        d.line([(228 + math.cos(a) * 76, 190 + math.sin(a) * 76),
                (228 + math.cos(a) * 102, 190 + math.sin(a) * 102)], fill=sun, width=7)
    d.ellipse([164, 126, 292, 254], fill=sun)

    outlined(d, size / 2, 402, "植物大战僵尸", K.sans(118, 800),
             (250, 255, 244), (14, 44, 8), 2, 6)
    K.tracked(d, size / 2, 512, "塔防复刻 · 二十三关六世界", K.sans(33, 400), (150, 190, 126), 8)

    # 种子卡（游戏 HUD）+ 几颗落下的阳光
    px, py, pw, ph = 152, lawn_y + 34, 72, 106
    for i, col in enumerate(((132, 200, 76), (255, 214, 92), (196, 142, 74), (168, 120, 224))):
        x = px + i * (pw + 22)
        d.rounded_rectangle([x, py, x + pw, py + ph], radius=9, fill=(238, 224, 178),
                            outline=(74, 54, 26), width=3)
        d.rounded_rectangle([x + 9, py + 9, x + pw - 9, py + ph - 30], radius=6, fill=(214, 198, 150))
        d.ellipse([x + pw / 2 - 20, py + 30, x + pw / 2 + 20, py + 70], fill=col,
                  outline=(74, 54, 26), width=2)
        d.rectangle([x + 14, py + ph - 22, x + pw - 14, py + ph - 18], fill=(74, 54, 26))
    for cx, cy, r in ((812, 792, 22), (944, 986, 19), (700, 1084, 17)):
        im = K.wash(im, cx, cy, r * 3.4, (255, 226, 130), 0.5)
        d = ImageDraw.Draw(im)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 228, 128),
                  outline=(206, 168, 60), width=3)
    return K.vignette(im, 0.30)


# ------------------------------------------------------------------ 5. 强渡火星
def scene_mars(size=SZ):
    im = K.vgrad((size, size), (24, 11, 9), (58, 15, 8))
    d = ImageDraw.Draw(im)
    rnd = random.Random(21)
    y, i = 190, 0
    while y < size:
        h = 74 + rnd.randint(0, 46)
        t = min(1.0, (y - 190) / (size - 190))
        alt = 9 if i % 2 else -7                      # 层与层之间要看得见
        d.rectangle([0, y, size, y + h],
                    fill=(round(32 + 40 * t + alt), round(13 + 7 * t + alt * .6),
                          round(11 + 2 * t + alt * .3)))
        d.line([(0, y), (size, y)], fill=(226, 152, 112, 34), width=1)
        y += h
        i += 1
    im = layer(im, lambda dd: dd.rectangle([0, 190, size, 210], fill=(0, 0, 0, 40)))
    im = K.wash(im, size / 2, 1046, 330, (255, 138, 62), 0.62)
    im = K.grain(im, 3.6, seed=6)
    im = hair(im, [(size / 2, 196), (size / 2, 946)], (255, 170, 120), 90, 2)

    d = ImageDraw.Draw(im)
    d.ellipse([size / 2 - 34, 1012, size / 2 + 34, 1080], fill=(255, 168, 92))
    K.tracked(d, size / 2, 486, "强渡火星", K.sans(178, 800), (242, 206, 178), 20)
    K.tracked(d, size / 2, 620, "卡牌构筑 · 下潜到地核", K.sans(35, 350), (216, 152, 120), 9)
    return K.vignette(im, 0.30, radius=0.86)


# ------------------------------------------------------------------ 6. 怨宅
def scene_house(size=SZ):
    im = K.vgrad((size, size), (10, 6, 6), (0, 0, 0))
    rnd = random.Random(33)

    def rain(d):
        for _ in range(110):
            x = rnd.uniform(-40, size)
            y = rnd.uniform(0, size)
            d.line([(x, y), (x - 26, y + rnd.uniform(50, 170))],
                   fill=(150, 160, 175, rnd.randint(10, 26)), width=1)

    im = layer(im, rain, blur=0.6)
    im = K.grain(im, 3.2, seed=8)
    red = (198, 22, 22)
    im = layer(im, lambda d: d.ellipse([size / 2 - 60, 208, size / 2 + 60, 328],
                                       outline=red + (235,), width=4))
    im = ink_glow(im, size / 2, 604, "怨宅", K.serif(252, 700), 150, (140, 8, 8), 26, 0.55)

    d = ImageDraw.Draw(im)
    K.ink_center(d, "咒", K.serif(66, 700), size / 2, 268, red)
    K.tracked(d, size / 2, 604, "怨宅", K.serif(252, 700), (222, 34, 30), 150)
    K.tracked(d, size / 2, 838, "第一人称中式恐怖 · 五章六图", K.sans(36, 350), (146, 62, 62), 14)
    im = hair(im, [(446, 930), (754, 930)], red, 90)
    return K.vignette(im, 0.66)


# ------------------------------------------------------------------ 7. 欧陆风云
def scene_europa(size=SZ):
    im = K.vgrad((size, size), (247, 243, 235), (235, 229, 216))
    im = K.wash(im, size * 0.22, size * 0.24, size * 0.42, (198, 178, 140), 0.30)
    im = K.wash(im, size * 0.84, size * 0.86, size * 0.36, (192, 172, 132), 0.26)
    im = K.specks(im, seed=15, n=4200, colors=((150, 126, 92), (255, 252, 240)), alpha=22, rmax=1.5)
    sepia = (120, 96, 62)
    cx, cy, r = 894, 292, 96

    def mapart(d):
        for x in range(0, size, 100):
            d.line([(x, 0), (x, size)], fill=sepia + (16,), width=1)
        for y in range(0, size, 100):
            d.line([(0, y), (size, y)], fill=sepia + (16,), width=1)
        d.line([(60, 1046), (196, 944), (250, 872), (392, 826), (430, 700), (556, 640),
                (612, 528), (742, 486), (790, 372), (900, 330), (952, 226), (1128, 186)],
               fill=sepia + (72,), width=3, joint="curve")
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=sepia + (66,), width=2)
        d.ellipse([cx - r * .72, cy - r * .72, cx + r * .72, cy + r * .72],
                  outline=sepia + (44,), width=1)
        for i in range(8):
            a = math.radians(i * 45)
            d.line([(cx, cy), (cx + math.cos(a) * r, cy + math.sin(a) * r)],
                   fill=sepia + (52,), width=1)

    im = layer(im, mapart)
    gold = (201, 162, 39)
    d = ImageDraw.Draw(im)
    for i in range(4):
        a, b = math.radians(i * 90), math.radians(i * 90 + 45)
        c = math.radians(i * 90 - 45)
        d.polygon([(cx + math.cos(a) * 78, cy + math.sin(a) * 78),
                   (cx + math.cos(b) * 24, cy + math.sin(b) * 24),
                   (cx + math.cos(c) * 24, cy + math.sin(c) * 24)], fill=gold)
    K.tracked(d, size / 2, 556, "欧陆风云", K.serif(190, 700), (36, 31, 25), 26)
    im = hair(im, [(490, 706), (710, 706)], gold, 235, 4)
    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 796, "一四四四年 · 六十国大战略", K.sans(36, 400), (120, 100, 70), 10)
    return K.vignette(im, 0.20, radius=0.92)


# ------------------------------------------------------------------ 8. 吸血鬼幸存者
def scene_vampire(size=SZ):
    im = K.vgrad((size, size), (20, 11, 34), (8, 4, 16))
    im = layer(im, lambda d: [d.line([(x, 0), (x, size)], fill=(124, 77, 255, 13), width=1)
                              for x in range(0, size, 60)])
    im = layer(im, lambda d: [d.line([(0, y), (size, y)], fill=(124, 77, 255, 13), width=1)
                              for y in range(0, size, 60)])
    im = K.wash(im, size * 0.5, size * 0.44, size * 0.60, (255, 77, 109), 0.20)
    im = K.grain(im, 3.2, seed=17)
    hearts = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"]

    def heart(d, hx, hy, cell, col, on):
        for r, row in enumerate(hearts):
            for c, ch in enumerate(row):
                if ch == "1":
                    x, y = hx + (c - 3.5) * cell, hy + (r - 3) * cell
                    d.rectangle([x, y, x + cell, y + cell], fill=col + (255 if on else 70,))

    im = layer(im, lambda d: [heart(d, 214 + i * 58, 266, 7, (255, 77, 109), i < 3)
                              for i in range(5)])
    pink = (255, 96, 124)
    f = K.sans(158, 800)
    im = ink_glow(im, size / 2, 566, "吸血鬼幸存者", f, 8, (120, 20, 60), 30, 0.42)

    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 566, "吸血鬼幸存者", f, pink, 8)
    K.tracked(d, size / 2, 700, "顶视角生存 · 无尽怪潮", K.sans(35, 350), (154, 138, 184), 9)
    d.rounded_rectangle([300, 806, 900, 830], radius=12, fill=(44, 32, 62))
    d.rounded_rectangle([300, 806, 672, 830], radius=12, fill=(124, 77, 255))
    d.rounded_rectangle([656, 806, 672, 830], radius=8, fill=(255, 210, 63))
    return K.vignette(im, 0.46)


# ------------------------------------------------------------------ 9. 像素舞台剧
def scene_persona(size=SZ):
    im = K.vgrad((size, size), (252, 252, 250), (243, 243, 240))
    im = layer(im, lambda d: [d.rectangle([x, y, x + 2, y + 2], fill=(26, 26, 24, 30))
                              for x in range(28, size, 26) for y in range(28, size, 26)])
    im = K.grain(im, 1.8, seed=19)
    ink = (26, 26, 24)
    im = hair(im, [(150, 300), (size - 150, 300)], ink, 60)

    pm = K.pixel_text_mask("像素舞台剧", K.sans(300, 800), cell=10, out_h=226)
    im.paste(K.colorize(pm, ink), (round(size / 2 - pm.width / 2), 452), pm)

    d = ImageDraw.Draw(im)
    for i in range(11):
        x = size / 2 - (11 * 30 - 8) / 2 + i * 30
        d.rectangle([x, 812, x + 22, 834], fill=ink if i % 4 == 0 else None, outline=ink, width=3)
    K.tracked(d, size / 2, 926, "同一句话 · 十一部答案", K.sans(34, 400), (110, 108, 100), 10)
    return im


# ------------------------------------------------------------------ 10. 文字工坊
def scene_ascii(size=SZ):
    im = K.vgrad((size, size), (14, 14, 16), (8, 8, 10))
    im = K.wash(im, size * 0.5, size * 0.28, size * 0.58, (60, 58, 54), 0.30)
    im = K.grain(im, 3.0, seed=23)
    ink = (242, 239, 233)
    ramp = " .:-=+*#%@"
    rnd = random.Random(29)
    cols, rows, x0, y0, cw, ch = 46, 9, 140, 232, 20, 26

    def ramp_block(d):
        for r in range(rows):
            for c in range(cols):
                t = c / (cols - 1)
                if rnd.random() < 0.10:
                    continue
                g = ramp[max(0, min(len(ramp) - 1, int(t * (len(ramp) - 1) + rnd.uniform(-0.7, 0.7))))]
                if g != " ":
                    d.text((x0 + c * cw, y0 + r * ch), g, font=K.font(K.MONO, 22),
                           fill=ink + (int(40 + 205 * t),))

    im = layer(im, ramp_block)
    im = hair(im, [(x0, y0 + rows * ch + 22), (x0 + (cols - 1) * cw, y0 + rows * ch + 22)],
              (255, 74, 28), 200, 6)
    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 786, "文字工坊", K.sans(198, 800), ink, 16)
    K.tracked(d, size / 2, 930, "汉字与字母变成字符画", K.sans(34, 350), (150, 146, 138), 12)
    return K.vignette(im, 0.42)


# ------------------------------------------------------------------ 11. 树言 · 旅记
def scene_shuyan(size=SZ):
    im = K.vgrad((size, size), (255, 249, 228), (250, 241, 214))
    im = K.specks(im, seed=31, n=3600, colors=((150, 120, 80), (255, 253, 245)), alpha=20, rmax=1.6)
    im = K.wash(im, size * 0.30, size * 0.26, size * 0.48, (206, 178, 132), 0.16)
    earth = (121, 85, 72)
    pts = [(168, 1042), (286, 936), (392, 878), (470, 786), (598, 726),
           (690, 622), (812, 556), (900, 442), (1024, 372), (1064, 268)]
    im = hair(im, pts, earth, 110, 3, blur=0.7)

    def dots(d):
        for i, (x, y) in enumerate(pts):
            r = 12 if i % 3 == 0 else 9
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 249, 231, 255),
                      outline=earth + (200,), width=3)

    im = layer(im, dots)
    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 556, "树言旅记", K.serif(186, 600), (44, 24, 16), 24)
    im = hair(im, [(496, 706), (704, 706)], (139, 115, 85), 150, 3)
    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 796, "徒步对角线 · 两年零一个月", K.sans(35, 400), (122, 96, 66), 11)
    return K.vignette(im, 0.16, radius=0.94)


# ------------------------------------------------------------------ 输出
CARDS = [
    ("assets/og-gamelab.jpg",      scene_site),
    ("singularity-echo/thumb.jpg", scene_se),
    ("singularity-echo/og.jpg",    scene_se),
    ("microsoft-vs-code/og.jpg",   scene_mvs),
    ("PVZ/og.jpg",                 scene_pvz),
    ("forcing-mars/og.jpg",        scene_mars),
    ("cursed-house/og.jpg",        scene_house),
    ("europa/og.jpg",              scene_europa),
    ("Vampire-2D/og.jpg",          scene_vampire),
    ("persona/og.jpg",             scene_persona),
    ("ascii-art/og.jpg",           scene_ascii),
    ("shuyan-travel/og.jpg",       scene_shuyan),
]


def build_all():
    made, seen = [], {}
    for rel, fn in CARDS:
        img = seen.get(fn)
        if img is None:
            img = fn()
            seen[fn] = img
        out = os.path.join(REPO, rel)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        img.save(out, "JPEG", quality=85, optimize=True, progressive=True)
        made.append((rel, img))
        print("wrote %-28s %s  %d KB" % (rel, img.size, os.path.getsize(out) // 1024))
    return made


def contact_sheet(made, path, per_row=4, big=300, pad=16):
    rows = math.ceil(len(made) / per_row)
    sheet = Image.new("RGB", (per_row * (big + pad) + pad, rows * (big + pad) + pad), (18, 18, 20))
    for i, (_r, img) in enumerate(made):
        sheet.paste(img.resize((big, big), Image.LANCZOS),
                    (pad + (i % per_row) * (big + pad), pad + (i // per_row) * (big + pad)))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.save(path, "PNG")
    print("preview", path, sheet.size)


def main():
    made = build_all()
    if "--preview" in sys.argv:
        contact_sheet(made, os.path.join(REPO, ".workbuddy", "shots", "share-contact.png"))


if __name__ == "__main__":
    main()

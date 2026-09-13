# -*- coding: utf-8 -*-
"""testing-example 各子站的微信 / Open Graph 分享缩略图生成器。

和 assets/gen_share_cards.py 同一套路数：**刻意不统一** —— 每张图都用该子站
自己 tokens.css 里的底色 / 主色 / 字体气质来画，一眼能认出是哪一家：

    样例站点      电光蓝满版 + 十二格环（首页那座黏液环廊的抽象）
    锐角          墨黑 + 左侧时刻尺 + 一枚锐角三角（预约制）
    辰光修表铺    宣纸米白 + 一整块墨黑招牌 + 金色表盘
    宏达汽修      水泥灰 + 数据密集的价目账本（swiss-utility）
    老陈家面馆    纸白 + 朱赭印章 + 一碗面
    麦芒手作      奶咖底 + 麦穗 + 低垂的太阳（日落前截单）
    拾花          米黄纸 + 牛皮纸包 + 一把花枝
    簪三制壶      宣纸 + 水墨茶壶 + 一方朱砂印（ink-wash 锚点）
    铜管与滤芯    混凝土冷灰 + 危险品条纹 + 滤芯罐（粗野派）
    涂涂画画      纸白 + 一圈孩子的画（黏液环廊）
    唱片库存      纯白 + 一张黑胶 + 库存表（data-dense）
    虚空典籍      近黑 + 霓虹渐变字 + 一排书脊
    屿光摄影      暖奶橘 + 相框里的海平线

共同点只有两条：正方形 1200×1200、标题只写站名（不带描述尾巴）。
每张右下角留一枚极安静的 GAME LAB 系列标（编号 / 总数）。

用法：
    python tools/gen-og.py              # 全部重画到 assets/og/
    python tools/gen-og.py --preview    # 另出一张核对图
"""
import math
import os
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parents[1]           # testing-example/
REPO = HERE.parent                                   # game-lab/
sys.path.insert(0, str(REPO / "assets"))

import share_kit as K  # noqa: E402

SZ = 1200
OUT = HERE / "assets" / "og"
TOTAL = 12


# ------------------------------------------------------------------ 小工具
def layer(im, fn, blur=0):
    return K.soft_shape(im, fn, blur=blur)


def hair(im, pts, color, alpha=40, w=1, blur=0):
    return layer(im, lambda d: d.line(pts, fill=color + (alpha,), width=w, joint="curve"), blur=blur)


def glow(im, cx, cy, text, f, trk, color, radius, alpha):
    """给一行字加柔光（霓虹 / 恐怖用）。"""
    g = Image.new("L", im.size, 0)
    K.tracked(ImageDraw.Draw(g), cx, cy, text, f, 255, trk)
    g = Image.eval(g.filter(ImageFilter.GaussianBlur(radius)), lambda v: int(v * alpha))
    return Image.composite(Image.new("RGB", im.size, color), im, g)


def series(im, idx, ink, alpha=105):
    """右下角那枚极安静的系列标：GAME LAB · 编号/总数。"""
    f = K.font(K.MONO, 25)

    def fn(d):
        d.text((118, 1082), "GAME LAB", font=f, fill=ink + (alpha,))
        lab = "%02d / %02d" % (idx, TOTAL)
        d.text((1082 - d.textlength(lab, font=f), 1082), lab, font=f, fill=ink + (alpha,))

    return layer(im, fn)


def gradient(size, stops):
    """横向多段渐变（stops 是 [(t, (r,g,b)), ...]）。给霓虹字用。"""
    w, h = size
    arr = Image.new("RGB", (w, 1))
    px = arr.load()
    stops = sorted(stops)
    for x in range(w):
        t = x / max(w - 1, 1)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1 or i == len(stops) - 2:
                k = 0 if t1 == t0 else min(1.0, max(0.0, (t - t0) / (t1 - t0)))
                px[x, 0] = tuple(round(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                break
    return arr.resize((w, h), Image.NEAREST)


def grad_text(im, cx, cy, text, f, trk, stops, blur=0):
    """按字模贴横向渐变（虚空典籍的 --grad-display）。"""
    m = Image.new("L", im.size, 0)
    K.tracked(ImageDraw.Draw(m), cx, cy, text, f, 255, trk)
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    return Image.composite(gradient(im.size, stops), im, m)


def seal(im, cx, cy, size, bg, fg, ch, font_path=K.KAI):
    """一枚方形印章（朱砂）。"""
    box = [cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2]

    def fn(d):
        d.rounded_rectangle(box, radius=size * 0.10, fill=bg + (255,))

    im = layer(im, fn)
    d = ImageDraw.Draw(im)
    K.ink_center(d, ch, K.font(font_path, size * 0.66), cx, cy, fg)
    return im


# ================================================================== 1. 样例站点
def scene_samples(size=SZ):
    """电光蓝满版 + 十二格环 —— 首页那座环廊，一格一个子站。"""
    im = K.vgrad((size, size), (12, 12, 255), (0, 0, 208))
    im = K.grain(im, 3.0, seed=5)
    ink = (245, 245, 245)
    acid = (237, 255, 69)
    dim = (140, 140, 240)
    cx, cy, R = size / 2, 566, 268
    tiles = [(255, 255, 255), (237, 255, 69), (255, 255, 255), (176, 220, 255),
             (255, 255, 255), (255, 176, 138), (255, 255, 255), (176, 255, 214),
             (255, 255, 255), (255, 214, 120), (255, 255, 255), (214, 176, 255)]
    side = 62

    def ring(d):
        for r in (150, 214, 278):
            d.ellipse([cx - r, 232 - r, cx + r, 232 + r], outline=ink + (26,), width=2)
        for y in (232, 1004):
            d.line([(120, y), (size - 120, y)], fill=ink + (100,), width=1)
        for i, col in enumerate(tiles):
            a = math.radians(-90 + i * 360 / len(tiles))
            x, y = cx + math.cos(a) * R, cy + math.sin(a) * R
            d.rounded_rectangle([x - side / 2, y - side / 2, x + side / 2, y + side / 2],
                                radius=10, fill=col + (232,))

    im = layer(im, ring)
    im = layer(im, lambda d: d.line([(468, 742), (732, 742)], fill=acid + (255,), width=4))

    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 566, "样例站点", K.serif(150, 600), ink, 22)
    K.tracked(d, size / 2, 866, "12 套小生意站点 · 同一份需求各做一遍", K.sans(37, 350), dim, 8)
    return series(K.vignette(im, 0.16, radius=0.95), 0, (255, 255, 255), 96)


# ================================================================== 2. 锐角
def scene_acute(size=SZ):
    """墨黑底 + 左侧时刻尺 + 一枚锐角三角：这家店卖的是「约定的那个点」。"""
    bg, fg, muted = (17, 15, 9), (239, 237, 231), (126, 123, 116)
    accent, accent_ink = (135, 170, 241), (76, 120, 218)
    im = K.vgrad((size, size), (26, 23, 16), bg, bias=0.8)
    im = K.grain(im, 3.0, seed=7)

    # 左侧时刻尺：三格预约位，中间那格是「已定」
    def rail(d):
        d.line([(168, 236), (168, 964)], fill=fg + (38,), width=1)
        for i, (t, on) in enumerate([("10:00", 0), ("11:30", 1), ("14:00", 0)]):
            y = 300 + i * 112
            d.line([(146, y), (190, y)], fill=fg + (70,), width=1)
            d.text((214, y - 16), t, font=K.font(K.MONO, 30),
                   fill=(accent if on else muted) + (255,))
            if on:
                d.rounded_rectangle([146, y + 34, 500, y + 38], radius=2,
                                    fill=accent + (255,))

    im = layer(im, rail)

    # 锐角三角（favicon 那个）：右尖 / 左下 / 左上
    tri = [(0.5, 0.0), (1.0, 1.0), (0.0, 1.0)]
    tcx, tcy, s = 812, 470, 300

    def art(d):
        d.polygon([(tcx + (x - .5) * s, tcy + (y - .5) * s) for x, y in tri],
                  outline=accent + (235,), width=5)

    im = layer(im, art)
    im = hair(im, [(tcx - 96, tcy + 128), (tcx + 96, tcy + 128)], accent, 70, 3)

    d = ImageDraw.Draw(im)
    K.tracked(d, 480, 812, "锐角", K.sans(150, 700), fg, 4)
    d = ImageDraw.Draw(im)
    K.tracked(d, 480, 918, "ACUTE ANGLE", K.font(K.MONO, 44), accent_ink, 6)
    K.tracked(d, 480, 1006, "预约制理发店 · 每一单从约定的时间开始", K.sans(31, 350), muted, 3)
    return series(K.vignette(im, 0.46), 1, fg)


# ================================================================== 3. 辰光修表铺
def scene_chenguang(size=SZ):
    """宣纸米白 + 一整块墨黑招牌 + 金色表盘：纸质纸、墨、金三色而已。"""
    paper, bg_soft = (247, 244, 238), (239, 233, 219)
    ink, on_ink = (26, 26, 26), (247, 244, 238)
    gold, accent = (200, 169, 107), (138, 108, 57)
    im = K.vgrad((size, size), (250, 248, 243), paper, bias=0.6)
    im = K.specks(im, seed=13, n=3000, colors=((150, 130, 96), (255, 253, 246)), alpha=18, rmax=1.5)

    def block(d):
        d.rectangle([100, 148, size - 100, 742], fill=ink + (255,))

    im = layer(im, block)

    # 表盘：外圈金、12 格刻度、两根针
    dcx, dcy, r = 856, 445, 186

    def dial(d):
        d.ellipse([dcx - r, dcy - r, dcx + r, dcy + r], outline=gold + (210,), width=3)
        d.ellipse([dcx - r * .80, dcy - r * .80, dcx + r * .80, dcy + r * .80],
                  outline=gold + (70,), width=1)
        for i in range(12):
            a = math.radians(i * 30)
            long = i % 3 == 0
            r0 = r * (.74 if long else .82)
            d.line([(dcx + math.cos(a) * r0, dcy + math.sin(a) * r0),
                    (dcx + math.cos(a) * r * .94, dcy + math.sin(a) * r * .94)],
                   fill=gold + (255 if long else 130,), width=3 if long else 2)
        # 十点十分 —— 钟表业的标准摆位
        for ang, ln, w in ((300, .52, 4), (60, .74, 3)):
            a = math.radians(ang)
            d.line([(dcx, dcy), (dcx + math.cos(a) * r * ln, dcy + math.sin(a) * r * ln)],
                   fill=on_ink + (240,), width=w)
        d.ellipse([dcx - 7, dcy - 7, dcx + 7, dcy + 7], fill=gold + (255,))

    im = layer(im, dial)

    d = ImageDraw.Draw(im)
    K.tracked(d, 470, 372, "辰光修表铺", K.serif(132, 700), on_ink, 10)
    K.tracked(d, 470, 512, "CHENGUANG WATCH ATELIER", K.font(K.MONO, 30), gold, 5)
    im = hair(im, [(214, 578), (726, 578)], gold, 120, 2)

    d = ImageDraw.Draw(im)
    K.tracked(d, size / 2, 900, "三十余年 · 机械表保养 · 古董表修复", K.serif(40, 500), accent, 6)
    K.tracked(d, size / 2, 972, "青阳区钟楼巷 9 号 · 周二至周日 10:00–18:30", K.sans(28, 350), (113, 108, 92), 3)
    return series(K.vignette(im, 0.18, radius=0.94), 2, ink, 92)


# ================================================================== 4. 宏达汽修
def scene_hongda(size=SZ):
    """水泥灰 + 数据密集的价目账本：这一页的全部内容就是那张表。"""
    bg, bg_soft, fg, muted = (225, 222, 212), (216, 211, 198), (32, 30, 25), (100, 98, 90)
    accent = (49, 100, 163)
    im = K.vgrad((size, size), (232, 229, 220), bg, bias=0.7)
    im = K.grain(im, 2.6, seed=3)

    rows = [("保养", "机油 · 机滤 · 空滤", "280"), ("制动", "刹车片（前轮一副）", "160"),
            ("轮胎", "补胎 / 动平衡", "40"), ("电瓶", "检测 · 更换", "380"),
            ("年检", "代跑 · 上线", "120"), ("钣喷", "小面积补漆（起）", "260")]
    x0, x1, y0, rh = 128, 1072, 460, 100

    # 顶部：标题 + 营业中胶囊 + 一行时间 + 头发丝分割线
    def header(d):
        d.text((128, 168), "宏达汽修", font=K.sans(108, 800), fill=fg + (255,))
        d.rounded_rectangle([600, 200, 760, 246], radius=4, fill=(40, 84, 64) + (255,))
        d.text((618, 210), "营业中", font=K.sans(26, 500), fill=(255, 255, 255) + (255,))
        d.text((128, 304), "周一至周六 8:30–18:30 · 幸福路 12 号（工商银行对面）· 院内可停车",
               font=K.sans(27, 350), fill=muted + (255,))
        d.line([(128, 358), (1072, 358)], fill=(0, 0, 0) + (140,), width=2)

    im = layer(im, header)

    # 数据行：粗上边线 + 细行线
    def table(d):
        d.line([(x0, y0), (x1, y0)], fill=(0, 0, 0) + (200,), width=4)
        for i in range(1, len(rows) + 1):
            y = y0 + i * rh
            d.line([(x0, y), (x1, y)], fill=(0, 0, 0) + (40,), width=1)
        for i, (cat, item, price) in enumerate(rows):
            y = y0 + i * rh
            d.text((x0 + 28, y + 32), cat, font=K.sans(32, 500), fill=fg + (255,))
            d.text((x0 + 260, y + 34), item, font=K.sans(28, 350), fill=muted + (255,))
            w = d.textlength(price, font=K.font(K.MONO, 44))
            d.text((x1 - 28 - w, y + 22), price, font=K.font(K.MONO, 44),
                   fill=(accent if i == 0 else fg) + (255,))

    im = layer(im, table)
    return series(im, 3, fg, 92)


# ================================================================== 5. 老陈家面馆
def scene_laochen(size=SZ):
    """纸白 + 朱赭印章 + 一碗面：三十年老店就靠这一碗。"""
    bg, bg_soft = (252, 245, 240), (248, 233, 222)
    fg, muted, accent, accent_ink = (35, 29, 24), (119, 112, 106), (150, 76, 40), (189, 79, 10)
    im = K.vgrad((size, size), (253, 248, 244), (247, 236, 227), bias=0.7)
    im = K.specks(im, seed=21, n=2800, colors=((160, 120, 88), (255, 252, 246)), alpha=17, rmax=1.5)

    # 印章：放在顶部中央作主图章
    im = seal(im, 600, 240, 168, accent, bg, "面")

    # 碗：缩到右下角作辅图，不挡字
    bcx, by, bw = 988, 920, 198

    def bowl(d):
        d.pieslice([bcx - bw / 2, by - bw * .52, bcx + bw / 2, by + bw * .52],
                   start=0, end=180, fill=accent + (255,))
        d.ellipse([bcx - bw / 2, by - 28, bcx + bw / 2, by + 28], fill=bg_soft + (255,))
        d.ellipse([bcx - bw / 2, by - 28, bcx + bw / 2, by + 28],
                  outline=accent + (255,), width=4)
        d.ellipse([bcx - bw * .30, by - 14, bcx + bw * .30, by + 14],
                  outline=accent_ink + (150,), width=3)
        for i in range(3):
            x = bcx - 44 + i * 44
            d.line([(x, by - 64), (x - 14, by - 110), (x + 8, by - 158), (x - 6, by - 200)],
                   fill=accent + (78,), width=5, joint="curve")

    im = layer(im, bowl)

    d = ImageDraw.Draw(im)
    K.tracked(d, 600, 412, "三十年老店", K.sans(28, 400), muted, 8)
    K.tracked(d, 600, 528, "老陈家面馆", K.serif(120, 700), fg, 6)
    im = hair(im, [(432, 612), (768, 612)], accent, 100, 3)
    d = ImageDraw.Draw(im)
    K.tracked(d, 600, 686, "招牌红烧牛肉面", K.serif(50, 600), accent, 4)
    K.tracked(d, 600, 786, "15 元", K.serif(82, 700), accent_ink, 2)
    K.tracked(d, 600, 832, "大碗 18 元", K.sans(28, 350), muted, 2)
    K.tracked(d, 600, 924, "牛肉每天凌晨四点现卤 · 汤底老卤十年不换", K.sans(28, 350), muted, 3)
    K.tracked(d, 600, 980, "城关区解放路 47 号 · 每天 6:30—20:30 全年无休", K.sans(26, 350),
              (150, 140, 130), 3)
    return series(im, 4, fg, 92)


# ================================================================== 6. 麦芒手作
def scene_maimang(size=SZ):
    """奶咖底 + 麦穗 + 低垂的太阳：日落之前（约 16:00）截单。"""
    bg, bg_soft = (248, 234, 223), (251, 220, 195)
    fg, muted, accent = (35, 29, 24), (112, 105, 100), (78, 111, 35)
    im = K.vgrad((size, size), (252, 241, 232), (246, 227, 212), bias=0.8)
    im = K.grain(im, 2.4, seed=11)
    im = K.wash(im, 900, 280, 280, (255, 206, 148), 0.42)
    im = hair(im, [(120, 480), (size - 120, 480)], (120, 90, 62), 46, 1)

    # 太阳挪到右上角，避开标题
    def sun(d):
        d.ellipse([900, 180, 1042, 322], fill=(238, 158, 88) + (255,))

    im = layer(im, sun)

    # 麦穗：一根主茎，两侧斜挑出麦芒（麦芒 = 芒，正是店名）
    sx, sy = 256, 1010

    def wheat(d):
        d.line([(sx, sy), (sx + 26, sy - 480)], fill=accent + (235,), width=7, joint="curve")
        for i in range(10):
            t = i / 9
            y = sy - 60 - t * 380
            x = sx + 26 * (sy - y) / 480
            ln = 138 * (1 - 0.42 * t)
            for sgn in (-1, 1):
                d.line([(x, y), (x + sgn * ln * .62, y - ln * .78)],
                       fill=accent + (220,), width=5)
                d.line([(x, y), (x + sgn * ln * .30, y - ln * .46)],
                       fill=(150, 170, 96) + (160,), width=3)
        d.line([(sx, sy - 480), (sx + 14, sy - 560)], fill=accent + (235,), width=6)

    im = layer(im, wheat)

    # 一只软欧包
    def loaf(d):
        d.ellipse([496, 712, 952, 968], fill=(206, 152, 96) + (255,))
        d.ellipse([496, 712, 952, 968], outline=(160, 110, 62) + (255,), width=4)
        for i in range(3):
            x = 580 + i * 122
            d.line([(x, 880), (x + 52, 770)], fill=(248, 232, 208) + (225,), width=14)

    im = layer(im, loaf)
    im = K.grain(im, 2.0, seed=17)

    d = ImageDraw.Draw(im)
    K.tracked(d, 600, 196, "日落之前 · 约 16:00 截单", K.sans(30, 400), accent, 5, left=True)
    K.tracked(d, 600, 340, "麦芒手作", K.serif(128, 700), fg, 8, left=True)
    K.tracked(d, 600, 458, "藏在巷子深处 · 无糖无油软欧包", K.sans(28, 350), muted, 3, left=True)
    return series(im, 5, fg, 92)


# ================================================================== 7. 拾花
def scene_shihua(size=SZ):
    """米黄纸 + 牛皮纸包 + 一把花枝：一枝一枝挑，一束一束包。"""
    bg, bg_soft = (250, 233, 221), (244, 222, 204)
    fg, muted, accent, accent_ink = (35, 29, 24), (112, 105, 100), (148, 78, 18), (152, 92, 48)
    kraft = (206, 176, 138)
    im = K.vgrad((size, size), (252, 238, 228), (247, 226, 211), bias=0.75)
    im = K.specks(im, seed=31, n=3400, colors=((156, 126, 92), (255, 252, 245)), alpha=18, rmax=1.6)

    # 花枝：从牛皮纸包里散出去
    bx, by = 600, 700
    stems = [(-108, -430), (-52, -472), (6, -486), (66, -462), (124, -404), (-6, -404)]

    def stems_fn(d):
        for i, (dx, dy) in enumerate(stems):
            ex, ey = bx + dx, by + dy
            d.line([(bx, by + 40), (ex, ey)], fill=accent + (215,), width=6, joint="curve")
            for j in (-1, 1):
                mx = bx + (ex - bx) * (.52 + j * .06)
                my = by + 40 + (ey - by - 40) * (.46 + j * .05)
                d.ellipse([mx - 34, my - 17, mx + 34, my + 17], fill=(150, 132, 74) + (215,))
            r = 42 + (i % 3) * 8
            col = [(214, 152, 138), (232, 190, 150), (186, 116, 100),
                   (226, 176, 176), (198, 158, 96), (170, 122, 128)][i % 6]
            d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=col + (235,))
            d.ellipse([ex - r * .42, ey - r * .42, ex + r * .42, ey + r * .42],
                      fill=(255, 246, 238) + (120,))

    im = layer(im, stems_fn)

    # 牛皮纸包（上宽下窄的梯形）+ 系带
    def wrap(d):
        d.polygon([(bx - 214, by - 60), (bx + 214, by - 60),
                   (bx + 118, by + 300), (bx - 118, by + 300)], fill=kraft + (255,))
        d.polygon([(bx - 214, by - 60), (bx + 214, by - 60),
                   (bx + 118, by + 300), (bx - 118, by + 300)],
                  outline=(158, 124, 82) + (255,))
        d.rectangle([bx - 176, by + 96, bx + 176, by + 148], fill=(178, 140, 92) + (255,))

    im = layer(im, wrap)

    def bow(d):
        d.ellipse([bx - 74, by + 66, bx - 12, by + 122], outline=(120, 84, 48) + (255,), width=6)
        d.ellipse([bx + 12, by + 66, bx + 74, by + 122], outline=(120, 84, 48) + (255,), width=6)
        d.ellipse([bx - 12, by + 84, bx + 12, by + 108], fill=(120, 84, 48) + (255,))

    im = layer(im, bow)
    im = K.grain(im, 2.2, seed=23)

    d = ImageDraw.Draw(im)
    K.tracked(d, 600, 200, "杭州街坊的手作花店", K.sans(30, 400), muted, 8)
    K.tracked(d, 600, 320, "拾花", K.font(K.KAI, 152), fg, 24)
    im = hair(im, [(500, 428), (700, 428)], accent, 150, 3)
    d = ImageDraw.Draw(im)
    K.tracked(d, 600, 1032, "一枝一枝挑 · 一束一束包", K.font(K.KAI, 40), accent_ink, 10)
    return series(im, 6, fg, 92)


# ================================================================== 8. 簪三制壶
def scene_zansan(size=SZ):
    """宣纸 + 水墨茶壶 + 一方朱砂印：黑白为主，一点朱。"""
    paper, bg_soft = (251, 250, 247), (244, 242, 238)
    fg, muted, accent, sealc = (32, 30, 24), (118, 115, 107), (127, 89, 75), (174, 59, 38)
    im = K.vgrad((size, size), (252, 251, 249), (246, 244, 239), bias=0.7)
    im = K.specks(im, seed=41, n=2400, colors=((150, 140, 120), (255, 255, 252)), alpha=15, rmax=1.4)
    im = K.wash(im, 870, 540, 360, (176, 170, 156), 0.22)

    # 茶壶：壶身 / 壶盖 / 钮 / 流 / 把 —— 缩小、放到右下，给文字留地方
    px, py, pw = 870, 740, 260

    def pot(d):
        d.ellipse([px - pw / 2, py - 100, px + pw / 2, py + 124], fill=accent + (232,))
        d.ellipse([px - pw * .30, py - 126, px + pw * .30, py - 80], fill=accent + (232,))
        d.ellipse([px - 20, py - 154, px + 20, py - 114], fill=accent + (232,))
        d.line([(px + pw * .40, py - 18), (px + pw * .40 + 88, py - 86),
                (px + pw * .40 + 116, py - 118)], fill=accent + (232,), width=20, joint="curve")
        d.arc([px - pw * .78, py - 82, px - pw * .18, py + 90], start=100, end=262,
              fill=accent + (232,), width=18)

    im = layer(im, pot, blur=0.8)

    d = ImageDraw.Draw(im)
    K.tracked(d, 128, 196, "手作茶壶 · 一次十来把", K.sans(28, 400), muted, 8, left=True)
    K.tracked(d, 128, 322, "簪三制壶", K.font(K.KAI, 150), fg, 18, left=True)
    K.tracked(d, 128, 466, "ZANSAN TEAPOTS", K.font(K.MONO, 32), accent, 7, left=True)
    im = hair(im, [(128, 542), (570, 542)], accent, 110, 2)
    d = ImageDraw.Draw(im)
    K.tracked(d, 128, 612, "制壶人簪三的手作，原样呈上；", K.serif(32, 400), (86, 82, 74), 3, left=True)
    K.tracked(d, 128, 668, "面向海外的买手与藏家，询价请邮件。", K.serif(32, 400), (86, 82, 74), 3, left=True)
    im = seal(im, 1024, 1024, 128, sealc, (251, 250, 247), "壶")
    return series(im, 7, fg, 92)


# ================================================================== 9. 铜管与滤芯
def scene_tongguan(size=SZ):
    """混凝土冷灰 + 危险品条纹 + 滤芯罐：祖安的呼吸安全站，粗野派。"""
    bg, bg_soft, fg, muted = (213, 223, 234), (200, 213, 228), (26, 31, 36), (93, 98, 105)
    copper, warn, ok = (138, 62, 28), (255, 206, 0), (40, 84, 64)
    im = K.vgrad((size, size), (222, 230, 239), (204, 216, 229), bias=0.7)
    im = K.grain(im, 3.0, seed=19)

    # 顶部危险品条纹
    def hazard(d):
        d.rectangle([0, 0, size, 96], fill=(20, 24, 28) + (255,))
        for x in range(-96, size + 96, 96):
            d.polygon([(x, 96), (x + 48, 96), (x + 48 + 48, 0), (x + 48, 0)], fill=warn + (255,))

    im = layer(im, hazard)

    # 滤芯罐：外圈 + 螺纹颈 + 放射状滤栅
    ccx, ccy, cr = 820, 620, 244

    def canister(d):
        d.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], fill=bg_soft + (255,),
                  outline=fg + (255,), width=6)
        for i in range(24):
            a = math.radians(i * 15)
            d.line([(ccx + math.cos(a) * cr * .30, ccy + math.sin(a) * cr * .30),
                    (ccx + math.cos(a) * cr * .86, ccy + math.sin(a) * cr * .86)],
                   fill=fg + (120,), width=7)
        d.ellipse([ccx - cr * .30, ccy - cr * .30, ccx + cr * .30, ccy + cr * .30],
                  fill=copper + (255,), outline=fg + (255,), width=5)
        d.rectangle([ccx - 74, ccy - cr - 76, ccx + 74, ccy - cr + 26],
                    fill=bg_soft + (255,), outline=fg + (255,), width=6)
        for i in range(4):
            y = ccy - cr - 58 + i * 24
            d.line([(ccx - 74, y), (ccx + 74, y)], fill=fg + (140,), width=4)

    im = layer(im, canister)

    d = ImageDraw.Draw(im)
    d.text((128, 214), "铜管与滤芯", font=K.sans(126, 900), fill=fg + (255,))
    d.text((128, 366), "COPPER & FILTER · RESPIRATORY SAFETY", font=K.font(K.MONO, 28),
           fill=muted + (255,))
    im = hair(im, [(128, 430), (1072, 430)], fg, 150, 3)

    lines = ["呼吸器维修", "滤芯定制（防尘 / 防酸 / 防瓦斯）", "应急氧气囊租赁 · 气密性检测"]
    d = ImageDraw.Draw(im)
    for i, t in enumerate(lines):
        y = 496 + i * 62
        d.rectangle([128, y + 14, 142, y + 28], fill=copper + (255,))
        d.text((166, y), t, font=K.sans(34, 400), fill=fg + (255,))
    im = layer(im, lambda dd: dd.rectangle([128, 716, 560, 792], fill=warn + (255,)))
    im = layer(im, lambda dd: dd.rectangle([128, 716, 560, 792], outline=fg + (255,), width=4))
    d = ImageDraw.Draw(im)
    d.text((158, 736), "当天可取 · 7 天保修", font=K.sans(34, 700), fill=fg + (255,))
    d.text((128, 850), "祖安中层锈巷铜管巷 13 号", font=K.sans(30, 350), fill=muted + (255,))
    return series(im, 8, fg, 92)


# ================================================================== 10. 涂涂画画
def scene_tutuhuahua(size=SZ):
    """纸白 + 一圈孩子的画：整站就是那座黏液环廊。"""
    bg, bg_soft = (249, 247, 239), (240, 236, 226)
    fg, muted, accent = (32, 30, 25), (116, 113, 105), (120, 94, 64)
    im = K.vgrad((size, size), (251, 250, 244), (245, 242, 233), bias=0.7)
    im = K.grain(im, 2.0, seed=29)

    cx, cy, R = 600, 580, 330
    n = 13
    side = 128
    cols = [(214, 162, 92), (201, 113, 63), (126, 158, 106), (110, 143, 181),
            (176, 114, 95), (217, 180, 74), (140, 107, 168), (96, 146, 138),
            (198, 128, 138), (168, 148, 96), (124, 132, 176), (205, 156, 116),
            (110, 124, 88)]

    # 环上的每一格 = 一张孩子的画；相邻两格之间用一根细线连起来（黏液环廊的「拉丝」）
    def ring(d):
        for i in range(n):
            a0 = math.radians(-90 + i * 360 / n)
            a1 = math.radians(-90 + (i + 1) * 360 / n)
            d.line([(cx + math.cos(a0) * R, cy + math.sin(a0) * R),
                    (cx + math.cos(a1) * R, cy + math.sin(a1) * R)],
                   fill=accent + (58,), width=7)
        for i, col in enumerate(cols):
            a = math.radians(-90 + i * 360 / n)
            x, y = cx + math.cos(a) * R, cy + math.sin(a) * R
            k = side / 2
            d.rounded_rectangle([x - k, y - k, x + k, y + k], radius=12,
                                fill=col + (255,), outline=(60, 50, 40) + (70,), width=2)
            # 画里那一道随手的笔触
            d.line([(x - k * .48, y + k * .30), (x + k * .16, y - k * .42),
                    (x + k * .52, y + k * .10)],
                   fill=(255, 252, 244) + (190,), width=7, joint="curve")

    im = layer(im, ring)
    im = K.wash(im, cx, cy, 300, (255, 250, 236), 0.72)

    d = ImageDraw.Draw(im)
    K.tracked(d, cx, cy - 26, "涂涂画画", K.serif(118, 600), fg, 16)
    K.tracked(d, cx, cy + 78, "儿童美术教室", K.sans(30, 350), muted, 12)
    K.tracked(d, size / 2, 1084, "转动环廊，看孩子们的画", K.font(K.KAI, 34), accent, 8)
    return series(im, 9, fg, 92)


# ================================================================== 11. 唱片库存
def scene_vinyl(size=SZ):
    """纯白 + 一张黑胶 + 库存表：这一页就是那张随时可查的表。"""
    bg, bg_soft, fg, muted = (255, 255, 255), (246, 246, 246), (17, 17, 17), (118, 118, 118)
    accent = (31, 63, 216)
    im = K.vgrad((size, size), (255, 255, 255), (247, 247, 249), bias=0.7)

    def grid(d):
        for x in range(0, size + 1, 80):
            d.line([(x, 0), (x, size)], fill=(0, 0, 0) + (8,), width=1)
        for y in range(0, size + 1, 80):
            d.line([(0, y), (size, y)], fill=(0, 0, 0) + (8,), width=1)

    im = layer(im, grid)

    # 标题、副标题、分割线都让出右上角的唱片位
    d = ImageDraw.Draw(im)
    d.text((128, 156), "唱片库存", font=K.sans(108, 800), fill=fg + (255,))
    d.text((128, 296), "VINYL STOCK · 二手唱片店库存自助查询", font=K.sans(26, 400), fill=muted + (255,))
    d.line([(128, 342), (840, 342)], fill=(0, 0, 0) + (140,), width=3)

    # 黑胶：右上角缩成 180 半径，不压表
    rcx, rcy, rr = 1020, 296, 160

    def record(d):
        d.ellipse([rcx - rr, rcy - rr, rcx + rr, rcy + rr], fill=(20, 20, 22) + (255,))
        for i in range(12):
            r = rr * (.42 + i * .046)
            d.ellipse([rcx - r, rcy - r, rcx + r, rcy + r], outline=(255, 255, 255) + (22,), width=1)
        d.ellipse([rcx - rr * .30, rcy - rr * .30, rcx + rr * .30, rcy + rr * .30],
                  fill=accent + (255,))
        d.ellipse([rcx - 10, rcy - 10, rcx + 10, rcy + 10], fill=bg + (255,))

    im = layer(im, record)

    # 表：左半边为主，留出右侧不挤唱片
    rows = [("A-1042", "Kind of Blue", "Miles Davis", "NM", "有货"),
            ("B-2210", "Blue Train", "John Coltrane", "VG+", "有货"),
            ("C-0087", "Rumours", "Fleetwood Mac", "VG", "已售")]
    x0, x1, y0, rh = 128, 1072, 432, 108

    def table(d):
        d.line([(x0, y0), (x1, y0)], fill=(0, 0, 0) + (200,), width=4)
        for i in range(1, len(rows) + 1):
            y = y0 + i * rh
            d.line([(x0, y), (x1, y)], fill=(0, 0, 0) + (40,), width=1)
        for i, (no, alb, art, gr, st) in enumerate(rows):
            y = y0 + i * rh
            d.text((x0 + 8, y + 32), no, font=K.font(K.MONO, 30), fill=muted + (255,))
            d.text((x0 + 188, y + 26), alb, font=K.sans(34, 600), fill=fg + (255,))
            d.text((x0 + 188, y + 68), art, font=K.sans(24, 350), fill=muted + (255,))
            d.text((x0 + 540, y + 36), gr, font=K.font(K.MONO, 30), fill=fg + (255,))
            on = st == "有货"
            col = accent if on else muted
            d.rounded_rectangle([x0 + 720, y + 18, x0 + 944, y + 72], radius=4,
                                fill=(col + (255,)) if on else None, outline=col + (255,), width=2)
            w = d.textlength(st, font=K.sans(28, 600))
            d.text((x0 + 832 - w / 2, y + 28), st, font=K.sans(28, 600),
                   fill=(255, 255, 255) if on else muted)

    im = layer(im, table)
    d = ImageDraw.Draw(im)
    d.text((128, 868), "有没有货、什么版本、多少钱 —— 都在这一页。", font=K.sans(30, 350),
           fill=muted + (255,))
    return series(im, 10, fg, 92)


# ================================================================== 12. 虚空典籍
def scene_void(size=SZ):
    """近黑 + 霓虹渐变字 + 一排书脊：24 小时亮灯的那家深夜书店。"""
    bg, fg, muted = (12, 16, 20), (233, 237, 242), (118, 124, 131)
    purple, pink, cyan = (192, 107, 255), (255, 92, 157), (86, 225, 255)
    im = K.vgrad((size, size), (18, 23, 29), (8, 11, 14), bias=0.9)
    im = K.wash(im, 320, 300, 420, (110, 40, 160), 0.34)
    im = K.wash(im, 940, 880, 400, (20, 90, 130), 0.28)
    im = K.grain(im, 3.0, seed=37)

    # 一排书脊，其中一本歪着 —— 深夜书店的样子
    def shelf(d):
        y = 706
        d.line([(140, y), (size - 140, y)], fill=fg + (70,), width=3)
        books = [((160, 250), (52, 78, 128)), ((224, 300), (86, 46, 104)),
                 ((288, 268), (32, 96, 104)), ((352, 322), (118, 52, 78)),
                 ((424, 282), (58, 66, 118))]
        for (x, h), col in books:
            d.rectangle([x, y - h, x + 52, y], fill=col + (255,), outline=fg + (46,), width=2)
            d.line([(x + 10, y - h + 26), (x + 42, y - h + 26)], fill=fg + (60,), width=2)
        d.polygon([(500, y), (556, y), (582, y - 300), (526, y - 300)],
                  fill=(92, 74, 52) + (255,), outline=fg + (46,))

    im = layer(im, shelf)

    # 霓虹玻璃小签：24H
    def chip(d):
        d.rounded_rectangle([850, 200, 1072, 288], radius=44, fill=(255, 255, 255) + (18,),
                            outline=(255, 255, 255) + (46,), width=2)

    im = layer(im, chip)
    d = ImageDraw.Draw(im)
    d.text((890, 218), "24H", font=K.font(K.MONO, 46), fill=cyan + (255,))

    # 标题走 --grad-display 那道紫→粉→青
    im = glow(im, 430, 402, "虚空典籍", K.font(K.SERIF_VF, 148), 12, (150, 40, 210), 34, 0.5)
    im = grad_text(im, 430, 402, "虚空典籍", K.font(K.SERIF_VF, 148), 12,
                   [(0.0, purple), (0.52, pink), (1.0, cyan)])

    d = ImageDraw.Draw(im)
    K.tracked(d, 430, 540, "VOID CODEX · 皮尔特沃夫", K.sans(28, 400), muted, 4, left=False)
    K.tracked(d, size / 2, 890, "文学与艺术书 24 小时亮灯 · 偶尔为一首诗通宵", K.sans(32, 350),
              (152, 160, 170), 4)
    return series(K.vignette(im, 0.40), 11, fg, 88)


# ================================================================== 13. 屿光摄影
def scene_yuguang(size=SZ):
    """暖奶橘 + 相框里的海平线：海边小城，自然光、不摆拍。"""
    bg, bg_soft = (250, 233, 221), (244, 222, 204)
    fg, muted, accent = (35, 29, 24), (112, 105, 100), (38, 117, 62)
    im = K.vgrad((size, size), (252, 240, 231), (246, 224, 209), bias=0.75)
    im = K.specks(im, seed=47, n=2600, colors=((160, 126, 96), (255, 252, 245)), alpha=16, rmax=1.5)

    # 后面两张歪着的小相框
    def back(d):
        for (x, y, w, h, rot, a) in ((196, 214, 250, 186, -7, 60), (300, 250, 250, 186, 5, 40)):
            d.rounded_rectangle([x, y, x + w, y + h], radius=4,
                                fill=(255, 255, 255) + (a,), outline=(120, 96, 76) + (70,), width=3)

    im = layer(im, back)

    # 主相框：相框白边 + 里面那条海平线
    fx0, fy0, fw, fh = 128, 250, 592, 470

    def frame(d):
        d.rounded_rectangle([fx0, fy0, fx0 + fw, fy0 + fh], radius=6, fill=(255, 253, 250) + (255,))
        d.rounded_rectangle([fx0, fy0, fx0 + fw, fy0 + fh], radius=6,
                            outline=(126, 100, 78) + (140,), width=3)

    im = layer(im, frame)
    pad = 26
    px0, py0 = fx0 + pad, fy0 + pad
    pw, ph = fw - pad * 2, fh - pad * 2
    horizon = py0 + ph * 0.56

    def photo(d):
        d.rectangle([px0, py0, px0 + pw, horizon], fill=(252, 214, 176) + (255,))
        d.rectangle([px0, horizon, px0 + pw, py0 + ph], fill=(126, 152, 168) + (255,))
        d.ellipse([px0 + pw * .60, horizon - 150, px0 + pw * .60 + 116, horizon - 34],
                  fill=(255, 214, 138) + (255,))
        for i in range(5):
            y = horizon + 26 + i * 22
            d.line([(px0 + 20, y), (px0 + pw - 20 - i * 34, y)],
                   fill=(214, 232, 240) + (90,), width=3)
        d.polygon([(px0 + 60, horizon), (px0 + 138, horizon), (px0 + 132, horizon + 26),
                   (px0 + 66, horizon + 26)], fill=(74, 62, 54) + (255,))
        d.line([(px0 + 99, horizon), (px0 + 99, horizon - 62)], fill=(74, 62, 54) + (255,), width=4)
        d.polygon([(px0 + 99, horizon - 62), (px0 + 168, horizon - 12), (px0 + 99, horizon - 6)],
                  fill=(246, 244, 238) + (255,))

    im = layer(im, photo)
    im = K.wash(im, px0 + pw * .68, horizon - 96, 260, (255, 226, 170), 0.30)

    d = ImageDraw.Draw(im)
    d.text((fx0 + 4, fy0 + fh + 34), "屿光摄影", font=K.font(K.YOU, 104), fill=fg + (255,))
    d.text((fx0 + 8, fy0 + fh + 178), "海边小城 · 婚礼跟拍与家庭纪实", font=K.sans(32, 400),
           fill=muted + (255,))
    d.text((fx0 + 8, fy0 + fh + 240), "自然光 · 纪实 · 不摆拍", font=K.sans(28, 350),
           fill=accent + (255,))

    # 右边一枚小取景框十字
    def mark(d):
        mx, my, r = 892, 486, 54
        d.ellipse([mx - r, my - r, mx + r, my + r], outline=fg + (110,), width=3)
        d.line([(mx - r - 30, my), (mx - r + 8, my)], fill=fg + (110,), width=3)
        d.line([(mx + r - 8, my), (mx + r + 30, my)], fill=fg + (110,), width=3)
        d.line([(mx, my - r - 30), (mx, my - r + 8)], fill=fg + (110,), width=3)
        d.line([(mx, my + r - 8), (mx, my + r + 30)], fill=fg + (110,), width=3)

    im = layer(im, mark)
    return series(im, 12, fg, 92)


# ================================================================== 簪三作品页
def work_card(src, out, name_zh, name_en, no, idx_note):
    """作品页缩略图：把那张实物照放进宣纸底 + 一行题签。"""
    paper, fg, muted, accent = (251, 250, 247), (32, 30, 24), (118, 115, 107), (127, 89, 75)
    im = K.vgrad((SZ, SZ), (252, 251, 249), (246, 244, 239), bias=0.7)
    im = K.specks(im, seed=51, n=2400, colors=((150, 140, 120), (255, 255, 252)), alpha=15, rmax=1.4)

    photo = Image.open(src).convert("RGB")
    box_w = 952
    box_h = round(photo.height * box_w / photo.width)
    photo = photo.resize((box_w, box_h), Image.LANCZOS)
    px, py = (SZ - box_w) // 2, 176
    im.paste(photo, (px, py))
    im = layer(im, lambda d: d.rectangle([px, py, px + box_w, py + box_h],
                                         outline=accent + (90,), width=2))

    d = ImageDraw.Draw(im)
    d.text((124, py + box_h + 46), name_zh, font=K.font(K.KAI, 78), fill=fg + (255,))
    d.text((126, py + box_h + 146), name_en.upper(), font=K.font(K.MONO, 26), fill=muted + (255,))
    lab = "簪三制壶 · %s" % no
    d.text((1076 - d.textlength(lab, font=K.font(K.MONO, 26)), py + box_h + 146),
           lab, font=K.font(K.MONO, 26), fill=accent + (255,))
    return series(im, idx_note, fg, 92)


# ================================================================== 输出
CARDS = [
    ("samples.jpg", scene_samples),
    ("acute-angle.jpg", scene_acute),
    ("chenguang-watch.jpg", scene_chenguang),
    ("hongda-auto-repair.jpg", scene_hongda),
    ("laochen-noodles.jpg", scene_laochen),
    ("maimang.jpg", scene_maimang),
    ("shihua.jpg", scene_shihua),
    ("zansan-teapots.jpg", scene_zansan),
    ("tongguan-lvxin.jpg", scene_tongguan),
    ("tutuhuahua.jpg", scene_tutuhuahua),
    ("vinyl-store.jpg", scene_vinyl),
    ("void-codex.jpg", scene_void),
    ("yuguang-photo.jpg", scene_yuguang),
]

# 簪三制壶的作品页：直接用那张实物照（比手绘更能说明「这一把壶」）
# 编号取自 src/data/works.json 的 numZh，别自己排
WORKS = [
    ("pot-zisha-01.png", "zansan-ball-knob-teapot.jpg", "圆珠钮壶", "Ball-Knob Teapot", "壹"),
    ("cup-celadon-01.png", "zansan-celadon-crackle-cup.jpg", "青釉开片杯", "Celadon Crackle Cup", "贰"),
    ("gaiwan-porcelain-01.png", "zansan-orchid-gaiwan.jpg", "兰草盖碗", "Orchid Gaiwan", "叁"),
    ("kettle-iron-01.png", "zansan-hammered-iron-kettle.jpg", "锤纹铁壶", "Hammered Iron Kettle", "肆"),
    ("tea-tools-bamboo-01.png", "zansan-bamboo-tea-scoop.jpg", "竹茶则", "Bamboo Tea Scoop", "伍"),
]


def build_all():
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for name, fn in CARDS:
        img = fn()
        path = OUT / name
        img.save(path, "JPEG", quality=83, optimize=True, progressive=True)
        made.append((name, img))
        print("wrote %-30s %s  %d KB" % (name, img.size, path.stat().st_size // 1024))
    src_dir = HERE / "teapot-artisan" / "assets"
    for src, name, zh, en, no in WORKS:
        img = work_card(src_dir / src, OUT / name, zh, en, no, 7)
        path = OUT / name
        img.save(path, "JPEG", quality=83, optimize=True, progressive=True)
        made.append((name, img))
        print("wrote %-30s %s  %d KB" % (name, img.size, path.stat().st_size // 1024))
    return made


def contact_sheet(made, path, per_row=5, big=300, pad=16):
    rows = math.ceil(len(made) / per_row)
    sheet = Image.new("RGB", (per_row * (big + pad) + pad, rows * (big + pad) + pad), (24, 24, 26))
    for i, (_n, img) in enumerate(made):
        sheet.paste(img.resize((big, big), Image.LANCZOS),
                    (pad + (i % per_row) * (big + pad), pad + (i // per_row) * (big + pad)))
    os.makedirs(path.parent, exist_ok=True)
    sheet.save(path, "PNG")
    print("preview", path, sheet.size)


def main():
    made = build_all()
    if "--preview" in sys.argv:
        contact_sheet(made, HERE / ".shots" / "og-contact.png")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""生成微信分享卡竖版海报（600×800 PNG）：主站 + 各游戏 og.png。
产物写回各项目目录，供页面里的 og:image / twitter:image 引用。
需要 Pillow 与 numpy，直接运行：python assets/gen_share_cards.py
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 2                      # supersample factor
W, H = 600, 800            # logical size
W2, H2 = W * S, H * S      # render size

# Fonts
FT = "C:/Windows/Fonts/times.ttf"        # Latin serif (GAME LAB)
FT_B = "C:/Windows/Fonts/timesbd.ttf"    # Latin serif bold
FC = "C:/Windows/Fonts/simsun.ttc"       # CJK serif
FB = "C:/Windows/Fonts/simhei.ttf"       # CJK bold (stamps/labels)

def fserif(sz):  return ImageFont.truetype(FT, int(sz * S))
def fserifb(sz): return ImageFont.truetype(FT_B, int(sz * S))
def fcjk(sz):    return ImageFont.truetype(FC, int(sz * S))
def fcjkb(sz):   return ImageFont.truetype(FB, int(sz * S))


def new_canvas(bg):
    arr = np.zeros((H2, W2, 3), dtype=np.float32)
    arr[:, :] = np.array(bg, dtype=np.float32)
    return arr


def glow(arr, cx, cy, R, color, max_a=1.0):
    ys, xs = np.mgrid[0:H2, 0:W2]
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    a = np.clip(1 - d / R, 0, 1) ** 1.5 * max_a
    for i in range(3):
        arr[:, :, i] = arr[:, :, i] * (1 - a) + color[i] * a


def to_pil(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def save(img, rel):
    out = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out, "PNG", optimize=True)
    print("saved", rel, os.path.getsize(out), "bytes")


def hx(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


# ------------------------------------------------------------------ helpers
def fl(x): return x * S
def fv(y): return y * S


# ============================ HORROR (cursed-house) ============================
def scene_horror():
    bg = hx("#0a0810")
    arr = new_canvas(bg)
    moon = hx("#e8e2d2")
    ink = hx("#a01212")
    glow(arr, fl(0.70 * W), fl(0.25 * H), fl(150), moon, 0.45)
    img = to_pil(arr)
    d = ImageDraw.Draw(img)
    # moon
    d.ellipse([fl(0.70 * W) - fl(26), fl(0.25 * H) - fl(26),
               fl(0.70 * W) + fl(26), fl(0.25 * H) + fl(26)], fill=moon)
    # house silhouette
    house = [(fl(0.20 * W), fl(0.95 * H)), (fl(0.20 * W), fl(0.60 * H)),
             (fl(0.32 * W), fl(0.45 * H)), (fl(0.44 * W), fl(0.60 * H)),
             (fl(0.44 * W), fl(0.95 * H))]
    d.polygon(house, fill=(2, 2, 3))
    # red window
    d.rectangle([fl(0.28 * W), fl(0.70 * H), fl(0.28 * W) + fl(14), fl(0.70 * H) + fl(24)], fill=ink)
    # 咒 stamp
    sx, sy, ss = fl(0.12 * W), fl(0.12 * H), fl(56)
    d.rectangle([sx, sy, sx + ss, sy + ss], fill=ink)
    d.text((sx + ss / 2, sy + ss / 2 + fl(2)), "咒", font=fcjkb(36), fill=hx("#f2ead8"), anchor="mm")
    # caption
    d.text((fl(40), fl(H) - fl(30)), "JYU / CURSED HOUSE", font=fserif(11), fill=(180, 176, 168), anchor="ls")
    return img



# ============================ PVZ ============================
def scene_pvz():
    bg = hx("#1a2410")
    arr = new_canvas(bg)
    glow(arr, fl(0.20 * W), fl(0.20 * H), fl(140), hx("#ffe6a0"), 0.85)
    img = to_pil(arr)
    d = ImageDraw.Draw(img)
    # lawn stripes
    for i in range(5):
        if i % 2 == 0:
            d.rectangle([0, i * fl(H / 5) + fl(2), W2, (i + 1) * fl(H / 5) - fl(2)], fill=(0, 0, 0))
    # sun
    d.ellipse([fl(0.20 * W) - fl(18), fl(0.20 * H) - fl(18),
               fl(0.20 * W) + fl(18), fl(0.20 * H) + fl(18)], fill=hx("#ffe6a0"))
    # pea shooter
    px, py = fl(0.35 * W), fl(0.60 * H)
    d.rectangle([px - fl(4), py, px + fl(4), py + fl(56)], fill=(42, 94, 26))
    d.ellipse([px - fl(22), py - fl(22), px + fl(22), py + fl(22)], fill=hx("#7cc242"))
    d.ellipse([px + fl(16), py - fl(8), px + fl(32), py + fl(8)], fill=(26, 64, 16))
    d.ellipse([px - fl(8), py - fl(10), px - fl(2), py - fl(4)], fill=(255, 255, 255))
    d.ellipse([px - fl(7), py - fl(9), px - fl(3), py - fl(5)], fill=(0, 0, 0))
    # pea
    d.ellipse([fl(0.52 * W), py - fl(8), fl(0.52 * W) + fl(10), py + fl(2)], fill=hx("#7cc242"))
    # zombie
    zx, zy = fl(0.78 * W), fl(0.62 * H)
    d.rectangle([zx - fl(12), zy - fl(22), zx + fl(12), zy + fl(22)], fill=(122, 138, 106))
    d.ellipse([zx - fl(12), zy - fl(34), zx + fl(12), zy - fl(10)], fill=(122, 138, 106))
    d.text((fl(40), fl(H) - fl(30)), "PLANTS vs ZOMBIES", font=fserif(11), fill=(170, 200, 140), anchor="ls")
    return img


# ============================ MARS (forcing-mars) ============================
def scene_mars():
    bg = hx("#1a0808")
    arr = new_canvas(bg)
    glow(arr, fl(0.80 * W), fl(0.25 * H), fl(150), hx("#ffb070"), 0.85)
    img = to_pil(arr)
    d = ImageDraw.Draw(img)
    # mountains
    m = [(0, fl(0.55 * H)), (fl(0.20 * W), fl(0.40 * H)), (fl(0.35 * W), fl(0.50 * H)),
         (fl(0.55 * W), fl(0.35 * H)), (fl(0.75 * W), fl(0.48 * H)),
         (fl(0.90 * W), fl(0.40 * H)), (W2, fl(0.50 * H)),
         (W2, fl(0.72 * H)), (0, fl(0.72 * H))]
    d.polygon(m, fill=(58, 14, 8))
    # ground
    pts = [(0, fl(0.70 * H))]
    for x in range(0, W2 + 1, fl(20)):
        pts.append((x, fl(0.70 * H) + int(np.sin(x / fl(20)) * fl(8))))
    pts += [(W2, H2), (0, H2)]
    d.polygon(pts, fill=(90, 26, 16))
    # sun
    d.ellipse([fl(0.80 * W) - fl(22), fl(0.25 * H) - fl(22),
               fl(0.80 * W) + fl(22), fl(0.25 * H) + fl(22)], fill=hx("#ffb070"))
    # cards with CJK glyphs
    syms = ["攻", "守", "术"]
    ink = hx("#d44a28")
    for i in range(3):
        cx = fl(0.25 * W) + i * fl(0.18 * W)
        cy = fl(0.45 * H)
        d.rectangle([cx - fl(16), cy - fl(22), cx + fl(16), cy + fl(22)], fill=(40, 20, 20), outline=ink, width=2)
        d.text((cx, cy + fl(2)), syms[i], font=fcjkb(20), fill=ink, anchor="mm")
    d.text((fl(40), fl(H) - fl(30)), "FORCING MARS", font=fserif(11), fill=(220, 150, 120), anchor="ls")
    return img


# ============================ MAIN (game-lab) ============================
def scene_main():
    bg = hx("#050505")
    arr = new_canvas(bg)
    img = to_pil(arr)
    d = ImageDraw.Draw(img)
    # subtle big serif GAME / LAB
    d.text((W2 / 2, fl(0.32 * H)), "GAME", font=fserifb(150), fill=(14, 14, 14), anchor="mm")
    d.text((W2 / 2, fl(0.62 * H)), "LAB", font=fserifb(150), fill=(14, 14, 14), anchor="mm")
    # horizontal lines
    lc = (242, 239, 233)
    for i in range(6):
        y = fl(80) + i * fl(110)
        d.line([(fl(40), y), (W2 - fl(40), y)], fill=lc + (int(0.18 * 255),), width=1)
    # dot matrix bottom
    for y in range(8):
        for x in range(6):
            px = fl(60) + x * fl(80)
            py = fl(H) - fl(220) + y * fl(20)
            d.ellipse([px - 2, py - 2, px + 2, py + 2], fill=lc + (int(0.4 * 255),))
    # red 玩 stamp
    sx, sy, ss = fl(0.18 * W), fl(0.78 * H), fl(90)
    d.rectangle([sx, sy, sx + ss, sy + ss], fill=hx("#c8360e"))
    d.text((sx + ss / 2, sy + ss / 2 + fl(4)), "玩", font=fcjkb(56), fill=hx("#f2ead8"), anchor="mm")
    # top / bottom small text
    d.text((fl(40), fl(30)), "NO.001 / GAME LAB", font=fserif(10), fill=lc + (int(0.4 * 255),), anchor="ls")
    d.text((W2 - fl(40), fl(30)), "AGENT EXPERIMENTS", font=fserif(10), fill=lc + (int(0.4 * 255),), anchor="rs")
    d.text((fl(40), fl(H) - fl(30)), "FROM IDEA TO PLAYABLE", font=fserif(10), fill=lc + (int(0.4 * 255),), anchor="ls")
    d.text((W2 - fl(40), fl(H) - fl(30)), "2026", font=fserif(10), fill=lc + (int(0.4 * 255),), anchor="rs")
    return img


def main():
    save(scene_horror(),  "cursed-house/og.png")
    save(scene_pvz(),     "PVZ/og.png")
    save(scene_mars(),    "forcing-mars/og.png")
    save(scene_main(),    "assets/og-gamelab.png")


if __name__ == "__main__":
    main()

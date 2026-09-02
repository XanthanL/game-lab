# -*- coding: utf-8 -*-
"""为缺 OG 缩略图的子网站生成 1200x630 品牌分享图（与 og-gamelab.jpg 同风格）。

微信在聊天里把 og:image 裁成正方形缩略图，所以关键信息全部收在中央安全区，
玻璃卡片宽度压进 640px（超出会被切掉）。复用 assets/gen_brand.py 的绘制原语。

    venv python assets/gen_og_subprojects.py
"""
import os

from PIL import Image, ImageDraw

import gen_brand as G

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# word=大号英文/标题，cn=中文副标，meta=一行简介，url=站点署名
PROJECTS = [
    dict(out="europa/og.jpg",        word="EUROPA 1444", cn="欧陆风云",
         meta="浏览器大战略 · 纯静态部署", url="XANTHANL.GITHUB.IO / GAME-LAB"),
    dict(out="ascii-art/og.jpg",     word="ASCII ART",   cn="文字工坊",
         meta="中文英文 → 字符画 · 纯前端", url="XANTHANL.GITHUB.IO / GAME-LAB"),
    dict(out="Vampire-2D/og.jpg",    word="VAMPIRE 2D",  cn="吸血鬼幸存者",
         meta="幸存者类 · 浏览器即玩", url="XANTHANL.GITHUB.IO / GAME-LAB"),
    dict(out="shuyan-travel/og.jpg", word="SHUYAN",      cn="树言 · 旅记",
         meta="徒步对角线 · 真实旅途记录", url="XANTHANL.GITHUB.IO / GAME-LAB"),
    dict(out="nova-drift/og.jpg",      word="NOVA DRIFT",  cn="新星漂移",
         meta="街机太空射击 · 浏览器即玩", url="XANTHANL.GITHUB.IO / GAME-LAB"),
]


def build_card(w=1200, h=630, word="", cn="", meta="", url="", cw=640, ch=430):
    im = Image.new("RGB", (w, h), (15, 15, 17))

    # 1) 背景图底纹（与主页 OG 同款玻璃光柱）
    hero = os.path.join(G.BG, "hero.jpg")
    if os.path.exists(hero):
        bg = Image.open(hero).convert("RGB")
        sw, sh = bg.size
        scale = max(w / sw, h / sh)
        bg = bg.resize((int(sw * scale), int(sh * scale)), Image.LANCZOS)
        bg = bg.crop((
            (bg.width - w) // 2, (bg.height - h) // 2,
            (bg.width - w) // 2 + w, (bg.height - h) // 2 + h,
        ))
        im = Image.blend(im, bg, 0.55)

    # 2) 小格子（RGBA 叠加层，直接画线会变纯白）
    grid = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    step = 55
    for x in range(0, w, step):
        gd.line([(x, 0), (x, h)], fill=(255, 255, 255, 18), width=1)
    for y in range(0, h, step):
        gd.line([(0, y), (w, y)], fill=(255, 255, 255, 18), width=1)
    im = Image.alpha_composite(im.convert("RGBA"), grid).convert("RGB")

    # 3) 中央玻璃卡片（宽度压进 640px）
    cx0, cy0 = (w - cw) // 2, (h - ch) // 2 - 8
    cbox = [cx0, cy0, cx0 + cw, cy0 + ch]
    cmask = G.rounded_mask((w, h), cbox, 34)

    card = Image.new("RGB", (w, h), (0, 0, 0))
    card.paste(Image.new("RGB", (w, h), (255, 255, 255)), (0, 0),
               Image.eval(cmask, lambda v: int(v * 0.06)))
    sheen = G.diag_sheen((w, h), blur=6)
    card.paste(Image.new("RGB", (w, h), G.GLASS_WHITE), (0, 0),
               Image.eval(Image.composite(sheen, Image.new("L", (w, h), 0), cmask),
                          lambda v: int(v * 0.55)))
    card.paste(Image.new("RGB", (w, h), (0, 0, 0)), (0, 0),
               Image.composite(G.inner_shadow(cmask, 6, 11, 170),
                               Image.new("L", (w, h), 0), cmask))
    rim = Image.new("L", (w, h), 0)
    ImageDraw.Draw(rim).rounded_rectangle(cbox, radius=34, outline=58, width=2)
    card.paste(G.GLASS_WHITE, (0, 0), rim)
    im = Image.composite(card, im, cmask)

    d = ImageDraw.Draw(im)

    # 4) 文字（长标题自动缩字号，保证不溢出 640px 卡片）
    f_word = G.font("C:/Windows/Fonts/georgia.ttf", 70 if len(word) > 9 else 80)
    f_cn = G.font("C:/Windows/Fonts/msyh.ttc", 34)
    f_meta = G.font("C:/Windows/Fonts/msyh.ttc", 20)
    f_lat = G.font("C:/Windows/Fonts/arial.ttf", 19)

    cy = cy0 + 78
    G.tracked(d, (w // 2, cy), word, f_word, (246, 246, 244), 6, anchor_x="center")

    ly = cy + 100
    lw = G.tracked(d, (w // 2, ly), cn, f_cn, (188, 188, 192), 0, anchor_x="center")
    d.line([(w // 2 - lw // 2, ly + 54), (w // 2 + lw // 2, ly + 54)],
           fill=(255, 255, 255, 60), width=1)

    G.tracked(d, (w // 2, ly + 76), meta, f_meta, (150, 150, 156), 0, anchor_x="center")
    G.tracked(d, (w // 2, h - 54), url, f_lat, (120, 120, 128), 6, anchor_x="center")

    return im


def main():
    for p in PROJECTS:
        im = build_card(word=p["word"], cn=p["cn"], meta=p["meta"], url=p["url"])
        out = os.path.join(REPO, p["out"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.save(out, "JPEG", quality=82, optimize=True, progressive=True)
        print("wrote", p["out"], im.size)


if __name__ == "__main__":
    main()

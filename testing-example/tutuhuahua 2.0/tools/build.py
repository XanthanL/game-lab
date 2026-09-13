# -*- coding: utf-8 -*-
"""涂涂画画官网 · 画作上架脚本

用法:
    python tools/build.py

流程:
    1. 扫描 assets/art/inbox/ 里的原图（jpg / png / webp）
    2. 压缩成网页版:大图长边 1400px(灯箱用) + 缩略图长边 720px(画廊网格用)
    3. 从 tools/works.json 读取每幅画的标题 / 媒介 / 作者 / 年龄(没有就自动补「待填」)
    4. 生成 js/works-data.js —— 页面画廊从这里读数据

老师上新画的流程:照片丢进 inbox → 命令行跑 python tools/build.py → 完成。
改画名 / 补年龄:编辑 tools/works.json 再跑一次。
"""
import json
import os
import re
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("需要 pillow: pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INBOX = os.path.join(ROOT, "assets", "art", "inbox")
OUT_DIR = os.path.join(ROOT, "assets", "art")
THUMB_DIR = os.path.join(OUT_DIR, "thumb")
META_FILE = os.path.join(ROOT, "tools", "works.json")
DATA_FILE = os.path.join(ROOT, "js", "works-data.js")

FULL_EDGE = 1400   # 灯箱大图长边
THUMB_EDGE = 720   # 网格缩略图长边
FULL_Q = 85
THUMB_Q = 82
OK_EXT = (".jpg", ".jpeg", ".png", ".webp")


def load_meta():
    if os.path.exists(META_FILE):
        with open(META_FILE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    return {"works": {}}


def save_meta(meta):
    with open(META_FILE, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def resize_save(img, edge, quality):
    im = img.copy()
    im.thumbnail((edge, edge), Image.LANCZOS)
    return im


def main():
    if not os.path.isdir(INBOX):
        sys.exit(f"找不到素材目录: {INBOX}")

    os.makedirs(THUMB_DIR, exist_ok=True)
    meta = load_meta()
    works_meta = meta.get("works", {})
    changed_meta = False

    inbox_files = sorted(
        f for f in os.listdir(INBOX)
        if f.lower().endswith(OK_EXT) and not f.startswith("_")
    )
    if not inbox_files:
        sys.exit("inbox 里没有图片。把画作照片放进 assets/art/inbox/ 再跑一次。")

    works = []
    warnings = []

    for i, fname in enumerate(inbox_files, start=1):
        stem = os.path.splitext(fname)[0]
        slug = f"w-{i:02d}"
        src_path = os.path.join(INBOX, fname)
        try:
            img = Image.open(src_path)
            real_format = img.format
            img = img.convert("RGB")
        except Exception as exc:
            warnings.append(f"[跳过] {fname}: 无法读取({exc})。")
            continue

        w_full = resize_save(img, FULL_EDGE, FULL_Q)
        w_thumb = resize_save(img, THUMB_EDGE, THUMB_Q)
        full_name = f"{slug}.jpg"
        w_full.save(os.path.join(OUT_DIR, full_name), "JPEG",
                    quality=FULL_Q, progressive=True, optimize=True)
        w_thumb.save(os.path.join(THUMB_DIR, full_name), "JPEG",
                     quality=THUMB_Q, progressive=True, optimize=True)
        tw, th = w_thumb.size

        entry = works_meta.get(fname)
        if entry is None:
            entry = {"title": "待填", "media": "待填", "author": "", "age": ""}
            works_meta[fname] = entry
            changed_meta = True
            warnings.append(
                f"[新作品] {fname} → {slug}:works.json 里还没有它的信息,"
                f"标题/媒介暂记「待填」,补好后重跑一次即可。"
            )

        works.append({
            "no": f"{i:02d}",
            "src": f"assets/art/{full_name}",
            "thumb": f"assets/art/thumb/{full_name}",
            "w": tw, "h": th,
            "title": entry.get("title") or "待填",
            "media": entry.get("media") or "待填",
            "author": entry.get("author") or "",
            "age": entry.get("age") or "",
            "srcName": fname,
            "srcFormat": real_format or "?",
        })

    # 重建后,assets/art 下属于上一次 build、本轮不再生成的 w-*.jpg 一律删除
    keep = {f"w-{i:02d}.jpg" for i in range(1, len(works) + 1)}
    for stale in list(os.listdir(OUT_DIR)) :
        if stale.startswith("w-") and stale.endswith(".jpg") and stale not in keep:
            os.remove(os.path.join(OUT_DIR, stale))
    for stale in list(os.listdir(THUMB_DIR)):
        if stale.startswith("w-") and stale.endswith(".jpg") and stale not in keep:
            os.remove(os.path.join(THUMB_DIR, stale))

    if changed_meta:
        save_meta(meta)

    payload = {"updated": __import__("datetime").date.today().isoformat(), "works": works}
    with open(DATA_FILE, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("// 本文件由 tools/build.py 生成 —— 手改会被覆盖,请改 tools/works.json\n")
        fh.write("window.WORKS = ")
        fh.write(json.dumps(payload, ensure_ascii=False, indent=2))
        fh.write(";\n")

    # 同步 index.html 里 works-data.js 的版本号(?v=日期),微信等强缓存环境也能及时上新
    index_file = os.path.join(ROOT, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as fh:
            html = fh.read()
        new_html = re.sub(
            r'(js/works-data\.js\?v=)[\w.-]+',
            r'\g<1>' + payload["updated"],
            html,
        )
        if new_html != html:
            with open(index_file, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(new_html)

    total_kb = 0
    for fname in os.listdir(OUT_DIR):
        if fname.startswith("w-") and fname.endswith(".jpg"):
            total_kb += os.path.getsize(os.path.join(OUT_DIR, fname)) // 1024
            tpath = os.path.join(THUMB_DIR, fname)
            if os.path.exists(tpath):
                total_kb += os.path.getsize(tpath) // 1024

    print(f"上架 {len(works)} 件作品 (大图 ≤{FULL_EDGE}px q{FULL_Q} + 缩略图 ≤{THUMB_EDGE}px)")
    print(f"图片总体积 ~{total_kb} KB (目标 <15MB)")
    print(f"数据已写入 {os.path.relpath(DATA_FILE, ROOT)}")
    for wtext in warnings:
        print(wtext)


if __name__ == "__main__":
    main()

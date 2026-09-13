# -*- coding: utf-8 -*-
"""发布打包 —— 把「该上线的东西」单独复制到 dist/

用法:
    python tools/pack.py           # 生成 dist/
    python tools/pack.py --zip     # 顺手打一个 dist.zip

为什么需要它
------------
站点目录里同时躺着三类不该上线的文件:
  - assets/art/inbox/  ~12 MB   build.py 的**输入**(没压过的原图)
  - source/            ~7.5 MB  溯源素材(v1 沿用)
  - tools/ docs/ design-system/ 构建脚本与文档
整目录上传会把它们一起送上服务器:浪费空间,也把未压缩原图暴露出去。
本脚本按白名单复制,dist/ 里就是运行时的全部。

同时做一次自检:解析 index.html 里的 src/href,确认每个引用在 dist/ 里都存在。
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

# 白名单:源路径 → 复制方式
#   "file" 单个文件;"glob" 按前缀匹配目录下的文件
RULES = [
    ("index.html", "file"),
    ("css", "glob"),                      # tokens.css / site.css
    ("js", "glob"),                       # works-data.js / gallery.js / ring-carousel.js
    ("assets/art", "glob:w-*.jpg"),        # 灯箱大图(≤1400px)
    ("assets/art/thumb", "glob:w-*.jpg"),  # 环廊图集源(≤720px)
]

SKIP_SUFFIX = (".pyc",)
SKIP_NAMES = (".DS_Store", "Thumbs.db")


def collect():
    """按白名单收集 (绝对源路径, dist 内相对路径)"""
    picked = []
    for rel, how in RULES:
        src = os.path.join(ROOT, rel)
        if how == "file":
            if not os.path.isfile(src):
                sys.exit(f"白名单里的文件不存在: {rel}")
            picked.append((src, rel))
            continue
        if not os.path.isdir(src):
            sys.exit(f"白名单里的目录不存在: {rel}")
        pat = how.split(":", 1)[1] if how.startswith("glob:") else None
        for name in sorted(os.listdir(src)):
            full = os.path.join(src, name)
            if not os.path.isfile(full):
                continue
            if name in SKIP_NAMES or name.endswith(SKIP_SUFFIX):
                continue
            if pat and not re.fullmatch(re.escape(pat).replace(r"\*", ".*"), name):
                continue
            picked.append((full, os.path.join(rel, name).replace(os.sep, "/")))
    return picked


def check_refs(dist_index):
    """index.html 里引用的每个本地资源,dist/ 里都得有"""
    with open(dist_index, "r", encoding="utf-8") as fh:
        html = fh.read()
    refs = re.findall(r'(?:src|href)="([^"]+)"', html)
    missing = []
    checked = 0
    for ref in refs:
        if ref.startswith(("data:", "http:", "https:", "//", "#")):
            continue
        path = ref.split("?")[0].split("#")[0]
        checked += 1
        if not os.path.isfile(os.path.join(DIST, path)):
            missing.append(path)
    return checked, missing


def human(n):
    return f"{n / 1048576:.2f} MB" if n >= 1048576 else f"{n / 1024:.0f} KB"


def main():
    picked = collect()

    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)

    by_dir = {}
    total = 0
    for src, rel in picked:
        dst = os.path.join(DIST, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        size = os.path.getsize(dst)
        total += size
        key = os.path.dirname(rel) or "."
        slot = by_dir.setdefault(key, [0, 0])
        slot[0] += 1
        slot[1] += size

    print(f"打包完成 → {os.path.relpath(DIST, ROOT)}/")
    print("-" * 46)
    for key in sorted(by_dir):
        count, size = by_dir[key]
        print(f"  {key:<24} {count:>3} 个   {human(size):>9}")
    print("-" * 46)
    print(f"  {'合计':<24} {len(picked):>3} 个   {human(total):>9}")

    checked, missing = check_refs(os.path.join(DIST, "index.html"))
    if missing:
        print(f"\n[警告] index.html 引用了 {len(missing)} 个 dist 里没有的文件:")
        for m in missing:
            print(f"        {m}")
    else:
        print(f"\n自检通过:index.html 的 {checked} 个本地引用在 dist/ 里都存在。")

    if "--zip" in sys.argv:
        archive = shutil.make_archive(DIST, "zip", DIST)
        print(f"已打包 {os.path.relpath(archive, ROOT)} ({human(os.path.getsize(archive))})")


if __name__ == "__main__":
    main()

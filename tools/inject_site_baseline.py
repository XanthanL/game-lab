# -*- coding: utf-8 -*-
"""站群基线 + 承接关系批量补齐（可复跑，幂等）。

只做三件不改变视觉语言的事：
  1. 缺 favicon / description / lang 的入口补上（description 直接取首页清单里的原有文案）
  2. <img> 补 decoding="async"（不改加载时机，只让解码不阻塞）
  3. 注入 assets/gl-back.js —— 样式全部继承各站 body，不引入统一模板

已有上级链接的页面不重复注入。构建产物（dist/out）同样处理，rebuild 后重跑本脚本即可。
用法：python tools/inject_site_baseline.py
"""
from __future__ import annotations
import json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os_chdir = None

def git_files():
    out = subprocess.run(["git", "ls-files", "-z", "*.html"], cwd=ROOT,
                         capture_output=True, check=True).stdout
    return sorted(p for p in out.decode("utf-8", "replace").split("\0") if p)

home = (ROOT / "index.html").read_text(encoding="utf-8")
lab = json.loads(re.search(r'id="lab-data"[^>]*>(.*?)</script>', home, re.S).group(1))
DESC = {i["dir"]: i["descZh"] for c in lab["cats"] for i in c["items"]}
FIRST_DIRS = set(DESC)
ARTIFACT = {"ARH/dist/index.html", "XanthanLMusic/dist/index.html",
            "golden-wind/out/index.html", "ARH/index.html", "XanthanLMusic/index.html"}

def target_for(rel: str):
    parts = rel.split("/")
    top = parts[0]
    depth = len(parts) - 1
    prefix = "../" * depth
    if rel in ARTIFACT or (top in FIRST_DIRS and depth == 1 and parts[-1] == "index.html"):
        return dict(back="../" * depth, label="GAME LAB", base=prefix, level=1, dir=top)
    if rel in ("index.html", "404.html"):
        return None
    if top == "persona" and depth == 2 and parts[-1] == "index.html":
        return dict(back="../index.html", label="节目单", base=prefix, level=2, dir=top)
    if top == "testing-example" and parts[-1] == "index.html" and rel != "testing-example/index.html":
        if depth == 2:
            return dict(back="../index.html", label="样例站点", base=prefix, level=2, dir=top)
        if depth == 3 and parts[-2] == "site":
            return dict(back="../../index.html", label="样例站点", base=prefix, level=2, dir=top)
    return None

def has_up_link(s: str) -> bool:
    return bool(re.search(r'<a\b[^>]*\bhref\s*=\s*["\'](?:\.\./|\.\./index\.html)["\']', s, re.I))

changed = {"favicon": 0, "desc": 0, "lang": 0, "img": 0, "back": 0}
touched = []

for rel in git_files():
    t = target_for(rel)
    if not t:
        continue
    p = ROOT / rel
    raw = p.read_bytes()
    nl = "\r\n" if b"\r\n" in raw else "\n"
    s = raw.decode("utf-8").replace("\r\n", "\n")
    orig = s

    if t["level"] == 1:
        if not re.search(r'rel\s*=\s*["\'](?:icon|apple-touch-icon|shortcut icon)', s, re.I):
            icon = (f'<link rel="icon" type="image/svg+xml" href="{t["base"]}assets/favicon.svg" />\n'
                    f'<link rel="apple-touch-icon" sizes="180x180" '
                    f'href="{t["base"]}assets/favicon-180.png" />\n')
            s = s.replace("</head>", icon + "</head>", 1)
            changed["favicon"] += 1
        if not re.search(r'<meta\s+name=["\']description["\']', s, re.I) and t["dir"] in DESC:
            d = DESC[t["dir"]].replace('"', "&quot;")
            s = s.replace("</head>", f'<meta name="description" content="{d}" />\n</head>', 1)
            changed["desc"] += 1

    # lang 与图片解码对所有目标页都补，不只是首页清单里的一级站
    m = re.search(r'<html\b[^>]*>', s, re.I)
    if m and "lang=" not in m.group(0).lower():
        s = s[:m.end() - 1] + ' lang="zh-CN"' + s[m.end() - 1:]
        changed["lang"] += 1

    def add_dec(mo):
        tag = mo.group(0)
        return tag if "decoding=" in tag.lower() else tag[:-1].rstrip() + ' decoding="async">'
    s2 = re.sub(r'<img\b[^>]*>', add_dec, s, flags=re.I)
    if s2 != s:
        changed["img"] += 1
        s = s2

    if "gl-back.js" not in s and not has_up_link(s) and "</body>" in s.lower():
        tag = (f'<script src="{t["base"]}assets/gl-back.js" '
               f'data-back="{t["back"]}" data-label="{t["label"]}"></script>\n')
        idx = s.lower().rfind("</body>")
        s = s[:idx] + tag + s[idx:]
        changed["back"] += 1

    if s != orig:
        p.write_bytes(s.replace("\n", nl).encode("utf-8"))
        touched.append(rel)

print("改动统计:", changed)
print(f"涉及 {len(touched)} 个页面")
for r in touched:
    print("  " + r)

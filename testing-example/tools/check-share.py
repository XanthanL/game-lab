# -*- coding: utf-8 -*-
"""冒烟检查：让无头 Chrome 把各入口页的 DOM 吐出来，从浏览器解析后的 <head> 里
读回分享标签。

og 标签要是被写到了 </head> 之后、或者 HTML 结构坏了，浏览器会把它挪进 body，
正则检查发现不了 —— 所以这里认的是 Chrome 自己解析出来的结构，不是源文件文本。

用法：
    python tools/check-share.py
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

PAGES = [
    ("样例站点", ROOT / "index.html"),
    ("锐角", ROOT / "acute-angle-2.0" / "index.html"),
    ("辰光修表铺", ROOT / "chenguang-watch" / "index.html"),
    ("宏达汽修", ROOT / "hongda-auto-repair-2.0" / "site" / "index.html"),
    ("老陈家面馆", ROOT / "laochen-noodles" / "site" / "index.html"),
    ("麦芒手作", ROOT / "maimang-site-2.0" / "index.html"),
    ("拾花", ROOT / "shihua 2.0" / "index.html"),
    ("铜管与滤芯", ROOT / "tongguan-lvxin" / "index.html"),
    ("涂涂画画", ROOT / "tutuhuahua 2.0" / "index.html"),
    ("唱片库存", ROOT / "vinyl-store-site" / "index.html"),
    ("虚空典籍", ROOT / "void-codex" / "index.html"),
    ("屿光摄影", ROOT / "yuguang-photo" / "index.html"),
    ("簪三·中文", ROOT / "teapot-artisan" / "site" / "dist" / "zh" / "index.html"),
    ("簪三·英文", ROOT / "teapot-artisan" / "site" / "dist" / "index.html"),
    ("簪三·圆珠钮壶",
     ROOT / "teapot-artisan" / "site" / "dist" / "zh" / "works" / "ball-knob-teapot" / "index.html"),
]

# 详情标题允许「页面名 · 品牌名」这种写法 —— 分享出去得让人知道是哪个站的。
# 但「站名 · 儿童美术教室」这类描述尾巴要拦下来。
BRANDS = {"簪三制壶", "Zansan Teapots"}
TITLE_SEP_RE = re.compile(r"\s*[·｜|—–]\s*")

HEAD_RE = re.compile(r"<head[^>]*>(.*?)</head>", re.I | re.S)
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
META_RE = re.compile(r"<meta\s+([^>]*?)/?>", re.I | re.S)
ATTR_RE = re.compile(r'([\w:-]+)\s*=\s*"([^"]*)"')


def dump_dom(page: Path, prof: Path) -> str:
    cmd = [
        CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
        "--allow-file-access-from-files", "--no-first-run",
        "--user-data-dir=" + str(prof),
        "--window-size=1200,800", "--virtual-time-budget=1500",
        "--force-prefers-reduced-motion", "--dump-dom", page.as_uri(),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return r.stdout or ""


def unescape(s: str) -> str:
    return (s.replace("&quot;", '"').replace("&amp;", "&")
             .replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'"))


def metas(head: str):
    """返回 [(name-or-property, content)]。"""
    out = []
    for m in META_RE.finditer(head):
        attrs = dict((k.lower(), unescape(v)) for k, v in ATTR_RE.findall(m.group(1)))
        key = attrs.get("property") or attrs.get("name")
        if key and "content" in attrs:
            out.append((key.lower(), attrs["content"]))
    return out


def main():
    bad = 0
    with tempfile.TemporaryDirectory() as td:
        prof = Path(td) / "prof"
        for label, page in PAGES:
            if not page.exists():
                print("  !! %-14s 文件不存在" % label)
                bad += 1
                continue
            dom = dump_dom(page, prof)
            hm = HEAD_RE.search(dom)
            if not hm:
                print("  !! %-14s Chrome 没解析出 head" % label)
                bad += 1
                continue
            head = hm.group(1)
            tm = TITLE_RE.search(head)
            title = unescape(tm.group(1)).strip() if tm else ""
            kv = dict(metas(head))
            og_image = kv.get("og:image", "")
            og_count = sum(1 for k in kv if k.startswith("og:"))

            problems = []
            if not title:
                problems.append("head 里没标题")
            segs = [s for s in TITLE_SEP_RE.split(title) if s]
            if len(segs) > 2 or (len(segs) == 2 and segs[-1] not in BRANDS):
                problems.append("标题带了描述尾巴：「%s」" % title)
            if not og_image.startswith("https://"):
                problems.append("og:image 不是 HTTPS 绝对地址")
            if og_count < 6:
                problems.append("og 标签只有 %d 个" % og_count)
            if kv.get("og:title") != title:
                problems.append("og:title 与 <title> 不一致")
            if not kv.get("description"):
                problems.append("缺 meta description")
            if kv.get("twitter:image") != og_image:
                problems.append("twitter:image 与 og:image 不一致")

            if problems:
                bad += 1
                print("  !! %-14s %s" % (label, "；".join(problems)))
            else:
                print("  ok %-14s %-14s | %s" % (label, title, og_image.rsplit("/", 1)[-1]))
    print("\n%d 个页面有问题" % bad if bad else "\n全部通过")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

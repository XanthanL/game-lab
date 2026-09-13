# -*- coding: utf-8 -*-
"""把 testing-example 各子站入口页的 head 分享块改写一遍。

每个入口页会得到一份统一的 share block：
    <title>                    站名（不带描述尾巴）
    <meta name="description">  site-meta.json 里的 descZh 短句
    <meta property="og:*">     og:type / og:site_name / og:locale / og:title
                               / og:description / og:url / og:image（绝对 HTTPS）
                               / og:image:width / og:image:height
    <meta name="twitter:*">    twitter:card / twitter:title / twitter:description
                               / twitter:image

改写时把现有的 title / description / og:* / twitter:* 全部清掉再重写，
所以脚本是幂等的（重复跑不会叠加）。用 <!--SHARE:BEGIN/END--> 标记这段，
手工别改它。

微信的硬性要求（og:image 必须是 HTTPS 绝对地址、可直连、≥300×300），
所以图片一律走 https://xanthanl.github.io/game-lab/testing-example/assets/og/。

用法：
    python tools/sync-share.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # testing-example/
REPO = ROOT.parent                                   # game-lab/
META_FILE = ROOT / "tools" / "site-meta.json"
INDEX_FILE = ROOT / "index.html"

BASE_URL = "https://xanthanl.github.io/game-lab"
SHARE_DIR = "assets/og"                              # 相对 testing-example/

# 站点目录下的这些子目录不参与扫描（文档 / 源料 / 构建产物）
SKIP_DIR_NAMES = {"node_modules", "tools", "dist", "assets", "source",
                  "public", "src", "docs", "design-system", "css", "js",
                  "fonts", "images"}
SKIP_DIR_PREFIXES = (".", "_")

TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
DESC_RE = re.compile(r'<meta\s+name=["\']description["\'][^>]*>', re.IGNORECASE)
OG_RE = re.compile(r'<meta\s+property=["\']og:[^"\']+["\'][^>]*>', re.IGNORECASE)
TW_RE = re.compile(r'<meta\s+name=["\']twitter:[^"\']+["\'][^>]*>', re.IGNORECASE)
# 连同一前一后的缩进/换行一起吃掉 —— 否则重复跑会不断累加空白，就谈不上幂等了。
# BEGIN 后面还跟了一句给人看的说明，所以要用 [^>]* 吃掉，不能写成写死的 "-->"。
SHARE_BLOCK_RE = re.compile(
    r"\n[ \t]*<!--SHARE:BEGIN[^>]*-->.*?<!--SHARE:END[^>]*-->[ \t]*\n?", re.DOTALL)
VIEWPORT_RE = re.compile(r'<meta\s+name=["\']viewport["\'][^>]*>', re.IGNORECASE)


def is_skipped(name):
    if any(name.startswith(p) for p in SKIP_DIR_PREFIXES):
        return True
    return name in SKIP_DIR_NAMES


def find_entry(site_dir):
    """子站入口：优先根 index.html，其次套了一层 site/ 的。"""
    for cand in ("index.html", "site/index.html"):
        p = site_dir / cand
        if p.exists():
            return p
    return None


def slug_of(name):
    """目录名 -> og 图文件名：'shihua 2.0' -> 'shihua-2.0'"""
    return re.sub(r"\s+", "-", name.strip())


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def abs_url(rel_to_repo):
    """入口页相对仓库根的路径 -> 绝对 URL（空格要百分号编码）。"""
    parts = [p.replace(" ", "%20") for p in rel_to_repo.lstrip("/").split("/")]
    return BASE_URL + "/" + "/".join(parts)


def build_block(title, desc, og_image_rel, page_url):
    og_image = BASE_URL + "/testing-example/" + og_image_rel.lstrip("/")
    return (
        "<!--SHARE:BEGIN 由 tools/sync-share.py 生成，勿手改-->\n"
        "  <title>" + esc(title) + "</title>\n"
        '  <meta name="description" content="' + esc(desc) + '">\n'
        '  <meta property="og:type" content="website">\n'
        '  <meta property="og:site_name" content="' + esc(title) + '">\n'
        '  <meta property="og:locale" content="zh_CN">\n'
        '  <meta property="og:title" content="' + esc(title) + '">\n'
        '  <meta property="og:description" content="' + esc(desc) + '">\n'
        '  <meta property="og:url" content="' + esc(page_url) + '">\n'
        '  <meta property="og:image" content="' + esc(og_image) + '">\n'
        '  <meta property="og:image:width" content="1200">\n'
        '  <meta property="og:image:height" content="1200">\n'
        '  <meta name="twitter:card" content="summary_large_image">\n'
        '  <meta name="twitter:title" content="' + esc(title) + '">\n'
        '  <meta name="twitter:description" content="' + esc(desc) + '">\n'
        '  <meta name="twitter:image" content="' + esc(og_image) + '">\n'
        "  <!--SHARE:END-->"
    )


def rewrite_head(html, block):
    """清掉旧的 title/description/og/twitter/SHARE 块，插在 viewport 之后。"""
    html = SHARE_BLOCK_RE.sub("", html)
    html = TITLE_RE.sub("", html, count=1)
    html = DESC_RE.sub("", html, count=1)
    html = OG_RE.sub("", html)
    html = TW_RE.sub("", html)
    m = VIEWPORT_RE.search(html)
    if m:
        html = html[:m.end()] + "\n  " + block + "\n" + html[m.end():]
    else:
        html = html.replace("</head>", "  " + block + "\n</head>", 1)
    # 被摘掉的旧标签会留下几行空行，块后面统一只留一行
    return re.sub(r"(<!--SHARE:END[^>]*-->)[ \t]*\n(?:\s*\n)+", r"\1\n\n", html)


def load_overrides():
    raw = json.loads(META_FILE.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        sys.exit("site-meta.json 顶层必须是对象")
    return {k: v for k, v in raw.items()
            if not k.startswith("_") and isinstance(v, dict)}


def collect(overrides):
    """返回 [(标签, 入口页路径, 页面 URL, 标题, 描述, og 图相对路径)]。"""
    out = []

    # 合集页本身也补一份（原先 og:image 指向的是 GAME LAB 总站的卡）
    out.append((
        "样例站点(合集页)", INDEX_FILE,
        BASE_URL + "/testing-example/", "样例站点",
        "12 套小生意站点样例：理发店、面馆、花店、茶壶、唱片店……同一份需求交给不同风格族各做一遍。",
        SHARE_DIR + "/samples.jpg",
    ))

    for site_dir in sorted(ROOT.iterdir()):
        if not site_dir.is_dir() or is_skipped(site_dir.name):
            continue
        if site_dir.name == "teapot-artisan":
            continue          # Astro 项目，走 Base.astro 模板
        meta = overrides.get(site_dir.name)
        page = find_entry(site_dir)
        if not meta or page is None:
            continue
        title = meta.get("title") or meta.get("nameZh") or site_dir.name
        desc = meta.get("descZh") or meta.get("descEn") or title
        og = meta.get("og") or (slug_of(site_dir.name) + ".jpg")
        rel = page.relative_to(REPO).as_posix()
        out.append((
            site_dir.name, page, abs_url(rel), title, desc,
            "%s/%s" % (SHARE_DIR, og.lstrip("/")),
        ))
    return out


def main():
    overrides = load_overrides()
    for label, page, page_url, title, desc, og_image in collect(overrides):
        try:
            text = page.read_text(encoding="utf-8")
        except OSError as e:
            print("  跳过 %s: %s" % (page, e))
            continue
        new_text = rewrite_head(text, build_block(title, desc, og_image, page_url))
        if new_text == text:
            print("  = %-22s 已是最新" % label)
            continue
        page.write_text(new_text, encoding="utf-8", newline="\n")
        print("  ok %-22s  -> %s" % (label, title))


if __name__ == "__main__":
    main()

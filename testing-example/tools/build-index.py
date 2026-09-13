#!/usr/bin/env python3
"""重建 index.html 内嵌的站点清单（<!--SITES:BEGIN/END--> 之间的 JSON 块）。

扫描项目根目录下的一级子目录：
- 目录内能找到 HTML 文件 -> 记为「可浏览」站点，提取 <title>、入口及全部子页面；
- 找不到 HTML -> 记为「进行中」，仅展示目录名和最后更新时间。

每个可浏览站点还会带上一组「卡片用」的中英字段（nameZh / nameEn / descZh / descEn）：
先自动推导（中文名取标题首个分句、英文名取标题里最长的拉丁文段、介绍取
<meta name="description"> 的第一句），再用 tools/site-meta.json 里手写的覆盖。
环形轮播拿这几个字段画卡面，所以改了 meta 之后要重跑本脚本。

用法：
    python tools/build-index.py
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_FILE = ROOT / "index.html"
META_FILE = ROOT / "tools" / "site-meta.json"
SKIP_DIR_NAMES = {"node_modules", "tools"}
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
DESC_RE = re.compile(
    r"""<meta\s+name=["']description["']\s+content=["'](.*?)["']""",
    re.IGNORECASE | re.DOTALL,
)
WS_RE = re.compile(r"\s+")
# 一段拉丁文（含词间空格与常见连接符），用来从双语标题里抠出英文名
LATIN_RE = re.compile(r"[A-Za-z][A-Za-z0-9&'\u2019\-.]*(?:\s+[A-Za-z0-9&'\u2019\-.]+)*")
SENT_END_RE = re.compile(r"[。！？!?]")
# 标题里的分隔符：分号、竖线、破折号、斜杠 —— 第一段通常就是品牌名
SPLIT_RE = re.compile(r"[·｜|—–／/]+")
MAX_PAGES_PER_SITE = 20
DESC_LIMIT = 34


def is_skipped(name: str) -> bool:
    return name.startswith(".") or name.startswith("_") or name in SKIP_DIR_NAMES


def find_pages(site_dir: Path):
    """返回该站点目录下所有 HTML 页面，按 (目录深度, 相对路径) 排序，index.html 优先。"""
    pages = []
    for p in site_dir.rglob("*.html"):
        if is_skipped(p.name):
            continue
        parts = p.relative_to(site_dir).parts
        if any(is_skipped(part) for part in parts[:-1]):
            continue
        rel = p.relative_to(ROOT).as_posix()
        depth = len(parts)
        is_index = p.name == "index.html"
        pages.append((depth, not is_index, rel, p))
    pages.sort(key=lambda t: (t[0], t[1], t[2]))
    return pages


def page_title(path: Path) -> str:
    return page_meta(path)[0]


def page_meta(path: Path):
    """返回 (标题, 描述)。描述取自 <meta name="description">，供卡片的小字用。"""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return "", ""
    t = TITLE_RE.search(text)
    d = DESC_RE.search(text)
    title = WS_RE.sub(" ", t.group(1)).strip() if t else ""
    desc = WS_RE.sub(" ", d.group(1)).strip() if d else ""
    return title, desc


def latin_of(text: str) -> str:
    """取标题里最长的一段拉丁文当英文名。

    「锐角 ACUTE ANGLE · 预约制理发店」-> ACUTE ANGLE
    「辰光修表铺 · Chenguang Watch Atelier — 机械表保养」-> Chenguang Watch Atelier
    """
    best = ""
    for m in LATIN_RE.finditer(text or ""):
        s = m.group(0).strip(" -\u2013\u2014\u00b7|\uff5c")
        if len(s) > len(best):
            best = s
    return best


def first_chunk(title: str) -> str:
    """取标题的第一个分句当站名。

    「宏达汽修｜价目表与电话预约」            -> 宏达汽修
    「锐角 ACUTE ANGLE · 预约制理发店」        -> 锐角 ACUTE ANGLE
    「Zansan Teapots — Handmade Teapots…」 -> Zansan Teapots
    """
    head = SPLIT_RE.split(WS_RE.sub(" ", title or "").strip())[0].strip()
    return head or (title or "").strip()


def prettify_dir(name: str) -> str:
    """目录名兜底成可读的英文：hongda-auto-repair-2.0 -> Hongda Auto Repair 2.0"""
    out = []
    for p in re.split(r"[-_\s]+", name):
        if not p:
            continue
        out.append(p if re.fullmatch(r"\d+(\.\d+)*", p) else p[:1].upper() + p[1:])
    return " ".join(out)


def first_sentence(text: str, limit: int = DESC_LIMIT) -> str:
    """掐出第一句，超长就截断加省略号 —— 卡片上放得下才是好介绍。"""
    text = WS_RE.sub(" ", text or "").strip()
    if not text:
        return ""
    m = SENT_END_RE.search(text)
    if m and m.start() <= limit:
        text = text[: m.start()]
    if len(text) > limit:
        text = text[:limit].rstrip(" ,\uff0c\u3001;\uff1b") + "\u2026"
    return text


def english_sentence(text: str) -> str:
    """从描述里挖一句英文（不少子站点自带英文副标），挖不到返回空串。"""
    for m in LATIN_RE.finditer(text or ""):
        s = m.group(0).strip()
        if len(s) >= 24:
            return s
    return ""


def load_overrides() -> dict:
    """读 tools/site-meta.json 里手写的卡片文案（可缺省，缺了就全走自动推导）。"""
    if not META_FILE.exists():
        return {}
    try:
        raw = json.loads(META_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(f"！{META_FILE.name} 读取失败，本次全走自动推导：{e}", file=sys.stderr)
        return {}
    if not isinstance(raw, dict):
        return {}
    # 以 _ 开头的键是写给人看的注释，不是站点
    return {k: v for k, v in raw.items()
            if not k.startswith("_") and isinstance(v, dict)}


def card_fields(dir_name: str, title: str, desc: str, ov: dict) -> dict:
    """合成卡片要用的四个字段：手写覆盖 > 自动推导 > 目录名兜底。"""
    def pick(key, *fallbacks):
        v = ov.get(key)
        if isinstance(v, str) and v.strip():
            return WS_RE.sub(" ", v).strip()
        for f in fallbacks:
            if f:
                return f
        return ""

    return {
        "nameZh": pick("nameZh", first_chunk(title), title, prettify_dir(dir_name)),
        "nameEn": pick("nameEn", latin_of(title), prettify_dir(dir_name)),
        "descZh": pick("descZh", first_sentence(desc)),
        "descEn": pick("descEn", english_sentence(desc)),
    }


def latest_mtime(site_dir: Path) -> float:
    latest = 0.0
    for p in site_dir.rglob("*"):
        if any(is_skipped(part) for part in p.relative_to(site_dir).parts):
            continue
        try:
            if p.is_file():
                latest = max(latest, p.stat().st_mtime)
        except OSError:
            continue
    return latest


def fmt_time(ts: float) -> str:
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M") if ts else ""


def collect_sites():
    overrides = load_overrides()
    sites = []
    for d in sorted(ROOT.iterdir(), key=lambda p: p.name):
        if not d.is_dir() or is_skipped(d.name):
            continue
        pages = find_pages(d)
        if pages:
            entry_rel, entry_path = pages[0][2], pages[0][3]
            page_items = [
                {"path": rel, "title": page_title(p) or Path(rel).name}
                for (_, _, rel, p) in pages[:MAX_PAGES_PER_SITE]
            ]
            try:
                updated = fmt_time(entry_path.stat().st_mtime)
            except OSError:
                updated = ""
            title = page_items[0]["title"]
            _, desc = page_meta(entry_path)
            site = {
                "dir": d.name,
                "name": title,
                "status": "ok",
                "updated": updated,
                "pages": page_items,
            }
            site.update(card_fields(d.name, title, desc, overrides.get(d.name, {})))
            sites.append(site)
        else:
            sites.append({
                "dir": d.name,
                "name": d.name,
                "status": "wip",
                "updated": fmt_time(latest_mtime(d)),
                "pages": [],
                "nameZh": d.name,
                "nameEn": prettify_dir(d.name),
                "descZh": "",
                "descEn": "",
            })
    sites.sort(key=lambda s: (s["status"] != "ok", s["dir"]))
    return {"generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"), "sites": sites}


def main() -> None:
    payload = collect_sites()
    dumped = json.dumps(payload, ensure_ascii=False, indent=2).replace("<", "\\u003c")
    block = (
        "<!--SITES:BEGIN-->\n"
        '<script type="application/json" id="sites-data">' + dumped + "</script>\n"
        "<!--SITES:END-->"
    )
    try:
        text = INDEX_FILE.read_text(encoding="utf-8")
    except OSError as e:
        sys.exit(f"读取 {INDEX_FILE} 失败：{e}")

    new_text, n = re.subn(
        r"<!--SITES:BEGIN-->.*?<!--SITES:END-->",
        lambda _: block,
        text,
        flags=re.DOTALL,
    )
    if n != 1:
        sys.exit("index.html 中未找到唯一的 <!--SITES:BEGIN/END--> 标记，无法更新")
    INDEX_FILE.write_text(new_text, encoding="utf-8", newline="\n")

    ok = sum(1 for s in payload["sites"] if s["status"] == "ok")
    print(f"已更新 {INDEX_FILE.name}：{len(payload['sites'])} 个目录（可浏览 {ok} 个），"
          f"生成于 {payload['generatedAt']}")
    for s in payload["sites"]:
        mark = "✓" if s["status"] == "ok" else "…"
        print(f"  {mark} {s['dir']}  ->  {s['name']}")
        if s["status"] == "ok":
            print(f"      卡片：{s['nameZh']}  /  {s['nameEn']}")
            print(f"      介绍：{s['descZh'] or '（无）'}")
            print(f"            {s['descEn'] or '（无）'}")


if __name__ == "__main__":
    main()

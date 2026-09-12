#!/usr/bin/env python3
"""重建 index.html 内嵌的站点清单（<!--SITES:BEGIN/END--> 之间的 JSON 块）。

扫描项目根目录下的一级子目录：
- 目录内能找到 HTML 文件 -> 记为「可浏览」站点，提取 <title>、入口及全部子页面；
- 找不到 HTML -> 记为「进行中」，仅展示目录名和最后更新时间。

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
SKIP_DIR_NAMES = {"node_modules", "tools"}
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
WS_RE = re.compile(r"\s+")
MAX_PAGES_PER_SITE = 20


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
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    m = TITLE_RE.search(text)
    return WS_RE.sub(" ", m.group(1)).strip() if m else ""


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
            sites.append({
                "dir": d.name,
                "name": page_items[0]["title"],
                "status": "ok",
                "updated": updated,
                "pages": page_items,
            })
        else:
            sites.append({
                "dir": d.name,
                "name": d.name,
                "status": "wip",
                "updated": fmt_time(latest_mtime(d)),
                "pages": [],
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


if __name__ == "__main__":
    main()

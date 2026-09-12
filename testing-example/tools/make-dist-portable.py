#!/usr/bin/env python3
"""把静态站 dist 目录改造成「可移植」：根绝对路径 -> 相对路径。

背景：Astro 等构建器默认按站点部署在域名根路径生成 `/_astro/...`、`/about/`
这类绝对引用。当 dist 被放在子路径下访问（例如本项目用
`python -m http.server` 从 testing-example 根目录提供
/teapot-artisan/site/dist/）时，这些引用会 404。

本脚本按文件所处深度把以下引用改写为相对路径，改写后 dist 可放在任意
子路径或根路径下正常工作：

- HTML 的 href/src/poster 属性、srcset 各段、style 与 <style> 中的 url()
- CSS 文件中的 url()

用法：
    python tools/make-dist-portable.py <dist目录> [更多dist目录...]

改写前建议确认 dist 可以随时由源工程重新构建（本脚本会原位修改文件）。
"""

import re
import sys
from pathlib import Path

ATTR_RE = re.compile(r'\b(href|src|poster)="(/(?!/)[^"]*)"')
SRCSET_RE = re.compile(r'\bsrcset="([^"]*)"')
URL_RE = re.compile(r'url\(\s*([\'"]?)/(?!/)')


def rel_prefix(depth: int) -> str:
    return "../" * depth


def rewrite_html(text: str, prefix: str):
    count = 0

    def sub_attr(m: re.Match) -> str:
        nonlocal count
        count += 1
        rest = m.group(2)[1:]  # 去掉捕获的开头斜杠
        target = (prefix + rest) if rest else (prefix or "./")
        return f'{m.group(1)}="{target}"'

    text = ATTR_RE.sub(sub_attr, text)

    def sub_srcset(m: re.Match) -> str:
        nonlocal count
        parts = []
        for token in m.group(1).split(","):
            token = token.strip()
            if token.startswith("/") and not token.startswith("//"):
                token = prefix + token[1:]
                count += 1
            parts.append(token)
        return 'srcset="' + ", ".join(parts) + '"'

    text = SRCSET_RE.sub(sub_srcset, text)

    def sub_url(m: re.Match) -> str:
        nonlocal count
        count += 1
        return f"url({m.group(1)}{prefix}"

    text = URL_RE.sub(sub_url, text)
    return text, count


def rewrite_css(text: str, prefix: str):
    count = 0

    def sub_url(m: re.Match) -> str:
        nonlocal count
        count += 1
        return f"url({m.group(1)}{prefix}"

    text = URL_RE.sub(sub_url, text)
    return text, count


def scan_js_absolute(dist: Path):
    hits = []
    for p in dist.rglob("*.js"):
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if re.search(r'["\'`]/(?!/)[A-Za-z0-9_.]', text):
            hits.append(p.relative_to(dist).as_posix())
    return hits


def process(dist: Path) -> None:
    if not dist.is_dir():
        sys.exit(f"不是目录：{dist}")
    total = 0
    files = 0
    for p in list(dist.rglob("*.html")) + list(dist.rglob("*.css")):
        depth = len(p.relative_to(dist).parts) - 1
        prefix = rel_prefix(depth)
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            print(f"  跳过（读取失败）{p.relative_to(dist)}：{e}")
            continue
        new_text, n = rewrite_html(text, prefix) if p.suffix == ".html" else rewrite_css(text, prefix)
        if n:
            p.write_text(new_text, encoding="utf-8", newline="\n")
            total += n
            files += 1
            print(f"  {p.relative_to(dist)}：改写 {n} 处")
    print(f"[{dist}] 共改写 {total} 处（{files} 个文件）")
    js_hits = scan_js_absolute(dist)
    if js_hits:
        print(f"  注意：以下 JS 仍含根绝对路径字符串，请人工确认（脚本未改动 JS）：")
        for h in js_hits:
            print(f"    - {h}")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    for arg in args:
        process(Path(arg).resolve())


if __name__ == "__main__":
    main()

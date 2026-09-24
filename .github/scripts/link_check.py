#!/usr/bin/env python3
"""全站内部链接检查 —— 零依赖，CI 和本机都能跑。

用法：
    python .github/scripts/link_check.py            # 检查，断了退出码 1
    python .github/scripts/link_check.py --verbose  # 把通过的也列出来

为什么需要它：Pages 直接发布仓库根目录，任何写死的根绝对路径（/_astro/、/about/）
在子路径部署下都会 404，而页面本身照样能打开、没有任何报错。
本脚本在建站时就把这类断链抓出来。

约定：
  * 绝对路径 /foo  → 相对仓库根解析（Pages 的站点根就是 /game-lab/，
    所以 /game-lab/foo 也按仓库根的 foo 解析）
  * 相对路径 foo   → 相对该 HTML 所在目录解析
  * 目录链接       → 目录下有 index.html 即算通过
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent.parent
SITE_PREFIX = "/game-lab/"  # Pages 把仓库挂在 /game-lab/ 下

# 扫都不扫的目录：依赖、本地工程、agent 工作区、版本库自身
# 注意：子项目（resonance-era 等）不在这里 —— 它们和仓库根目录一起发布到
# <user>.github.io/game-lab/ 下面，断链一样会让线上 404，必须扫。
# last-firewall 例外：它是第三方原型克隆（github.com/GordenSun/last-firewall），
# 本地只作参照、不入库不上线，扫它只会报一堆「本机有但没进 git」的假阳性。
SKIP_DIRS = {
    "node_modules", ".git", ".next", "local-only",
    ".workbuddy", ".workbuddy-ai", ".github",
    "run", "run2", "saves", "data", "logs",
    "last-firewall",
}

# 已知豁免：(文件, 前缀) —— 只在理由充分时加，且必须写清为什么
KNOWN_EXEMPT: dict[str, tuple[str, ...]] = {
    # Vite 开发入口：线上走 dist/，根 index.html 只给 npm run dev 用。
    # /src/main.tsx 在发布产物里本来就不存在；favicon 那几个在 public/ 下，
    # 由 Vite 在开发服务器根上提供，发布后由 dist/index.html 用相对路径引用。
    "ARH/index.html": (
        "/src/main.tsx", "./favicon.svg", "./favicon.ico", "./apple-touch-icon.png",
    ),
    "XanthanLMusic/index.html": ("/src/main.tsx",),
}

ATTR_RE = re.compile(r"""(?:href|src)\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
# 这些协议不是本站资源
NON_LOCAL = ("http://", "https://", "mailto:", "tel:", "data:", "javascript:", "#")


def iter_html_files() -> list[Path]:
    out = []
    for p in ROOT.rglob("*.html"):
        if any(part in SKIP_DIRS for part in p.relative_to(ROOT).parts[:-1]):
            continue
        out.append(p)
    return sorted(out)


def resolve(base_dir: Path, url: str) -> Path:
    """把 HTML 里的 URL 解析成本地路径。"""
    url = unquote(url.split("?")[0].split("#")[0]).strip()
    if url.startswith("/"):
        rel = url[len(SITE_PREFIX):] if url.startswith(SITE_PREFIX) else url.lstrip("/")
        return (ROOT / rel).resolve()
    return (base_dir / url).resolve()


def exists(target: Path) -> bool:
    if target.is_file():
        return True
    return target.is_dir() and (target / "index.html").is_file()


def published(target: Path) -> Path:
    """页面真正会去取的那个文件（目录 → 其下的 index.html）。"""
    if target.is_dir():
        ix = target / "index.html"
        if ix.is_file():
            return ix
    return target


def tracked_files() -> set[str] | None:
    """git 跟踪清单。ROOT 不是仓库顶层就返回 None（跳过「未发布」检查）。

    必须核对顶层：随便一个临时目录都可能落在某个祖先仓库里，
    那时 git 照样成功返回、只是清单是空的 —— 会把所有引用都误报成「没进 git」。
    """
    try:
        top = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], cwd=ROOT,
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        if not top or Path(top).resolve() != ROOT:
            return None
        out = subprocess.run(
            ["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True
        ).stdout.decode("utf-8", "replace")
    except (OSError, subprocess.CalledProcessError):
        return None
    files = {p for p in out.split("\0") if p}
    return files or None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    broken: list[tuple[str, str]] = []
    # 本机存在但没进 git 的目标：线下打得开、线上 404 —— 这类最难发现，必须拦
    untracked: list[tuple[str, str]] = []
    checked = 0
    tracked = tracked_files()

    for page in iter_html_files():
        rel_page = page.relative_to(ROOT).as_posix()
        try:
            text = page.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        exempt = KNOWN_EXEMPT.get(rel_page, ())

        for url in ATTR_RE.findall(text):
            if not url or url.startswith(NON_LOCAL):
                continue
            checked += 1
            if any(url == e or url.startswith(e) for e in exempt):
                continue
            target = resolve(page.parent, url)
            if not exists(target):
                broken.append((rel_page, url))
            elif tracked is not None:
                rel = published(target).relative_to(ROOT).as_posix()
                if rel not in tracked:
                    untracked.append((rel_page, url))

    if args.verbose:
        print(f"检查了 {checked} 条内部引用（{ROOT}）")

    if broken:
        print(f"\n发现 {len(broken)} 处断链：\n")
        for page, url in broken:
            print(f"  {page}\n      -> {url}")
        print("\n修完再推。常见原因：构建产物用了根绝对路径（给构建器配 base）。")

    if untracked:
        print(f"\n发现 {len(untracked)} 处「本机有、但没进 git」的引用（线上一定 404）：\n")
        for page, url in untracked:
            print(f"  {page}\n      -> {url}")
        print("\n多半是被 .gitignore 误伤了运行时资源。给那条规则加例外，再 git add。")

    if broken or untracked:
        return 1

    print(f"链接检查通过：{checked} 条内部引用全部可达。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

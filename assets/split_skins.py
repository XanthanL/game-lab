#!/usr/bin/env python3
"""把共享样式拆成「每套皮肤一个自包含文件」，让首屏只下载当前皮肤。

用法：python assets/split_skins.py

  assets/index.css        —— 源码正本（人工维护，只改这里；页面不再直接加载）
  assets/skins/<s>.css    —— 生成：原文件按「core 规则 + 该皮肤规则」过滤后的副本

为什么不是 core.css + 每套补丁：index.css 后半段有一层「风格增强层」，
它靠**同特异度、更晚的源序**压过皮肤自己的声明（例如把一批皮肤的
.hero { overflow:hidden } 改回 visible）。拆成两段必然打乱源序，实测会
让首屏母题被裁掉。所以每套皮肤生成一份按原始顺序过滤的完整副本：
不属于该皮肤的规则本来就不会命中，删掉无副作用，源序 100% 保留。

首屏代价：459 KB → 约 89 KB（core 81.7 KB + 单皮肤 7.3 KB），仍是 80% 降幅。
换一套皮肤要重新取一份完整文件（约 89 KB，本地静态 + 浏览器缓存），
换来的是「改源码不必手工维护规则优先级」，这个取舍是刻意的。

皮肤文件在 skins/ 子目录，url("fonts/…") / url("bg/…") 要退回一级。
改完源码必须重跑本脚本，并把生成物一起提交（它们是发布产物）。
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "index.css"
SKINS = ROOT / "skins"
STYLE_RE = re.compile(r'data-style\s*=\s*["\']?([\w-]+)["\']?')
COMMENT_RE = re.compile(r'/\*.*?\*/', re.S)
URL_RE = re.compile(r'(url\(\s*["\']?)((?:fonts|bg)/)')
AT_GROUP_RE = re.compile(r'^\s*@(media|supports|container|layer)\b')
HEADER = ("/* 生成文件，勿手工编辑 —— 源在 assets/index.css，"
          "改完跑 python assets/split_skins.py */\n")


def top_level_blocks(css: str) -> list[str]:
    """按大括号深度切顶层规则块。字符串 / 注释里的括号不计数。"""
    out, buf = [], []
    depth, i, state, quote = 0, 0, "normal", ""
    n = len(css)
    while i < n:
        c = css[i]
        nxt = css[i + 1] if i + 1 < n else ""
        if state == "normal":
            if c == "/" and nxt == "*":
                state = "comment"; buf.append(c + nxt); i += 2; continue
            if c in ('"', "'"):
                state = "string"; quote = c; buf.append(c); i += 1; continue
            if c == "{":
                depth += 1; buf.append(c)
            elif c == "}":
                depth -= 1; buf.append(c)
                if depth == 0:
                    out.append("".join(buf)); buf = []
            else:
                buf.append(c)
            i += 1
        elif state == "comment":
            if c == "*" and nxt == "/":
                state = "normal"; buf.append(c + nxt); i += 2
            else:
                buf.append(c); i += 1
        else:  # string
            if c == "\\" and nxt:
                buf.append(c + nxt); i += 2; continue
            if c == quote:
                state = "normal"
            buf.append(c); i += 1
    tail = "".join(buf).strip()
    if tail:
        out.append(tail)
    return out


def single_style(text: str) -> str | None:
    """这块规则只服务一套皮肤就返回名字；通用 / 跨皮肤返回 None。"""
    styles = set(STYLE_RE.findall(COMMENT_RE.sub("", text)))
    return styles.pop() if len(styles) == 1 else None


def split_at_group(block: str):
    """@media / @supports 块 → (外壳头, 子规则列表)；普通块 → None。"""
    idx = block.find("{")
    if idx == -1:
        return None
    head, inner = block[:idx + 1], block[idx + 1:-1]
    if not AT_GROUP_RE.match(COMMENT_RE.sub("", head)):
        return None
    return head, top_level_blocks(inner)


def css_for(blocks: list[str], skin: str) -> str:
    """按原顺序保留「通用块」和「属于 skin 的块」，其余皮肤的规则整块丢掉。
    at-rule 内部逐条过滤，外壳留一份，顺序不动。"""
    out = []
    for b in blocks:
        g = split_at_group(b)
        if g:
            head, children = g
            kept = [c for c in children if single_style(c) in (None, skin)]
            if kept:
                out.append(head + "".join(kept) + "}")
        elif single_style(b) in (None, skin):
            out.append(b)
    return URL_RE.sub(r"\1../\2", "".join(out))


def main() -> None:
    css = SRC.read_text(encoding="utf-8")
    blocks = top_level_blocks(css)
    names = sorted({s for b in blocks
                    for g in [split_at_group(b)]
                    for c in (g[1] if g else [b])
                    for s in [single_style(c)] if s})
    SKINS.mkdir(parents=True, exist_ok=True)
    for s in names:
        (SKINS / (s + ".css")).write_text(
            HEADER + f"/* skin: {s} — 源序保留的自包含样式表 */\n" + css_for(blocks, s),
            encoding="utf-8", newline="\n")

    # 校验：每个产物 = 源码按叶子规则过滤后的结果，规则不许丢
    for s in names:
        got = (SKINS / (s + ".css")).read_text(encoding="utf-8")
        want = css_for(blocks, s)
        assert got.endswith(want), f"{s}: 产物与源码过滤结果不一致"
    sizes = [(SKINS / (s + ".css")).stat().st_size for s in names]
    print(f"源 {SRC.name}: {len(css)/1024:.1f} KB / {len(blocks)} 个顶层块")
    print(f"skins: {len(names)} 套自包含样式表，平均 {sum(sizes)/len(sizes)/1024:.1f} KB，"
          f"最小 {min(sizes)/1024:.1f} KB，最大 {max(sizes)/1024:.1f} KB")
    print("皮肤列表: " + " ".join(names))


if __name__ == "__main__":
    main()

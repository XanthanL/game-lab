#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
奇点旅途 · 像素字体子集化

为什么需要：
    完整版 fusion-pixel-12.woff2 = 602 KB，且它挂在 <head> 里参与首屏带宽竞争。
    实测（120 kbps 限速）：含字体 22.4s 进标题 / 掐掉字体 13.4s —— 字体一个人吃掉 40% 的首屏时间。
    手机上 github.io 链路更慢，表现就是「卡在加载页一分钟」。

做法（宁可多收，不可漏收）：
    扫描 index.html / style.css / src/*.js 里出现的**每一个非 ASCII 字符**（含注释里的中文）——
    这是「界面上可能出现的所有字」的超集，因为 UI 文案、船体/敌型/模块名、i18n 词条全部以字面量写在源码里。
    再补上 ASCII 可打印区 + 若干结构符号，交给 fontTools 子集化。

⚠️ 新增 UI 文案后必须重跑本脚本，否则新字会变豆腐块 □。
   跑法（Python 3.10，带 fonttools + brotli）：
       "C:/Users/www27/AppData/Local/Programs/Python/Python310/python.exe" tools/subset_font.py
   只读 src：全量字体 assets/fusion-pixel-12.woff2 保留，产物写到 .subset.woff2。
"""
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC_FONT = os.path.join(ROOT, 'assets', 'fusion-pixel-12.woff2')
OUT_FONT = os.path.join(ROOT, 'assets', 'fusion-pixel-12.subset.woff2')
SCAN = ['index.html', 'style.css'] + sorted(glob.glob(os.path.join(ROOT, 'src', '*.js')))

# 结构/安全字符：即使源码里没出现过也留着（数字格式化、占位、全角标点等）
EXTRA = '  　、。，．；：？！…—－·×÷±≤≥≈∈←↑→↓↔⟪⟫▣◆●★☆✔✕⟳⏸▶⏭①②③④⑤⑥⑦⑧⑨⑩'
# 全角数字/字母（HUD 偶尔用全角排版）
EXTRA += '０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ'


def collect():
    chars = set(EXTRA)
    for f in SCAN:
        if not os.path.exists(f):
            print('  [warn] 跳过不存在的文件:', f)
            continue
        with open(f, encoding='utf-8') as fh:
            for c in fh.read():
                if ord(c) > 127:
                    chars.add(c)
    # ASCII 可打印区
    for i in range(0x20, 0x7F):
        chars.add(chr(i))
    return chars


def main():
    try:
        from fontTools import subset
    except ImportError:
        print('需要 fonttools：py -3.10 -m pip install fonttools brotli')
        return 2

    chars = collect()
    text = ''.join(sorted(chars))
    print('扫描文件: %d 个' % len(SCAN))
    print('保留字形: %d 个（其中非 ASCII %d 个）'
          % (len(chars), sum(1 for c in chars if ord(c) > 127)))

    before = os.path.getsize(SRC_FONT)
    args = [
        SRC_FONT,
        '--text=%s' % text,
        '--flavor=woff2',
        '--output-file=%s' % OUT_FONT,
        '--no-hinting',
        '--desubroutinize',
        '--drop-tables+=DSIG',
        '--layout-features=',          # 像素字体不需要 OpenType 特性，砍掉省字节
        '--name_IDs=0,1,2,3,4,5,6',
        '--notdef-outline',
    ]
    subset.main(args)

    after = os.path.getsize(OUT_FONT)
    print('字体: %.1f KB -> %.1f KB  (%.0f%%)'
          % (before / 1024, after / 1024, after / before * 100))
    return 0


if __name__ == '__main__':
    sys.exit(main())

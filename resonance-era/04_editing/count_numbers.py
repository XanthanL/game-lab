#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
数字密度验收脚本（配合 04_editing/numeric-discipline.md）

用法：
    python 04_editing/count_numbers.py            # 全卷
    python 04_editing/count_numbers.py 6          # 只看某一章

口径：
    净字   = 去空白后字符数（与全书字数统计一致）
    数字串 = 正则 \d+(?:\.\d+)? 的匹配次数
    密度   = 数字串 / 净字 * 1000        （硬上限 4）
    代码块 = ``` 对数                     （硬上限 12）
    小数   = \d+\.\d+ 的个数              （软上限 8，且每个应出现 >=3 次）
"""
import re
import io
import os
import sys
import glob
import collections

HERE = os.path.dirname(os.path.abspath(__file__))
MANU = os.path.join(os.path.dirname(HERE), '03_manuscript')

LIMIT_DENSITY = 4.0
LIMIT_BLOCK = 12
LIMIT_DECIMAL = 8


def scan(path):
    t = io.open(path, encoding='utf-8').read()
    net = len(re.sub(r'\s', '', t))
    blocks = re.findall(r'```.*?```', t, re.S)
    inblk = ' '.join(blocks)
    out = t
    for b in blocks:
        out = out.replace(b, ' ')
    nums = re.findall(r'\d+(?:\.\d+)?', t)
    cnt = collections.Counter(nums)
    # 计量数字 = 带小数点的，或带单位的。读者「记不住」的是这一类。
    # 编号（A-0031 / D-08814 / 第19扇区 / 纪元1018.03.18）不算 —— 它是物，不是量。
    UNIT = r'(?:Hz|kHz|dB|米|m/s|ms|min|秒|s\b|克|g\b|吨|t\b|次|遍|厘米|毫米|km|%)'
    # 纪元日期（1018.03.18 / 1009.11.03）不是计量数字，先抠掉再统计
    t = re.sub(r'\d{4}\.\d{2}(?:\.\d{2})?', '<DATE>', t)
    dec = re.findall(r'\d+\.\d+', t)
    unit = re.findall(r'\d+(?:\.\d+)?\s*' + UNIT, t)
    # 小数按「唯一值」考核 —— 同一个数重复出现是三遍法则要求的，是好事不是噪声。
    # 出现次数只显示，不判超标。
    dec_uniq = len(set(dec))
    # 并集（同一个数字串可能既带小数又带单位，不重复计）
    metric_spans = [m.span() for m in re.finditer(r'\d+\.\d+|\d+(?:\.\d+)?\s*' + UNIT, t)]
    return {
        'net': net,
        'total': len(nums),
        'inblk': len(re.findall(r'\d+(?:\.\d+)?', inblk)),
        'outblk': len(re.findall(r'\d+(?:\.\d+)?', out)),
        'blocks': len(blocks),
        'decimal': len(dec),
        'dec_uniq': dec_uniq,
        'metric': len(metric_spans),
        'once': sum(1 for _, v in cnt.items() if v == 1),
        'density': len(nums) / net * 1000 if net else 0,
        'mdensity': len(metric_spans) / net * 1000 if net else 0,
    }


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    rows = []
    for path in sorted(glob.glob(os.path.join(MANU, '第 * 章_*.md'))):
        base = os.path.basename(path)
        n = int(re.match(r'第 (\d+) 章_', base).group(1))
        if only and str(n) != only:
            continue
        rows.append((n, base[len('第 %d 章_' % n):-3], scan(path)))

    rows.sort(key=lambda r: r[0])
    print('章  标题          净字   计量数 计量密度 小数种类  块   块内数字  一次性')
    print('-' * 74)
    fails = []
    for n, title, s in rows:
        mark = ''
        if s['mdensity'] > LIMIT_DENSITY:
            mark += ' 计量超标'
        if s['blocks'] > LIMIT_BLOCK:
            mark += ' 块太多'
        if s['dec_uniq'] > LIMIT_DECIMAL:
            mark += ' 小数种类多'
        if mark:
            fails.append((n, title, mark.strip()))
        print('%-3d %-12s %6d %6d %8.1f %5d %4d %8d %6d %s' % (
            n, title, s['net'], s['metric'], s['mdensity'],
            s['dec_uniq'], s['blocks'], s['inblk'], s['once'],
            'FAIL:' + mark.strip() if mark else ''))

    print()
    print('上限：计量密度 %.1f / 千字   代码块 %d   小数种类 %d/章（出现次数不限，重复才记得住）' % (
        LIMIT_DENSITY, LIMIT_BLOCK, LIMIT_DECIMAL))
    print('计量数字 = 带小数点 或 带单位（Hz/dB/s/米/克/吨/次/遍…）；编号与纪元日期不计。')
    if fails:
        print()
        print('超标 %d 章:' % len(fails))
        for n, t, m in fails:
            print('   第 %d 章 %s —— %s' % (n, t, m))
        return 1
    print('全部达标。')
    return 0


if __name__ == '__main__':
    sys.exit(main())

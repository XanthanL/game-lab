# -*- coding: utf-8 -*-
"""给每个 CommonJS 模块加 IIFE 外壳。

为什么需要：
  微信小游戏里每个文件是独立的模块作用域；浏览器里用 <script src> 加载时
  所有文件共享全局作用域，各模块顶层的 const（clamp / PAL / T / AW ...）会
  互相撞名。套一层 IIFE 后三种环境（Node / 微信 / 浏览器）行为一致，
  且不需要任何打包器。

用法：python tools/h5/wrap-modules.py
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FILES = [
    os.path.join('js', 'util.js'),
    os.path.join('js', 'tokens.js'),
    os.path.join('js', 'pal.js'),
    os.path.join('js', 'arena.js'),
    os.path.join('js', 'singularity.js'),
    os.path.join('js', 'input.js'),
    os.path.join('js', 'entities.js'),
    os.path.join('js', 'combat.js'),
    os.path.join('js', 'render.js'),
    os.path.join('js', 'ui.js'),
    os.path.join('js', 'app.js'),
    'game.js',
]

HEAD = ";(function () {\n'use strict';\n"
TAIL = "\n})();\n"


def already_wrapped(src):
    return src.lstrip().startswith(';(function () {')


def main():
    changed = 0
    for rel in FILES:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            print('跳过（不存在）:', rel)
            continue
        with io.open(p, 'r', encoding='utf-8') as f:
            src = f.read()
        if already_wrapped(src):
            print('已包裹:', rel)
            continue
        # 保留文件头部的 shebang / 说明注释在最外层，包裹体从第一行代码开始
        body = src.strip('\n')
        out = HEAD + body + TAIL
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(out)
        changed += 1
        print('已包裹:', rel)
    print('\n完成，修改 %d 个文件' % changed)


if __name__ == '__main__':
    main()

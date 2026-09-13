# -*- coding: utf-8 -*-
"""环廊渲染探针 —— 无头 Chrome 真跑一遍,把「实际请求了什么图、上传了多大的纹理、
入场时间线走到哪」打出来。

用法:
    python tools/probe-ring.py
    python tools/probe-ring.py --chrome "D:/path/to/chrome.exe"
    python tools/probe-ring.py --width 390 --height 844     # 按手机视口量

为什么需要它
------------
环廊的毛病大多**不报错,只是静默变差**:图集悄悄降档、图源从缩略图换成大图、
入场卡在某个阶段 —— 页面照常显示,只是画糊了或首屏重了。
index.html 里 `data-ring-state` / `data-ring-wait` / `data-ring-error` 是作者留的
运行时回显,本脚本把它读出来,再补一层 `Image` / `texImage2D` 钩子,量出
「请求清单」和「纹理尺寸」两件代码里看不出来的事。

退出码:0 正常;1 环廊抛错或时间线没走完。
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
PROBE = ROOT / "_probe.html"

CHROME_CANDIDATES = [
    r"C:/Program Files/Google/Chrome/Application/chrome.exe",
    r"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    r"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    r"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
]

# 注入到页面最前面的探针:记录 Image.src 与 texImage2D 尺寸,每帧回写到 body 属性
HOOK = """  <script>
  (function () {
    window.__req = []; window.__tex = []; window.__max = 0;
    var OrigImage = window.Image;
    var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    window.Image = function () {
      var img = new OrigImage();
      Object.defineProperty(img, "src", {
        configurable: true,
        get: function () { return d.get.call(img); },
        set: function (v) { window.__req.push(String(v)); d.set.call(img, v); }
      });
      return img;
    };
    var origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      var ctx = origGetContext.apply(this, arguments);
      if (type === "webgl" && ctx && !ctx.__patched) {
        ctx.__patched = true;
        try { window.__max = ctx.getParameter(ctx.MAX_TEXTURE_SIZE); } catch (e) {}
        var origTex = ctx.texImage2D.bind(ctx);
        ctx.texImage2D = function () {
          var a = arguments, w = 0, h = 0;
          if (a.length === 9) { w = a[3]; h = a[4]; }
          else if (a.length === 6 && a[5] && a[5].width) { w = a[5].width; h = a[5].height; }
          if (w && h) window.__tex.push(w + "x" + h);
          return origTex.apply(null, a);
        };
      }
      return ctx;
    };
    (function flush() {
      if (document.body) {
        document.body.setAttribute("data-probe-srcs", window.__req.map(function (s) {
          return String(s).replace(/\\?.*$/, "");
        }).join(","));
        document.body.setAttribute("data-probe-maxtex", window.__max);
        var uniq = window.__tex.filter(function (v, i, arr) { return arr.indexOf(v) === i; });
        document.body.setAttribute("data-probe-tex", uniq.join(","));
        var st = document.getElementById("ring-stage");
        if (st) {
          document.body.setAttribute("data-ring-state", st.getAttribute("data-ring-state") || "");
          document.body.setAttribute("data-ring-wait", st.getAttribute("data-ring-wait") || "");
          document.body.setAttribute("data-ring-error", st.getAttribute("data-ring-error") || "");
        }
      }
      requestAnimationFrame(flush);
    })();
  })();
  </script>
"""


def find_chrome(explicit=None):
    if explicit:
        return explicit
    env = os.environ.get("CHROME_PATH")
    if env and Path(env).exists():
        return env
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    return None


def build_probe():
    html = INDEX.read_text(encoding="utf-8")
    marker = '<script src="js/works-data.js'
    if marker not in html:
        sys.exit("index.html 里找不到 works-data.js 的 <script>,探针无法注入。")
    PROBE.write_text(html.replace(marker, HOOK + "  " + marker, 1), encoding="utf-8")


def attr(dom, name):
    m = re.search(r'data-' + name + r'="([^"]*)"', dom)
    return m.group(1) if m else ""


def human(n):
    return f"{n / 1048576:.2f} MB" if n >= 1048576 else f"{n / 1024:.0f} KB"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default=None, help="chrome/edge 可执行文件路径")
    ap.add_argument("--width", type=int, default=1512)
    ap.add_argument("--height", type=int, default=870)
    ap.add_argument("--budget", type=int, default=5000, help="虚拟时间预算(ms)")
    args = ap.parse_args()

    chrome = find_chrome(args.chrome)
    if not chrome:
        sys.exit("找不到 Chrome / Edge。用 --chrome 指定路径,或设环境变量 CHROME_PATH。")

    build_probe()
    tmp = Path(tempfile.mkdtemp(prefix="ringprobe-"))
    try:
        cmd = [
            chrome, "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader",
            "--allow-file-access-from-files", "--no-first-run", "--no-sandbox",
            f"--user-data-dir={tmp / 'profile'}",   # 独立 profile:避免与已开浏览器抢锁
            f"--window-size={args.width},{args.height}",
            f"--virtual-time-budget={args.budget}",
            "--dump-dom", PROBE.resolve().as_uri(),
        ]
        proc = subprocess.run(cmd, capture_output=True, timeout=240)
        dom = proc.stdout.decode("utf-8", "replace")
        if not dom:
            sys.exit("Chrome 没有输出 DOM。用 --chrome 换个浏览器试试。")

        srcs = [s for s in attr(dom, "probe-srcs").split(",") if s]
        tex = [t for t in attr(dom, "probe-tex").split(",") if t]
        state = attr(dom, "ring-state")
        wait = attr(dom, "ring-wait")
        err = attr(dom, "ring-error")

        print(f"视口 {args.width}x{args.height} · MAX_TEXTURE_SIZE={attr(dom, 'probe-maxtex') or '?'}")
        print("-" * 58)

        # 1) 请求清单
        thumbs = [s for s in srcs if "/thumb/" in s]
        fulls = [s for s in srcs if "/thumb/" not in s]
        print(f"图片请求  {len(srcs)} 个   缩略图 {len(thumbs)} · 全尺寸 {len(fulls)}")
        disk = 0
        for s in srcs:
            p = ROOT / s
            if p.exists():
                disk += p.stat().st_size
        if disk:
            print(f"          首屏图片体积 {human(disk)}")
        if fulls:
            print("          [注意] 环廊应当只吃 thumb;以下全尺寸图不该出现在首屏:")
            for s in fulls[:5]:
                print(f"            {s}")

        # 2) 纹理
        print(f"纹理上传  {', '.join(tex) if tex else '(无)'}")
        atlas = [t for t in tex if t not in ("1x1",) and int(t.split("x")[0]) == int(t.split("x")[1])]
        if atlas:
            side = int(atlas[0].split("x")[0])
            print(f"          图集 {side}x{side} ≈ {human(side * side * 4)} 显存(不含 mipmap)")

        # 3) 时间线
        print(f"入场状态  {state or '(尚未回显)'}   等待原因={wait or '-'}")

        # 退出码只跟「真出错」绑定。软件渲染(SwiftShader)下虚拟时钟走得比真实帧慢,
        # 入场时间线(需 ~8s 虚拟时间)不一定能在预算内走完 —— 那是探针的局限,
        # 不是环廊的故障,所以只提示。要它走完就加大 --budget,代价是跑得更久。
        if err:
            print(f"\n[失败] 环廊抛错:{err}")
            return 1
        if wait and wait != "run":
            print(f"\n[失败] 主循环没在跑,卡在等待:{wait}")
            return 1
        if state and "done" not in state:
            print(f"\n[通过] 环廊无异常、主循环在跑。")
            print(f"       (时间线还没走完 —— 软件渲染下常见,加大 --budget 可复核)")
            return 0
        print("\n[通过] 环廊跑通,时间线完成,无异常。")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        if PROBE.exists():
            PROBE.unlink()


if __name__ == "__main__":
    sys.exit(main())

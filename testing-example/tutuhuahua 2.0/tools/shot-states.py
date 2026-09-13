# -*- coding: utf-8 -*-
"""环廊双态截图 —— 无头 Chrome 把「整体圆环」与「单张聚焦」两个状态各拍一张。

用法:
    python tools/shot-states.py                    # 默认 1000x640 + 520x780
    python tools/shot-states.py --width 1280 --height 800
    python tools/shot-states.py --only desktop

为什么需要它
------------
probe-zoom.py 读的是**状态**(类名、缩放值、计算透明度),它证明的是"逻辑走到了",
不是"看起来对"。字标压在环心上有没有被卡片蹭到、整体圆环在窄屏是不是小得看不清 ——
这些只有照片能回答。本项目前几轮的 bug 全是这一类:数字全绿,眼睛一看就错。

做法:降级动画直取终态(省掉 10s 开场)→ 聚焦态拍一张 → 派发 ESC →
等跑满 spinTime 2.6s → 整体圆环再拍一张。

退出码:0 拍齐了;1 有一张没出来。
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
PROBE = ROOT / "_shot_state.html"
OUT = ROOT / ".shots"

CHROME_CANDIDATES = [
    r"C:/Program Files/Google/Chrome/Application/chrome.exe",
    r"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    r"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    r"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
]

# 状态到手后再多跑几帧,让 CSS 补间/自转惯性也走完
SETTLE_FRAMES = 40

# 「转圈中」:转圈起点之后再走多少帧才按快门。
# opacity 区间方案(headless 下每帧真实耗时飘忽,经常错过窗口)不稳,
# 改回固定帧数。MID=8 帧 ≈ 130ms 真实时间,字标正进入淡出中段
MID_FRAMES = 8


def hook(state):
    """注入到 index.html 最前面的等待脚本。

    不等固定帧数,等**状态自校准**:
      聚焦态 → 等 is-ready(环已落定)
      整体态 → 派发 ESC 后等 is-zooming 消失(两态补间跑完)
      转圈中 → 等 data-spin-at 写出(转圈起点),再多跑 MID_FRAMES 帧
               抓"环已经在转、字标正在淡出"的那一瞬
    这样换参数(P.spinTime 调快调慢)也不用回来改 WAIT_FRAMES。

    注意「转圈中」必须走**真实开场**,不能加 --force-prefers-reduced-motion
    (那会把整条入场时间线跳过,直接停在聚焦态)。
    """
    if state == "overview":
        body = """
      until(function () { return stage().classList.contains("is-ready"); },
            600, function () {
        document.dispatchEvent(new KeyboardEvent("keydown",
          { key: "Escape", bubbles: true, cancelable: true }));
        until(function () {
          return !stage().classList.contains("is-zooming");
        }, 900, function () { raf(SETTLE, done); });
      });"""
    elif state == "mid":
        # mid **必须**只等 spinAt,不能接受 is-ready —— 否则会直接跳到聚焦终态
        body = """
      until(function () { return stage().dataset.spinAt != null; },
            1200, function () { raf(MID, done); });"""
    else:
        body = """
      until(function () { return stage().classList.contains("is-ready"); },
            600, function () { raf(SETTLE, done); });"""
    return f"""  <script>
  (function () {{
    var SETTLE = {SETTLE_FRAMES}, MID = {MID_FRAMES};
    function stage() {{ return document.getElementById("ring-stage"); }}
    function raf(n, fn) {{ if (n <= 0) return fn();
      requestAnimationFrame(function () {{ raf(n - 1, fn); }}); }}
    function until(fn, limit, done) {{
      if (fn() || limit <= 0) return done();
      requestAnimationFrame(function () {{ until(fn, limit - 1, done); }});
    }}
    // 心跳:从 spinAt 出现那一刻起,每帧把字标 opacity 写到 dataset 上。
    // dump-dom 模式不会等 done(),但能读到最近一帧的心跳 —— 排查时一眼
    // 看出"截到转圈后多久、字标处于淡出第几成"
    (function beat() {{
      var s = stage();
      if (s && s.dataset.spinAt != null) {{
        var b = document.getElementById("ring-brand");
        var op = b ? parseFloat(window.getComputedStyle(b).opacity || "0") : -1;
        s.setAttribute("data-shot-beat",
          "spin" + s.dataset.spinAt +
          " off" + (s.dataset.markOffAt || "-") +
          " markCls" + (b && b.classList.contains("is-mark-in") ? "in"
                         : b && b.classList.contains("is-mark-out") ? "out" : "-") +
          " markOp" + op.toFixed(2));
      }}
      requestAnimationFrame(beat);
    }})();
    function done() {{
      var s = stage();
      s.setAttribute("data-shot", "ready");
      // 调试:done 时把页面底色染红,看截图是不是真在 done 时拍的
      document.documentElement.style.background = "#ff0000";
      document.body && (document.body.style.background = "#ff0000");
      try {{ console.log("SHOT_BEAT", s.getAttribute("data-shot-beat")); }} catch (e) {{}}
    }}
    window.addEventListener("load", function () {{{body}
    }});
  }})();
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


def unlink_hard(path):
    """沙箱里 Path.unlink() 会被代理成回收站并抛错,和 rmtree 一个毛病。"""
    p = Path(path)
    if not p.exists():
        return
    try:
        p.unlink()
    except OSError:
        pass
    if not p.exists():
        return
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "del", "/f", "/q", str(p)], capture_output=True)
    else:
        subprocess.run(["rm", "-f", str(p)], capture_output=True)


def rmtree_hard(path):
    p = Path(path)
    if not p.exists():
        return
    shutil.rmtree(p, ignore_errors=True)
    if not p.exists():
        return
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "rmdir", "/s", "/q", str(p)], capture_output=True)
    else:
        subprocess.run(["rm", "-rf", str(p)], capture_output=True)


def shoot(chrome, state, w, h, budget, timeout, debug=False):
    html = INDEX.read_text(encoding="utf-8")
    marker = '<script src="js/works-data.js'
    if marker not in html:
        sys.exit("index.html 里找不到 works-data.js 的 <script>,无法注入。")
    PROBE.write_text(html.replace(marker, hook(state) + "  " + marker, 1),
                     encoding="utf-8")

    OUT.mkdir(exist_ok=True)
    png = (OUT / f"{state}-{w}x{h}.png").resolve()
    if png.exists():
        unlink_hard(png)

    tmp = Path(tempfile.mkdtemp(prefix="shotstate-"))
    try:
        common = [
            chrome, "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader",
            "--allow-file-access-from-files", "--no-first-run", "--no-sandbox",
            f"--user-data-dir={tmp / 'profile'}",
            f"--window-size={w},{h}",
            # 「转圈中」要抓真实开场的中段,**不能**跳过入场动画
            *(() if state == "mid" else ("--force-prefers-reduced-motion",)),
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
            f"--virtual-time-budget={budget}",
        ]
        if debug:
            cmd = common + ["--dump-dom", PROBE.resolve().as_uri()]
            out = subprocess.run(cmd, capture_output=True, timeout=timeout).stdout
            return out.decode("utf-8", "ignore") if out else ""
        cmd = common + [f"--screenshot={png}", PROBE.resolve().as_uri()]
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
        # stderr 里 chrome 会把 JS console.log 输出到一行 —— 抓出来当 done 时刻证据
        if proc.stderr:
            for line in proc.stderr.decode("utf-8", "ignore").splitlines():
                if "SHOT_BEAT" in line:
                    print("  → " + line.split("SHOT_BEAT")[-1].strip())
                    break
        return png if png.exists() else None
    finally:
        rmtree_hard(tmp)
        if PROBE.exists():
            unlink_hard(PROBE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default=None)
    ap.add_argument("--width", type=int, default=1000, help="桌面视口宽")
    ap.add_argument("--height", type=int, default=640, help="桌面视口高")
    ap.add_argument("--only", choices=["desktop", "mobile", "mid"], default=None)
    ap.add_argument("--budget", type=int, default=200000)
    ap.add_argument("--debug", action="store_true", help="mid 模式只 dump DOM 不截图")
    args = ap.parse_args()

    chrome = find_chrome(args.chrome)
    if not chrome:
        sys.exit("找不到 Chrome / Edge。用 --chrome 指定,或设 CHROME_PATH。")

    # 「转圈中」是开场中段的一瞬,只有一张,且必须跑真实时间线(慢),
    # 所以单独一个分支、默认只用较小的视口
    if args.only == "mid":
        print("  拍 转圈中(环已转起来、字标正在淡出)...", end="", flush=True)
        if args.debug:
            dom = shoot(chrome, "mid", args.width, args.height, args.budget, 900, debug=True)
            # 抓 data-shot-beat,看出当时跑到哪一拍
            import re as _re
            m = _re.search(r'data-shot-beat="([^"]+)"', dom or "")
            beat = m.group(1) if m else "无(说明 data-shot=\"ready\" 都没写出来)"
            print(f" 拍到的节拍:{beat}")
            return 0 if beat != "无(说明 data-shot=\"ready\" 都没写出来)" else 1
        png = shoot(chrome, "mid", args.width, args.height, args.budget, 900)
        print(f" {png.stat().st_size // 1024} KB" if png else " 没拍出来")
        return 0 if png else 1

    views = []
    if args.only != "mobile":
        views.append(("桌面", args.width, args.height))
    if args.only != "desktop":
        views.append(("手机竖屏", 520, 780))

    shots, missing = [], 0
    for label, w, h in views:
        for state in ("聚焦", "整体"):
            key = "focus" if state == "聚焦" else "overview"
            print(f"  拍 {label} {w}x{h} · {state}态 ...", end="", flush=True)
            png = shoot(chrome, key, w, h, args.budget, 900)
            if png:
                print(f" {png.stat().st_size // 1024} KB")
                shots.append(png)
            else:
                print(" 没拍出来")
                missing += 1

    print()
    if missing:
        print(f"[失败] {missing} 张没拍出来。加大 --budget 再试。")
        return 1
    print(f"[完成] {len(shots)} 张 → {OUT}")
    for p in shots:
        print(f"  {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

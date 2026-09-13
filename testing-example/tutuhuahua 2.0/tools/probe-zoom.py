# -*- coding: utf-8 -*-
"""环廊双态探针 —— 无头 Chrome 真跑一遍「整体圆环 ↔ 单张聚焦」。

用法:
    python tools/probe-zoom.py
    python tools/probe-zoom.py --skip-entry      # 只跑状态机那趟(快)

为什么需要它
------------
这次加的东西全都是**不报错的静默行为**:字标该不该在、缩放有没有推到 1、
ESC / 双指有没有真的把环退回整体、开场收势有没有回到正面大卡 ——
页面上没有任何报错,只能靠读运行时状态。所以跑两趟:

  第一趟 状态机(降级动画,直取终态):点击 → ESC → 双指收缩,三步都验
  第二趟 真实开场时间线:等「字标浮现在环心」与「开场结束」两个节拍,
        验中间态 zoom=0、收势 zoom=1 —— 也就是"自动转圈之后转进大图"

结果回写到 body 的 data-zoom-log,一次 --dump-dom 全读回来。

退出码:0 全部符合预期;1 有一步不符或环廊抛错。
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
PROBE = ROOT / "_probe_zoom.html"

CHROME_CANDIDATES = [
    r"C:/Program Files/Google/Chrome/Application/chrome.exe",
    r"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    r"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    r"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
]

# 两个探针共用的工具层
COMMON = r"""
    var out = [];
    function put(k, v) { out.push(k + "=" + v); flush(); }
    function flush() {
      if (document.body) document.body.setAttribute("data-zoom-log", out.join(" | "));
    }
    function raf(n, fn) {
      if (n <= 0) return fn();
      requestAnimationFrame(function () { raf(n - 1, fn); });
    }
    function until(fn, limit, done) {
      if (fn() || limit <= 0) return done();
      requestAnimationFrame(function () { until(fn, limit - 1, done); });
    }
    function stage() { return document.getElementById("ring-stage"); }
    function brand() { return document.getElementById("ring-brand"); }
    function markOp() {
      var b = brand();
      if (!b) return 0;
      // 字标现在走 CSS 过渡(和片头同款),行内 opacity 已经不写了 ——
      // 必须读**计算后**的值,才拿得到过渡中间态
      return parseFloat(window.getComputedStyle(b).opacity || "0");
    }
    function markCls() {
      var b = brand();
      if (!b) return "-";
      return b.classList.contains("is-mark-in") ? "in"
        : (b.classList.contains("is-mark-out") ? "out" : "-");
    }
    function zoomAttr() {
      var m = (stage().getAttribute("data-ring-state") || "").match(/z([\d.]+)/);
      return m ? parseFloat(m[1]) : null;
    }
    // 开场四个节拍的**实测**相对秒数(JS 每拍只写一次 dataset),
    // 用来判"字标是陪着转圈,还是转起来就走" —— 不靠推参数
    function beats() {
      var d = stage().dataset;
      return "on" + (d.markOnAt || "-") +
             " spin" + (d.spinAt || "-") +
             " off" + (d.markOffAt || "-") +
             " land" + (d.landedAt || "-");
    }
    function sample(tag) {
      var s = stage(), b = brand(), z = zoomAttr();
      put(tag,
        "zoom" + (z === null ? "?" : z.toFixed(2)) +
        " isZoom" + (s.classList.contains("is-zoom") ? 1 : 0) +
        " mark" + (b.classList.contains("is-mark") ? 1 : 0) +
        " markCls" + markCls() +
        " markOp" + markOp().toFixed(2) +
        " ready" + (s.classList.contains("is-ready") ? 1 : 0) +
        " beats[" + beats() + "]" +
        " state[" + (s.getAttribute("data-ring-state") || "无") + "]" +
        " err[" + (s.getAttribute("data-ring-error") || "无") + "]");
    }
    function key(target, k) {
      target.dispatchEvent(new KeyboardEvent("keydown",
        { key: k, bubbles: true, cancelable: true }));
    }
    function ptr(type, id, x, y, kind) {
      stage().dispatchEvent(new PointerEvent(type, {
        pointerId: id, pointerType: kind || "mouse", clientX: x, clientY: y,
        bubbles: true, cancelable: true
      }));
    }
    // 正面卡在整体圆环下的屏幕坐标:环心 + (R, 0);世界 y=0 → 屏幕 y 居中
    function frontXY() {
      var ws = window.WORKS.works, n = ws.length;
      var s = stage(), vw = s.clientWidth, vh = s.clientHeight;
      var ringRadius = (100 * 0.875) / Math.sin(Math.PI / n);
      var byW = vw / 1512, byH = vh / 870;
      var fit = Math.min(1.6, Math.max(0.5, byW * 0.55 + Math.min(byW, byH) * 0.45));
      var narrow = vw <= 1024, tight = vw <= 640;
      var planeK = narrow ? 1.22 : 1;
      var radiusK = (narrow ? 1.28 : 1) * (tight ? 0.8 : 1);
      var endScale = tight ? 4.8 : (narrow ? 3.5 : 4.2);
      var sum = 0;
      for (var i = 0; i < n; i++) sum += (ws[i].w && ws[i].h) ? ws[i].w / ws[i].h : 0.83;
      var a = Math.min(0.98, Math.max(0.5, sum / n));
      var hPerG = 100 * planeK, wPerG = hPerG * a, rPerG = ringRadius * radiusK;
      var half = Math.sqrt(Math.pow(rPerG + wPerG * 0.5, 2) + Math.pow(hPerG * 0.5, 2));
      var og = Math.min(Math.min(vw, vh) * 0.88 / (2 * half), endScale * fit);
      var R = rPerG * og;
      var r = s.getBoundingClientRect();
      put("几何", "vw" + vw + " vh" + vh + " R" + R.toFixed(0) +
        " cardW" + (100 * planeK * og * a).toFixed(0) +
        " cardH" + (100 * planeK * og).toFixed(0));
      return { x: r.left + vw / 2 + R, y: r.top + vh / 2, R: R };
    }
    // 点在正面卡上:先按算出来的坐标试,不中就沿半径扫一圈
    function tapFront(done) {
      var p = frontXY();
      var tries = [1, 0.92, 1.08, 0.84, 1.16, 0, 2];
      var k = 0;
      (function attempt() {
        if (k >= tries.length) return done(false);
        var x = p.x + (tries[k] - 1) * p.R;
        k++;
        ptr("pointerdown", 1, x, p.y);
        ptr("pointerup", 1, x, p.y);
        raf(1, function () {
          stage().dispatchEvent(new MouseEvent("click",
            { clientX: x, clientY: p.y, bubbles: true, cancelable: true }));
          raf(2, function () {
            if (stage().classList.contains("is-zoom")) return done(true);
            attempt();
          });
        });
      })();
    }
"""

# 第一趟:降级动画下直取终态,然后走一遍 点击 → ESC → 双指
HOOK_STATE = ("  <script>\n  (function () {\n" + COMMON + r"""
    window.addEventListener("load", function () {
      // data-ring-state 每 30 帧才写一次 —— 等它出现,zoom 才读得到真值
      until(function () {
        return stage().classList.contains("is-ready") && zoomAttr() !== null;
      }, 200, function () {
        raf(3, function () {
          sample("A-开场终态(聚焦)");

          // B:ESC → 退回整体圆环(现在要跑满 spinTime 2.6s,轮询放宽到 300 帧)
          key(document, "Escape");
          until(function () { return !stage().classList.contains("is-zoom"); },
            300, function () {
              raf(30, function () {
                sample("B-ESC后(整体)");

                // C:点击正面卡 → 再进聚焦
                tapFront(function (hit) {
                  if (!hit) { put("C-点击后(聚焦)", "没点中任何卡片"); return; }
                  until(function () {
                    return stage().classList.contains("is-zoom") && markOp() < 0.02;
                  }, 300, function () {
                    sample("C-点击后(聚焦)");

                    // D:双指往中间收缩 → 退回整体
                    var p = frontXY();
                    var d = 140;
                    ptr("pointerdown", 11, p.x - d, p.y, "touch");
                    ptr("pointerdown", 12, p.x + d, p.y, "touch");
                    ptr("pointermove", 11, p.x - d * 0.3, p.y, "touch");
                    ptr("pointermove", 12, p.x + d * 0.3, p.y, "touch");
                    until(function () {
                      return !stage().classList.contains("is-zoom");
                    }, 300, function () {
                      raf(30, function () { sample("D-双指收缩后(整体)"); });
                    });
                  });
                });
              });
            });
        });
      });
    });
  })();
  </script>
""")

# 第二趟:真实开场时间线。两个节拍 —— 字标浮现、开场结束
HOOK_ENTRY = ("  <script>\n  (function () {\n" + COMMON + r"""
    window.addEventListener("load", function () {
      // 心跳:每 60 帧覆写一次,万一虚拟时钟提前耗尽,也能看出时间线走到哪
      (function beat() {
        if (document.body) {
          var s = stage();
          document.body.setAttribute("data-zoom-beat",
            (s.getAttribute("data-ring-state") || "无状态") +
            " cls[" + (brand().classList.value || "-") + "]" +
            " markOp" + markOp().toFixed(2) +
            " ready" + (s.classList.contains("is-ready") ? 1 : 0));
        }
        requestAnimationFrame(beat);
      })();
      // 触发器只能认类名:**片头字标自己就是从 1 淡到 0**,
      // 用 markOp > 阈值 去抓会把片头的淡出误判成"印记浮现"
      until(function () { return brand().classList.contains("is-mark-in"); },
        4000, function () {
        until(function () { return markOp() > 0.8; }, 200, function () {
          sample("E1-字标浮现(整环)");
          // 字标**开始退场**这一拍:此刻缩进应该还没起来(zoom 仍接近 0),
          // 才说明它是"环一转起来就走",而不是陪着转完
          until(function () { return brand().classList.contains("is-mark-out"); },
            4000, function () {
            sample("E1b-字标开始退场");
            until(function () { return stage().classList.contains("is-ready"); },
              4000, function () {
              // data-ring-state 每 30 帧才刷新一次 —— 等回显追上再采样,否则读到旧值
              until(function () { return zoomAttr() === 1; }, 200, function () {
                // 采样常卡在过渡中途 —— 这里等它确实淡完再取值。
                // 「是否在落地**之前**就开始退场」由 markCls=out 断言负责
                until(function () { return markOp() < 0.02; }, 200, function () {
                  sample("E2-开场结束(聚焦)");
                });
              });
            });
          });
        });
      });
    });
  })();
  </script>
""")


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


def build_probe(hook):
    html = INDEX.read_text(encoding="utf-8")
    marker = '<script src="js/works-data.js'
    if marker not in html:
        sys.exit("index.html 里找不到 works-data.js 的 <script>,探针无法注入。")
    PROBE.write_text(html.replace(marker, hook + "  " + marker, 1), encoding="utf-8")


def attr(dom, name):
    m = re.search(r'data-' + name + r'="([^"]*)"', dom)
    return (m.group(1) if m else "").replace("&quot;", '"').replace("&amp;", "&")


def unlink_hard(path):
    """删单个文件。`Path.unlink()` 在带 safe-delete 代理的沙箱里会被改写成
    「移到回收站」,对仓库内的临时探针文件会直接抛 OSError(0x2)——
    所以先试正常的,失败就走系统命令兜底,最后再复查一次。"""
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
    if p.exists():
        print(f"[提示] 临时文件没能删掉,请手动清理:{p}", file=sys.stderr)


def rmtree_hard(path):
    """删临时目录并**确认真的删掉了** —— 沙箱里 rmtree 会被代理成回收站并静默失败。"""
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
    if p.exists():
        print(f"[提示] 临时目录没能删掉,请手动清理:{p}", file=sys.stderr)


def run(chrome, hook, width, height, budget, reduced, timeout):
    build_probe(hook)
    tmp = Path(tempfile.mkdtemp(prefix="zoomprobe-"))
    try:
        cmd = [
            chrome, "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader",
            "--allow-file-access-from-files", "--no-first-run", "--no-sandbox",
            f"--user-data-dir={tmp / 'profile'}",
            f"--window-size={width},{height}",
            # 这三个是「别把后台标签页的 rAF 掐掉」:不加的话虚拟时钟会
            # 提前耗尽,开场时间线走不完,探针拿不到采样(实测 7s 就退出)
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
        ]
        if reduced:
            cmd.append("--force-prefers-reduced-motion")
        cmd += [f"--virtual-time-budget={budget}",
                "--dump-dom", PROBE.resolve().as_uri()]
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
        dom = proc.stdout.decode("utf-8", "replace")
        if not dom:
            sys.exit("Chrome 没有输出 DOM。用 --chrome 换个浏览器试试。")
        return dom
    finally:
        rmtree_hard(tmp)
        if PROBE.exists():
            unlink_hard(PROBE)


def parse(log):
    res = {}
    for part in log.split(" | "):
        part = part.strip()
        if not part or "=" not in part:
            continue
        tag, body = part.split("=", 1)
        res[tag.strip()] = body.strip()
    return res


def num(res, tag, key):
    body = res.get(tag, "")
    m = re.search(re.escape(key) + r"([\d.]+)", body)
    return float(m.group(1)) if m else None


def eq(res, tag, key, want):
    """读出来必须**恰好**等于 want —— 不能用 `x or 默认值` 兜底,0.0 是假值。"""
    return num(res, tag, key) == want


def lt(res, tag, key, bound):
    v = num(res, tag, key)
    return v is not None and v < bound


def gt(res, tag, key, bound):
    v = num(res, tag, key)
    return v is not None and v > bound


def cls(res, tag, key):
    """读类名类的采样值(如 markCls=in / out)"""
    m = re.search(re.escape(key) + r"([a-z-]+)", res.get(tag, ""))
    return m.group(1) if m else None


def beat(res, tag, name):
    """读开场节拍回显 beats[on2.52 spin4.32 off4.32 land6.92] 里的一个值。

    这些是 JS 每拍只写一次的 dataset,是**实测**相对秒数(相对 launchAt),
    比在 Python 里重推参数表可靠 —— 参数改了这里自动跟着变。
    """
    m = re.search(r"beats\[[^\]]*?" + name + r"([\d.]+)", res.get(tag, ""))
    return float(m.group(1)) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default=None)
    ap.add_argument("--skip-entry", action="store_true", help="跳过真实开场那趟")
    ap.add_argument("--only-entry", action="store_true", help="只跑真实开场那趟")
    args = ap.parse_args()

    chrome = find_chrome(args.chrome)
    if not chrome:
        sys.exit("找不到 Chrome / Edge。用 --chrome 指定路径,或设环境变量 CHROME_PATH。")

    bad = 0
    err = ""

    # ── 第一趟:状态机 ──────────────────────────────────────
    if not args.only_entry:
        print("=" * 64)
        print("第一趟 · 双态状态机(降级动画,直取终态)")
        print("=" * 64)
        dom = run(chrome, HOOK_STATE, 760, 560, 20000, True, 300)
        res = parse(attr(dom, "zoom-log"))
        if not res:
            print("没有拿到采样。body 片段:", dom[:300])
            return 1
        for tag, body in res.items():
            print(f"  {tag:<20} {body}")
        err = attr(dom, "ring-error")

        checks = [
            ("A 开场收势停在聚焦(zoom=1)", eq(res, "A-开场终态(聚焦)", "zoom", 1)),
            ("A 聚焦类名已开(isZoom=1)", eq(res, "A-开场终态(聚焦)", "isZoom", 1)),
            ("A 字标未登场(markOp<0.02)", lt(res, "A-开场终态(聚焦)", "markOp", 0.02)),
            ("B ESC 退回整体(isZoom=0)", eq(res, "B-ESC后(整体)", "isZoom", 0)),
            ("B 字标回到环心(markOp>0.9)", gt(res, "B-ESC后(整体)", "markOp", 0.9)),
            ("B 字标处于淡入态(markCls=in)", cls(res, "B-ESC后(整体)", "markCls") == "in"),
            ("C 点击后进入聚焦(isZoom=1)", eq(res, "C-点击后(聚焦)", "isZoom", 1)),
            ("C 字标先消失(markOp<0.02)", lt(res, "C-点击后(聚焦)", "markOp", 0.02)),
            ("C 字标处于淡出态(markCls=out)", cls(res, "C-点击后(聚焦)", "markCls") == "out"),
            ("D 双指收缩退回整体(isZoom=0)", eq(res, "D-双指收缩后(整体)", "isZoom", 0)),
            ("D 字标回到环心(markOp>0.9)", gt(res, "D-双指收缩后(整体)", "markOp", 0.9)),
            ("D 字标处于淡入态(markCls=in)", cls(res, "D-双指收缩后(整体)", "markCls") == "in"),
        ]
        print("-" * 64)
        for name, ok in checks:
            print(("  [ok] " if ok else "  [!!] ") + name)
            if not ok:
                bad += 1

    # ── 第二趟:真实开场时间线 ───────────────────────────────
    if not args.skip_entry:
        print()
        print("=" * 64)
        print("第二趟 · 真实开场时间线(自动转圈 → 字标浮现 → 转进大图)")
        print("=" * 64)
        # 预算必须给得很大:软件渲染下虚拟时钟走得远比预算慢
        # (40000 只够 ~3.3s 页面时间)。视口越小越省,420x320 + 500000
        # 实测 21s 真实耗时就能跑完 ~10s 的开场
        dom2 = run(chrome, HOOK_ENTRY, 420, 320, 500000, False, 600)
        res2 = parse(attr(dom2, "zoom-log"))
        if not res2:
            print("没有拿到采样。body 片段:", dom2[:300])
            bad += 1
        else:
            for tag, body in res2.items():
                print(f"  {tag:<20} {body}")
            print("-" * 64)
            # 节拍只在 E2 读:那一刻四拍都已写完,数值是最终的
            on = beat(res2, "E2-开场结束(聚焦)", "on")
            spin = beat(res2, "E2-开场结束(聚焦)", "spin")
            off = beat(res2, "E2-开场结束(聚焦)", "off")
            land = beat(res2, "E2-开场结束(聚焦)", "land")
            e2 = [
                ("E1 环转到位时仍是整体圆环(zoom=0)",
                 eq(res2, "E1-字标浮现(整环)", "zoom", 0)),
                ("E1 此刻未进聚焦(isZoom=0)",
                 eq(res2, "E1-字标浮现(整环)", "isZoom", 0)),
                ("E1 字标已在环心(mark=1)",
                 eq(res2, "E1-字标浮现(整环)", "mark", 1)),
                ("E1 字标处于淡入态(markCls=in)",
                 cls(res2, "E1-字标浮现(整环)", "markCls") == "in"),
                # ── 字标退场的**时机**:锚转圈起点,不是环落地 ──
                # 这四个数都是 JS 每拍写一次的实测秒数,改参数不用同步这里
                ("字标退场与转圈起点对齐(|off-spin|≤0.15)",
                 off is not None and spin is not None
                 and abs(off - spin) <= 0.15),
                ("字标不是陪着转完才走(land-off≥2.0)",
                 land is not None and off is not None
                 and (land - off) >= 2.0),
                ("浮现到退场留足窗口(off-on≥1.5)",
                 on is not None and off is not None and (off - on) >= 1.5),
                ("E1b 退场时缩进还没起来(zoom<0.15)",
                 lt(res2, "E1b-字标开始退场", "zoom", 0.15)),
                ("E2 开场结束落在聚焦(zoom=1)",
                 eq(res2, "E2-开场结束(聚焦)", "zoom", 1)),
                ("E2 聚焦类名已开(isZoom=1)",
                 eq(res2, "E2-开场结束(聚焦)", "isZoom", 1)),
                ("E2 字标已退场(markOp<0.02)",
                 lt(res2, "E2-开场结束(聚焦)", "markOp", 0.02)),
                ("E2 字标处于淡出态(markCls=out)",
                 cls(res2, "E2-开场结束(聚焦)", "markCls") == "out"),
            ]
            for name, ok in e2:
                print(("  [ok] " if ok else "  [!!] ") + name)
                if not ok:
                    bad += 1
            err = err or attr(dom2, "ring-error")

    print()
    if err:
        print(f"[失败] 环廊抛错:{err}")
        return 1
    if bad:
        print(f"[失败] {bad} 项不符预期。")
        return 1
    print("[通过] 开场收势 + 双态切换全部符合预期。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

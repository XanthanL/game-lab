"""临时诊断脚本：量化 testing-example 中 5 个站点的 token 同质化程度。"""
import re

SITES = [
    ("acute-angle", "acute-angle/design-system/tokens.css", "acute-angle/design-system/MASTER.md"),
    ("hongda", "hongda-auto-repair/site/css/tokens.css", "hongda-auto-repair/design-system/MASTER.md"),
    ("shihua", "shihua/design-system/tokens.css", "shihua/design-system/MASTER.md"),
    ("maimang", "maimang-site/styles/tokens.css", "maimang-site/design-system/MASTER.md"),
    ("tutuhuahua", "tutuhuahua/css/tokens.css", "tutuhuahua/design-system/MASTER.md"),
]

VAR = re.compile(r"--([a-zA-Z0-9\-_]+)\s*:\s*([^;{}\n]+)")
ANCHOR = re.compile(r"(swiss-utility|provisions-label|museum-modern|editorial-print|warm-hospitality|diagonal)")

data = {}
for name, css, _ in SITES:
    txt = open(css, encoding="utf-8").read()
    idx = txt.find(":root")
    body = txt[idx:] if idx >= 0 else txt
    d = {}
    for m in VAR.finditer(body):
        k = "--" + m.group(1)
        v = re.sub(r"/\*.*", "", m.group(2)).strip()
        if k not in d:
            d[k] = v
    data[name] = d

KEYS = [
    "--bg", "--fg", "--muted", "--line", "--accent",
    "--font-display", "--font-body",
    "--fs-base", "--fs-display", "--lh-base",
    "--space-1", "--radius", "--measure", "--axis",
]

print("变量".ljust(16) + "唯一".ljust(6) + "重合")
print("-" * 58)
summary = []
for k in KEYS:
    vals = [data[s].get(k, "(缺)") for s, _, _ in SITES]
    uniq = len(set(vals))
    summary.append((k, uniq))
    print(k.ljust(16) + str(uniq).ljust(6) + f"{len(vals)-uniq}/{len(vals)}")

print()
print("=" * 58)
print("取值明细（唯一值 ≤ 2 的变量）")
print("=" * 58)
for k, uniq in summary:
    if uniq > 2:
        continue
    print(f"\n{k}   ← {uniq} 个唯一值")
    for s, _, _ in SITES:
        print(f"    {s.ljust(14)} {data[s].get(k, '(缺)')[:76]}")

print()
print("=" * 58)
print("锚点 / 字体搭配 / 视觉签名")
print("=" * 58)
for s, css, master in SITES:
    try:
        t = open(master, encoding="utf-8").read()
    except FileNotFoundError:
        t = ""
    a = ANCHOR.search(t) or ANCHOR.search(open(css, encoding="utf-8").read())
    d = data[s]
    fd = d.get("--font-display", "(缺)")
    fb = d.get("--font-body", "(缺)")

    def first(stack):
        m = re.match(r'\s*"?([^",]+)"?', stack)
        return m.group(1).strip() if m else stack

    same = "相同" if fd == fb else "不同"
    sig = "有" if "视觉签名" in t else "缺失"
    print(f"  {s.ljust(14)} 锚点={str(a.group(1) if a else '?'):<17} "
          f"display={first(fd)[:22]:<24} body={first(fb)[:20]:<22} {same:<4} 签名={sig}")

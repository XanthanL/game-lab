#!/usr/bin/env node
/* ==================================================================
   皮肤清单一致性自检（node tools/check-skins.js）
   退出码 0 = 全部一致，1 = 有不一致（CI 可直接用）

   一套皮肤要落地，得同时登记在四个地方，漏一处就是「静默降级」：
     1. assets/i18n.js 的 GROUPS   —— 唯一事实源，STYLES 由它派生
     2. assets/i18n.js 的 SMETA    —— 缺了标签就显示成 undefined
     3. assets/index.css           —— 缺了 :root[data-style="KEY"] 就是无样式
     4. 各页内联的 var OK = [...]    —— 缺了这一页会把用户选的皮肤丢掉、回退默认
   前两处互相挨着不易漏，后两处是重灾区：加 klein 时漏了 4 个页，
   加 borderlands 时又差点漏掉 persona。所以脚本来守。
================================================================== */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = path.resolve(__dirname, "..");

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }

/* 要扫的页面：根目录下所有 html + persona 子页 + 样例站点索引。
   只扫这三处，避免踩进 ARH / golden-wind / XanthanLMusic 这些 vendored 大目录。 */
function pages() {
  var out = fs.readdirSync(ROOT)
    .filter(function (f) { return /\.html?$/.test(f); })
    .map(function (f) { return f; });
  ["persona"].forEach(function (dir) {
    var p = path.join(ROOT, dir);
    if (!fs.existsSync(p)) return;
    fs.readdirSync(p)
      .filter(function (f) { return /\.html?$/.test(f); })
      .forEach(function (f) { out.push(dir + "/" + f); });
  });
  var te = "testing-example/index.html";
  if (fs.existsSync(path.join(ROOT, te))) out.push(te);
  return out;
}

var fail = 0;
function ok(msg)   { console.log("  \u2713 " + msg); }
function bad(msg)  { fail++; console.log("  \u2717 " + msg); }

/* ---- 1/2. i18n.js：GROUPS 派生 STYLES，SMETA 必须双向覆盖 ---- */
console.log("\n[1] assets/i18n.js");
var i18n = read("assets/i18n.js");
var GROUPS = eval("[" + i18n.match(/var GROUPS = \[([\s\S]*?)\n  \];/)[1] + "]");
var STYLES = GROUPS.reduce(function (a, g) { return a.concat(g.styles); }, []);
var dupes = STYLES.filter(function (k, i) { return STYLES.indexOf(k) !== i; });
if (dupes.length) bad("GROUPS 里有重复键：" + dupes.join(", "));
else ok("GROUPS " + GROUPS.length + " 组 → STYLES " + STYLES.length + " 套，无重复");

var SMETA = eval("(" + i18n.match(/var SMETA = (\{[\s\S]*?\n  \});/)[1] + ")");
var noMeta = STYLES.filter(function (k) { return !SMETA[k]; });
var extraMeta = Object.keys(SMETA).filter(function (k) { return STYLES.indexOf(k) === -1; });
if (noMeta.length) bad("SMETA 缺少：" + noMeta.join(", ")); else ok("SMETA 覆盖全部 " + STYLES.length + " 套");
if (extraMeta.length) bad("SMETA 多出（GROUPS 里没有）：" + extraMeta.join(", "));

/* 皮肤数量注释（"风格：NN 套皮肤"）也不能说谎 */
var m = i18n.match(/风格：(\d+) 套皮肤/);
if (m && Number(m[1]) !== STYLES.length) bad("i18n.js 注释写的是 " + m[1] + " 套，实际 " + STYLES.length + " 套");
else if (m) ok("数量注释与实际一致（" + STYLES.length + " 套）");

/* ---- 3. index.css：每套皮肤都得有 :root[data-style="KEY"] 主块 ---- */
console.log("\n[2] assets/index.css");
var css = read("assets/index.css");
var noCss = STYLES.filter(function (k) {
  return css.indexOf(':root[data-style="' + k + '"]') === -1;
});
if (noCss.length) bad("CSS 里没有主块：" + noCss.join(", "));
else ok("全部 " + STYLES.length + " 套都有 :root[data-style=...] 主块");

/* ---- 4. 各页内联白名单 ---- */
console.log("\n[3] 各页内联 var OK 白名单");
var scanned = 0, withList = 0;
pages().forEach(function (p) {
  var html = read(p);
  var mm = html.match(/var OK = \[([\s\S]*?)\];/);
  if (!mm) return;
  scanned++; withList++;
  var list = eval("[" + mm[1] + "]");
  var miss = STYLES.filter(function (k) { return list.indexOf(k) === -1; });
  var extra = list.filter(function (k) { return STYLES.indexOf(k) === -1; });
  if (miss.length || extra.length) {
    bad(p + "（" + list.length + " 项）缺: " + (miss.join(",") || "—") + " / 多: " + (extra.join(",") || "—"));
  } else {
    ok(p + " — " + list.length + " 项，与权威清单一致");
  }
});
console.log("  （共扫 " + scanned + " 个页面文件，其中 " + withList + " 个带皮肤白名单）");

console.log("\n" + (fail ? "✗ " + fail + " 项不一致" : "✓ 全部一致"));
process.exit(fail ? 1 : 0);

/* 解锁：签发清单 + 单向指纹（v9 起）
 * ------------------------------------------------------------------
 * 一个码长这样：body(10 位) + chk(2 位) = 12 位，字符取自 Crockford base32
 * （0-9 + 22 个字母，不含 I / L / O / U，免得手抄时 1 和 I 分不清）。
 *
 *   chk = b32(fnv1a(SALT_C + body) % 32²)                      挡改字符、挡手滑打错
 *   fp  = b32(fnv1a(SALT_A + body) % 32³) + b32(fnv1a(SALT_B + body) % 32³)
 *
 * 站点里只有 fp 这一个数组（data.js 的 keyfps），一个完整码都没有。
 * 原文台账在 产出/keys.csv —— 那份绝不进公开仓，发货链接全从那儿取。
 *
 * ⚠️ 这是前端的**唯一一份**实现：主页 app.js 与练习本 pack.html 都从这儿取。
 *    2026-10-08 之前它写在 app.js 里。练习本也要校验 URL 上的码，若各写一份，
 *    两份实现必然漂移（改了一处忘了另一处 = 发货链接有一半打不开）。
 *    产出/_selftest.js 里另有一份算法副本，那份是**独立校验**用的，故意不共用。
 *
 * 这层设计能挡什么、挡不了什么，写下来免得以后反复纠结：
 *   挡得住：改一位字符、手滑打错、瞎猜一个码。要合法通过得先撞对一个 10 位 body，
 *           概率约 1/32^10 ≈ 1/1.1e15，本地枚举得跑几个月。
 *   挡不住：① 买家把链接转发给别人——这是交付方式自带的性质，跟码的强度无关；
 *           ② 有人铁了心要把整个 body 空间枚举一遍，那要 1.1e15 次，不值得。
 * 纯前端校验的物理上限就在这儿：校验逻辑必然公开。改造真正买到的是
 * 「1296 个码全都能被算出来」变成「撞到一个码要几个月」。对这个客单价，够了。
 *
 * 补库存：python 产出/_keyissue.py 500 --append（会重写 data.js 的 KEYFPS 块）
 */
window.CKEY = (function () {
  var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var KEY_BODY = 10, KEY_CHK = 2, KEY_LEN = KEY_BODY + KEY_CHK;
  var SALT_LEGACY = 'cht2026x';   // 旧 6 位码专用，别动：朋友手上那条链接还在用
  var SALT_C = 'cht-check-v9';
  var SALT_A = 'cht-fp-a-v9';
  var SALT_B = 'cht-fp-b-v9';

  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  function b32(n, width) {
    var out = '';
    for (var i = 0; i < width; i++) { out = B32.charAt(n & 31) + out; n >>>= 5; }
    return out;
  }
  /* 旧通道（6 位 = 2 位订单尾号 + 4 位签名）：已停止签发，只保留放行。 */
  function signature(body) {
    return (fnv1a(body + SALT_LEGACY) % 1679616).toString(36).toUpperCase().padStart(4, '0');
  }
  function checksum(body) {
    return b32(fnv1a(SALT_C + body) % 1024, KEY_CHK);
  }
  function fingerprint(body) {
    return b32(fnv1a(SALT_A + body) % 32768, 3) + b32(fnv1a(SALT_B + body) % 32768, 3);
  }

  /* valid(k, fps) —— fps 传 data.js 的 keyfps 数组（缺省当空清单，一律不通过）。
     刻意不导出任何「生成码」的函数：码必须由本地签发脚本产出并写进 keyfps，
     前端一旦能自造，清单就失去意义了（那正是旧版 1296 个码可被整体算出的问题）。*/
  function valid(k, fps) {
    if (typeof k !== 'string') return false;
    k = k.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (k.length === 6 && /^[0-9A-Z]{6}$/.test(k)) {
      return signature(k.slice(0, 2)) === k.slice(2);        // 旧码，兼容通道
    }
    if (k.length !== KEY_LEN) return false;
    for (var i = 0; i < KEY_LEN; i++) {
      if (B32.indexOf(k.charAt(i)) < 0) return false;        // 字符集不含 I / L / O / U
    }
    var body = k.slice(0, KEY_BODY);
    if (checksum(body) !== k.slice(KEY_BODY)) return false;
    return ((fps || []).indexOf(fingerprint(body)) >= 0);
  }

  /* head(k) —— 只用来显示「码 XXXX…」，绝不整条显示 */
  function head(k) {
    if (typeof k !== 'string') return '';
    return k.length > 6 ? k.slice(0, 4) + '…' : k.slice(0, 2);
  }

  return { valid: valid, head: head, LEN: KEY_LEN, BODY: KEY_BODY, B32: B32 };
})();

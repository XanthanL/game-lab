/* ============================================================
 * 《妖怪夜市》sprites.js —— 像素角色与道具
 * 每个精灵由字符矩阵 + 调色板定义，'.' 表示透明
 * ============================================================ */

window.SPRITES = (function () {
  "use strict";

  /* ---------- 精灵定义 ---------- */
  const DEFS = {

    /* 小满：穿黄色雨衣的人类小孩（两帧走路动画） */
    child: {
      pal: { k: "#1a1026", h: "#5a3a22", s: "#ffd9b0", e: "#20140f",
             c: "#ff9a90", y: "#ffd23e", d: "#d9a41f", p: "#4a3a6a",
             r: "#c8373d" },
      frames: [
        [
          "....kkkk....",
          "...khhhhk...",
          "..khhhhhhk..",
          "..kssssssk..",
          "..ksesessk..",
          "..kssccssk..",
          "...kssssk...",
          "..kyyyyyyk..",
          ".kyydyydyyk.",
          ".kyyyyyyyyk.",
          "kskyyyyyyksk",
          ".k.kyyyyk.k.",
          "...kppppk...",
          "...kpkpkp...",
          "...krk.krk..",
          "...kk...kk..",
        ],
        [
          "....kkkk....",
          "...khhhhk...",
          "..khhhhhhk..",
          "..kssssssk..",
          "..ksesessk..",
          "..kssccssk..",
          "...kssssk...",
          "..kyyyyyyk..",
          ".kyydyydyyk.",
          ".kyyyyyyyyk.",
          "kskyyyyyyksk",
          ".k.kyyyyk.k.",
          "...kppppk...",
          "...kpkpkp...",
          "..krk...krk.",
          ".kk......kk.",
        ],
      ],
    },

    /* 阿昆：围着红围巾的白狐 */
    fox: {
      pal: { k: "#1a1026", w: "#f5f0e8", g: "#d8cfc0", e: "#20140f",
             n: "#3a2a2a", r: "#c8373d", o: "#f5f0e8" },
      frames: [
        [
          ".kk......kk.....",
          ".kwk....kwk.....",
          ".kwwk..kwwk.....",
          "..kwwkkwwk......",
          "..kwwwwwwk......",
          "..kwekwekk......",
          "...kwwnnk.......",
          "..kwwwwwwk......",
          ".krrrwwrrrk.....",
          ".k.kwwwwk.k.....",
          "..kwwwwwwk..kk..",
          "..kwk..kwk.kwwk.",
          "..kk....kk.kwgk.",
          "...........kkk..",
        ],
        [
          ".kk......kk.....",
          ".kwk....kwk.....",
          ".kwwk..kwwk.....",
          "..kwwkkwwk......",
          "..kwwwwwwk......",
          "..kwekwekk......",
          "...kwwnnk.......",
          "..kwwwwwwk..kk..",
          ".krrrwwrrrk.kwk.",
          ".k.kwwwwk.kkwwk.",
          "..kwwwwwwk.kwgk.",
          "..kwk..kwk.kkk..",
          "..kk....kk......",
          "................",
        ],
      ],
    },

    /* 灯笼小僧：会走路的灯笼妖怪 */
    lantern: {
      pal: { k: "#1a1026", o: "#ff9c3f", O: "#ffd23e", e: "#4a1a0a",
             m: "#c8373d", f: "#7a4a22" },
      frames: [
        [
          "....kfk....",
          "...kkkkk...",
          "..koooook..",
          ".koOOOOOok.",
          ".koOeOeOok.",
          ".koOOOOOok.",
          ".koOmmmOok.",
          ".koOOOOOok.",
          "..koooook..",
          "...kkkkk...",
          "....k.k....",
          "...kk.kk...",
        ],
        [
          "....kfk....",
          "...kkkkk...",
          "..koooook..",
          ".koOOOOOok.",
          ".koOOOOOok.",
          ".koeOeOeok.",
          ".koOOmOOok.",
          ".koOOOOOok.",
          "..koooook..",
          "...kkkkk...",
          "....k.k....",
          "....kkkk...",
        ],
      ],
    },

    /* 伞妖：独足的唐伞 */
    umbrella: {
      pal: { k: "#1a1026", u: "#7a5ab0", U: "#5a3f8a", e: "#20140f",
             t: "#ff8a9a", f: "#d8cfc0", s: "#ffd9b0" },
      frames: [
        [
          "......kk......",
          "...kkkUkkk....",
          "..kuuUUUuuk...",
          ".kuuuuUuuuuk..",
          "kuuuuuUuuuuuk.",
          ".kkkkkkkkkkkk.",
          ".....keke.....",
          ".....kttk.....",
          "......kk......",
          "......kf......",
          "......kf......",
          ".....kffk.....",
        ],
      ],
    },

    /* 提灯屋摊主：大个儿的青鬼摊主 */
    oni: {
      pal: { k: "#1a1026", g: "#5ab07a", G: "#3f8a5a", e: "#20140f",
             h: "#f5f0e8", r: "#c8373d", w: "#f5f0e8" },
      frames: [
        [
          "..khk....khk..",
          "...kggggggk...",
          "..kggggggggk..",
          "..kgekggkegk..",
          "..kggggggggk..",
          "..kgkwwwwkgk..",
          "...kggggggk...",
          ".kggggggggggk.",
          "kgkgrrrrrrkgk.",
          "kgkgggggggkgk.",
          ".k.kggggggk.k.",
          "...kggggggk...",
          "...kgk..kgk...",
          "...kk....kk...",
        ],
      ],
    },

    /* 道具：纸灯笼 */
    paperLantern: {
      pal: { k: "#1a1026", r: "#e8443d", R: "#c8373d", O: "#ffd23e", f: "#7a4a22" },
      frames: [
        [
          "..kfk..",
          ".kkkkk.",
          "krOrOrk",
          "krOrOrk",
          ".kkkkk.",
          "..kfk..",
        ],
      ],
    },

    /* 道具：面具摊上的狐狸面具 */
    mask: {
      pal: { k: "#1a1026", w: "#f5f0e8", r: "#c8373d", e: "#20140f" },
      frames: [
        [
          ".kk..kk.",
          ".kwkkwk.",
          "kwwwwwwk",
          "kwerewwk",
          ".kwrrwk.",
          "..kwwk..",
        ],
      ],
    },
  };

  /* ---------- 离屏画布缓存 ---------- */
  const cache = {};

  function build(name, frame, flip) {
    const def = DEFS[name];
    if (!def) return null;
    const rows = def.frames[frame % def.frames.length];
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const c = cv.getContext("2d");
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === "." || !def.pal[ch]) continue;
        const dx = flip ? w - 1 - x : x;
        c.fillStyle = def.pal[ch];
        c.fillRect(dx, y, 1, 1);
      }
    }
    return cv;
  }

  function get(name, frame = 0, flip = false) {
    const key = `${name}|${frame}|${flip ? 1 : 0}`;
    if (!cache[key]) cache[key] = build(name, frame, flip);
    return cache[key];
  }

  function size(name) {
    const def = DEFS[name];
    if (!def) return { w: 0, h: 0 };
    const rows = def.frames[0];
    return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
  }

  return { get, size, DEFS };
})();

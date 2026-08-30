/* ============================================================
   gallery.js — 静态 / 交互式场景
   · 图像转 ASCII (image)
   · ASCII 大字生成 (banner)
   · 手绘艺术画廊 (gallery)
   ============================================================ */

(function (global) {
  "use strict";
  const { M } = global.ASCII;
  const scenes = global.ASCII_SCENES;

  /* ------------------------------------------------------------
     图像转 ASCII
     ------------------------------------------------------------ */
  const imageScene = {
    id: "image",
    name: "图像转字符",
    badge: "IO",
    _ascii: null,
    _placeholder: true,
    init(fb) {
      if (!this._ascii) this._buildPlaceholder(fb);
    },
    _buildPlaceholder(fb) {
      const lines = [
        "",
        "   ┌──────────────────────────────┐",
        "   │                              │",
        "   │      拖入 / 选择 一张图片      │",
        "   │                              │",
        "   │     右侧面板 → 图像转 ASCII    │",
        "   │                              │",
        "   │        ▚▞  IMAGE → TEXT       │",
        "   │                              │",
        "   └──────────────────────────────┘",
        "",
      ];
      this._ascii = lines;
    },
    // 由 main.js 调用：给定 <img>，采样为 ASCII
    convert(img, fb, ramp, invert) {
      ramp = ramp || " .:-=+*#%@";
      const cols = fb.cols, rows = fb.rows;
      const cvs = document.createElement("canvas");
      cvs.width = cols; cvs.height = rows;
      const ctx = cvs.getContext("2d", { willReadFrequently: true });
      // 保持纵横比，字符高宽比≈2
      const imgRatio = img.width / img.height;
      const cellRatio = cols / (rows * 2);
      let dw = cols, dh = rows, dx = 0, dy = 0;
      if (imgRatio > cellRatio) {
        dh = Math.round(cols / imgRatio / 2);
        dy = Math.round((rows - dh) / 2);
      } else {
        dw = Math.round(rows * 2 * imgRatio);
        dx = Math.round((cols - dw) / 2);
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, cols, rows);
      ctx.drawImage(img, dx, dy, dw, dh);
      const data = ctx.getImageData(0, 0, cols, rows).data;
      const out = [];
      for (let y = 0; y < rows; y++) {
        let row = "";
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          let lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          if (invert) lum = 1 - lum;
          row += M.rampChar(ramp, lum);
        }
        out.push(row);
      }
      this._ascii = out;
      this._placeholder = false;
    },
    render(fb, t, frame) {
      if (!this._ascii) this._buildPlaceholder(fb);
      const rows = this._ascii;
      const startY = Math.max(0, ((fb.rows - rows.length) / 2) | 0);
      for (let y = 0; y < rows.length; y++) {
        const line = rows[y];
        const startX = Math.max(0, ((fb.cols - line.length) / 2) | 0);
        for (let x = 0; x < line.length; x++) {
          fb.set(startX + x, startY + y, line[x], (line.charCodeAt(x) % 20) / 20);
        }
      }
    },
  };
  scenes.push(imageScene);
  global.ASCII_IMAGE_SCENE = imageScene;

  /* ------------------------------------------------------------
     ASCII 大字生成 (5 行块字体)
     ------------------------------------------------------------ */
  const FONT = buildFont();
  const bannerScene = {
    id: "banner",
    name: "ASCII 大字",
    badge: "TXT",
    _text: "HELLO",
    _t0: 0,
    setText(s) { this._text = (s || "").toUpperCase(); },
    render(fb, t, frame) {
      const rows = renderBanner(this._text);
      // 竖直居中并轻微上下浮动
      const bob = Math.round(Math.sin(t * 1.5) * 1.5);
      const startY = Math.max(0, ((fb.rows - rows.length) / 2 | 0) + bob);
      for (let y = 0; y < rows.length; y++) {
        const line = rows[y];
        const startX = Math.max(0, (fb.cols - line.length) / 2 | 0);
        for (let x = 0; x < line.length; x++) {
          if (line[x] !== " ") {
            // 波浪高亮
            const lum = 0.5 + 0.5 * Math.sin(x * 0.2 + t * 3);
            fb.set(startX + x, startY + y, line[x], lum);
          }
        }
      }
    },
  };
  scenes.push(bannerScene);
  global.ASCII_BANNER_SCENE = bannerScene;

  function renderBanner(text) {
    const rows = ["", "", "", "", ""];
    for (const chRaw of text) {
      const ch = FONT[chRaw] ? chRaw : (FONT[chRaw.toUpperCase()] ? chRaw.toUpperCase() : " ");
      const glyph = FONT[ch] || FONT[" "];
      for (let r = 0; r < 5; r++) rows[r] += glyph[r] + " ";
    }
    return rows;
  }

  /* 紧凑 5x? 块字体，'#'为实心 */
  function buildFont() {
    const raw = {
      "A": ["███","█ █","███","█ █","█ █"],
      "B": ["██ ","█ █","██ ","█ █","██ "],
      "C": ["███","█  ","█  ","█  ","███"],
      "D": ["██ ","█ █","█ █","█ █","██ "],
      "E": ["███","█  ","██ ","█  ","███"],
      "F": ["███","█  ","██ ","█  ","█  "],
      "G": ["███","█  ","█ █","█ █","███"],
      "H": ["█ █","█ █","███","█ █","█ █"],
      "I": ["███"," █ "," █ "," █ ","███"],
      "J": ["███","  █","  █","█ █","███"],
      "K": ["█ █","█ █","██ ","█ █","█ █"],
      "L": ["█  ","█  ","█  ","█  ","███"],
      "M": ["█ █","███","███","█ █","█ █"],
      "N": ["█ █","██","█ █","█ █","█ █"],
      "O": ["███","█ █","█ █","█ █","███"],
      "P": ["███","█ █","███","█  ","█  "],
      "Q": ["███","█ █","█ █","███","  █"],
      "R": ["██ ","█ █","██ ","█ █","█ █"],
      "S": ["███","█  ","███","  █","███"],
      "T": ["███"," █ "," █ "," █ "," █ "],
      "U": ["█ █","█ █","█ █","█ █","███"],
      "V": ["█ █","█ █","█ █"," █ "," █ "],
      "W": ["█ █","█ █","███","███","█ █"],
      "X": ["█ █"," █ "," █ "," █ ","█ █"],
      "Y": ["█ █","█ █"," █ "," █ "," █ "],
      "Z": ["███","  █"," █ ","█  ","███"],
      "0": ["███","█ █","█ █","█ █","███"],
      "1": [" █ ","██ "," █ "," █ ","███"],
      "2": ["███","  █","███","█  ","███"],
      "3": ["███","  █","███","  █","███"],
      "4": ["█ █","█ █","███","  █","  █"],
      "5": ["███","█  ","███","  █","███"],
      "6": ["███","█  ","███","█ █","███"],
      "7": ["███","  █"," █ "," █ "," █ "],
      "8": ["███","█ █","███","█ █","███"],
      "9": ["███","█ █","███","  █","███"],
      " ": ["   ","   ","   ","   ","   "],
      "!": [" █ "," █ "," █ ","   "," █ "],
      "?": ["███","  █"," ██","   "," █ "],
      ".": ["   ","   ","   ","   "," █ "],
      "-": ["   ","   ","███","   ","   "],
      "+": ["   "," █ ","███"," █ ","   "],
      "∴": ["   "," █ ","   ","█ █","   "],
    };
    // 归一化到等宽 3
    const font = {};
    for (const k in raw) {
      font[k] = raw[k].map((r) => (r + "   ").slice(0, 3));
    }
    return font;
  }

  /* ------------------------------------------------------------
     手绘艺术画廊 — 幻灯轮播 + 打字机效果
     ------------------------------------------------------------ */
  const ART = [
    {
      title: "猫 / CAT",
      art: [
        "   /\\_/\\  ",
        "  ( o.o ) ",
        "   > ^ <  ",
        "  /     \\ ",
        " (  ___  )",
        "  |_|-|_| ",
      ],
    },
    {
      title: "飞船 / SHIP",
      art: [
        "        !          ",
        "        !          ",
        "        ^          ",
        "       / \\         ",
        "      /___\\        ",
        "     |=   =|       ",
        "     |     |       ",
        "     |     |       ",
        "    /| ### |\\      ",
        "   / | ### | \\     ",
        "  /__|_###_|__\\    ",
        " |___|(o o)|___|   ",
        "     /  o  \\       ",
        "    /   o   \\      ",
        "   *    *    *     ",
      ],
    },
    {
      title: "咖啡 / COFFEE",
      art: [
        "      ) ) )       ",
        "     ( ( (        ",
        "    ........      ",
        "    |      |]     ",
        "    \\      /      ",
        "     `----'       ",
        "   ~ 咖啡时间 ~    ",
      ],
    },
    {
      title: "骷髅 / SKULL",
      art: [
        "     ______       ",
        "  .-'      '-.    ",
        " /            \\   ",
        "|  .--.  .--.  |  ",
        "|  |  |  |  |  |  ",
        "|  '--'  '--'  |  ",
        " \\    .--.    /   ",
        "  '.  '--'  .'    ",
        "    '------'      ",
        "    | | | | |     ",
      ],
    },
    {
      title: "山水 / LANDSCAPE",
      art: [
        "        /\\            /\\      ",
        "       /  \\    /\\    /  \\     ",
        "      /    \\  /  \\  /    \\    ",
        "     /______\\/____\\/______\\   ",
        "    ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~   ",
        "   ~ ~  ⛵  ~ ~ ~ ~  ⛵  ~ ~ ~ ",
        "  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ",
      ],
    },
    {
      title: "ASCII LAB",
      art: [
        " █████╗ ███████╗ ██████╗██╗██╗",
        "██╔══██╗██╔════╝██╔════╝██║██║",
        "███████║███████╗██║     ██║██║",
        "██╔══██║╚════██║██║     ██║██║",
        "██║  ██║███████║╚██████╗██║██║",
        "╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝╚═╝",
        "        ·  L A B  ·           ",
      ],
    },
  ];

  const galleryScene = {
    id: "gallery",
    name: "艺术画廊",
    badge: "ART",
    init() { this._page = -1; },
    render(fb, t, frame) {
      const holdTime = 4.5;                 // 每张停留秒数
      const page = Math.floor(t / holdTime);
      const idx = ((page % ART.length) + ART.length) % ART.length;
      const piece = ART[idx];
      const cycle = t - page * holdTime;    // 本张已停留时间

      // 打字机推进（前 40% 时间完成显示）
      const total = piece.art.reduce((s, l) => s + l.length, 0);
      const revealChars = Math.min(total, Math.ceil((cycle / (holdTime * 0.4)) * total));

      const startY = Math.max(0, (fb.rows - piece.art.length - 3) / 2 | 0);
      // 标题
      const title = "『 " + piece.title + " 』";
      const tx = Math.max(0, (fb.cols - title.length) / 2 | 0);
      fb.text(tx, startY, title, 1);

      let counted = 0;
      let done = false;
      for (let y = 0; y < piece.art.length && !done; y++) {
        const line = piece.art[y];
        const sx = Math.max(0, (fb.cols - line.length) / 2 | 0);
        for (let x = 0; x < line.length; x++) {
          if (counted >= revealChars) {
            // 打字机光标
            if ((frame >> 2) % 2 === 0) fb.set(sx + x, startY + 2 + y, "▊", 1);
            done = true; break;
          }
          fb.set(sx + x, startY + 2 + y, line[x], 0.6 + (x % 5) / 10);
          counted++;
        }
      }

      // 进度点
      const dots = ART.map((_, i) => (i === idx ? "●" : "·")).join(" ");
      fb.text((fb.cols - dots.length) / 2 | 0, startY + piece.art.length + 3, dots, 0.8);
    },
  };
  scenes.push(galleryScene);

})(window);

'use strict';
/* ═══════════════════════════════════════════════
   《最后一盏灯》各幕演出 —— 上屏 256x192 像素动画
   每个场景 draw(g, t, info)：t 为幕内已播放秒数
   info 携带当前台词信息，便于联动灯光强弱
   ═══════════════════════════════════════════════ */
const Scene = (() => {
  const W = 256, H = 192;
  const FLOOR = 158;             /* 街道地面顶部 */
  const starsA = makeStars(74, 7);
  const starsDim = makeStars(40, 19);

  /* ── 共用：夜空 + 月 + 星 + 远屋 + 街道 ── */
  function sky(g, colors) { bandedSky(g, colors); }
  function moon(g, x, y, t) {
    g.globalAlpha = 0.18;
    pDisc(g, x, y, 22, '#cfe0f0');
    g.globalAlpha = 1;
    pDisc(g, x, y, 13, '#eef3fb');
    pDisc(g, x - 4, y - 3, 3, '#d6deea');
    pDisc(g, x + 5, y + 4, 2, '#d6deea');
    pDisc(g, x + 2, y - 6, 1, '#d6deea');
  }
  function street(g) {
    g.fillStyle = '#0b0e16';
    g.fillRect(0, FLOOR, W, H - FLOOR);
    g.fillStyle = '#11151f';
    g.fillRect(0, FLOOR, W, 3);
    /* 石板纹理 */
    g.fillStyle = '#161b27';
    for (let i = 0; i < 26; i++) {
      const r = mulberry32(41 + i);
      const x = (r() * W) | 0, y = FLOOR + 6 + ((r() * (H - FLOOR - 8)) | 0);
      g.fillRect(x, y, 3, 1);
    }
  }
  /* 远处一排房屋剪影 */
  function townHouses(g, winLit) {
    const xs = [6, 44, 84, 126, 168, 210];
    xs.forEach((x, i) => house(g, x, FLOOR + 2, [34, 40, 36, 42, 38, 34][i], [44, 56, 40, 60, 46, 38][i], 100 + i, winLit));
  }

  /* ── 手持玻璃提灯（主要光源）：跟随点灯人移动 ── */
  function lantern(g, lx, ly, t, lit, dim = 1) {
    const flick = lit ? (0.82 + 0.18 * Math.sin(t * 7 + lx * 0.3)) * dim : 1;
    if (lit) {
      g.globalAlpha = 0.14 * flick;
      pEllipse(g, lx, ly + 8, 70, 44, '#ffd98a');
      g.globalAlpha = 0.09 * flick;
      pEllipse(g, lx, ly + 8, 120, 70, '#ffcf7a');
      g.globalAlpha = 0.5 * flick;
      pDisc(g, lx, ly, 9, '#ffd98a');
      g.globalAlpha = 1;
    }
    /* 金属提环与顶盖 */
    g.fillStyle = '#3a2a1a';
    g.fillRect(lx - 4, ly - 6, 9, 2);     /* 顶盖 */
    g.fillStyle = '#1c130b';
    g.fillRect(lx - 1, ly - 9, 3, 3);     /* 提环 */
    /* 玻璃罩 */
    g.fillStyle = lit ? '#3a2a1a' : '#241a12';
    g.fillRect(lx - 5, ly - 4, 11, 11);
    if (lit) {
      g.fillStyle = '#ffe9a8';
      g.fillRect(lx - 3, ly - 3, 7, 9);
      g.fillStyle = '#fff6d8';
      g.fillRect(lx - 1, ly - 2, 3, 6);
      g.globalAlpha = flick;
      g.fillStyle = '#ffcaa0';
      g.fillRect(lx, ly + 1, 1, 3);        /* 焰心 */
      g.globalAlpha = 1;
    } else {
      g.fillStyle = '#0e0a07';
      g.fillRect(lx - 3, ly - 3, 7, 9);
    }
    /* 底座 */
    g.fillStyle = '#3a2a1a';
    g.fillRect(lx - 4, ly + 7, 9, 2);
  }

  /* ── 点灯人（可持灯）──
     kx,ky 为人物左上角；bob 为上下浮动像素；lit 灯是否点亮 ── */
  function keeper(g, kx, ky, t, bob, lit) {
    const by = ky + bob;
    drawSprite(g, 'keeper', kx, by, 1, PAL);
    /* 持灯的长杆 + 灯 */
    const lx = kx + 9, ly = by - 13;
    pLine(g, kx + 5, by + 6, lx, ly + 2, '#2d1f14');
    pLine(g, kx + 5, by + 6, lx, ly + 2, '#4a3322');
    lantern(g, lx, ly, t, lit);
  }

  /* ── 孩子（可持小提灯）── */
  function child(g, cx, cy, t, bob, litLantern) {
    const by = cy + bob;
    drawSprite(g, 'child', cx, by, 1, PAL);
    if (litLantern) {
      drawSprite(g, 'lantern', cx + 6, by + 1, 1, PAL);
      const lx = cx + 10, ly = by + 6;
      g.globalAlpha = 0.12;
      pDisc(g, lx, ly, 6, '#ffd98a');
      g.globalAlpha = 1;
    }
  }

  /* ── 死去的路灯（场景道具，全部熄灭）── */
  function deadPosts(g, t) {
    [30, 66, 102, 138].forEach(x => lampPost(g, x, FLOOR + 2, FLOOR - 40, false, t));
  }

  /* ════════════ 标题 / 节目单背景 ════════════ */
  function title(g, t) {
    sky(g, ['#070a14', '#0a0f1e', '#0d1426', '#10182e']);
    drawStars(g, starsA, t, 0.9);
    moon(g, 206, 40, t);
    townHouses(g, 0.06);
    street(g);
    /* 舞台中央：一根最后路灯，灯亮着 */
    lampPost(g, 128, FLOOR + 2, FLOOR - 46, true, t);
    /* 点灯人倚在灯下（剪影） */
    g.globalAlpha = 0.9;
    drawSprite(g, 'keeper', 150, FLOOR - 14, 1, { '.': null, 'K': '#05070c', 'W': '#05070c', 'E': '#05070c', 'D': '#05070c' });
    g.globalAlpha = 1;
    /* 标题 */
    ptext(g, '最后一盏灯', 128, 40, 40, '#ffe9a8', 'center');
    g.globalAlpha = 0.9;
    ptext(g, PLAY.subtitle, 128, 86, 14, '#e0a14a', 'center');
    g.globalAlpha = 1;
    ptext(g, PLAY.credit, 128, 162, 8, '#7f93b0', 'center');
    if ((t | 0) % 2 === 0) ptext(g, '▲ 点击开始演出', 128, 178, 9, '#cfe3ff', 'center');
  }

  /* ════════════ 序幕 · 熄灭的城市 ════════════ */
  function prologue(g, t) {
    sky(g, ['#05070f', '#070b18', '#0a1020', '#0d1426']);
    drawStars(g, starsDim, t, 0.7);
    moon(g, 214, 34, t);
    townHouses(g, 0.05);
    street(g);
    deadPosts(g, t);
    /* 最后那根灯杆（此刻未点亮） */
    const lastX = 200;
    lampPost(g, lastX, FLOOR + 2, FLOOR - 46, false, t);
    const prog = Math.min(1, t / 13);
    const kx = 8 + prog * (lastX - 8 - 10);
    const bob = prog < 1 ? (Math.sin(t * 9) * 1) | 0 : 0;
    keeper(g, kx, FLOOR - 16, t, bob, false);
    /* 一只猫静坐在暗处 */
    drawSprite(g, 'cat', 24, FLOOR - 6, 1, PAL);
    /* 临近结尾，最后一盏灯杆轻颤（尚未点亮） */
    if (t > 14) {
      g.globalAlpha = 0.10 + 0.06 * Math.sin(t * 5);
      pEllipse(g, lastX, FLOOR - 4, 40, 24, '#ffcf7a');
      g.globalAlpha = 1;
    }
  }

  /* ════════════ 第一幕 · 点灯人 ════════════ */
  function light(g, t) {
    sky(g, ['#070a16', '#0a1020', '#0d1426', '#10182e']);
    drawStars(g, starsA, t, 0.85);
    moon(g, 214, 34, t);
    townHouses(g, 0.08);
    street(g);
    deadPosts(g, t);
    /* 点灯人立于最后灯杆下，火柴点燃 → 灯亮（约 3.5s 后点亮） */
    const lxLamp = 200;
    const lit = t > 3.5;
    const glowUp = lit ? Math.min(1, (t - 3.5) / 3) : 0;
    keeper(g, lxLamp - 22, FLOOR - 16, t, 0, lit);
    /* 该灯杆同步点亮 */
    lampPost(g, lxLamp, FLOOR + 2, FLOOR - 46, lit, t);
    if (lit && glowUp < 1) {
      g.globalAlpha = 0.12 * (1 - glowUp);
      pEllipse(g, lxLamp, FLOOR - 6, 30 + glowUp * 30, 18 + glowUp * 16, '#ffd98a');
      g.globalAlpha = 1;
    }
    /* 火柴微光（点亮瞬间） */
    if (t > 2.6 && t < 4) {
      g.globalAlpha = 0.6 * (1 - (t - 2.6) / 1.4);
      pDisc(g, lxLamp - 22 + 9, FLOOR - 16 - 8, 3, '#ffcaa0');
      g.globalAlpha = 1;
    }
    /* 暗处偷看的孩子（约 5s 后出现） */
    if (t > 5) {
      const ca = Math.min(1, (t - 5) / 2);
      g.globalAlpha = ca;
      drawSprite(g, 'child', 26, FLOOR - 11, 1, PAL);
      g.globalAlpha = 1;
    }
  }

  /* ════════════ 第二幕 · 跟随 ════════════ */
  function follow(g, t) {
    sky(g, ['#060a14', '#090f1e', '#0c1324', '#0f192c']);
    drawStars(g, starsA, t, 0.8);
    moon(g, 36, 32, t);
    townHouses(g, 0.07);
    street(g);
    deadPosts(g, t);
    /* 点灯人持灯从右向左走，孩子跟在身后 */
    const startX = 214, endX = 44, dur = 22;
    const prog = Math.min(1, t / dur);
    const kx = startX + prog * (endX - startX);
    const bob = prog < 1 ? (Math.sin(t * 9) * 1) | 0 : 0;
    keeper(g, kx, FLOOR - 16, t, bob, true);
    const childDelay = Math.max(0, t - 1.2);
    const cprog = Math.min(1, childDelay / dur);
    const cx = startX + 22 + cprog * (endX - 22 - startX);
    const cbob = cprog < 1 ? (Math.sin(t * 9 + 1) * 1) | 0 : 0;
    child(g, cx, FLOOR - 11, t, cbob, false);
    /* 远处一只猫掠过 */
    const catx = ((t * 10) % 300) - 20;
    drawSprite(g, 'cat', catx, FLOOR - 6, 1, PAL);
    /* 风：横向微光条 */
    g.globalAlpha = 0.06;
    for (let i = 0; i < 4; i++) {
      const yy = 40 + i * 30 + ((t * 20 + i * 13) % 30);
      const xx = ((t * 60 + i * 50) % 300) - 20;
      g.fillStyle = '#aab6c0';
      g.fillRect(xx, yy, 18, 1);
    }
    g.globalAlpha = 1;
  }

  /* ════════════ 第三幕 · 灯下 ════════════ */
  function under(g, t) {
    sky(g, ['#080c18', '#0b1222', '#0e1628', '#111d32']);
    drawStars(g, starsA, t, 0.8);
    moon(g, 40, 34, t);
    townHouses(g, 0.1);
    street(g);
    deadPosts(g, t);
    /* 二人在灯下静坐（点灯人持灯放身边，孩子依偎） */
    const lx = 120;
    keeper(g, lx - 6, FLOOR - 16, t, 0, true);
    /* 灯放在两人之间地上 */
    lantern(g, lx, FLOOR - 18, t, true);
    g.globalAlpha = 0.12;
    pEllipse(g, lx, FLOOR - 6, 80, 40, '#ffd98a');
    g.globalAlpha = 1;
    child(g, lx + 16, FLOOR - 11, t, 0, false);
    /* 回忆微光：一缕上升的暖色星点 */
    if (((t * 2) | 0) % 2 === 0) {
      const yy = FLOOR - 30 - ((t * 14) % 60);
      g.globalAlpha = 0.5;
      g.fillStyle = '#ffd98a';
      g.fillRect(lx + ((Math.sin(t * 3) * 8) | 0), yy, 1, 1);
      g.globalAlpha = 1;
    }
    /* 上方一对相叠的影子（剪影） */
    g.globalAlpha = 0.5;
    g.fillStyle = '#05070c';
    pEllipse(g, lx, FLOOR, 50, 6, '#05070c');
    g.globalAlpha = 1;
  }

  /* ════════════ 第四幕 · 风 ════════════ */
  function wind(g, t) {
    sky(g, ['#0a0e1a', '#0d1322', '#101a2e', '#131f36']);
    drawStars(g, starsDim, t, 0.5);
    moon(g, 214, 34, t);
    townHouses(g, 0.06);
    street(g);
    deadPosts(g, t);
    /* 风：密集斜雨 + 横向气流 */
    for (let i = 0; i < 60; i++) {
      const r = mulberry32(i + 3);
      const x = (r() * W + t * 40) % W | 0;
      const y = (r() * H + t * 120) % H | 0;
      g.globalAlpha = 0.25;
      g.fillStyle = '#9fb0c4';
      g.fillRect(x, y, 1, 3);
    }
    g.globalAlpha = 1;
    /* 灯焰在风中挣扎：中段最弱，后段恢复 */
    const weak = t > 6 && t < 14 ? 0.35 + 0.65 * Math.abs(Math.sin((t - 6) * 1.6)) : 1;
    const bend = t > 4 ? Math.sin(t * 4) * 3 * Math.min(1, (t - 4) / 3) : 0;
    const lx = 120 + bend;
    keeper(g, lx - 6, FLOOR - 16, t, 0, true);
    lantern(g, lx, FLOOR - 18, t, true, weak);
    g.globalAlpha = 0.12 * weak;
    pEllipse(g, lx, FLOOR - 6, 80, 40, '#ffd98a');
    g.globalAlpha = 1;
    /* 孩子张开双臂护灯 */
    child(g, lx + 16, FLOOR - 11, t, 0, false);
    /* 护灯的手臂（剪影弧） */
    g.strokeStyle = '#0b0e16';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(lx + 16 + 4, FLOOR - 11 + 6, 12, -2.4, -0.7);
    g.stroke();
    /* 风声可视：横向白条 */
    g.globalAlpha = 0.10;
    for (let i = 0; i < 5; i++) {
      const yy = 50 + i * 26 + ((t * 30 + i * 17) % 26);
      const xx = ((t * 90 + i * 60) % 300) - 20;
      g.fillStyle = '#cdd8ea';
      g.fillRect(xx, yy, 26, 1);
    }
    g.globalAlpha = 1;
  }

  /* ════════════ 终幕 · 黎明 ════════════ */
  function dawn(g, t) {
    /* 天色由夜转晓 */
    const f = Math.min(1, t / 14);
    const night = ['#070a16', '#0a1020', '#0d1426', '#10182e'];
    const morn = ['#243a5e', '#3f5a7e', '#9a7e74', '#e2b074'];
    const blend = night.map((c, i) => mixHex(c, morn[i], f));
    sky(g, blend);
    drawStars(g, starsDim, t, Math.max(0, 0.7 - f));
    if (f < 0.6) moon(g, 214, 34 + f * 10, t);
    townHouses(g, 0.1 * (1 - f) + 0.05);
    street(g);
    deadPosts(g, t);
    /* 日出辉光从底部升起 */
    const sunY = H + 10 - f * 70;
    g.globalAlpha = 0.5 * f;
    pDisc(g, 60, sunY, 26, '#ffd98a');
    g.globalAlpha = 0.25 * f;
    pDisc(g, 60, sunY, 48, '#f0a14a');
    g.globalAlpha = 1;
    /* 点灯人旋灭主灯（灯渐暗），把孩子的小提灯点亮 */
    const outF = Math.min(1, Math.max(0, (t - 3) / 4));   /* 3~7s 熄灯 */
    const lx = 110;
    keeper(g, lx - 6, FLOOR - 16, t, 0, outF < 1);
    if (outF < 1) {
      lantern(g, lx, FLOOR - 18, t, true, 1 - outF);
      g.globalAlpha = 0.12 * (1 - outF);
      pEllipse(g, lx, FLOOR - 6, 80, 40, '#ffd98a');
      g.globalAlpha = 1;
    } else {
      /* 灯已灭，留下空杆 */
      g.fillStyle = '#3a2a1a';
      g.fillRect(lx - 4, FLOOR - 22, 9, 2);
      g.fillRect(lx - 3, FLOOR - 20, 7, 9);
      g.fillStyle = '#0e0a07';
      g.fillRect(lx - 2, FLOOR - 19, 5, 7);
    }
    /* 孩子高举小提灯（约 5s 后点亮） */
    const childLit = t > 5;
    child(g, lx + 18, FLOOR - 11, t, 0, childLit);
    /* 朝阳下，二人浅淡的剪影 */
    g.globalAlpha = 0.4 * (1 - f * 0.5);
    g.fillStyle = '#1a1208';
    pEllipse(g, lx + 9, FLOOR, 46, 5, '#1a1208');
    g.globalAlpha = 1;
    if (t > 18) ptext(g, '—— 全剧终 ——', 128, 150, 12, 'rgba(255,233,168,' + Math.min(1, (t - 18) / 3) + ')', 'center');
  }

  /* 颜色线性混合 */
  function mixHex(a, b, t) {
    const pa = hex2rgb(a), pb = hex2rgb(b);
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function hex2rgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  return { title, prologue, light, follow, under, wind, dawn };
})();

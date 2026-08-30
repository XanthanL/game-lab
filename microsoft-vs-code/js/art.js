/* 美术：全矢量绘制。微软僵尸重模 —— 两节腿步态、挂绳工牌、前倾蹒跚 */
'use strict';

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, 7); };

/* ---------- 僵尸通用躯体 ----------
   两节腿 + 摆臂 + 工牌 + 呼吸起伏。o: {sc 体型, wf 步频, shirt, skin, hunch 前倾, arms 臂长} */
function zbody2(c, t, e, o = {}) {
  const sc = o.sc ?? 1, wf = o.wf ?? 1;
  const skin = o.skin || '#a8bfa0', shirt = o.shirt || '#d8d8d8';
  const ph = t * 4.2 * wf + e.seed;
  const w1 = Math.sin(ph), w2 = Math.sin(ph + Math.PI);
  c.save();
  c.scale(sc, sc);
  c.rotate(o.hunch ?? 0.09);
  c.translate(0, Math.sin(ph * 2) * 1.2);

  // 两节腿：大腿-小腿-鞋
  const leg = (side, sw) => {
    const hipX = side * 5, kneeX = hipX + sw * 4, footX = kneeX + sw * 5;
    c.strokeStyle = '#3f3f46'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hipX, 24); c.lineTo(kneeX + 2, 34); c.lineTo(footX, 42); c.stroke();
    c.fillStyle = '#22222a';
    rr(c, footX - 5, 40, 13, 6, 3); c.fill();
  };
  leg(-1, w1); leg(1, w2);
  c.lineCap = 'butt';

  // 躯干：衬衫 + 领口 + 领带
  c.fillStyle = shirt; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -13, -16, 27, 42, 9); c.fill(); c.stroke();
  c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(-13, 14, 27, 6);
  c.fillStyle = '#f2f2f2';
  c.beginPath(); c.moveTo(-6, -16); c.lineTo(0, -9); c.lineTo(6, -16); c.closePath(); c.fill();
  const tieSw = Math.sin(ph) * 1.5;
  c.fillStyle = o.tie || '#a33';
  c.beginPath(); c.moveTo(-2.5 + tieSw * .2, -12); c.lineTo(2.5 + tieSw * .2, -12); c.lineTo(1 + tieSw, 8); c.lineTo(-1 + tieSw, 8); c.closePath(); c.fill();

  // 挂绳工牌
  c.strokeStyle = '#5b7fa6'; c.lineWidth = 1.5;
  const bsw = Math.sin(ph + 0.7) * 2;
  c.beginPath(); c.moveTo(-5, -14); c.lineTo(bsw, -2); c.stroke();
  c.save(); c.translate(bsw, 2); c.rotate(bsw * 0.04);
  c.fillStyle = '#e8e8e8'; c.strokeStyle = '#999'; c.lineWidth = 1;
  rr(c, -3.5, -3, 7, 9, 1.5); c.fill(); c.stroke();
  c.fillStyle = '#8a8a8a'; c.fillRect(-2.5, -1.5, 5, 1.5); c.fillRect(-2.5, 1, 3.5, 1);
  c.restore();

  // 前伸双臂 + 手
  const arm = (y0, sw) => {
    const L = (o.arms ?? 24);
    c.strokeStyle = shirt; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(6, y0); c.quadraticCurveTo(-8, y0 + sw * 2, -L + 6, y0 + 2 + sw * 3); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.5; c.lineCap = 'butt';
    c.fillStyle = skin; circ(c, -L + 4, y0 + 3 + sw * 3, 4.5); c.fill();
    c.strokeStyle = '#333'; c.lineWidth = 1.2; c.stroke();
  };
  arm(-9, w1); arm(-1, w2);
  c.restore();
}
/* 通用僵尸头 */
function zhead(c, x, y, r, skin) {
  c.fillStyle = skin || '#a8bfa0'; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, x, y, r); c.fill(); c.stroke();
  c.fillStyle = '#c0392b'; circ(c, x - r * 0.35, y - 1, 1.9); c.fill(); circ(c, x + r * 0.3, y - 1, 1.9); c.fill();
  c.strokeStyle = '#4d5d4d'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(x - r * 0.4, y + r * 0.5); c.lineTo(x + r * 0.35, y + r * 0.5); c.stroke();
}

const ART = { p: {}, z: {} };

/* ================= 代码方 ================= */
ART.p.coffee = (c, t, e) => {
  c.fillStyle = '#3b3b3b'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -24, -26, 48, 50, 7); c.fill(); c.stroke();
  c.fillStyle = '#4a4a4a'; rr(c, -24, -36, 48, 14, 5); c.fill(); c.stroke();
  c.fillStyle = Math.sin(t * 4) > 0 ? '#7ed957' : '#5a5a5a'; circ(c, 15, -29, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, -14, -6, 28, 26, 4); c.fill();
  const lv = 0.45 + 0.3 * (Math.sin(t * 0.8 + e.seed) + 1) / 2;
  c.fillStyle = '#7a4a21'; rr(c, -12, 18 - 22 * lv, 24, 22 * lv, 3); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const ph = t * 3 + i * 2;
    c.beginPath(); c.moveTo(-6 + i * 12, -40);
    c.quadraticCurveTo(-6 + i * 12 + Math.sin(ph) * 4, -48, -6 + i * 12, -56);
    c.globalAlpha = 0.3 + 0.2 * Math.sin(ph); c.stroke(); c.globalAlpha = 1;
  }
};
ART.p.log = (c, t, e) => {
  c.fillStyle = '#10241a'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -28, -32, 56, 58, 6); c.fill(); c.stroke();
  c.fillStyle = '#2d2d2d'; rr(c, -28, -32, 56, 13, 6); c.fill();
  ['#d1695c', '#dcdcaa', '#7ed957'].forEach((col, i) => { c.fillStyle = col; circ(c, -20 + i * 8, -25.5, 2.2); c.fill(); });
  c.fillStyle = '#3f6f4f'; c.fillRect(-20, -12, 30, 3); c.fillRect(-20, -4, 22, 3); c.fillRect(-20, 4, 26, 3);
  if (t % 1 < 0.6) { c.fillStyle = '#7ed957'; c.font = 'bold 12px monospace'; c.textAlign = 'left'; c.fillText('>_', -20, 20); }
  if (e.fireT > 0) { c.fillStyle = 'rgba(126,217,87,.8)'; circ(c, 32, -6, 6); c.fill(); }
};
ART.p.keyboard = (c, t, e) => {
  const rec = e.fireT > 0 ? 2 : 0;
  c.strokeStyle = '#555'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(20, -8 + rec); c.quadraticCurveTo(34, -22, 30, -30); c.stroke();
  c.fillStyle = '#262626'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -32, -10 + rec, 64, 30, 5); c.fill(); c.stroke();
  for (let r = 0; r < 2; r++) for (let k = 0; k < 7; k++) {
    c.fillStyle = (r === 0 && k === 3) ? '#dcdcaa' : '#3d3d3d';
    rr(c, -28 + k * 8.4, -5 + rec + r * 11, 7, 9, 2); c.fill();
  }
};
ART.p.firewall = (c, t, e) => {
  c.strokeStyle = OUT; c.lineWidth = 3; c.fillStyle = '#1f4e5f';
  rr(c, -26, -32, 52, 64, 5); c.fill(); c.stroke();
  c.strokeStyle = '#12333d'; c.lineWidth = 2;
  for (let r = 0; r < 4; r++) {
    const y = -32 + r * 16;
    c.beginPath(); c.moveTo(-26, y + 16); c.lineTo(26, y + 16); c.stroke();
    const off = r % 2 ? -13 : 0;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(off - 13 + k * 26, y); c.lineTo(off - 13 + k * 26, y + 16); c.stroke(); }
  }
  c.save(); c.shadowColor = '#35c1f1'; c.shadowBlur = 10;
  c.strokeStyle = '#bfe8ff'; c.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3 + t * 0.5;
    c.beginPath(); c.moveTo(-Math.cos(a) * 9, -Math.sin(a) * 9); c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); c.stroke();
  }
  c.restore();
};
ART.p.duck = (c, t, e) => {
  c.fillStyle = '#ffd94a'; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, 0, 8, 19); c.fill(); c.stroke();
  circ(c, 7, -17, 12); c.fill(); c.stroke();
  c.fillStyle = '#f28c28'; c.beginPath(); c.moveTo(17, -20); c.lineTo(28, -15); c.lineTo(17, -11); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = OUT; circ(c, 10, -20, 2.5); c.fill();
  c.strokeStyle = '#d9a92a'; c.lineWidth = 2.5;
  c.beginPath(); c.arc(-4, 8, 10, 0.5, 2.6); c.stroke();
};
ART.p.bp = (c, t, e) => {
  c.fillStyle = '#333'; rr(c, -30, 10, 60, 4, 2); c.fill();
  if (!e.armed) {
    c.fillStyle = 'rgba(255,64,64,.55)'; circ(c, 0, 12, 5); c.fill();
    c.strokeStyle = 'rgba(255,64,64,.6)'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 12, 9, -Math.PI / 2, -Math.PI / 2 + (e.armT / 8) * Math.PI * 2); c.stroke();
  } else {
    const pu = 1 + 0.12 * Math.sin(t * 7);
    c.save(); c.shadowColor = '#ff4040'; c.shadowBlur = 12;
    c.fillStyle = '#ff4040'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    circ(c, 0, 12, 7 * pu); c.fill(); c.stroke(); c.restore();
  }
};
ART.p.rmrf = (c, t, e) => {
  c.fillStyle = '#1b1b1b'; c.strokeStyle = '#000'; c.lineWidth = 3;
  circ(c, 0, 4, 18); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(-6, -2, 7, 0, 7); c.fill();
  c.fillStyle = '#e8e8e8'; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText('rm -rf', 0, 8);
  c.fillStyle = '#333'; rr(c, -5, -20, 10, 8, 2); c.fill();
  c.strokeStyle = '#888'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -20); c.quadraticCurveTo(6, -26, 10, -27); c.stroke();
  if (Math.sin(t * 20) > -0.3) {
    c.strokeStyle = '#ffd94a'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * 6; c.beginPath(); c.moveTo(10 + Math.cos(a) * 2, -27 + Math.sin(a) * 2); c.lineTo(10 + Math.cos(a) * 6, -27 + Math.sin(a) * 6); c.stroke(); }
  }
  if (e.fuse < 0.35 && Math.sin(t * 30) > 0) { c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, 0, 4, 18); c.fill(); }
};
ART.p.stack = (c, t, e) => {
  const pu = 1 + 0.04 * Math.sin(t * 2.5 + e.seed);
  c.save(); c.scale(pu, pu);
  c.fillStyle = '#e8e8e8'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -24, -26, 48, 50, 6); c.fill(); c.stroke();
  c.fillStyle = '#f48024'; rr(c, -14, 2, 28, 14, 3); c.fill();
  c.fillStyle = '#c8641e'; rr(c, -14, 8, 28, 8, 2); c.fill();
  c.strokeStyle = '#7ed957'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-10, -14); c.lineTo(-2, -6); c.lineTo(12, -22); c.stroke(); c.lineCap = 'butt';
  c.restore();
  c.strokeStyle = 'rgba(244,128,36,' + (0.25 + 0.15 * Math.sin(t * 3)) + ')'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 28, 30, 8, 0, 0, 7); c.stroke();
};
ART.p.monitor = (c, t, e) => {
  c.fillStyle = '#1b1b1b'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -30, -34, 60, 44, 5); c.fill(); c.stroke();
  const flash = e.fireT > 0;
  c.fillStyle = flash ? '#2a4a6f' : '#10243a'; rr(c, -26, -30, 52, 36, 3); c.fill();
  c.strokeStyle = flash ? '#bfe8ff' : '#35c1f1'; c.lineWidth = 2;
  c.beginPath(); c.arc(0, -12, 9, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -20); c.moveTo(-14, -12); c.lineTo(-10, -12); c.moveTo(10, -12); c.lineTo(14, -12); c.moveTo(-7, -5); c.lineTo(7, -5); c.stroke();
  c.fillStyle = '#333'; c.fillRect(-4, 10, 8, 12); c.fillRect(-16, 22, 32, 5);
  if (flash) { c.fillStyle = 'rgba(191,232,255,.5)'; circ(c, 0, -12, 14); c.fill(); }
};
ART.p.pad = (c, t, e) => {
  c.fillStyle = '#2e7d4f'; c.strokeStyle = OUT; c.lineWidth = 3;
  c.beginPath(); c.ellipse(0, 12, 34, 14, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#3f9e63'; c.beginPath(); c.ellipse(0, 10, 26, 9, 0, 0, 7); c.fill();
  c.fillStyle = '#bfe8c8'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.fillText('< >', 0, 14);
};

/* ================= 微软方 ================= */
ART.z.clippy = (c, t, e) => {
  zbody2(c, t, e, { sc: 0.9, shirt: '#cfcfcf' });
  const bob = Math.sin(t * 3 + e.seed) * 1.5;
  c.save(); c.translate(0, bob - 2); c.rotate(Math.sin(t * 1.6 + e.seed) * 0.05);
  c.strokeStyle = '#d7d7d7'; c.lineWidth = 5; c.lineCap = 'round';
  rr(c, -12, -54, 24, 42, 12); c.stroke();
  c.strokeStyle = '#bdbdbd';
  c.beginPath(); c.moveTo(-5, -48); c.lineTo(-5, -22); c.quadraticCurveTo(-5, -17, 0, -17); c.quadraticCurveTo(5, -17, 5, -22); c.lineTo(5, -42); c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 2;
  circ(c, -6, -41, 6); c.fill(); c.stroke(); circ(c, 6, -41, 6); c.fill(); c.stroke();
  const lk = Math.sin(t * 0.9 + e.seed) * 1.6;
  c.fillStyle = OUT; circ(c, -7 + lk, -41, 2.3); c.fill(); circ(c, 5 + lk, -41, 2.3); c.fill();
  c.strokeStyle = OUT; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-11, -49); c.lineTo(-3, -47.5); c.moveTo(11, -49); c.lineTo(3, -47.5); c.stroke();
  c.restore();
};
ART.z.ie = (c, t, e) => {
  zbody2(c, t, e, { sc: 0.95, wf: 0.55, shirt: '#b8b8a8', hunch: 0.16, tie: '#7a7a55' });
  c.save(); c.translate(0, -30);
  const ring = Math.sin(t * 1.2 + e.seed);
  c.strokeStyle = '#f7d038'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(0, 2, 18, 4 + Math.abs(ring) * 5, ring * 0.5, 0, 7); c.stroke();
  const g = c.createLinearGradient(-15, -15, 15, 15);
  g.addColorStop(0, '#37a9e8'); g.addColorStop(1, '#0f5f96');
  c.fillStyle = g; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, 0, 0, 15); c.fill(); c.stroke();
  c.strokeStyle = '#e8f4ff'; c.lineWidth = 3;
  c.beginPath(); c.arc(0, 1, 8, 0.35, 5.9); c.stroke();
  c.fillStyle = '#e8f4ff'; c.fillRect(-9, -1, 15, 3);
  c.restore();
};
ART.z.edge = (c, t, e) => {
  zbody2(c, t, e, { sc: 0.9, wf: 2, shirt: '#d8d8d8', hunch: 0.14 });
  c.save(); c.translate(0, -31); c.rotate(Math.sin(t * 6 + e.seed) * 0.08);
  c.fillStyle = '#e8e8e8'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -15, -14, 30, 28, 4); c.fill(); c.stroke();
  c.fillStyle = '#b5b5b5'; rr(c, -15, -14, 30, 7, 4); c.fill();
  c.fillStyle = '#8e1a1a'; circ(c, 10, -10.5, 2.2); c.fill();
  const g = c.createLinearGradient(-8, 0, 8, 10);
  g.addColorStop(0, '#35c1f1'); g.addColorStop(1, '#0c59a4');
  c.strokeStyle = g; c.lineWidth = 4;
  c.beginPath(); c.arc(0, 2, 8, -0.6, 4.3); c.stroke();
  c.strokeStyle = '#0c59a4'; c.lineWidth = 3;
  c.beginPath(); c.arc(1.5, 3, 4.5, 2.2, 7.6); c.stroke();
  c.restore();
};
ART.z.update = (c, t, e) => {
  zbody2(c, t, e, { sc: 1.05, wf: 0.8, shirt: '#c8c8c8' });
  zhead(c, 0, -27, 12);
  c.save(); c.translate(0, -45);
  c.strokeStyle = 'rgba(126,217,87,.25)'; c.lineWidth = 5;
  c.beginPath(); c.arc(0, 0, 13, 0, 7); c.stroke();
  c.strokeStyle = '#7ed957';
  const p = (t * 0.35 + e.seed) % 1;
  c.beginPath(); c.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); c.stroke();
  c.rotate(t * 2.2);
  c.strokeStyle = '#aef08e'; c.lineWidth = 4;
  c.beginPath(); c.arc(0, 0, 9, 0.3, 2.8); c.stroke();
  c.beginPath(); c.arc(0, 0, 9, 3.4, 5.9); c.stroke();
  c.fillStyle = '#aef08e';
  c.beginPath(); c.moveTo(8, 4); c.lineTo(12, -2); c.lineTo(4, -1); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-8, -4); c.lineTo(-12, 2); c.lineTo(-4, 1); c.closePath(); c.fill();
  c.restore();
};
ART.z.bsod = (c, t, e) => {
  zbody2(c, t, e, { sc: 1.1, wf: 0.6, shirt: '#b0b0b0', hunch: 0.14 });
  zhead(c, 6, -28, 11);
  c.save(); c.translate(-2, Math.sin(t * 2 + e.seed) * 1.5);
  c.fillStyle = '#0078d7'; c.strokeStyle = '#003a66'; c.lineWidth = 3;
  rr(c, -34, -60, 24, 84, 3); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 11px monospace'; c.textAlign = 'center';
  c.fillText(':(', -22, -44);
  c.font = '6px monospace'; c.fillStyle = 'rgba(255,255,255,.85)';
  c.fillText('正在收集', -22, -32); c.fillText('错误信息', -22, -24);
  const pct = 1 + Math.floor((t * 11 + e.seed * 30) % 98);
  c.font = 'bold 8px monospace'; c.fillStyle = '#fff';
  c.fillText(pct + '%', -22, -8);
  c.restore();
};
ART.z.garg = (c, t, e) => {
  const rage = e.hp < e.maxHp * 0.5;
  zbody2(c, t, e, { sc: 1.65, wf: 0.5, shirt: rage ? '#9a8080' : '#8a8a8a', hunch: 0.12, arms: 30 });
  zhead(c, -2, -40, 12);
  if (rage) {
    c.fillStyle = '#ff4040'; circ(c, -6, -42, 2.4); c.fill(); circ(c, 1, -42, 2.4); c.fill();
  }
  c.save(); c.translate(8, -62); c.rotate(-0.15 + Math.sin(t * 2 + e.seed) * 0.03);
  c.fillStyle = '#e8e8e8'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -18, -16, 38, 30, 3); c.fill(); c.stroke();
  c.fillStyle = '#2d2d2d'; rr(c, -18, -16, 38, 8, 3); c.fill();
  c.fillStyle = '#333'; c.font = 'bold 8px monospace'; c.textAlign = 'center'; c.fillText('setup.exe', 1, 2);
  c.fillStyle = '#444'; c.fillRect(-13, 6, 26, 5);
  const w = (Math.sin(t * 1.2) + 1) / 2 * 22;
  c.fillStyle = '#7ed957'; c.fillRect(-13, 6, 4 + w, 5);
  if (rage) {
    c.strokeStyle = '#5a5a5a'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-10, -8); c.lineTo(-2, 0); c.lineTo(-8, 8); c.stroke();
  }
  c.restore();
};
ART.z.telemetry = (c, t, e) => {
  zbody2(c, t, e, { sc: 0.88, wf: 1.25, shirt: '#6f7b8a', skin: '#9aa8b5', hunch: 0.1 });
  zhead(c, 0, -26, 10, '#9aa8b5');
  c.strokeStyle = '#c8d2dc'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(0, -36); c.lineTo(0, -44); c.stroke();
  c.fillStyle = '#d1695c'; circ(c, 0, -46, 2.5); c.fill();
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.5 + i * 0.33 + e.seed) % 1;
    c.strokeStyle = 'rgba(209,105,92,' + (0.6 * (1 - ph)) + ')'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, -46, 4 + ph * 14, -2.4, -0.7); c.stroke();
    c.beginPath(); c.arc(0, -46, 4 + ph * 14, 0.7, 2.4); c.stroke();
  }
};
ART.z.teams = (c, t, e) => {
  zbody2(c, t, e, { sc: 1, wf: 0.75, shirt: '#5b5fc7' });
  c.save(); c.translate(0, -31);
  c.fillStyle = '#1b1a38'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -16, -14, 32, 28, 4); c.fill(); c.stroke();
  c.fillStyle = '#3d3f7a'; rr(c, -13, -11, 13, 11, 2); c.fill(); rr(c, 1, -11, 13, 11, 2); c.fill();
  c.fillStyle = '#8f94d8'; circ(c, -6.5, -5.5, 3); c.fill(); circ(c, 7.5, -5.5, 3); c.fill();
  c.fillStyle = '#5b5fc7'; rr(c, -13, 4, 26, 8, 2); c.fill();
  const b = 1 + Math.sin(t * 5 + e.seed) * 0.18;
  c.save(); c.translate(14, -14); c.scale(b, b);
  c.fillStyle = '#e04b4b'; c.strokeStyle = '#fff'; c.lineWidth = 2;
  circ(c, 0, 0, 6); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 8px monospace'; c.textAlign = 'center'; c.fillText('!', 0, 3);
  c.restore();
  c.restore();
};
ART.z.popup = (c, t, e) => {
  zbody2(c, t, e, { sc: 0.55, wf: 2.6, shirt: '#e8e8e8', hunch: 0.18 });
  c.fillStyle = '#e04b4b'; c.strokeStyle = OUT; c.lineWidth = 2.5;
  circ(c, 0, -20, 9); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText('1', 0, -17);
};
ART.z.balloon = (c, t, e) => {
  const wob = Math.sin(t * 2.4 + e.seed) * 0.1;
  if (e.land) {
    zbody2(c, t, e, { sc: 0.7, wf: 1.8, shirt: '#d8b8b8' });
    zhead(c, 0, -24, 10);
    return;
  }
  c.save(); c.rotate(wob * 0.4);
  zbody2(c, t, e, { sc: 0.7, wf: 1.8, shirt: '#d8b8b8', hunch: 0.02, arms: 20 });
  zhead(c, 0, -24, 10);
  c.strokeStyle = '#999'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-14, -8); c.quadraticCurveTo(-24, -26, -20, -40); c.stroke();
  c.save(); c.translate(-20, -56); c.rotate(wob);
  const g = c.createRadialGradient(-5, -6, 3, 0, 0, 17);
  g.addColorStop(0, '#ff8080'); g.addColorStop(1, '#c03030');
  c.fillStyle = g; c.strokeStyle = OUT; c.lineWidth = 2.5;
  c.beginPath(); c.ellipse(0, 0, 14, 16, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-5, -6, 4, 6, 0.5, 0, 7); c.fill();
  c.fillStyle = '#c03030'; c.beginPath(); c.moveTo(-3, 15); c.lineTo(3, 15); c.lineTo(0, 20); c.closePath(); c.fill();
  c.restore();
  c.restore();
};
ART.z.dotnet = (c, t, e) => {
  const compat = e.compat;
  zbody2(c, t, e, { sc: 1.25, wf: 0.45, shirt: compat ? '#5a3a6a' : '#4a3a5a', hunch: 0.18, tie: '#b48ee0' });
  zhead(c, 0, -30, 13);
  c.save(); c.translate(0, -45);
  c.fillStyle = '#2d1b3d'; c.strokeStyle = OUT; c.lineWidth = 2.5;
  rr(c, -13, -4, 26, 6, 2); c.fill(); c.stroke();
  rr(c, -8, -18, 16, 15, 2); c.fill(); c.stroke();
  c.fillStyle = '#b48ee0'; rr(c, -8, -8, 16, 3, 1); c.fill();
  c.restore();
  c.fillStyle = '#d8c8e8'; c.font = 'bold 8px monospace'; c.textAlign = 'center';
  c.fillText('.NET', 0, 2);
  if (compat) {
    c.fillStyle = 'rgba(255,64,64,' + (0.35 + 0.2 * Math.sin(t * 6)) + ')';
    c.font = 'bold 8px monospace'; c.fillText('兼容模式', 0, -58);
  }
};

/* ---------- 场景小件 ---------- */
function drawCup(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#f5f5f5'; c.strokeStyle = OUT; c.lineWidth = 2;
  rr(c, -8, -6, 16, 13, 3); c.fill(); c.stroke();
  c.beginPath(); c.arc(9, 0, 4, -1.4, 1.4); c.stroke();
  c.fillStyle = '#6f4e37'; c.beginPath(); c.ellipse(0, -5, 6.5, 2.4, 0, 0, 7); c.fill();
  c.restore();
}
function drawPad(c, x, y, t) {
  c.save(); c.translate(x, y + 14);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 6, 36, 10, 0, 0, 7); c.fill();
  c.fillStyle = '#2e7d4f'; c.strokeStyle = OUT; c.lineWidth = 3;
  c.beginPath(); c.ellipse(0, 0, 38, 16, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#3f9e63'; c.beginPath(); c.ellipse(0, -2, 30, 11, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(191,232,200,.75)'; c.font = 'bold 10px monospace'; c.textAlign = 'center';
  c.fillText('< />', 0, 2);
  c.restore();
}
function drawWater(c, t, y0, h) {
  c.fillStyle = '#0e2c40'; c.fillRect(LAWN_X, y0, COLS * CELL_W, h);
  c.strokeStyle = 'rgba(80,170,220,.16)'; c.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const yy = y0 + 14 + i * (h / 7);
    const off = Math.sin(t * 0.8 + i * 1.7) * 22;
    c.beginPath();
    for (let x = LAWN_X; x < LAWN_R; x += 46) {
      c.moveTo(x + off, yy); c.lineTo(Math.min(x + off + 24, LAWN_R), yy);
    }
    c.stroke();
  }
  c.fillStyle = 'rgba(120,200,255,.05)';
  c.fillRect(LAWN_X, y0, COLS * CELL_W, h);
}

/* ================= meta：BUG 投掷器 / star / 屋顶 / 雾 / 花园 / 鸭店主 ================= */
ART.p.bug = (c, t, e) => {
  const lean = e.fireT > 0 ? -0.25 : 0;
  c.save(); c.rotate(lean);
  c.fillStyle = '#3a3f46'; c.strokeStyle = OUT; c.lineWidth = 3;
  rr(c, -22, -2, 40, 26, 6); c.fill(); c.stroke();
  c.fillStyle = '#2b2f35'; rr(c, -18, -26, 26, 26, 5); c.fill(); c.stroke();
  c.fillStyle = '#d1695c'; rr(c, -15, -22, 20, 16, 3); c.fill();
  c.fillStyle = '#fff'; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText('BUG', -5, -10);
  c.strokeStyle = '#555'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(18, 10); c.lineTo(26, 22); c.stroke(); c.lineCap = 'butt';
  c.restore();
  c.fillStyle = '#22222a'; rr(c, -24, 24, 12, 6, 3); c.fill(); rr(c, 8, 24, 12, 6, 3); c.fill();
};
function drawStar(c, x, y, s, glow) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (glow) { c.shadowColor = 'rgba(255,220,120,.9)'; c.shadowBlur = 12; }
  const g = c.createLinearGradient(0, -10, 0, 10);
  g.addColorStop(0, '#ffe28a'); g.addColorStop(1, '#e8a63c');
  c.fillStyle = g; c.strokeStyle = '#8a5a1a'; c.lineWidth = 1.6;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 10 : 4.4, a = -Math.PI / 2 + i * Math.PI / 5;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath(); c.fill(); c.stroke();
  c.restore();
}
function drawRoof(c, t) {
  for (let r = 0; r < ROWS; r++) {
    ctxShingles(c, LAWN_Y + r * CELL_H, r);
  }
  function ctxShingles(cc, y0, row) {
    cc.fillStyle = row % 2 ? '#5a3038' : '#66363f';
    cc.fillRect(LAWN_X, y0, COLS * CELL_W, CELL_H);
    cc.strokeStyle = 'rgba(0,0,0,.28)'; cc.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const yy = y0 + 12 + i * 22;
      cc.beginPath(); cc.moveTo(LAWN_X, yy); cc.lineTo(LAWN_R, yy); cc.stroke();
      const off = i % 2 ? 29 : 0;
      for (let x = LAWN_X + off; x < LAWN_R; x += 59) { cc.beginPath(); cc.moveTo(x, yy); cc.lineTo(x, yy + 22); cc.stroke(); }
    }
  }
  /* 兼容性深渊：左 5 列是空洞 */
  c.fillStyle = 'rgba(8,8,12,.78)'; c.fillRect(LAWN_X, LAWN_Y, 5 * CELL_W, ROWS * CELL_H);
  c.strokeStyle = 'rgba(209,105,92,.5)'; c.lineWidth = 2; c.setLineDash([7, 7]);
  c.strokeRect(LAWN_X + 3, LAWN_Y + 3, 5 * CELL_W - 6, ROWS * CELL_H - 6);
  c.setLineDash([]);
  c.fillStyle = 'rgba(209,105,92,.75)'; c.font = 'bold 13px monospace'; c.textAlign = 'center';
  c.save(); c.translate(LAWN_X + 2.5 * CELL_W, LAWN_Y + ROWS * CELL_H / 2); c.rotate(-0.12);
  c.fillText('compatibility abyss', 0, 0);
  c.font = '10px monospace'; c.fillStyle = 'rgba(209,105,92,.5)';
  c.fillText('（此处禁止施工）', 0, 16);
  c.restore();
}
function drawFog(c, t) {
  const x0 = LAWN_X + 5 * CELL_W;
  const g = c.createLinearGradient(x0 - 60, 0, W, 0);
  g.addColorStop(0, 'rgba(150,160,170,0)'); g.addColorStop(0.35, 'rgba(150,160,170,.5)'); g.addColorStop(1, 'rgba(140,150,160,.72)');
  c.fillStyle = g; c.fillRect(x0 - 60, LAWN_Y, W - x0 + 60, ROWS * CELL_H);
  c.fillStyle = 'rgba(200,210,220,.14)';
  for (let i = 0; i < 5; i++) {
    const fx = x0 + ((t * 14 + i * 210) % (W - x0 + 120)) - 60;
    const fy = LAWN_Y + 40 + i * 105 + Math.sin(t * 0.6 + i) * 12;
    c.beginPath(); c.ellipse(fx, fy, 90, 26, 0, 0, 7); c.fill();
  }
  c.fillStyle = 'rgba(220,220,170,.3)'; c.font = '10px monospace'; c.textAlign = 'left';
  const todos = ['// TODO: fix later', '// 谁写的？', '// DO NOT TOUCH', '// temp 2019'];
  for (let i = 0; i < 4; i++) {
    const fx = x0 + 30 + ((t * 9 + i * 260) % (W - x0 + 80));
    c.fillText(todos[i], fx, LAWN_Y + 60 + i * 128);
  }
}
function drawGardenPot(c, kind, stage, t) {
  c.fillStyle = '#7a4a2a'; c.strokeStyle = OUT; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(-16, 10); c.lineTo(16, 10); c.lineTo(12, 28); c.lineTo(-12, 28); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#3a2a1a'; c.fillRect(-14, 8, 28, 5);
  const grow = (stage + 1) / 6;
  if (kind === 'ossl') {
    c.strokeStyle = '#3f7a3f'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 8); c.lineTo(0, 8 - 30 * grow); c.stroke();
    c.fillStyle = '#4e9e4e';
    for (let i = 0; i < 3 + stage; i++) {
      const a = -Math.PI / 2 + (i - (2 + stage) / 2) * 0.55;
      c.beginPath(); c.ellipse(Math.cos(a) * 12 * grow, 8 - 30 * grow + Math.sin(a) * 8, 7 * grow + 2, 3.5 * grow + 1, a, 0, 7); c.fill();
    }
    if (stage >= 5) { c.fillStyle = '#dcdcaa'; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText('v1.0', 0, -30); }
  } else {
    c.strokeStyle = '#6a9955'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(0, 8); c.quadraticCurveTo(4, -6 * grow, 0, -16 * grow); c.stroke();
    c.fillStyle = '#8ecf6f';
    c.beginPath(); c.ellipse(-6, -8 * grow, 7 * grow, 3.5 * grow, -0.6, 0, 7); c.fill();
    c.beginPath(); c.ellipse(6, -11 * grow, 7 * grow, 3.5 * grow, 0.6, 0, 7); c.fill();
    if (stage >= 3) { c.fillStyle = '#ffd94a'; circ(c, 0, -18 * grow, 4); c.fill(); }
  }
}
function drawDuckShop(c, t) {
  c.fillStyle = '#ffd94a'; c.strokeStyle = OUT; c.lineWidth = 3;
  circ(c, 0, 10, 26); c.fill(); c.stroke();
  circ(c, 10, -20, 16); c.fill(); c.stroke();
  c.fillStyle = '#f28c28'; c.beginPath(); c.moveTo(24, -24); c.lineTo(40, -19); c.lineTo(24, -14); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = OUT; circ(c, 13, -24, 3); c.fill();
  c.strokeStyle = '#d9a92a'; c.lineWidth = 3; c.beginPath(); c.arc(-5, 10, 13, 0.5, 2.6); c.stroke();
  c.fillStyle = '#2d2d2d'; c.strokeStyle = OUT; c.lineWidth = 2.5;
  rr(c, -30, -46, 26, 16, 3); c.fill(); c.stroke();
  c.fillStyle = '#7ed957'; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText('npm', -17, -34);
  c.fillStyle = '#dcdcaa'; c.font = 'bold 8px monospace';
  c.fillText('~quack~ 要装点什么？', 6, 44);
}

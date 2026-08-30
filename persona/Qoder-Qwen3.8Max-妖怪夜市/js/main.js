/* ============================================================
 * 《妖怪夜市》main.js —— 导演
 * 负责：启动演出、逐条执行剧本事件、观众交互（推进/静音/重演）
 * ============================================================ */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const theater = $("theater");
  const subtitle = $("subtitle");
  const speakerEl = $("speaker");
  const lineEl = $("line");
  const actTitleBox = $("act-title");
  const actTitleText = $("act-title-text");
  const actSubText = $("act-sub-text");
  const overlay = $("overlay");
  const startBtn = $("start-btn");
  const controls = $("controls");
  const actIndicator = $("act-indicator");

  let waitingLine = null;   // 当前等待推进的 resolve
  let running = false;
  let lastAct = "序幕";     // 当前幕名（静音提示后恢复用）

  /* ---------------- 演员注册表 ---------------- */
  function registerActors() {
    Engine.addActor("child", "child", { x: -40, speed: 34 });
    Engine.addActor("fox", "fox", { x: 540, speed: 46, visible: false });
    Engine.addActor("lantern", "lantern", { x: 540, speed: 30, visible: false });
    Engine.addActor("oni", "oni", { x: 540, speed: 26, visible: false });
    Engine.addActor("umbrella", "umbrella", { x: -40, speed: 24, visible: false });
  }

  /* ---------------- 台词推进 ---------------- */
  function showLine(who, text) {
    return new Promise((resolve) => {
      subtitle.classList.remove("hidden");
      speakerEl.textContent = who;
      lineEl.textContent = "";
      waitingLine = resolve;
      // 打字机效果
      let i = 0;
      const timer = setInterval(() => {
        if (!waitingLine) { clearInterval(timer); return; }
        i++;
        lineEl.textContent = text.slice(0, i);
        if (i >= text.length) clearInterval(timer);
      }, 42);
      subtitle._typeTimer = timer;
    });
  }

  function advance() {
    if (!waitingLine) return;
    if (subtitle._typeTimer) clearInterval(subtitle._typeTimer);
    const r = waitingLine;
    waitingLine = null;
    subtitle.classList.add("hidden");
    AudioStage.sfx("pop");
    r();
  }

  /* ---------------- 幕标题 ---------------- */
  function showActTitle(text, sub) {
    actTitleText.textContent = text;
    actSubText.textContent = sub;
    actTitleBox.classList.remove("hidden");
    actTitleBox.style.animation = "none";
    void actTitleBox.offsetWidth; // 重置动画
    actTitleBox.style.animation = "";
    lastAct = text.replace(/\s/g, "");
    actIndicator.textContent = lastAct;
    return Engine.wait(2800);
  }

  /* ---------------- 事件执行器 ---------------- */
  async function exec(ev) {
    switch (ev.t) {
      case "title":   await showActTitle(ev.text, ev.sub); break;
      case "bg":      Engine.setBg(ev.scene); break;
      case "bgm":     AudioStage.playBgm(ev.name); break;
      case "stopBgm": AudioStage.stopBgm(); break;
      case "sfx":     AudioStage.sfx(ev.name); break;
      case "fade":    Engine.fadeTo(ev.to, ev.dur || 0.8); break;
      case "wait":    await Engine.wait(ev.ms); break;
      case "say":     await showLine(ev.who, ev.text); break;
      case "add":     Engine.addActor(ev.a, ev.sprite, ev.opts || {}); break;
      case "remove":  Engine.removeActor(ev.a); break;
      case "enter":   await Engine.enterActor(ev.a, ev.from, ev.x, ev.speed); break;
      case "move":    await Engine.moveActor(ev.a, ev.x, ev.speed); break;
      case "exit":    await Engine.exitActor(ev.a, ev.to, ev.speed); break;
      case "emote":   Engine.emote(ev.a, ev.g, ev.dur || 1.4); break;
      case "flies":   Engine.spawnFireflies(16); break;
      case "embers":  Engine.spawnEmbers(); break;
      case "bellRing": Engine.bellRing(ev.x, ev.y); break;
      case "end":     await finale(); break;
      default: break;
    }
  }

  async function runScript() {
    running = true;
    for (const ev of SCRIPT) {
      await exec(ev);
      if (!running) return;
    }
  }

  /* ---------------- 谢幕与重演 ---------------- */
  function finale() {
    return new Promise((resolve) => {
      overlay.querySelector(".overlay-inner h1").textContent = "— 剧 终 —";
      overlay.querySelector(".en").textContent = "THE END · YO-KAI NIGHT MARKET";
      overlay.querySelector(".intro").innerHTML =
        "小满与妖怪们的故事，明年夜市再见。<br/>原作 / 剧本 / 演出 / 配乐 —— 均由前端实现";
      startBtn.textContent = "↻ 再 演 一 次";
      overlay.classList.remove("gone");
      theater.classList.remove("theater-open");
      startBtn.onclick = () => {
        overlay.classList.add("gone");
        resolve();
        restart();
      };
    });
  }

  function restart() {
    running = false;
    AudioStage.stopBgm();
    subtitle.classList.add("hidden");
    waitingLine = null;
    setTimeout(startShow, 800); // 等幕布合上再重开
  }

  /* ---------------- 开演 ---------------- */
  async function startShow() {
    Engine.init($("stage"));
    registerActors();
    controls.classList.remove("hidden");
    // 拉幕
    await Engine.wait(300);
    theater.classList.add("theater-open");
    await Engine.wait(1400);
    runScript();
  }

  startBtn.addEventListener("click", () => {
    // 重演时按钮行为由 finale 的 onclick 接管，这里不重复启动
    if (startBtn.onclick) return;
    AudioStage.init();
    overlay.classList.add("gone");
    startShow();
  });

  /* ---------------- 观众交互 ---------------- */
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      advance();
    } else if (e.code === "KeyM") {
      const muted = AudioStage.toggleMute();
      actIndicator.textContent = muted ? "已静音" : lastAct;
    } else if (e.code === "KeyR") {
      restart();
    }
  });

  theater.addEventListener("click", (e) => {
    if (e.target === startBtn) return;
    advance();
  });
})();

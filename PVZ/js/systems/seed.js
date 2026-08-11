// 卡片栏：选卡、阳光消耗、冷却、拖拽种植（移动端可由 DOM dock 调用 select）
(function () {
  'use strict';

  PVZ.SeedBar = class {
    constructor(game, deck) {
      this.game = game;
      this.cards = (deck || []).map(id => ({ id, cd: 0 }));
      this.selected = null;
      this.visible = true; // 移动端 DOM dock 模式下置 false，隐藏画布内卡片栏

      this.x = 110;
      this.y = 5;
      this.cardW = 66;
      this.cardH = 88;
      this.gap = 3;
    }

    cardRect(i) {
      return {
        x: this.x + i * (this.cardW + this.gap),
        y: this.y,
        w: this.cardW,
        h: this.cardH
      };
    }

    update(dt) {
      for (const card of this.cards) {
        if (card.cd > 0) card.cd -= dt;
      }
    }

    // 由 DOM dock / 画布点击调用：选中或取消某卡片
    select(id) {
      const card = this.cards.find(c => c.id === id);
      if (!card) return false;
      const p = PVZ.config.PLANTS[id];
      if (this.game.sun < p.cost || card.cd > 0) return false;
      this.selected = (this.selected === id) ? null : id;
      return true;
    }

    // 返回卡片状态（供 DOM dock 实时刷新）
    stateOf(id) {
      const card = this.cards.find(c => c.id === id);
      if (!card) return null;
      const p = PVZ.config.PLANTS[id];
      return {
        affordable: this.game.sun >= p.cost && card.cd <= 0,
        cd: card.cd,
        cdFrac: p.cooldown ? Math.min(1, card.cd / p.cooldown) : 0,
        cooldown: p.cooldown
      };
    }

    // 返回 { hit: 是否点在卡片上, id: 选中的植物 id 或 null }
    onMouseDown(x, y) {
      for (let i = 0; i < this.cards.length; i++) {
        const r = this.cardRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          if (this.cards[i].cd > 0) return { hit: true, id: null };
          this.selected = (this.selected === this.cards[i].id) ? null : this.cards[i].id;
          return { hit: true, id: this.selected };
        }
      }
      return { hit: false, id: null };
    }

    tryPlant(col, row) {
      if (!this.selected) return false;
      const card = this.cards.find(c => c.id === this.selected);
      const plantCfg = PVZ.config.PLANTS[card.id];
      if (this.game.sun < plantCfg.cost || card.cd > 0) return false;
      if (!this.game.plantAt(col, row, card.id)) return false;

      this.game.sun -= plantCfg.cost;
      card.cd = plantCfg.cooldown;
      PVZ.audio.play('plant');
      return true;
    }

    render(ctx) {
      const g = PVZ.config;
      ctx.textBaseline = 'middle';

      for (let i = 0; i < this.cards.length; i++) {
        const card = this.cards[i];
        const r = this.cardRect(i);
        const p = g.PLANTS[card.id];
        const affordable = this.game.sun >= p.cost && card.cd <= 0;
        const isSel = this.selected === card.id;

        ctx.fillStyle = isSel ? '#3d8b40' : '#2e6b2e';
        PVZ.art.roundRect(ctx, r.x, r.y, r.w, r.h, 6);
        ctx.fill();
        ctx.strokeStyle = isSel ? '#ffd54f' : '#1b5e20';
        ctx.lineWidth = isSel ? 3 : 1;
        PVZ.art.roundRect(ctx, r.x, r.y, r.w, r.h, 6);
        ctx.stroke();

        PVZ.art.drawPlant(ctx, card.id, r.x + r.w / 2, r.y + 50, 0, 1, 0.38);

        ctx.fillStyle = '#e8f5e9';
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, r.x + r.w / 2, r.y + r.h - 5);

        ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = affordable ? '#ffd54f' : '#e57373';
        ctx.fillText(String(p.cost), r.x + r.w - 6, r.y + 12);

        if (card.cd > 0) {
          const frac = Math.min(1, card.cd / p.cooldown);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          PVZ.art.roundRect(ctx, r.x, r.y, r.w, r.h * frac, 6);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(Math.ceil(card.cd) + 's', r.x + r.w / 2, r.y + r.h / 2);
        } else if (!affordable) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(r.x, r.y, r.w, r.h);
        }
      }
    }
  };
})();

/* 宏达汽修 2.0 · 页面渲染脚本（从 data.js 取数，不用改这个文件） */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function telHref(num) {
    return "tel:" + String(num).replace(/[^0-9+]/g, "");
  }

  function toMin(hm) {
    var p = String(hm).split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  /* 价目台账：左侧分类标签栏，相邻同分类合并显示 */
  var list = $("price-list");
  var prevCat = null;
  PRICE_LIST.forEach(function (it) {
    var li = document.createElement("li");

    var rail = document.createElement("span");
    rail.className = "rail-cell";
    rail.textContent = it.cat === prevCat ? "" : (it.cat || "");
    if (it.cat !== prevCat) { prevCat = it.cat; }
    li.appendChild(rail);

    var item = document.createElement("div");
    item.className = "item";
    var name = document.createElement("span");
    name.className = "name";
    name.textContent = it.name;
    item.appendChild(name);
    if (it.note) {
      var note = document.createElement("span");
      note.className = "note";
      note.textContent = it.note;
      item.appendChild(note);
    }
    li.appendChild(item);

    var price = document.createElement("span");
    price.className = "price";
    price.textContent = it.price;
    li.appendChild(price);

    list.appendChild(li);
  });

  /* 价目表更新时间（填了才显示） */
  if (SHOP.updatedAt) {
    $("upd-text").textContent = SHOP.updatedAt;
    $("upd").hidden = false;
  }

  /* 营业时间列表（休息日按周日写死；改作息需同时看 data.js 注释） */
  var hours = $("hours-list");
  [
    [SHOP.workdays, '<span class="t">' + SHOP.openTime + " – " + SHOP.closeTime + "</span>"],
    [SHOP.closedDay, '<span class="tag">休息</span>'],
  ].forEach(function (row) {
    var li = document.createElement("li");
    li.innerHTML = "<span>" + row[0] + "</span>" + row[1];
    hours.appendChild(li);
  });

  /* 电话与拨号链接 */
  var href = telHref(SHOP.phone);
  var phoneBig = $("phone-big");
  phoneBig.textContent = SHOP.phone;
  phoneBig.href = href;
  $("cta-call").href = href;
  $("cta-num").textContent = SHOP.phone;
  $("call-sub").textContent = SHOP.contact + " · 电话 / 微信同号";

  /* 到店 */
  $("addr-text").textContent = SHOP.address;
  $("parking").textContent = "● " + SHOP.parking;
  $("foot-name").textContent = SHOP.name + " · " + SHOP.address;
  $("foot-hours").textContent =
    SHOP.workdays.replace(/\s/g, "") + " " + SHOP.openTime + "–" + SHOP.closeTime +
    " · " + SHOP.closedDay + "休息";

  /* [待填] 占位标记 */
  var todo = SHOP.todo || [];
  if (todo.indexOf("phone") !== -1) { $("tbd-phone").hidden = false; }
  if (todo.indexOf("address") !== -1) { $("tbd-addr").hidden = false; }

  /* 营业状态（按访客手机时间算；休息日为周日） */
  function statusLine() {
    var now = new Date();
    var day = now.getDay(); /* 0 = 周日 */
    var mins = now.getHours() * 60 + now.getMinutes();
    var open = toMin(SHOP.openTime);
    var close = toMin(SHOP.closeTime);
    if (day === 0) {
      return { open: false, text: "今日休息 · 周一 " + SHOP.openTime + " 开门" };
    }
    if (mins < open) {
      return { open: false, text: "未开门 · 今天 " + SHOP.openTime + " 开门" };
    }
    if (mins < close) {
      return { open: true, text: "营业中 · " + SHOP.closeTime + " 打烊" };
    }
    return { open: false, text: "已打烊 · " + (day === 6 ? "周一" : "明天") + " " + SHOP.openTime + " 开门" };
  }

  function renderStatus() {
    var s = statusLine();
    var html = '<span class="dot" aria-hidden="true">●</span> ' + s.text;
    var live = $("live");
    var today = $("today");
    live.innerHTML = html;
    live.classList.toggle("is-closed", !s.open);
    today.innerHTML = "今天：" + html;
    today.classList.toggle("is-closed", !s.open);
  }

  renderStatus();
  setInterval(renderStatus, 30000);
})();

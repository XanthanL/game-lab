/* app.js — renders index.html from site.config.js.
   config is the single source of truth; this file contains no hospital data.
   Language switching re-runs render() instead of reloading the page. */

(function () {
  "use strict";

  var C = window.HOSPITAL_CONFIG;
  if (!C) return;                       // config missing -> static fallback in HTML stays visible

  var $  = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var contact = C.contact || {};

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function isBlank(v) { return /\[[^\]]*\]/.test(String(v == null ? "" : v)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] == null ? "" : String(vars[k]);
    });
  }

  var currentLang = document.documentElement.lang === "ur" ? "ur" : "en";
  function ui()  { return C.ui[currentLang]  || C.ui.en; }
  function copy(){ return C.content[currentLang] || C.content.en; }
  function t(key){ return ui()[key] == null ? (C.ui.en[key] == null ? key : C.ui.en[key]) : ui()[key]; }

  function addressOf(c, lang) {
    var sep = lang === "ur" ? "، " : ", ";
    return [c.address.line1, c.address.line2, c.address.country]
      .filter(function (s) { return s && String(s).trim(); }).join(sep);
  }

  /* ---------- one-shot wiring (language independent) ---------- */
  var dial = String(contact.phoneDial || contact.emergencyDial || "").replace(/[^0-9]/g, "");
  var wa   = String(contact.whatsapp || "").replace(/[^0-9]/g, "");
  var enAddress = addressOf(C.content.en, "en");
  var directions = "https://www.google.com/maps/dir/?api=1&destination=" +
                   encodeURIComponent((C.mapQuery || enAddress).trim());

  var toastTimer;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 3200);
  }

  $$("[data-link]").forEach(function (a) {
    var kind = a.getAttribute("data-link");
    if (kind === "tel")             a.href = dial ? "tel:+" + dial : "#";
    else if (kind === "wa")         a.href = wa ? "https://wa.me/" + wa + "?text=" +
      encodeURIComponent("Hello, I would like to enquire about an appointment.") : "#";
    else if (kind === "directions") a.href = directions;

    if (C.demo || a.getAttribute("href") === "#") {
      a.setAttribute("aria-disabled", "true");
      a.addEventListener("click", function (e) {
        e.preventDefault();
        toast(C.demo ? t("toastDemo") : t("toastEmpty"));
      });
    }
  });

  var mapQuery = String(C.mapQuery || "").trim();
  if (mapQuery) {
    var frame = $("#mapFrame");
    frame.src = "https://maps.google.com/maps?q=" + encodeURIComponent(mapQuery) + "&z=15&output=embed";
    frame.hidden = false;
    $("#mapPlaceholder").hidden = true;
  }

  $$("[data-demo]").forEach(function (el) { el.hidden = !C.demo; });
  var draftBadge = null;
  if (C.demo) {
    draftBadge = document.createElement("span");
    draftBadge.className = "draft-badge";
    var left = $(".utility-left");
    if (left) left.appendChild(draftBadge);
  }

  var navToggle = $("#navToggle"), nav = $("#siteNav");
  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) { if (e.target.tagName === "A") closeNav(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeNav(); });
    window.addEventListener("resize", function () { if (window.innerWidth > 760) closeNav(); });
  }

  var langBtn = $("#langToggle");
  if (langBtn) {
    langBtn.addEventListener("click", function () {
      var next = currentLang === "en" ? "ur" : "en";
      document.documentElement.lang = next === "ur" ? "ur" : "en";
      document.documentElement.dir  = next === "ur" ? "rtl" : "ltr";
      currentLang = next;
      try { localStorage.setItem("hospital-lang", next); } catch (e) {}
      try {
        var u = new URL(location.href);
        u.searchParams.set("lang", next);
        history.replaceState(null, "", u.href);
      } catch (e) {}
      closeNav();
      render();
    });
  }

  $("#year").textContent = new Date().getFullYear();

  /* ---------- render(lang): everything that depends on language ---------- */
  function render() {
    var c = copy();
    var addressLine = addressOf(c, currentLang);

    /* interface strings */
    $$("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    /* trusted config strings only — these carry <code> markup */
    $$("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    $$("[data-i18n-aria]").forEach(function (el) {
      var label = t(el.getAttribute("data-i18n-aria"));
      if (el.tagName === "IFRAME") el.setAttribute("title", label);
      else el.setAttribute("aria-label", label);
    });

    /* hospital data */
    var bound = {
      name: c.name, shortName: c.shortName, descriptor: c.descriptor,
      city: c.city, country: c.country, established: c.established,
      tagline: c.tagline, about: c.about, registration: c.registration,
      phoneDisplay: contact.phoneDisplay,
      emergencyDisplay: contact.emergencyDisplay || contact.phoneDisplay,
      addressLine: addressLine,
      opdHours: (c.hours[1] || {}).value || ""
    };
    $$("[data-bind]").forEach(function (el) {
      var v = String(bound[el.getAttribute("data-bind")] == null ? "" : bound[el.getAttribute("data-bind")]);
      el.textContent = v;
      el.classList.toggle("is-blank", isBlank(v));
    });

    /* dynamic lists */
    $("#deptList").innerHTML = (c.departments || []).map(function (d, i) {
      var services = (d.services || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
      return '<details class="dept"' + (i === 0 ? " open" : "") + ">" +
        "<summary>" +
          '<span class="dept-no num">' + pad(i + 1) + "</span>" +
          '<span class="dept-name' + (isBlank(d.name) ? " is-blank" : "") + '">' + esc(d.name) + "</span>" +
          '<span class="dept-summary">' + esc(d.summary) + "</span>" +
          '<span class="dept-toggle" aria-hidden="true"></span>' +
        "</summary>" +
        '<ul class="dept-services">' + services + "</ul>" +
      "</details>";
    }).join("");

    $("#doctorList").innerHTML = (c.doctors || []).map(function (d, i) {
      return '<article class="doctor-card">' +
        '<p class="doctor-no"><span class="num">' + pad(i + 1) + "</span> / " + esc(t("consultant")) + "</p>" +
        '<h3 class="doctor-name' + (isBlank(d.name) ? " is-blank" : "") + '">' + esc(d.name) + "</h3>" +
        '<p class="doctor-role">' + esc(d.role) + "</p>" +
        '<p class="doctor-qual">' + esc(d.qualification) + "</p>" +
      "</article>";
    }).join("");

    $("#hoursList").innerHTML = (c.hours || []).map(function (h) {
      return "<div><dt>" + esc(h.label) + '</dt><dd class="' +
        (isBlank(h.value) ? "is-blank" : "") + '">' + esc(h.value) + "</dd></div>";
    }).join("");

    $("#beforeList").innerHTML = (c.beforeVisit || []).map(function (line) {
      return "<li>" + esc(line) + "</li>";
    }).join("");

    if (draftBadge) draftBadge.textContent = t("draft");
    if (langBtn) {
      langBtn.textContent = currentLang === "en" ? "اردو" : "English";
      langBtn.lang = currentLang === "en" ? "ur" : "en";
      langBtn.dir  = currentLang === "en" ? "rtl" : "ltr";
    }

    /* head */
    document.title = fill(t("titleTpl"), {
      name: c.name, descriptor: c.descriptor, city: c.city, country: c.country
    });
    var desc = $('meta[name="description"]');
    if (desc) desc.setAttribute("content", fill(t("descTpl"), {
      tagline: c.tagline, address: addressLine, phone: contact.phoneDisplay
    }));

    /* SEO: NAP must be written exactly as on the Google Business Profile, so
       structured data always uses the canonical (English) legal name — it is
       created once and must NOT change when the visitor switches language. */
    if (!$("#hospital-jsonld") && !C.demo && C.siteUrl && !isBlank(C.content.en.name)) {
      var nc = C.content.en;
      if (!$('link[rel="canonical"]')) {
        var canonical = document.createElement("link");
        canonical.rel = "canonical";
        canonical.href = C.siteUrl.replace(/\/$/, "");
        document.head.appendChild(canonical);
      }
      var org = {
        "@context": "https://schema.org",
        "@type": "MedicalOrganization",
        "name": nc.name,
        "url": C.siteUrl.replace(/\/$/, ""),
        "telephone": contact.phoneDisplay,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": nc.address.line1,
          "addressLocality": nc.address.line2,
          "addressCountry": nc.country
        }
      };
      if (contact.email) org.email = contact.email;
      if (!isBlank(C.content.ur.name)) org.alternateName = C.content.ur.name;
      var ld = document.createElement("script");
      ld.id = "hospital-jsonld";
      ld.type = "application/ld+json";
      ld.textContent = JSON.stringify(org);
      document.head.appendChild(ld);
    }
  }

  render();
})();

/* Lumina — TV home screen.
 * Layout, styling and navigation come from the Lumina design; titles come live
 * from the LUMINA data layer (Stremio/Cinemeta catalogues + JustWatch offers);
 * apps come from TVL_APPS (generated from the TV itself). */
(function () {
  "use strict";

  var ICO = {
    play: '<svg class="od-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    check: '<svg class="od-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg>',
    list: '<svg class="od-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    plus: '<svg class="od-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
  var motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var app = $("#app");
  var state = {
    tab: "home", profile: "Shashvat",
    heroIdx: 0, heroTimer: null, toastTimer: null, splashTimer: null,
    detailFor: null, detailReturn: null, qTimer: null
  };

  /* ---------------- luna bridge (inside the TV app) ---------------- */
  var Bridge = window.WebOSServiceBridge || window.PalmServiceBridge;

  function luna(uri, params) {
    return new Promise(function (resolve, reject) {
      if (!Bridge) { reject(new Error("no service bridge")); return; }
      var b = new Bridge();
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; reject(new Error("timeout: " + uri)); }
      }, 8000);
      b.onservicecallback = function (raw) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      };
      b.call(uri, JSON.stringify(params || {}));
    });
  }

  function launchApp(id, params) {
    var payload = { id: id };
    if (params && Object.keys(params).length) payload.params = params;
    return luna("luna://com.webos.applicationManager/launch", payload);
  }

  /* ---------------- data bridge ---------------- */
  var T = {};        /* id -> title */
  var RAILS = [];    /* [{name, items:[{id}], apps?}] */
  var FEATURED = [];
  var APPS = [];

  function item(id) { return T[id] || (window.LUMINA && LUMINA.get(id)) || null; }

  function syncData() {
    T = {};
    APPS = (window.TVL_APPS || []).slice();
    var keep = function (id) { if (!T[id]) { var it = LUMINA.get(id); if (it) T[id] = it; } };
    (LUMINA.rails() || []).forEach(function (r) { r.items.forEach(function (it) { T[it.id] = it; }); });
    LUMINA.listIds().forEach(keep);
    LUMINA.continueIds().forEach(keep);

    RAILS = [];
    var cont = LUMINA.continueIds().filter(function (id) { return !!item(id); });
    if (cont.length) RAILS.push({ name: "Continue Watching", items: cont.map(function (id) { return { id: id }; }) });
    (LUMINA.rails() || []).forEach(function (r) {
      RAILS.push({ name: r.name, items: r.items.map(function (it) { return { id: it.id }; }) });
    });
    if (APPS.length) RAILS.push({ name: "Your apps", apps: true, items: APPS.map(function (a) { return { id: a.id, app: a }; }) });

    var first = (LUMINA.rails() || [])[0];
    FEATURED = first ? first.items.slice(0, 4).map(function (i) { return i.id; }) : [];
  }

  /* ---------------- cards ---------------- */
  function metaChips(t) {
    var bits = [];
    if (t.r) bits.push('<span class="chip chip-line od-nowrap">' + esc(t.r) + "</span>");
    if (t.y) bits.push('<span class="chip od-nowrap">' + esc(t.y) + "</span>");
    if (t.len) bits.push('<span class="chip od-nowrap">' + esc(t.len) + "</span>");
    (t.g || []).slice(0, 3).forEach(function (g) { bits.push('<span class="chip">' + esc(g) + "</span>"); });
    return bits.join("");
  }

  function letterCard(name, colour, cls) {
    var initial = (String(name || "?").match(/[A-Za-z0-9]/) || ["?"])[0].toUpperCase();
    var style = colour ? ' style="background:' + esc(colour) + '"' : "";
    return '<span class="app-icon app-icon-letter ' + cls + '"' + style + ">" + esc(initial) + "</span>";
  }

  function cardHTML(id, opts) {
    opts = opts || {};
    var t = item(id);
    if (!t) return "";
    return '<button class="card" data-focusable data-id="' + esc(id) + '" aria-label="' + esc(t.t) + '">' +
      '<span class="card-art">' +
      '<img class="od-media od-media-cover" style="--od-ratio:2/3" src="' + esc(t.img) + '" alt="" loading="lazy">' +
      '<span class="card-shade" aria-hidden="true"></span>' +
      '<span class="card-flag" aria-hidden="true">' + ICO.check + "</span>" +
      '<span class="card-name">' + esc(t.t) + "</span>" +
      (opts.progress != null ? '<span class="card-progress" aria-hidden="true" style="--p:' + opts.progress + '"><span></span></span>' : "") +
      "</span></button>";
  }

  function appCardHTML(a, inRail) {
    var inner = a.icon
      ? '<img class="app-icon" src="' + esc(a.icon) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling&&(this.nextElementSibling.style.display=\'grid\')">' +
        '<span class="app-icon app-icon-letter" style="display:none;background:' + esc(a.iconColor || "#2b3240") + '">' + esc((a.title || "?").charAt(0)) + "</span>"
      : letterCard(a.title, a.iconColor, "");
    return '<button class="app-card' + (inRail ? " app-tile" : "") + '" data-focusable data-app="' + esc(a.id) + '">' +
      inner + '<span class="app-name">' + esc(a.title) + "</span></button>";
  }

  function syncFlags() {
    $$(".card").forEach(function (c) {
      c.classList.toggle("card--in-list", LUMINA.inList(c.dataset.id));
    });
  }

  function syncListBtn(btn, id) {
    var on = LUMINA.inList(id);
    btn.classList.toggle("on", on);
    btn.innerHTML = (on ? ICO.check : ICO.plus) + "<span>" + (on ? "In My List" : "Watchlist") + "</span>";
  }

  /* ---------------- rails ---------------- */
  function renderRails() {
    var rails;
    if (state.tab === "mylist") {
      var ids = LUMINA.listIds().filter(function (id) { return !!item(id); });
      rails = ids.length ? [{ name: "My List", items: ids.map(function (id) { return { id: id }; }) }] : [];
    } else if (state.tab === "home") {
      rails = RAILS;
    } else {
      var kind = state.tab === "movies" ? "movie" : "series";
      rails = RAILS.filter(function (r) { return !r.apps; }).map(function (r) {
        return { name: r.name, items: r.items.filter(function (it) { var t = item(it.id); return t && t.type === kind; }) };
      }).filter(function (r) { return r.items.length; });
    }

    var zone = $("#rails");
    if (!rails.length) {
      zone.innerHTML = '<div class="empty"><div class="empty-glyph">' + ICO.list + "</div><h2>" +
        (state.tab === "mylist" ? "Nothing in My List yet" : "Nothing to show") + "</h2><p>" +
        (state.tab === "mylist" ? "Press <strong>Watchlist</strong> on any title and it will wait for you here." : "Check your connection — the catalogue could not be loaded.") +
        "</p></div>";
      return;
    }
    zone.innerHTML = rails.map(function (r) {
      var body = r.apps
        ? r.items.map(function (it) { return appCardHTML(it.app, true); }).join("")
        : r.items.map(function (it) { return cardHTML(it.id); }).join("");
      return '<section class="rail"><h2>' + esc(r.name) + '</h2><div class="od-rail rail-track' + (r.apps ? " app-rail" : "") + '">' + body + "</div></section>";
    }).join("");
    syncFlags();
  }

  /* ---------------- apps tab ---------------- */
  function renderApps() {
    var zone = $("#appsEl");
    zone.innerHTML = APPS.length
      ? APPS.map(function (a) { return appCardHTML(a, false); }).join("")
      : '<p class="search-empty">No apps found.</p>';
  }

  /* ---------------- hero ---------------- */
  function renderHero(i) {
    if (!FEATURED.length) return;
    var id = FEATURED[i % FEATURED.length];
    var t = item(id);
    if (!t) return;
    $("#heroBg").src = t.bg || t.img;
    var art = $("#heroArt");
    art.src = t.img;
    art.alt = "Poster of " + t.t;
    $("#heroTitle").textContent = t.t;
    $("#heroMeta").innerHTML = metaChips(t);
    $("#heroSyn").textContent = t.s || "";
    $("#heroPlay").dataset.id = id;
    syncListBtn($("#heroList"), id);
    $("#heroList").dataset.id = id;
    $$("#heroDots span").forEach(function (d, k) { d.classList.toggle("on", k === (i % 3)); });
    var hero = $("#hero");
    hero.classList.remove("swap");
    void hero.offsetWidth;
    hero.classList.add("swap");
  }

  function startHero() {
    if (!motionOK || state.heroTimer) return;
    state.heroTimer = setInterval(function () {
      if (document.hidden || state.tab !== "home") return;
      if ($("#detail").classList.contains("on") || $("#search").classList.contains("on") || $("#player").classList.contains("on")) return;
      if ($("#hero").contains(document.activeElement)) return;
      if (!FEATURED.length) return;
      state.heroIdx = (state.heroIdx + 1) % FEATURED.length;
      renderHero(state.heroIdx);
    }, 9000);
  }

  /* ---------------- toast + splash ---------------- */
  function showToast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }

  function showSplash(title, note, kicker) {
    $("#pTitle").textContent = title || "";
    $("#pNote").textContent = note || "";
    $("#pKicker").textContent = kicker || "Opening";
    var p = $("#player");
    p.hidden = false;
    requestAnimationFrame(function () { p.classList.add("on"); });
    clearTimeout(state.splashTimer);
    state.splashTimer = setTimeout(closeSplash, 6000);
  }

  function closeSplash() {
    var p = $("#player");
    p.classList.remove("on");
    setTimeout(function () { p.hidden = true; }, 180);
  }

  /* ---------------- actions ---------------- */
  var STREMIO = "io.strem.webos";

  function playTitle(id) {
    var t = item(id);
    if (!t) return;
    LUMINA.pushContinue(id);
    showSplash(t.t, "Stremio is opening — search for this title there to pick a source.", "Playing");
    launchApp(STREMIO).catch(function () { showToast("Could not open Stremio"); });
  }

  function providerTarget(web) {
    if (!web) return "";
    if (/gti=/.test(web)) return web.split("gti=")[1].split("&")[0];
    return (web.replace(/[?#].*$/, "").split("/").filter(Boolean).pop() || "");
  }

  function openProvider(offer, title) {
    showSplash(title, "Handing off to " + offer.label + " — if it doesn't land on the title, search there.", "Watch on");
    launchApp(offer.app, { contentTarget: providerTarget(offer.web) }).catch(function () {
      showToast("Could not open " + offer.label);
    });
  }

  function playTrailer(id) {
    var t = item(id);
    if (!t) return;
    showSplash(t.t + " — trailer", "Opening YouTube search.", "Trailer");
    launchApp("youtube.leanback.v4", { contentTarget: "q=" + encodeURIComponent(t.t + " trailer") })
      .catch(function () { showToast("Could not open YouTube"); });
  }

  function openInBrowser(id) {
    showSplash(item(id) ? item(id).t : "", "Opening the web page in the TV browser.", "Web");
    launchApp("com.webos.app.browser", { target: "https://www.imdb.com/title/" + id + "/" })
      .catch(function () { showToast("Could not open the browser"); });
  }

  /* ---------------- detail panel ---------------- */
  var detail = $("#detail"), search = $("#search"), player = $("#player"), pmenu = $("#pmenu");

  function offersHTML(offers) {
    if (!offers || !offers.length) return "";
    return '<div class="provider-row">' + offers.map(function (o) {
      var kind = (o.type || "").toLowerCase();
      var tag = kind === "flatrate" ? "included" : (kind === "rent" ? "rent" : (kind === "buy" ? "buy" : (kind ? kind : "")));
      return '<button class="provider-chip" data-focusable data-provider="' + esc(o.app) + '" data-web="' + esc(o.web) + '">' +
        esc(o.label) + (tag ? '<span class="tag">' + esc(tag) + "</span>" : "") + "</button>";
    }).join("") + "</div>" +
    '<p class="provider-note">Availability for your region via JustWatch. Hand-off is best-effort — some apps ignore deep links.</p>';
  }

  function openDetail(id, returnEl) {
    state.detailFor = id;
    state.detailReturn = returnEl || document.activeElement;
    var t = item(id);
    if (!t) return;

    $("#dBg").src = t.bg || t.img;
    var poster = $("#dPoster");
    poster.src = t.img;
    poster.alt = "Poster of " + t.t;
    $("#dTitle").textContent = t.t;
    $("#dMeta").innerHTML = metaChips(t);
    $("#dSyn").textContent = t.s || "";
    $("#dCredits").innerHTML = t.c ? "<b>Starring</b> " + esc(t.c) : "";
    $("#dPlay").dataset.id = id;
    syncListBtn($("#dList"), id);
    $("#dList").dataset.id = id;

    var old = $("#dExtras");
    if (old) old.remove();
    var extras = document.createElement("div");
    extras.id = "dExtras";
    extras.innerHTML =
      '<div class="hero-actions">' +
      '<button class="btn btn-ghost" data-focusable data-act="trailer">Trailer</button>' +
      '<button class="btn btn-ghost" data-focusable data-act="browser">Web page</button>' +
      "</div><p class=\"provider-note\">Checking where to watch…</p>";
    $(".detail-info").appendChild(extras);

    detail.hidden = false;
    requestAnimationFrame(function () { detail.classList.add("on"); });
    app.inert = true;
    $("#dPlay").focus();

    LUMINA.loadMeta(id, t.type).then(function (full) {
      if (!full || state.detailFor !== id) return;
      $("#dBg").src = full.bg || full.img || t.bg || t.img;
      $("#dMeta").innerHTML = metaChips(full);
      $("#dSyn").textContent = full.s || t.s || "";
      if (full.c || full.d) {
        $("#dCredits").innerHTML = (full.c ? "<b>Starring</b> " + esc(full.c) : "") +
          (full.d ? " &nbsp;·&nbsp; <b>Directed by</b> " + esc(full.d) : "");
      }
    });

    /* installed-only offers */
    LUMINA.offers(t.t, t.y).then(function (list) {
      if (state.detailFor !== id) return;
      var installed = {};
      APPS.forEach(function (a) { installed[a.id] = true; });
      var usable = (list || []).filter(function (o) { return installed[o.app]; });
      var extrasEl = $("#dExtras");
      if (!extrasEl) return;
      extrasEl.querySelector(".provider-note").outerHTML = usable.length
        ? offersHTML(usable)
        : '<p class="provider-note">Not on your installed services (or unavailable) — try Stremio or the web page.</p>';
    });
  }

  function closeDetail() {
    state.detailFor = null;
    detail.classList.remove("on");
    app.inert = false;
    setTimeout(function () {
      detail.hidden = true;
      if (state.detailReturn && state.detailReturn.focus) state.detailReturn.focus();
    }, 160);
  }

  /* ---------------- search ---------------- */
  function resultsHTML(list) {
    return list.length ? list.map(function (it) {
      T[it.id] = it;
      return cardHTML(it.id);
    }).join("") : '<p class="search-empty">No matches. Try another title.</p>';
  }

  function openSearch() {
    search.hidden = false;
    requestAnimationFrame(function () { search.classList.add("on"); });
    app.inert = true;
    var popular = ((LUMINA.rails() || [])[0] || { items: [] }).items.slice(0, 12);
    popular.forEach(function (it) { T[it.id] = it; });
    $("#qHint").textContent = "Popular now";
    $("#qGrid").innerHTML = resultsHTML(popular);
    syncFlags();
    var input = $("#q");
    input.value = "";
    input.focus();
  }

  function closeSearch() {
    search.classList.remove("on");
    setTimeout(function () { search.hidden = true; }, 180);
    app.inert = false;
  }

  function runSearch(q) {
    if (!q.trim()) { openSearch(); return; }
    $("#qHint").textContent = "Searching…";
    LUMINA.search(q).then(function (list) {
      $("#qHint").textContent = list.length + " result" + (list.length === 1 ? "" : "s");
      $("#qGrid").innerHTML = resultsHTML(list);
      syncFlags();
    });
  }

  /* ---------------- watchlist ---------------- */
  function toggleWatch(id, btn) {
    var added = LUMINA.toggleList(id);
    syncFlags();
    if (btn) syncListBtn(btn, id);
    if (state.tab === "mylist") renderRails();
    showToast(added ? "Added to My List" : "Removed from My List");
  }

  function switchTab(tab) {
    state.tab = tab;
    $$(".nav-item").forEach(function (n) {
      if (n.dataset.tab === tab) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    });
    app.className = app.className.replace(/\btab-\w+\b/g, "").trim() + " tab-" + tab;
    var appsTab = tab === "apps";
    $("#rails").hidden = appsTab;
    $("#hero").hidden = appsTab || tab !== "home";
    $("#appsEl").hidden = !appsTab;
    if (appsTab) renderApps();
    else renderRails();
  }

  /* ---------------- navigation ---------------- */
  function currentScope() {
    if (!player.hidden && player.classList.contains("on")) return { name: "player" };
    if (!detail.hidden && detail.classList.contains("on")) return { name: "detail" };
    if (!pmenu.hidden) return { name: "menu" };
    if (!search.hidden && search.classList.contains("on")) return { name: "search" };
    return { name: "main" };
  }

  function visibleFocusables() {
    var scope = currentScope();
    if (scope.name === "player") return [$("#pExit")];
    var root = document;
    if (scope.name === "search") root = search;
    else if (scope.name === "menu") root = pmenu;
    else if (scope.name === "detail") root = detail;
    return $$("[data-focusable]", root).filter(function (el) {
      return !el.closest("[hidden]") && (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : true);
    });
  }

  function move(dir) {
    var list = visibleFocusables();
    if (!list.length) return;
    var cur = document.activeElement;
    if (list.indexOf(cur) < 0) {
      var first = list.filter(function (el) { return !el.classList.contains("nav-item"); })[0] || list[0];
      first.focus();
      return;
    }
    var dirs = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    var d = dirs[dir];
    var r = cur.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var best = null, bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el === cur) continue;
      var b = el.getBoundingClientRect();
      var ex = b.left + b.width / 2, ey = b.top + b.height / 2;
      var px = ex - cx, py = ey - cy;
      var proj = px * d[0] + py * d[1];
      if (proj < 6) continue;
      var cross = Math.abs(px * d[1] - py * d[0]);
      if (cross > Math.max(48, proj * 1.5)) continue;
      var score = proj + cross * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) best.focus();
  }

  document.addEventListener("keydown", function (e) {
    var scope = currentScope();
    var inInput = e.target && e.target.closest && e.target.closest("input,textarea");
    var back = e.key === "Escape" || e.keyCode === 461 || (e.key === "Backspace" && !inInput);
    if (back) {
      if (scope.name === "player") { e.preventDefault(); closeSplash(); }
      else if (scope.name === "detail") { e.preventDefault(); closeDetail(); }
      else if (scope.name === "search") { e.preventDefault(); closeSearch(); $("#searchBtn").focus(); }
      else if (scope.name === "menu") { e.preventDefault(); closeMenu(); }
      return;
    }
    if (scope.name === "player") return;
    var dirs = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    if (e.keyCode === 37) { e.preventDefault(); move("left"); return; }
    if (e.keyCode === 39) { e.preventDefault(); move("right"); return; }
    if (e.keyCode === 38) { e.preventDefault(); move("up"); return; }
    if (e.keyCode === 40) { e.preventDefault(); move("down"); return; }
    if (dirs[e.key]) { e.preventDefault(); move(dirs[e.key]); return; }
    if (e.keyCode === 13 && scope.name === "search" && e.target.id === "q") {
      var firstCard = $("#qGrid .card");
      if (firstCard) { e.preventDefault(); firstCard.focus(); }
    }
  });

  document.addEventListener("focusin", function (e) {
    if (e.target.scrollIntoView) {
      e.target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motionOK ? "smooth" : "auto" });
    }
  });

  /* ---------------- profile menu ---------------- */
  function openMenu() {
    pmenu.hidden = false;
    $("#profileBtn").setAttribute("aria-expanded", "true");
    $$("#pmenu [data-profile]").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.dataset.profile === state.profile));
    });
    $$("#pmenu [data-profile]")[0].focus();
  }
  function closeMenu() {
    pmenu.hidden = true;
    $("#profileBtn").setAttribute("aria-expanded", "false");
    $("#profileBtn").focus();
  }

  /* ---------------- wiring ---------------- */
  $("#brandBtn").addEventListener("click", function () { switchTab("home"); });
  $$(".nav-item").forEach(function (n) { n.addEventListener("click", function () { switchTab(n.dataset.tab); }); });
  $("#liveBtn").addEventListener("click", function () { switchTab("apps"); });

  $("#heroPlay").addEventListener("click", function (e) { playTitle(e.currentTarget.dataset.id); });
  $("#heroList").addEventListener("click", function (e) { toggleWatch(e.currentTarget.dataset.id, e.currentTarget); });

  function delegateClick(root, handler) {
    root.addEventListener("click", function (e) {
      var el = e.target.closest("[data-app],[data-id],[data-act],[data-provider]");
      if (el) handler(el);
    });
  }

  function onCard(el) {
    if (el.dataset.app) {
      launchApp(el.dataset.app).catch(function () { showToast("Could not open " + el.dataset.app); });
      return;
    }
    if (el.dataset.act === "trailer" && state.detailFor) { playTrailer(state.detailFor); return; }
    if (el.dataset.act === "browser" && state.detailFor) { openInBrowser(state.detailFor); return; }
    if (el.dataset.provider) {
      openProvider({ app: el.dataset.provider, label: el.textContent.trim(), web: el.dataset.web }, state.detailFor ? (item(state.detailFor) || {}).t : "");
      return;
    }
    if (el.dataset.id) openDetail(el.dataset.id, el);
  }

  delegateClick($("#rails"), onCard);
  delegateClick($("#appsEl"), onCard);
  delegateClick($("#qGrid"), onCard);
  detail.addEventListener("click", function (e) {
    var el = e.target.closest("[data-app],[data-id],[data-act],[data-provider]");
    if (el) onCard(el);
  });

  $("#dClose").addEventListener("click", closeDetail);
  $("#dPlay").addEventListener("click", function (e) { playTitle(e.currentTarget.dataset.id); });
  $("#dList").addEventListener("click", function (e) { toggleWatch(e.currentTarget.dataset.id, e.currentTarget); });

  $("#searchBtn").addEventListener("click", openSearch);
  $("#qClose").addEventListener("click", function () { closeSearch(); $("#searchBtn").focus(); });
  $("#q").addEventListener("input", function (e) {
    var value = e.target.value;
    clearTimeout(state.qTimer);
    state.qTimer = setTimeout(function () { runSearch(value); }, 450);
  });
  $("#q").addEventListener("keydown", function (e) { if (e.keyCode === 13) e.preventDefault(); });

  $("#pExit").addEventListener("click", closeSplash);
  player.addEventListener("click", function (e) { if (e.target === player) closeSplash(); });

  $("#profileBtn").addEventListener("click", function () { if (pmenu.hidden) openMenu(); else closeMenu(); });
  $$("#pmenu [data-profile]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.profile = b.dataset.profile;
      $("#avatarInitials").textContent = state.profile.charAt(0);
      $$("#pmenu [data-profile]").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
      showToast("Watching as " + state.profile);
      closeMenu();
    });
  });

  /* ---------------- boot ---------------- */
  renderApps();
  function repaint() {
    syncData();
    renderHero(state.heroIdx);
    if (state.tab === "apps") renderApps(); else renderRails();
  }

  LUMINA.loadRails().then(function (source) {
    repaint();
    if (source === "fallback") showToast("Offline — showing a saved catalogue");
    startHero();
  }).catch(function () {
    repaint();
  });
  LUMINA.onChange(repaint);

  $("#navHome").focus();
})();

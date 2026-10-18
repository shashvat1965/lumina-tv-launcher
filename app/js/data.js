/* Lumina data layer.
 * Live catalogues from Stremio's public Cinemeta service (no account needed),
 * cached in localStorage, with a bundled offline fallback (js/fallback.json).
 * Titles are normalised into the shape the UI expects:
 *   { id, type, t:title, y:year, r:rating, len:runtime, g:[genres],
 *     s:synopsis, c:cast, d:director, img:poster, bg:background } */
(function () {
  "use strict";

  var CATS = "https://cinemeta-catalogs.strem.io/top";
  var META = "https://v3-cinemeta.strem.io/meta";
  var KEY = "lumina.rails.v3";
  var KEY_AT = "lumina.rails.v3.at";
  var ITEMS_KEY = "lumina.items.v1";
  var TTL = 6 * 60 * 60 * 1000;

  var RAIL_SPECS = [
    { name: "Popular Movies", type: "movie", path: "top" },
    { name: "Popular Series", type: "series", path: "top" },
    { name: "Top Rated", type: "movie", path: "imdbRating" },
    { name: "Action & Adventure", type: "movie", path: "top/genre=Action" },
    { name: "Comedy", type: "movie", path: "top/genre=Comedy" },
    { name: "Sci-Fi", type: "movie", path: "top/genre=Sci-Fi" },
    { name: "Thriller", type: "movie", path: "top/genre=Thriller" },
    { name: "Drama Series", type: "series", path: "top/genre=Drama" }
  ];

  var rails = [];
  var byId = {};
  var listeners = [];

  function norm(meta, fallbackType) {
    var year = meta.releaseInfo || meta.year || "";
    year = String(year).match(/\d{4}/);
    var parts = (meta.runtime || "").split(" ");
    return {
      id: meta.id,
      type: meta.type || fallbackType || "movie",
      t: meta.name || "",
      y: year ? year[0] : "",
      r: meta.imdbRating ? "★ " + meta.imdbRating : "",
      len: parts.length ? parts.slice(0, 2).join(" ") : "",
      g: meta.genres || [],
      s: meta.description || "",
      c: (meta.cast || []).slice(0, 3).join(", "),
      d: (meta.director || []).slice(0, 2).join(", "),
      img: meta.poster || "",
      bg: (meta.background || "").replace(/\/background\/[a-z]+\//, "/background/small/")
    };
  }

  function json(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function ingest() {
    byId = {};
    rails.forEach(function (rail) {
      (rail.items || []).forEach(function (it) {
        byId[it.id] = it;
      });
    });
    persistItems();
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { console.warn(e); }
    });
  }

  /* Keep a snapshot of every item we have ever seen, so My List and
   * Continue Watching still render after the rails change. */
  function persistItems() {
    try {
      var saved = JSON.parse(localStorage.getItem(ITEMS_KEY) || "{}");
      Object.keys(byId).forEach(function (id) { saved[id] = byId[id]; });
      var keys = Object.keys(saved);
      if (keys.length > 400) {
        var trimmed = {};
        keys.slice(keys.length - 400).forEach(function (k) { trimmed[k] = saved[k]; });
        saved = trimmed;
      }
      localStorage.setItem(ITEMS_KEY, JSON.stringify(saved));
    } catch (e) {}
  }

  function loadItems() {
    try {
      var saved = JSON.parse(localStorage.getItem(ITEMS_KEY) || "{}");
      Object.keys(saved).forEach(function (id) { byId[id] = saved[id]; });
    } catch (e) {}
  }

  function readCache() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || "null");
      var at = Number(localStorage.getItem(KEY_AT) || 0);
      if (data && data.rails && data.rails.length) return { rails: data.rails, at: at };
    } catch (e) {}
    return null;
  }

  function writeCache() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ rails: rails }));
      localStorage.setItem(KEY_AT, String(Date.now()));
    } catch (e) {}
  }

  function fetchRails() {
    var jobs = RAIL_SPECS.map(function (spec) {
      return json(CATS + "/catalog/" + spec.type + "/" + spec.path + ".json")
        .then(function (d) {
          return {
            name: spec.name,
            type: spec.type,
            items: (d.metas || []).slice(0, 12).map(function (m) { return norm(m, spec.type); })
          };
        })
        .catch(function () { return null; });
    });
    return Promise.all(jobs).then(function (done) {
      return done.filter(function (r) { return r && r.items.length; });
    });
  }

  function fallback() {
    return json("js/fallback.json").then(function (d) {
      rails = (d.rails || []).map(function (r) {
        return { name: r.name, type: r.type, items: (r.items || []).map(function (m) { return norm(m, r.type); }) };
      });
      ingest();
      return "fallback";
    });
  }

  function loadRails() {
    var cached = readCache();
    if (cached) {
      rails = cached.rails;
      ingest();
      if (Date.now() - cached.at < TTL) return Promise.resolve("cache");
    }
    return fetchRails().then(function (fresh) {
      if (fresh.length) {
        rails = fresh;
        ingest();
        writeCache();
        return "live";
      }
      return rails.length ? "stale" : fallback();
    }).catch(function () {
      return rails.length ? "stale" : fallback();
    });
  }

  function loadMeta(id, type) {
    var known = byId[id];
    var kind = type || (known && known.type) || "movie";
    return json(META + "/" + kind + "/" + id + ".json").then(function (d) {
      if (!d || !d.meta) throw new Error("no meta");
      var merged = norm(d.meta, kind);
      if (known) {
        merged.len = merged.len || known.len;
        merged.img = merged.img || known.img;
        merged.bg = merged.bg || known.bg;
      }
      byId[id] = merged;
      return merged;
    }).catch(function () { return known || null; });
  }

  function search(q) {
    var query = encodeURIComponent(String(q || "").trim());
    if (!query) return Promise.resolve([]);
    var urls = [
      CATS + "/catalog/movie/top/search=" + query + ".json",
      CATS + "/catalog/series/top/search=" + query + ".json"
    ];
    return Promise.all(urls.map(function (u) {
      return json(u).catch(function () { return { metas: [] }; });
    })).then(function (both) {
      var seen = {};
      var out = [];
      both.forEach(function (d, i) {
        (d.metas || []).forEach(function (m) {
          if (seen[m.id]) return;
          seen[m.id] = true;
          out.push(norm(m, i === 0 ? "movie" : "series"));
        });
      });
      out.forEach(function (it) { byId[it.id] = it; });
      return out;
    });
  }

  /* ---- local: my list + continue watching ---- */
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return []; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function listIds() { return lsGet("lumina.list"); }
  function inList(id) { return listIds().indexOf(id) >= 0; }
  function toggleList(id) {
    var ids = listIds();
    var i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.unshift(id);
    lsSet("lumina.list", ids);
    return i < 0;
  }
  function continueIds() { return lsGet("lumina.continue"); }
  function pushContinue(id) {
    var ids = continueIds().filter(function (x) { return x !== id; });
    ids.unshift(id);
    lsSet("lumina.continue", ids.slice(0, 12));
  }

  /* ---- boot ---- */
  loadItems();

  /* ---- where to watch (JustWatch, keyless, cached) ----
   * Returns [{ app, label, type, web }] for the installed services that carry
   * the title in this region, using each provider's own deep link/ID. */
  var OFFERS_KEY = "lumina.offers.v1";
  var PROVIDER_APPS = [
    { match: /netflix/i, app: "netflix", label: "Netflix" },
    { match: /amazon (prime )?video|prime video|amazon video/i, app: "amazon", label: "Prime Video" },
    { match: /jiohotstar|disney\+ hotstar|hotstar/i, app: "hotstar", label: "JioHotstar" },
    { match: /apple tv/i, app: "com.apple.appletv", label: "Apple TV" },
    { match: /sonyliv/i, app: "com.sonyliv2.tvapp", label: "SonyLIV" },
    { match: /zee5/i, app: "com.zee5.app", label: "ZEE5" },
    { match: /youtube/i, app: "youtube.leanback.v4", label: "YouTube" }
  ];

  function offersCache() {
    try { return JSON.parse(localStorage.getItem(OFFERS_KEY) || "{}"); } catch (e) { return {}; }
  }

  function matchTitle(edges, title, year) {
    var want = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    var best = null;
    (edges || []).forEach(function (edge) {
      var node = edge.node || {};
      var content = node.content || {};
      var got = String(content.title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!got) return;
      var score = got === want ? 0 : (got.indexOf(want) >= 0 || want.indexOf(got) >= 0 ? 1 : 9);
      if (score === 9) return;
      var dy = Math.abs((Number(content.originalReleaseYear) || 0) - (Number(year) || 0));
      score += Math.min(dy, 5);
      if (!best || score < best.score) best = { score: score, node: node };
    });
    return best ? best.node : null;
  }

  function offers(title, year) {
    var key = String(title || "").toLowerCase() + "|" + (year || "");
    var cached = offersCache();
    if (cached[key] && Date.now() - cached[key].at < 24 * 60 * 60 * 1000) {
      return Promise.resolve(cached[key].offers);
    }
    var query = '{"query":"query($t:String!){popularTitles(country:IN,first:6,filter:{searchQuery:$t}){edges{node{__typename ... on Movie{content(country:IN,language:en){title originalReleaseYear}offers(country:IN,platform:WEB){monetizationType standardWebURL package{clearName}}}... on Show{content(country:IN,language:en){title originalReleaseYear}offers(country:IN,platform:WEB){monetizationType standardWebURL package{clearName}}}}}}}","variables":{"t":' + JSON.stringify(String(title)) + "}}";
    return fetch("https://apis.justwatch.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: query
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (d) {
      var edges = ((d.data || {}).popularTitles || {}).edges || [];
      var node = matchTitle(edges, title, year);
      var out = [];
      var seen = {};
      ((node || {}).offers || []).forEach(function (o) {
        var label = ((o.package || {}).clearName || "");
        var entry = null;
        for (var i = 0; i < PROVIDER_APPS.length; i++) {
          if (PROVIDER_APPS[i].match.test(label)) { entry = PROVIDER_APPS[i]; break; }
        }
        if (!entry || seen[entry.app]) return;
        seen[entry.app] = true;
        out.push({
          app: entry.app,
          label: entry.label,
          type: o.monetizationType || "",
          web: o.standardWebURL || "",
          id: (o.standardWebURL || "").replace(/.*\//, "")
        });
      });
      cached[key] = { at: Date.now(), offers: out };
      try { localStorage.setItem(OFFERS_KEY, JSON.stringify(cached)); } catch (e) {}
      return out;
    }).catch(function () { return []; });
  }

  window.LUMINA = {
    offers: offers,
    loadRails: loadRails,
    loadMeta: loadMeta,
    search: search,
    rails: function () { return rails; },
    get: function (id) { return byId[id]; },
    onChange: function (fn) { listeners.push(fn); },
    ready: function () { return rails.length > 0; },
    listIds: listIds,
    inList: inList,
    toggleList: toggleList,
    continueIds: continueIds,
    pushContinue: pushContinue
  };
})();

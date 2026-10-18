#!/usr/bin/env node
/* Talk to the TV's Chrome DevTools protocol over the network.
 *
 *   node tools/tv-cdp.js shot  [out.png]     screenshot of the running page
 *   node tools/tv-cdp.js metrics             layout/measure numbers as JSON
 *   node tools/tv-cdp.js eval  "<js expr>"   evaluate in the page
 *   node tools/tv-cdp.js console             recent console messages
 *   node tools/tv-cdp.js css   "<css>"       inject CSS live (for experiments)
 *   node tools/tv-cdp.js targets             list debug targets
 */
const fs = require("fs");
const TV = process.env.TV_IP || "192.168.0.10";
const PORT = process.env.TV_CDP || "9998";
const APP_HINT = process.env.TV_APP || "com.shashvat.launcher";

async function targets() {
  const res = await fetch(`http://${TV}:${PORT}/json`);
  return res.json();
}

async function pickTarget() {
  const list = await targets();
  return list.find((t) => t.type === "page" && (t.url || "").includes(APP_HINT))
    || list.find((t) => t.type === "page")
    || null;
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const events = [];
  const ready = new Promise((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(new Error("ws error"));
  });
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  };
  const send = (method, params) => new Promise((resolve, reject) => {
    const my = ++id;
    pending.set(my, { resolve, reject });
    ws.send(JSON.stringify({ id: my, method, params: params || {} }));
  });
  return { ws, ready, send, events };
}

const METRICS_JS = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) };
  };
  const rails = document.querySelector('.rails');
  const cards = [...document.querySelectorAll('.card')].slice(0, 4).map((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) };
  });
  const imgs = [...document.images];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0;
  };
  const clipped = [...document.querySelectorAll('.rail-track')].map((el) => {
    const r = el.getBoundingClientRect();
    return { name: (el.closest('.rail') ? el.closest('.rail').querySelector('h2').textContent : '?'), top: Math.round(r.top), bottom: Math.round(r.bottom), fullyVisible: r.bottom <= innerHeight && r.top >= 0 };
  });
  return {
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    rootFont: getComputedStyle(document.documentElement).fontSize,
    topbar: box('.topbar'), hero: box('.hero'), rails: box('.rails'), hints: box('.hints'),
    railsScroll: { scrollHeight: rails ? rails.scrollHeight : null, clientHeight: rails ? rails.clientHeight : null },
    card: cards[0] || null,
    railRows: clipped,
    railCount: document.querySelectorAll('.rail').length,
    cardCount: document.querySelectorAll('.card').length,
    images: { total: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length },
    dataSource: document.querySelector('#toast') ? document.querySelector('#toast').textContent : '',
    errors: window.__LUMINA_ERRORS__ || []
  };
})()`;

(async () => {
  const cmd = process.argv[2] || "metrics";
  if (cmd === "targets") {
    const list = await targets();
    for (const t of list) console.log(`${t.type}\t${(t.url || "").slice(0, 90)}\t${t.webSocketDebuggerUrl || ""}`);
    return;
  }

  const target = await pickTarget();
  if (!target) { console.error("no debug target found (is the app running?)"); process.exit(2); }
  const c = connect(target.webSocketDebuggerUrl);
  await c.ready;

  if (cmd === "shot") {
    const out = process.argv[3] || "shots/tv.png";
    fs.mkdirSync(require("path").dirname(out), { recursive: true });
    const r = await c.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    const buf = Buffer.from(r.data, "base64");
    fs.writeFileSync(out, buf);
    console.log(`wrote ${out} (${buf.length} bytes, ${target.url.slice(-40)})`);
  } else if (cmd === "metrics") {
    const r = await c.send("Runtime.evaluate", { expression: METRICS_JS, returnByValue: true });
    console.log(JSON.stringify(r.result.value, null, 1));
  } else if (cmd === "eval") {
    const expr = process.argv.slice(3).join(" ");
    const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    console.log(JSON.stringify(r.result ? (r.result.value !== undefined ? r.result.value : r.result) : r, null, 1));
  } else if (cmd === "css") {
    const css = process.argv.slice(3).join(" ");
    const r = await c.send("Runtime.evaluate", {
      expression: `(() => { let el = document.getElementById('__live'); if (!el) { el = document.createElement('style'); el.id = '__live'; document.head.appendChild(el); } el.textContent = ${JSON.stringify(css)}; return el.textContent.length; })()`,
      returnByValue: true
    });
    console.log("injected", r.result.value, "chars of CSS");
  } else if (cmd === "console") {
    await c.send("Runtime.enable");
    await c.send("Log.enable");
    await new Promise((r) => setTimeout(r, 1200));
    for (const e of c.events) {
      if (e.method === "Runtime.consoleAPICalled") console.log("[console]", e.params.type, JSON.stringify(e.params.args.map((a) => a.value !== undefined ? a.value : a.description)));
      if (e.method === "Log.entryAdded") console.log("[log]", e.params.entry.level, e.params.entry.text);
      if (e.method === "Runtime.exceptionThrown") console.log("[exception]", e.params.exceptionDetails.text || "", (e.params.exceptionDetails.exception || {}).description || "");
    }
  }
  c.ws.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

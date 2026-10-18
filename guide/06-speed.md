# 6. Speed

**Goal:** make the TV feel as fast as it can be — and be honest with yourself
about what cannot be fixed.

**Time:** reading, plus 10 minutes of measurement. **Risk:** none if you stick to
the reversible knobs.

---

## 6.1 The one-paragraph summary

The TV in this repo is a **4-core ARM (Cortex-A55 class) with 1.5 GB of RAM**.
That is a streaming stick's worth of compute behind a 4K panel. No amount of
de-bloating will make a 2026 LG boot like a phone. What you *can* do is remove
the work the TV does **behind your back**: telemetry uploaders, diagnostic
loggers, ACR content mining, promotion popups, silent app updates, and a home
screen that fetches recommendations you never asked for. The wins are real but
they are **tens of megabytes and fewer background wakeups**, not a new SoC.

---

## 6.2 What actually helped (in order of impact)

### 1. Background services off

The single biggest win. Chapter 4.5 masks `contentminer`, `uploadd`, `rdxd`,
`remotelogger`, `nudge`, `camera` (on our TV). These are daemons that run
continuously and, in `rdxd`'s case, write to flash.

Measure it before/after. The repo's tool already does:

```sh
cd ~/tv-launcher
python3 tools/glasshouse_services.py
```

*What this does:* prints `MemAvailable` before and after toggling, and the
`freed: X MB` line. *What you should see:* a positive number. On a 1.5 GB box,
**tens of MB** is meaningful because it raises the floor before the OOM killer
starts evicting app caches.

You can also watch the effect live:

```sh
python3 tools/tvsh.py "grep -E 'MemTotal|MemAvailable' /proc/meminfo; cat /proc/loadavg"
```

*What this does:* reads memory and load. *What you should see:* `MemTotal` around
`1235024 kB` on our TV, and `MemAvailable` higher than before the mask.

### 2. Ad / telemetry / update domains blocked

Fewer DNS lookups that go nowhere, fewer background HTTP requests competing with
video, and no firmware download eating your link. Glasshouse's `hosts` mount does
this (Chapter 4.3). It is not a CPU optimization — it is removing *waiting*.

### 3. Fewer installed apps

Every installed app adds to the app list, the icon cache, and often a background
service or a boot-time registration. Uninstalling the things you never open is
free speed and free storage. This project's own suggested prune candidates are in
`docs/PENDING.md` §2 (Copilot, 8 Ball Pool, Gaming Portal, Sports Playbook,
Sports, Streaming Week, Gallery+, Media Player, Home Hub).

Two-step, because the launcher bakes its app list:

1. Uninstall on the TV: app list → long-press the app → delete.
2. Re-bake and reinstall: `tools/fetch_apps.py` → `tools/build_ipk.py` →
   `dist/tv_update.sh` (Chapter 5).

### 4. A lighter home screen

LG's stock home is a content surface: recommendations, an ad tile, a "LG
Channels" rail, and network fetches on every focus move. Lumina replaces all of
that with a static layout, a handful of cached rails, and your apps. It is
noticeably lighter **in what it fetches**, though it is still a web app and still
has to parse JSON and decode images. Expect "less stutter and no ads", not
"instant".

### 5. Quick Start+ off — a trade-off, not a speed win

Chapter 4.2 turns Quick Start+ **off** so every power-on is a real boot and the
boot hook runs. Be clear about what that costs: **cold boot is slower** than
instant-on standby. You are trading boot time for a predictable, hook-running
system. If you care more about fast power-on than the boot hook, turn Quick
Start+ back on and drop the boot hook.

### 6. Turn off what you don't use

- **Bluetooth** (`pl.krzywro.webos-bluetooth-disabler`) if your remote is IR/RF.
- **Always Ready / screen-off features** if you don't use them (LG settings).
- **Voice/AI features** if you don't use them (LG settings; leave
  `voiceconductor` alone in Glasshouse — see 4.5).

---

## 6.3 What is hardware-bound and cannot be fixed

Say it plainly, so you stop chasing it:

| Symptom | Why it cannot be fixed in software |
| --- | --- |
| App cold-start takes seconds | 4×A55-class cores + eMMC + a web engine. The app has to boot a JS runtime. |
| 4K/HDR video stutter | Fixed-function decode and HDMI bandwidth; not a CPU scheduling problem. |
| Menu animations feel 30 fps-ish | GPU and compositor are what they are. |
| Wi-Fi throughput | Radio/antenna, distance, channel congestion. Use Ethernet if the model has it. |
| Only ~1.5 GB RAM total | You cannot add RAM. You can only stop wasting it. |
| Web pages in the TV browser are slow | The browser is old and the CPU is small. Use an app, not the browser. |

Two things that *look* like speed problems but are not:

- **The TV taking 1–2 minutes after boot to answer the app manager.** That is
  boot sequencing, not a leak. It is why the boot hook polls instead of
  launching immediately (Chapter 2.4 and Chapter 5).
- **A launcher that "hangs" on first open.** It is fetching Cinemeta/JustWatch.
  After the first load the rails are cached for 6 h
  (`localStorage` `lumina.rails.v3`) and it should feel immediate.

---

## 6.4 Measure, don't guess

```sh
# memory + load
python3 tools/tvsh.py "grep -E 'MemTotal|MemAvailable|SwapTotal|SwapFree' /proc/meminfo; cat /proc/loadavg"

# who is using the RAM (top 12 by RSS; use `top -b -n 1 | head -15` if ps lacks -o)
python3 tools/tvsh.py "ps -eo pid,rss,comm 2>/dev/null | sort -k2 -nr | head -12"

# what is running that you did not ask for
python3 tools/tvsh.py "ps | grep -E 'contentminer|uploadd|rdxd|remotelogger|nudge|camera' | grep -v grep"
```

*What these do:* read memory, show the biggest processes, and check the six
masked services are gone. *What you should see:* `MemAvailable` in the hundreds
of MB (not tens), no output from the third command.

Glasshouse also exposes a live stats blob if it is installed:

```sh
curl -s http://192.168.0.10:8081/api/stats | python3 -m json.tool | head -40
```

*What this does:* shows temperature, load, memory and more as JSON. *What you
should see:* a `temp` (e.g. `62`), `load`, `mem` and `cores` block. On this model
there is **no** `/proc/lg/*`, so some fields (CPU MHz, HDMI timing) are `null` —
see `docs/GLASSHOUSE-STUDY.md`.

---

## 6.5 Deeper reading

If your checkout has them, the repo's speed reports go further:

- `docs/SPEED-*.md` — per-change measurements and analysis.
- `docs/GLASSHOUSE-STUDY.md` — exact telemetry sources, and what this model does
  and does not expose.
- `docs/PENDING.md` §2 — the app-prune decision list.

These are written by other workstreams and **may not exist yet** in your
checkout. The playbook above stands on its own.

---

**Next:** [7. See your TV without photos](07-see-your-tv-without-photos.md)

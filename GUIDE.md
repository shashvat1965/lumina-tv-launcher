# Lumina — from a factory-fresh LG TV to a custom home screen

A complete, start-to-finish guide. You begin with an **unmodified LG webOS TV** —
no root, no developer tools, no prior experience — and finish with the setup this
repo actually runs today: a rooted TV, Homebrew Channel, a de-bloated and
DNS-blocked system, a custom home screen called **Lumina**, and the Home key
rebound to open it.

Every chapter is written from the real files in this repo, and every command is
copy-pasteable. The exact commands the project's own scripts run are quoted — if
a script hardcodes an IP address, this guide says so and tells you exactly which
line to change.

> **Read the next two sections before you type anything.** Rooting a TV is
> reversible, but it is not risk-free, and the honest version of that matters
> more than a smooth sales pitch.

---

## What you'll get when you're done

| | |
| --- | --- |
| **Root** | Homebrew Channel installed; a root shell over SSH (and, while you keep it on, telnet). |
| **A shell** | `ssh root@<TV_IP>` from your computer, key-based. |
| **Less spying** | LG's consent/"service" collectors withdrawn, its silent app-updater blocked, firmware-update domains DNS-blocked, the background services we masked disabled. |
| **A custom home screen** | **Lumina** (`com.shashvat.launcher`): live movie/TV rails from Stremio's Cinemeta, a "where to watch" panel from JustWatch, an app launcher, My List / Continue Watching. |
| **It's actually the home screen** | The HOME key opens Lumina; a guarded boot hook opens it after a reboot; a watchdog bounces LG's home back to Lumina. |
| **A debug loop** | A screenshot/layout/console view of the TV's screen from your computer, over the network. |

---

## What it costs

**Time.** Budget about **an hour** for a first run: rooting is 10–20 minutes,
Homebrew + SSH a few minutes, the privacy/speed stack 10 minutes, building and
installing Lumina 10–15 minutes, and the Home-key + boot integration another
10 minutes (which includes one reboot). Add debugging time if your TV differs
from ours.

**Money.** None. Every tool used here is free and open source. The only "cost"
is your time and, if you use them, the streaming subscriptions you already pay
for.

**Risk.** Real but bounded. See below.

---

## Risk, honesty, and how to back out

**Warranty.** Rooting uses an exploit (a software vulnerability). It does not
open the TV, flash firmware, or touch the read-only system partition — but a
service technician *can* tell the TV was rooted, and some manufacturers treat
that as out of warranty. If your TV is under warranty and you care, don't do
this.

**What we actually change.** Everything lives in writable, non-system locations:

- `/media/developer/` — Homebrew Channel and installed apps (this is what a
  "root persistence" is; uninstalling Homebrew Channel wipes it).
- `/var/lib/webosbrew/init.d/` — boot hooks (plain scripts; delete to disable).
- `/home/root/.config/lginputhook/keybinds.json` — the Home-key rebind.
- Runtime settings via `settingsservice` (Quick Start+, power-on slot).

**Nothing here flashes or downgrades firmware, and nothing writes to the
read-only root filesystem.** The README for this repo states this flatly:
*"No firmware is flashed and nothing is downgraded."*

**What can go wrong.**

- The exploit fails on your model/firmware (very possible — see Chapter 1).
- A network experiment breaks networking until you revert it (that's what
  `dist/tv_wifi_revert.sh` exists for).
- A background service you disable turns out to be needed (masking is
  runtime-reversible; see Chapter 4 and Chapter 9).
- The boot hook can misbehave on an unusual TV and launch things you didn't ask
  for; our version is deliberately conservative, and Chapter 9 removes it.

**Undo.** You can reverse any single piece (Chapter 9), or go all the way back to
near-stock with `dist/tv_unroot.sh` plus uninstalling the apps, plus a factory
**Reset to Initial Settings**. **Unrooting is possible; a factory reset always
is.** Plan on a factory reset being the guaranteed final fallback.

---

## Prerequisites checklist

- [ ] **The TV**, on the same Wi-Fi/router as your computer.
- [ ] **A computer** (this guide assumes macOS; Linux works with the same tools;
      Windows would need adjustment for shell/python paths). It must be on the
      **same LAN** as the TV, able to reach it and be reached by it.
- [ ] **Python 3** on the computer (`python3 --version`).
- [ ] **git** (`git --version`).
- [ ] **The TV's LAN IP address** (e.g. `192.168.0.10`). Chapter 1 shows how to
      find it.
- [ ] **An SSH client** (`ssh` is already on macOS/Linux).
- [ ] **~1 hour**, and a willingness to read error messages.
- [ ] **Node.js** (optional) — only needed for the DevTools screenshots in
      Chapter 7.

> **Conventions used throughout.** This repo was built for **one specific TV**,
> so the numbers are baked in. Wherever you see them, substitute yours:
>
> - TV address: **`192.168.0.10`**
> - Mac/computer address: **`192.168.0.3`**
> - HTTP server port for installs: **`8123`** · SlopBro's port: **`8080`**
> - Glasshouse dashboard: **`8081`** · TV Chrome DevTools: **`9998`**
>
> All of the Python tools and `tools/tv-cdp.js` now honour a **`TV_IP`**
> environment variable (`TV_IP=192.168.1.55 python3 tools/probe_tv.py`). The
> shell scripts under `dist/` and `rootrun/` still hardcode `192.168.0.3` /
> `192.168.0.10` in their headers — each chapter says exactly where.

---

## If you only do three steps

Short on time, or just want to see if your TV is even a candidate? Do these:

1. **Check compatibility and don't update the firmware** — Chapter 1.
2. **Root with SlopBro** — Chapter 2.
3. **Build, install, and open Lumina** — Chapter 5.

That gets you a rooted TV running a custom home screen you launch by hand. The
privacy stack (4), the Home-key/boot integration (5), speed tuning (6),
debugging (7) and extras (8) can all wait.

---

## Table of contents

| Chapter | What it covers |
| --- | --- |
| [1. Check your TV](guide/01-check-your-tv.md) | Model + firmware, find the IP, is it rootable, the do-not-update rule. |
| [2. Root it with SlopBro](guide/02-root.md) | The exploit, the TV pairing prompt, and the pitfalls we hit. |
| [3. Homebrew Channel and a root shell](guide/03-homebrew-and-a-shell.md) | Verify Homebrew, enable SSH, connect, telnet fallback and its warning, luna-send quirks. |
| [4. Declutter and privacy](guide/04-declutter-and-privacy.md) | LGWS, App Update Blocker, DNS blocking, Quick Start+, service pruning, what not to touch. |
| [5. Your own home screen: Lumina](guide/05-your-own-home-screen.md) | Build, install, dev-install gotcha, data sources, and making it the default home. |
| [6. Speed](guide/06-speed.md) | What actually helped, what's hardware-bound, deeper reports. |
| [7. See your TV without photos](guide/07-see-your-tv-without-photos.md) | The TV's Chrome DevTools on port 9998, plus the root shell. |
| [8. Extras](guide/08-extras.md) | Stremio, where-to-watch, the HDMI tile, vitals screensaver, AI research, Spotify. |
| [9. Undo and unroot](guide/09-undo-and-unroot.md) | Every undo path, then the full unroot + factory reset. |
| [99. Troubleshooting](guide/99-troubleshooting.md) | The pitfalls we genuinely hit: symptom → cause → fix. |

---

## Where the details live

This guide is the narrative. The repo also ships deeper reference documents
(written alongside this one, so they may appear over time):

- `docs/HOMEBREW-HOOKS.md` — the exact boot hooks and how to remove each one.
- `docs/PENDING.md` — open decisions (the PS5 tile, the telnet question, the
  app-prune list).
- `docs/GLASSHOUSE-STUDY.md` — a deep read-only study of how Glasshouse reads the
  TV and how its screensaver works.
- `docs/SPEED-*.md`, `docs/SCREENSAVER.md`, `docs/AI-*.md`, `docs/SPOTIFY.md` —
  referenced from Chapters 6 and 8 **if present** in your checkout; not every
  document is finished.

And the source of truth for the launcher itself: the repo `README.md`.

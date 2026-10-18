# 4. Declutter and privacy

**Goal:** stop the TV from spying on you, updating itself behind your back, and
running services you never asked for — reversibly.

**Time:** 15–20 minutes. **Risk:** low-to-medium. Every change here is
reversible (Chapter 9), but one of them (disabling background services) can make
a feature you actually use stop working. Read 4.6 before you run it.

---

## 4.0 The stack, at a glance

| Change | What it stops | How |
| --- | --- | --- |
| **Life's Good Without Spying** | LG consent/"service" agreements + collectors | Homebrew app |
| **LG App Update Blocker** | Silent updates of LG's own apps | Homebrew app |
| **Quick Start+ off** | "Instant on" standby (and makes the boot hook run) | `settingsservice` |
| **Firmware-update domains blocked** | The TV downloading a firmware update | Glasshouse `hosts` |
| **Six background services masked** | Telemetry, diagnostics, ACR content mining, popups | Glasshouse API |
| **Bluetooth disabled** | The Bluetooth stack (optional) | Homebrew app |

---

## 4.1 Install the two Homebrew apps

Open **Homebrew Channel** on the TV and install, from its app list:

1. **Life's Good Without Spying** — `ooo.lew.lifesgoodwithoutspying`
2. **LG App Update Blocker** — `org.webosbrew.appupdateblocker`

*What you should see:* both appear in the TV's app list, and Homebrew Channel
reports them installed. Verify from the computer:

```sh
cd ~/tv-launcher
python3 tools/probe_tv.py | grep -E 'lifesgood|appupdateblocker'
```

*What this does:* lists installed apps and filters to the two ids. *What you
should see:* two lines containing those ids.

> **If they do not appear:** the TV's app list sometimes needs a refresh or a
> reboot. See Chapter 99 — "apps that look installed only after a refresh".

### Life's Good Without Spying

It withdraws the TV from LG's consent and "service" agreements and shuts down the
associated collectors. It also installs its own boot hook so the setting survives
reboots: `/var/lib/webosbrew/init.d/50-lifesgoodwithoutspying` (see
`docs/HOMEBREW-HOOKS.md`).

It has a control script on the TV:

```sh
/media/developer/apps/usr/palm/applications/ooo.lew.lifesgoodwithoutspying/init/nospy-ctl.sh disable
```

*What this does:* disables the app's effect completely. *What you should see:*
the script's own status output. `dist/tv_wifi_revert.sh` suggests this as the way
to rule the app out if networking misbehaves (more in Chapter 99). Keep that path
handy.

### LG App Update Blocker

It stops LG silently updating its pre-installed apps (which can undo your
privacy choices and change behaviour under you). `docs/HOMEBREW-HOOKS.md` notes
that it *probably* installs a boot hook but this repo never created or listed
one — so if you go looking, run `ls -la /var/lib/webosbrew/init.d/` rather than
assuming a filename.

---

## 4.2 Turn Quick Start+ off

**Quick Start+** is LG's "instant on" standby: the TV never really powers down,
so it boots faster but never re-runs boot hooks reliably. Turning it off makes
every power-on a real boot — which the boot hook in Chapter 5 needs.

On the TV: **Settings → General → Additional Settings → Quick Start+ → off**
(wording varies).

Or do it exactly as the repo does:

```sh
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings '{\"category\":\"option\",\"settings\":{\"quickStartMode\":\"off\"}}'"
```

*What this does:* sets `option.quickStartMode` to `off`. *What you should see:*
JSON with `"returnValue":true`.

Verify:

```sh
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.settingsservice/getSystemSettings '{\"category\":\"option\",\"keys\":[\"quickStartMode\"]}'"
```

*What this does:* reads the setting back. *What you should see:*
`"quickStartMode":"off"`.

`dist/tv_push.sh` and `dist/tv_unroot.sh` use the same two calls — off to enable
the setup, back `on` to restore stock behaviour.

---

## 4.3 Block firmware-update domains (DNS)

The TV resolves update servers through DNS; if those names resolve to nowhere,
it cannot download a firmware update. **Glasshouse** does this with a `hosts`
file bind-mounted over the system one, and its boot hook re-applies it after each
boot (`glasshouse/server/50-tvweb.sh`, installed as
`/var/lib/webosbrew/init.d/50-tvweb.sh`).

**You need Glasshouse installed for this** — see 4.6. This repo vendors a
Glasshouse checkout at `glasshouse/` for reference, but it is **gitignored and not
part of the pushed repo**; use that checkout's `glasshouse/server/deploy.sh` (or
the upstream project's install instructions) to put it on the TV.

Once Glasshouse is running, the block is automatic and survives reboots. Confirm
from the TV that the hosts file is the Glasshouse one:

```sh
python3 tools/tvsh.py "head -5 /etc/hosts; mount | grep hosts"
```

*What this does:* shows the active hosts file and whether it is bind-mounted.
*What you should see:* a hosts file containing block entries, and a mount line
pointing at Glasshouse's copy.

> **This is why Chapter 1's do-not-update rule still matters.** The DNS block
> only exists *after* Glasshouse is installed and booted. Before that, the TV can
> still update itself. Decline prompts until you are here.

---

## 4.4 Bluetooth, if you don't want it

If you never use the TV's Bluetooth (no BT remote, headphones, or soundbar), the
**Bluetooth Disabler** removes the stack and a little background work:

- Homebrew app **`pl.krzywro.webos-bluetooth-disabler`** (the built package is
  `dist/pl.krzywro.webos-bluetooth-disabler_1.1.0_all.ipk` in our checkout).

*What you should see:* the TV's Bluetooth menu stops offering devices. **Do not
install this if your remote is Bluetooth-only** — you would lose your remote.
Check what your remote uses before you touch this.

---

## 4.5 Service pruning via Glasshouse

This is the biggest single de-bloat win, and the easiest to get wrong. Read the
whole section first.

### What it does

LG runs a pile of background daemons: telemetry uploaders, crash/diagnostic
loggers, an ACR "content miner" that fingerprints what is on screen, a
promotions/nudge daemon, a USB-camera watcher, and so on. Glasshouse exposes a
curated list of them and can **mask** (disable) them at runtime.

The repo's tool is `tools/glasshouse_services.py`:

```sh
cd ~/tv-launcher
curl -s http://192.168.0.10:8081/api/services | python3 -m json.tool | head -60
```

*What this does:* shows the curated service list Glasshouse reports, **before**
you change anything. *What you should see:* a JSON array of services with `id`,
`title`, `disabled`, and `running`. Read the titles and descriptions — this is
your chance to veto.

Then:

```sh
python3 tools/glasshouse_services.py
```

*What this does:* reads `MemAvailable` from `/proc/meminfo` over SSH, disables
**every service Glasshouse reports as not already disabled**, waits 4 seconds,
re-reads the list and the memory, and prints what is still enabled.
*What you should see:* a `before` table, a line per service with `ok`, an `after`
table, `MemAvailable before/after`, a `freed: X MB` line, and
`still enabled: ...`.

> **SSH is only used for the memory reading.** The toggles themselves go over
> Glasshouse's HTTP API on 8081. If SSH is not set up, the numbers are missing
> but the disabling still works; set `TV_IP`/`TVWEB` if your addresses differ.

On our TV this masked **six** services:

| id | What it was doing |
| --- | --- |
| `contentminer` | ACR content fingerprinting for ads/viewing telemetry |
| `uploadd` | Uploads crash logs, diagnostics and usage telemetry to LG |
| `rdxd` | Remote diagnostics; writes traces/core dumps to flash |
| `remotelogger` | Ships system logs to remote servers |
| `nudge` | LG marketing/promotion popups and tips |
| `camera` | USB webcam detection daemon |

> **Read this before running it.** The script is **not selective** — it disables
> whatever `/api/services` returns, not just the six above. On a different TV or
> Glasshouse version the list can be longer (the catalog also contains `mycar`,
> `crashreportd`, and a hidden `voiceconductor`). If you only want specific ones,
> toggle them by hand instead:
>
> ```sh
> curl -s -X POST -H 'Content-Type: application/json' \
>   -d '{"id":"nudge","disabled":true}' http://192.168.0.10:8081/api/services/toggle
> ```
>
> *What this does:* disables exactly one service. *What you should see:*
> `{"ok":true,...}`.

### Put them back

Reversal is the same API with `disabled: false`. The Python tool only disables,
so do it directly:

```sh
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"id":"contentminer","disabled":false}' http://192.168.0.10:8081/api/services/toggle
```

*What this does:* re-enables one service. *What you should see:* `{"ok":true,...}`.
Repeat per id. Then verify with `curl -s http://192.168.0.10:8081/api/services`.

### The catch: masks are runtime-only, then re-applied at boot

A mask does **not** edit a unit file; it stops the process for now. Glasshouse
persists your choice and re-applies it at boot from its own hook
`/var/lib/webosbrew/init.d/20-tvweb-services`. So:

- If you re-enable a service and reboot, it may come back **disabled** again
  (Glasshouse remembers).
- If you remove that init hook, the mask lasts only until the next reboot.

That's the "runtime-only" trap in Chapter 99. If you want a service permanently
back, re-enable it **in Glasshouse** (the toggle), not just with `kill`/`start`.

### Do not disable these

- **Anything you cannot explain.** Titles and descriptions are right there in
  `/api/services`; if it sounds like audio, video, networking, HDMI detection,
  settings, or the app manager, leave it.
- **`com.webos.service.eim`** — HDMI/device detection. Glasshouse's own study
  notes the PS5's name comes from `eim/getAllInputStatus`; disabling it would
  break input naming and CEC labels.
- **`com.webos.service.tvpower` / power management** — you like your TV turning
  on.
- **Wi-Fi / connman** — obviously.
- **`voiceconductor`** — Glasshouse hides it from the normal list for a reason:
  it is LG's voice assistant, and how it behaves depends on the AI-button
  setting. Don't poke it unless you are deliberately turning voice off.
- **`tvdataexchanger` and `alwaysready`** — Glasshouse marks these **retired**:
  they are deliberately *never* switched off (they caused muted video and a
  stretched picture on other models). If you see them, leave them.

---

## 4.6 Where Glasshouse fits

Glasshouse is a separate upstream project: a small Node server on the TV
(`/var/lib/tvweb/`) with a dashboard at `http://<TV_IP>:8081`, a stats/telemetry
API, an ad-blocking hosts mount, screensavers, and the service toggles above.
This repo vendors a read-only checkout at `glasshouse/` (gitignored) and drives
its API from `tools/glasshouse_services.py`.

To install it, use the checkout's deploy path:

```sh
cd ~/tv-launcher/glasshouse
cat server/deploy.sh          # read it before running it
```

*What this does:* shows Glasshouse's own deploy script. *What you should see:*
the script's steps (it copies the server to `/var/lib/tvweb/` and installs its
boot hook). Follow the upstream project's instructions for the actual deploy —
this repo does not re-document them, and Glasshouse is not committed here.

> **Port 8080 conflict.** Glasshouse and Stremio/SlopBro-style tooling both like
> port 8080 on some setups. If Glasshouse fails to start with `EADDRINUSE`, give
> it a different port in its `config.json` (`"port": 8081` is what this project
> uses) and point the tools at it with `TVWEB`:
>
> ```sh
> TVWEB=http://192.168.0.10:8081 python3 tools/glasshouse_services.py
> ```
>
> See Chapter 99.

---

## 4.7 Check your work

```sh
python3 tools/tvsh.py "ps | grep -E 'contentminer|uploadd|rdxd|remotelogger|nudge|camera' | grep -v grep"
```

*What this does:* looks for the six processes. *What you should see:* **no
output** (they are gone). If any are still there, the toggle did not take —
re-check the id spelling in `/api/services`.

```sh
free -m 2>/dev/null || grep -E 'MemTotal|MemAvailable' /proc/meminfo
```

*What this does:* shows memory. *What you should see:* more `MemAvailable` than
before — on a 1.5 GB TV, a few tens of MB is a real win, but don't expect magic
(Chapter 6).

---

**Next:** [5. Your own home screen: Lumina](05-your-own-home-screen.md)

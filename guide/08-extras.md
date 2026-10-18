# 8. Extras

Short chapters for the other things in this project. Some are finished and
working; some are research or **in progress**. They are labelled honestly — do
not read "in progress" as "will work if you follow along".

---

## 8.1 Stremio (the player behind Play)

Lumina has **no bundled video player**. The **Play** button launches
**Stremio** (`io.strem.webos`) and asks you to choose a source there. That is a
deliberate split: Stremio does discovery/add-ons/sources, Lumina does the
browsing.

- App id: `io.strem.webos`
- **Does not need root.** It is a normal webOS app; install it from the LG store
  if it is available in your region, or from Homebrew Channel / a side-loaded
  `.ipk` (the project's build is
  `dist/io.strem.webos_1.1.5_all.ipk` in our checkout — **gitignored**, not in
  the repo).
- The "where to watch" chips (8.2) are separate: they hand off to *streaming
  services*, not Stremio.

If Play shows `Could not open Stremio`, the app is not installed under that id,
or it is not visible to the launcher. Check with:

```sh
python3 tools/probe_tv.py | grep -i strem
```

*What this does:* confirms the app id is installed. *What you should see:* a line
with `io.strem.webos`.

---

## 8.2 Where-to-watch chips — **working, best-effort**

Per title, Lumina asks **JustWatch** (GraphQL, `country: IN`) which services
carry it, caches the answer for 24 h, and **filters to services you actually have
installed**. The chips launch the provider app with its own deep link/ID.

Providers the app knows about:

| Chip | App id |
| --- | --- |
| Prime Video | `amazon` |
| Netflix | `netflix` |
| JioHotstar | `hotstar` |
| Apple TV | `com.apple.appletv` |
| SonyLIV | `com.sonyliv2.tvapp` |
| ZEE5 | `com.zee5.app` |
| YouTube | `youtube.leanback.v4` |

**Best-effort is the honest word.** Some apps ignore deep links and land on
their home screen. If you uninstall a provider, its chip disappears (offers are
filtered to installed apps) — which also means the app list must be re-baked
(Chapter 5.2) for that to be reflected.

**Region:** the query hardcodes `country: IN` in `app/js/data.js`. Outside India,
edit both `country:IN` occurrences (the search query and the offers query) to
your country code.

---

## 8.3 The PS5 / HDMI input tile — **in progress**

There is an **HDMI tile** in the app list (`com.webos.app.hdmi2`, shown as
"HDMI 2"). It launches the input. It does **not** know a PlayStation is plugged
in.

Say that plainly: **a device's *name* over HDMI is only obtainable the way
Glasshouse does it** — through LG's `com.webos.service.eim`, which composes and
caches a label from its device detection plus CEC/SPD data
(`getAllInputStatus` → `devices[].label`, e.g. `"PS5 Game Console"`, with a
`subList` carrying the CEC name `"PlayStation 5"`, brand, vendor and
`deviceType: "game"`). webOS will not otherwise tell you what is on an HDMI
port. The full method, including the `eim_device_db.json` and SPD details, is in
**`docs/GLASSHOUSE-STUDY.md`** (if present in your checkout).

What remains is a decision, per `docs/PENDING.md` §1:

1. **Name the port on the TV** (LG's input/connection settings, or
   `settingsservice`). Until then the tile is just "HDMI 2".
2. **Brand the tile**: edit the baked entry for `com.webos.app.hdmi2` in
   `app/js/apps.js` — but that file is **generated**, so the durable fix is to
   teach `tools/fetch_apps.py` a label/icon override for that id, then re-bake,
   rebuild and reinstall.

Do not expect the tile to auto-detect the console from the launcher; that is the
part that is not finished.

---

## 8.4 Vitals screensaver — **working via Glasshouse, in progress here**

Glasshouse has a **`vitals`** screensaver mode: CPU load, temperature, memory,
etc. rendered as a QML screensaver on the TV. Mechanically it is the stock
`com.webos.app.screensaver` app with Glasshouse's QML **bind-mounted over its
directory**, and Glasshouse's `50-tvweb` boot hook restores the mount after each
reboot. The QML polls `http://127.0.0.1:8081/api/stats` itself.

On this model some vitals are missing: there is **no `/proc/lg/*`**, so CPU MHz
and HDMI timing are `null`; the temperature comes from the kernel thermal zone
(`/sys/class/thermal/thermal_zone0/temp`) and load from `/proc/stat`. Details and
exact fields: **`docs/GLASSHOUSE-STUDY.md`**.

The project's own screensaver notes live in **`docs/SCREENSAVER.md`** — cross-
reference it **if present**. The "Lumina-native vitals screen" is research, not a
shipped feature.

> If you start a screensaver/boot helper by hand from an SSH session and it dies
> when you disconnect, that is the `nohup setsid` trap — see Chapter 99.

---

## 8.5 AI agent research — **in progress**

There is research in this project about using an AI agent to drive/inspect the
TV (the same devtools + luna + shell surface this guide documents). It is
**research**, not a finished feature. See **`docs/AI-*.md`** if those files are
present in your checkout. Nothing in the working setup depends on it.

---

## 8.6 Spotify — **in progress**

There is work around **Spotify** on the TV (`spotify-beehive` appears in the
baked app list). Treat it as **in progress**: see **`docs/SPOTIFY.md`** if
present. It is not part of the Home-key/boot/watchdog setup and nothing here
requires it.

---

## 8.7 The design reference

`design/lumina-reference.html` is the original **Open Design prototype** the
launcher's layout and styling came from. It is kept as a labelled reference and
is **not shipped** in the `.ipk`. Open it in a desktop browser if you want to see
the intended look at full size.

---

**Next:** [9. Undo and unroot](09-undo-and-unroot.md)

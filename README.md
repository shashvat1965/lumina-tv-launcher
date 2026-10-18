# Lumina — a custom home screen for a rooted LG webOS TV

**Lumina** (`com.shashvat.launcher`) is a custom home screen for a rooted **LG
43NU885BPLA** (LG calls the generation webOS 26; the TV's SDK reports webOS
11.0.1, firmware 43.04.24). It comes with the tooling this project needed to get
there: rooting and remote access, a privacy/speed stack, a Home-key rebind, a
guarded boot hook and a watchdog — so the TV opens *your* home screen instead of
LG's.

**No firmware is flashed and nothing is downgraded.** Everything lives in
writable, non-system locations and each piece can be removed independently.

## Start here

**[→ GUIDE.md](GUIDE.md)** — the complete, start-to-finish guide: from a
factory-default TV with no root and no tools, through rooting, the homebrew
shell, de-bloating, building and installing Lumina, to making it the default
home screen. It includes risk/reversibility up front, a prerequisites checklist,
and a troubleshooting chapter of problems this project actually hit.

Chapter index: [1. Check your TV](guide/01-check-your-tv.md) ·
[2. Root](guide/02-root.md) ·
[3. Homebrew + shell](guide/03-homebrew-and-a-shell.md) ·
[4. Declutter & privacy](guide/04-declutter-and-privacy.md) ·
[5. Your own home screen](guide/05-your-own-home-screen.md) ·
[6. Speed](guide/06-speed.md) ·
[7. See your TV](guide/07-see-your-tv-without-photos.md) ·
[8. Extras](guide/08-extras.md) ·
[9. Undo & unroot](guide/09-undo-and-unroot.md) ·
[99. Troubleshooting](guide/99-troubleshooting.md)

## Supported TV

Built and verified on **LG 43NU885BPLA.DTRDLJL** — NanoCell, board
`K25LPN_DVB_AJ`, 4-core ARM, 1.5 GB RAM. Rooted with **SlopBro** (webOS 4–11)
and **Homebrew Channel**.

Other webOS TVs may work if a known root method applies to their
**model + firmware**. **Check compatibility first** (`cani.rootmy.tv`,
`webosbrew.org`) and **do not accept a firmware update before rooting** — a
patched TV cannot be downgraded. See [Chapter 1](guide/01-check-your-tv.md).

## Repo layout

| Path | What it is |
| --- | --- |
| `GUIDE.md`, `guide/` | The start-to-finish guide (this is the front door). |
| `app/` | The launcher: plain HTML/CSS/**ES5**, no build step. `js/data.js` is the data layer (Cinemeta + JustWatch); `js/apps.js` is **generated**. |
| `tools/` | Build/deploy/debug: `fetch_apps.py`, `build_ipk.py`, `deploy.py`, `ssap_install.py`, `tvsh.py`, `run_tv.py`, `probe_tv.py`, `glasshouse_services.py`, `tv-cdp.js`. Honour `TV_IP`. |
| `rootrun/` | Root-side payloads: `lumina-boot.sh` (one-shot boot launch), `lumina-watchdog.sh` (foreground watchdog), earlier `autoroot.sh`. |
| `dist/` | On-TV helpers (`tv_update.sh`, `tv_install.sh`, `tv_stop_launcher.sh`, `tv_unroot.sh`, `tv_wifi_revert.sh`, …). Built `.ipk`s are gitignored. |
| `design/` | The original Open Design prototype, kept as a reference; not shipped. |
| `docs/` | `HOMEBREW-HOOKS.md` (boot hooks + removal), `PENDING.md` (open items), `GLASSHOUSE-STUDY.md`, plus other reports. |
| `glasshouse/`, `shots/` | **Gitignored.** Vendored Glasshouse checkout and local screenshots. |

## Build and install (short version)

```sh
python3 tools/fetch_apps.py                    # bake the TV's app list
python3 tools/build_ipk.py                     # -> dist/com.shashvat.launcher_<v>_all.ipk
python3 tools/deploy.py "$(ls -t dist/com.shashvat.launcher_*_all.ipk | head -1)" --launch com.shashvat.launcher
```

Dev installs need the dev-mode flag and a restarted installer, or they fail
silently: `mkdir -p /var/luna/preferences/devmode_enabled; restart appinstalld`.
Full detail in [Chapter 5](guide/05-your-own-home-screen.md).

## Privacy and security

- This is a **private repo** for one TV. The TV's LAN address **`192.168.0.10`**
  and the dev machine's **`192.168.0.3`** appear directly in the scripts. That is
  intentional here; it would need scrubbing before this became public.
- **No secrets are committed**: no keys, tokens or credentials. The SSH key used
  by `tools/glasshouse_services.py` (`~/.ssh/webos_tv`) lives outside the tree.
- **Homebrew's telnet service is unauthenticated root on your LAN.** Use SSH
  where possible and turn telnet off when you are done setting up — see
  `docs/PENDING.md` §3 and [Chapter 3](guide/03-homebrew-and-a-shell.md).

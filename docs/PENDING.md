# Pending / open items

Things that are deliberately left for the owner to decide. None of these is a bug in the launcher.

## 1. PS5 tile (HDMI 2)

HDMI 2 is the **only connected input** on the TV. The TV exposes **no device name** for an HDMI
port — webOS will not tell us what is plugged in, so the launcher cannot detect "PlayStation 5" and
label the tile on its own.

Two halves, both needing the owner's input:

- **Name the port on the TV** (LG's input/connection settings let you rename an HDMI input, or it can
  be set through `settingsservice`). Until the port is named, the tile is just "HDMI 2".
- **Brand the tile PlayStation.** The tile comes from the baked app list: `tools/fetch_apps.py`
  writes `app/js/apps.js`, and the HDMI entries (`com.webos.app.hdmi2`) currently carry the generic
  title `"HDMI 2"` and a neutral `iconColor`. To brand it, change that entry's title to something
  like `"PlayStation"`/`"PS5"` and (optionally) drop in a PlayStation icon in the icon-copy manifest.

Waiting on: the owner's chosen port name and tile label/icon.

## 2. App-prune list — keep or delete?

The launcher bakes the TV's installed apps into `app/js/apps.js` (33 entries, 5 of them inputs/ports).
Uninstalling removes them from LG's app list but **not** from the baked list until
`tools/fetch_apps.py` is re-run — so this is a decision list, not an automatic prune.

Present in the baked list today, grouped by how clearly they earn their place:

**Core — keep unless you know otherwise**

| App | id |
| --- | --- |
| Launcher (Lumina) | `com.shashvat.launcher` |
| Homebrew Channel | `org.webosbrew.hbchannel` |
| LG Input Hook | `org.webosbrew.inputhook` |
| Stremio | `io.strem.webos` |
| Live TV / HDMI 1–4 | `com.webos.app.livetv`, `com.webos.app.hdmi1..4` |
| Settings | `com.palm.app.settings` |

**Privacy / speed stack — keep while rooted**

| App | id |
| --- | --- |
| Life's Good Without Spying | `ooo.lew.lifesgoodwithoutspying` |
| LG App Update Blocker | `org.webosbrew.appupdateblocker` |

**Streaming — owner's call (drives the "where to watch" chips)**

| App | id |
| --- | --- |
| Netflix | `netflix` |
| Prime Video | `amazon` |
| JioHotstar | `hotstar` |
| Apple TV | `com.apple.appletv` |
| SonyLIV | `com.sonyliv2.tvapp` |
| ZEE5 | `com.zee5.app` |
| YouTube | `youtube.leanback.v4` |
| Spotify | `spotify-beehive` |
| Kodi | `org.xbmc.kodi` |
| FanCode | `com.fancode.app.streaming` |
| Web Browser | `com.webos.app.browser` |
| Apps (LG store) | `com.webos.app.discovery` |

Removing a streaming app also drops its chip from the detail panel, since offers are filtered to
installed apps.

**LG extras / installed-once experiments — suggested candidates to prune, pending your decision**

| App | id |
| --- | --- |
| Copilot | `shortcutcopilot` |
| 8 Ball Pool | `com.miniclip.eightballpool` |
| LG Gaming Portal | `com.twin.app.gamingportal` |
| LG Sports Playbook | `epoxyaisports` |
| Sports | `com.webos.app.sportsteamsettings` |
| LG Streaming Week | `webos.day` |
| LG Gallery+ | `com.webos.app.lifeonscreen` |
| Media Player | `com.webos.app.mediadiscovery` |
| Home Hub | `com.webos.app.homeconnect` |

Waiting on: keep/delete for each of the last two groups. After deciding, uninstall on the TV
(app list → long-press → delete) and re-run `tools/fetch_apps.py` to rebuild `app/js/apps.js` (and
the icon manifest), then reinstall the launcher.

## 3. Telnet root shell is still open on the LAN

Homebrew Channel's **telnet service is still enabled and unauthenticated** — `tools/tvsh.py` simply
connects to `192.168.0.10:23` and gets a **root** shell, no credentials. Anything else on the LAN can
do the same.

**SSH works** (`ssh root@192.168.0.10`, key at `~/.ssh/webos_tv`), so telnet is redundant and should
be turned off — via the Homebrew Channel settings (disable its telnet service) or by blocking port 23
at the router/firewall. Note that `tools/tvsh.py` will stop working once telnet is closed; switch to
SSH or to `tools/run_tv.py` / `tools/deploy.py` (SSAP) instead.

Waiting on: owner go-ahead to close telnet (and confirmation that the debug tooling can move to SSH).

## Also worth a look

- `docs/HOMEBREW-HOOKS.md` lists two hooks whose exact on-device names/contents this repo never sees
  (`50-tvl-ssh.sh`, a possible App Update Blocker hook). A single `ls -la /var/lib/webosbrew/init.d/`
  and `cat` on the TV would settle both and let that doc drop its "verify on device" caveats.
- Whether the TV's copy of `60-tvl-launcher.sh` is the conservative single-attempt version
  (`rootrun/lumina-boot.sh`) or an earlier retry-loop version (`rootrun/autoroot.sh` /
  `dist/tv_push.sh`) — worth confirming, since it is the only hook that touches boot timing.

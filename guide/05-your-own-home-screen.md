# 5. Your own home screen: Lumina

**Goal:** build the Lumina launcher, install it on the TV, then make it the thing
you actually land on — HOME key, boot, and the fallback when LG's home sneaks
back.

**Time:** 20–30 minutes including a reboot. **Risk:** low. The app is inert until
you open it; the autostart pieces are each independently removable.

---

## 5.1 What Lumina is

`com.shashvat.launcher` — **Lumina** — is a webOS app made of plain HTML, CSS and
**ES5** JavaScript. There is **no build step**: no bundler, no npm, no
transpiler. `app/` is the app.

```
app/
  appinfo.json        id, version, title, icon, resolution
  index.html          the whole UI shell
  css/                style.css, fonts.css
  js/app.js           UI, navigation, detail panel, focus
  js/data.js          Cinemeta rails + JustWatch offers + localStorage lists
  js/apps.js          GENERATED app list (see 5.2)
  js/fallback.json    bundled offline catalogue
  assets/             bundled poster images
  fonts/              bundled woff2 fonts
```

It is ES5 on purpose: it has to run in the TV's own web engine, not a modern
browser.

### Where its data comes from

| Data | Source | Cache |
| --- | --- | --- |
| Rails (Popular Movies, Popular Series, Top Rated, Action, Comedy, Sci-Fi, Thriller, Drama Series) | `https://cinemeta-catalogs.strem.io/top` | `localStorage` `lumina.rails.v3`, 6 h |
| Per-title meta (cast, director, synopsis, runtime) | `https://v3-cinemeta.strem.io/meta` | in-memory |
| "Where to watch" | JustWatch GraphQL (`https://apis.justwatch.com/graphql`, `country: IN`) | 24 h |
| My List | `localStorage` `lumina.list` | permanent |
| Continue Watching | `localStorage` `lumina.continue` | permanent |
| App list + icons | **baked** from your TV at build time | in the package |

Two consequences worth knowing:

- **No account, no API key.** Cinemeta is Stremio's public catalogue service;
  JustWatch's GraphQL endpoint is keyless in the way the app uses it.
- **The app list is baked, not queried.** webOS denies `listApps` to third-party
  apps, so `tools/fetch_apps.py` reads the installed apps over SSAP *from your
  computer* and writes them into `app/js/apps.js`. That is why you must re-run it
  after installing or removing apps (5.2).

---

## 5.2 Get the repo and bake the app list

```sh
cd ~
git clone git@github.com:shashvat1965/lumina-tv-launcher.git
cd lumina-tv-launcher
```

*What this does:* clones this private repo. *What you should see:* `app/`,
`tools/`, `dist/`, `rootrun/`, `docs/`. You need access to the private repo
(an SSH key on GitHub) for this to work.

Now read the TV's installed apps and write the launcher's app list:

```sh
TV_IP=192.168.0.10 python3 tools/fetch_apps.py
```

*What this does:* connects over SSAP (using `~/slopbro` and the saved key),
calls `listApps`, filters out LG's hidden/system apps, pins Live TV and HDMI 1–4
first, and writes two files: `app/js/apps.js` and `rootrun/copy_icons.sh` (the
on-TV icon-copy manifest). *What you should see:* something like

```
baked 33 apps (pinned: com.webos.app.livetv, com.webos.app.hdmi1, ...)
wrote /Users/you/lumina-tv-launcher/app/js/apps.js
wrote /Users/you/lumina-tv-launcher/rootrun/copy_icons.sh
```

> **Re-run this whenever your app list changes.** Uninstalling an app does not
> remove it from a launcher that already shipped; it stays baked until you re-run
> `fetch_apps.py`, rebuild and reinstall. `docs/PENDING.md` §2 is the project's
> own keep/delete decision list.

> **Icons cannot be fetched remotely.** They live inside the TV's app folders.
> `fetch_apps.py` emits shell that copies them **on the TV** (falling back to each
> app's own resource URL). That is what `dist/tv_update.sh` / `dist/tv_icons.sh`
> run after an install.

---

## 5.3 Build the package

```sh
python3 tools/build_ipk.py
VERSION=$(python3 -c "import json; print(json.load(open('app/appinfo.json'))['version'])")
echo "built version: $VERSION"
```

*What this does:* reads `app/appinfo.json`, packs every file under `app/` into a
webOS `.ipk` (an `ar` archive wrapping `control.tar.gz` + `data.tar.gz`) with no
external dependencies, writes
`dist/com.shashvat.launcher_<version>_all.ipk`, and syncs
`rootrun/copy_icons.sh` into `dist/`. The second line captures the version so the
copy-paste commands below never go stale. *What you should see:*

```
wrote /Users/you/lumina-tv-launcher/dist/com.shashvat.launcher_0.2.3_all.ipk (NNNNN bytes, NN app files)
synced copy_icons.sh -> dist/
built version: 0.2.3
```

Check it:

```sh
python3 tools/inspect_ipk.py "dist/com.shashvat.launcher_${VERSION}_all.ipk"
```

*What this does:* lists the archive members and dumps `control` and
`appinfo.json`. *What you should see:* `debian-binary`, `control.tar.gz`,
`data.tar.gz`, and the app's `appinfo.json` with `"id":
"com.shashvat.launcher"`.

> **Bump the version before building.** `app/appinfo.json` is at `0.2.3` right
> now (other workstreams keep bumping it — **check the file**, don't trust this
> guide). If you reinstall the same version, the TV may decide it has nothing to
> do. Bump it for each real change.

> **New terminal?** Re-run the `VERSION=` line from 5.3 before any command below
> that uses `${VERSION}`.

---

## 5.4 Serve the package to the TV

The TV cannot see your filesystem; it downloads the `.ipk` over HTTP from your
computer. This project uses **port 8123**.

### Start the server

```sh
cd ~/tv-launcher/dist
python3 -m http.server 8123
```

*What this does:* serves `dist/` (including the `.ipk` and `copy_icons.sh`) on
your LAN. *What you should see:* `Serving HTTP on 0.0.0.0 port 8123 ...`. Leave
it running.

Check it from another terminal:

```sh
curl -s http://192.168.0.3:8123/ | grep -o 'com\.shashvat\.launcher_[0-9.]*_all\.ipk' | sort | tail -1
```

*What this does:* asks the server for its directory listing and extracts the
newest-looking IPK name. *What you should see:* the filename, e.g.
`com.shashvat.launcher_0.2.3_all.ipk`. **If this prints nothing, the TV will also
find nothing** — you are in the wrong directory or the server is not running.

### The dev-install gotcha (do not skip this)

Development installs **fail silently** without the dev-mode flag and a restarted
installer. Every install script in this repo does this first, and so should you:

```sh
mkdir -p /var/luna/preferences/devmode_enabled
restart appinstalld
```

*What this does:* creates the flag that tells webOS the TV is in developer mode,
and restarts the app-install daemon so it picks the flag up. *What you should
see:* nothing much — `mkdir` is silent and `restart` prints an upstart job line.
If you skip this, `luna-send …/dev/install` can return success-ish output while
**nothing is installed**. That is Chapter 99's "installs that appear to succeed
but don't".

`dist/tv_update.sh` wraps exactly this, including a defensive
`rm -f` before `mkdir --`:

```sh
if [ ! -d /var/luna/preferences/devmode_enabled ]; then
  rm -f /var/luna/preferences/devmode_enabled
  mkdir -- /var/luna/preferences/devmode_enabled
fi
restart appinstalld >/dev/null 2>&1
```

### Install: pick one path

**Path A — the one this project uses (`dist/tv_update.sh`, as root).** It
downloads the newest IPK from your server, installs it with
`com.webos.appInstallService/dev/install`, refreshes icons, and relaunches.

```sh
cd ~/tv-launcher
scp -i ~/.ssh/webos_tv dist/tv_update.sh root@192.168.0.10:/tmp/tv_update.sh
ssh -t -i ~/.ssh/webos_tv root@192.168.0.10 'sh /tmp/tv_update.sh'
```

*What this does:* copies the script onto the TV and runs it there as root.
*What you should see:* `[*] installing com.shashvat.launcher_<version>_all.ipk`,
`install response:` with `"statusText":"installed"` (or similar), `version on
disk: "version": "<version>"`, `[*] icons present: NN of NN`, `[*] relaunching
launcher`, `[*] DONE`.

> **Don't run a whole install through `tools/tvsh.py`.** It gives each command a
> **30-second** timeout, while a download + install can take a minute or two;
> when the socket closes, the install can be cut off mid-flight. Use SSH (above),
> or start it detached over telnet and poll the log:
>
> ```sh
> python3 tools/tvsh.py "nohup setsid sh /tmp/tv_update.sh >/tmp/tv-update.out 2>&1 & echo started"
> python3 tools/tvsh.py "sleep 25; tail -20 /tmp/tv-update.out"
> ```
>
> (Over telnet alone you also have to fetch the script first:
> `curl -s -o /tmp/tv_update.sh http://192.168.0.3:8123/tv_update.sh`.)

> `tv_update.sh` hardcodes `BASE="http://192.168.0.3:8123"`. If your computer's
> IP differs, edit that line **before** serving/running it (Chapter 1.2). Also
> note it `sort | tail -1`s the filenames, so it picks the lexicographically last
> — fine for `0.2.x`, but be aware if you have many versions.

**Path B — from the computer over SSAP (`tools/deploy.py`).** It starts its own
HTTP server on 8123 and installs via Homebrew Channel, no root shell needed:

```sh
python3 tools/deploy.py "dist/com.shashvat.launcher_${VERSION}_all.ipk" --launch com.shashvat.launcher
```

*What this does:* serves the file, connects over SSAP, calls
`org.webosbrew.hbchannel.service/install`, streams status, then launches the app.
*What you should see:* `serving ... -> http://192.168.0.3:8123/...`, `registered
with TV`, progress lines, `install finished: True`, `launch: request ...`.

> **Port clash:** if you already have `python3 -m http.server 8123` running,
> `deploy.py` cannot bind. Stop one, or run `deploy.py --port 8124` and make sure
> the TV can reach that port.

**Path C — install by URL (`tools/ssap_install.py`):** same idea, using
`appInstallService/dev/install` instead of Homebrew's installer:

```sh
python3 tools/ssap_install.py "http://192.168.0.3:8123/com.shashvat.launcher_${VERSION}_all.ipk"
```

*What this does:* asks the TV to download and install the IPK at that URL. *What
you should see:* progress/status lines ending in `finished: True`.

Two other helpers exist in `dist/`:

- **`tv_install.sh <file.ipk>`** — downloads one named IPK from the server and
  installs it (`dev/install`), no root required. Same dev-mode flag caveat.
- **`tv_lumina_install.sh`** — an older variant pinned to launcher `0.2.0`; it
  installs and refreshes icons but **deliberately does not launch** the app. Use
  it only if you specifically want that behaviour.

### Verify on screen

```sh
node tools/tv-cdp.js shot shots/after-install.png
```

*What this does:* takes a PNG screenshot of the running page via the TV's
DevTools port. *What you should see:* `wrote shots/after-install.png (...)`. Open
it. (Needs Node 21+ for the global `fetch`/`WebSocket`; see Chapter 7.)

---

## 5.5 Make Lumina the default home screen

Three independent mechanisms. Each is safe to remove on its own (Chapter 9), and
together they are what makes the TV feel like it has *your* home screen.

### 5.5.1 HOME key → Lumina (LG Input Hook)

**LG Input Hook** (`org.webosbrew.inputhook`) intercepts remote buttons and runs
an action. Install it from Homebrew Channel, then bind **HOME** (key id **773**)
to the launcher.

```sh
python3 tools/tvsh.py "mkdir -p /home/root/.config/lginputhook && echo '{\"773\":{\"action\":\"launch\",\"id\":\"com.shashvat.launcher\"}}' > /home/root/.config/lginputhook/keybinds.json && cat /home/root/.config/lginputhook/keybinds.json"
```

*What this does:* writes the keybind file. *What you should see:*
`{"773":{"action":"launch","id":"com.shashvat.launcher"}}` echoed back.

Arm and start the hook (this is what `rootrun/autoroot.sh` §4 does):

```sh
python3 tools/tvsh.py "/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service org.webosbrew.inputhook.service"
python3 tools/tvsh.py "luna-send -n 1 -w 8000 -f luna://org.webosbrew.inputhook.service/autostart '{}'"
python3 tools/tvsh.py "luna-send -n 1 -w 10000 -f luna://org.webosbrew.inputhook.service/start '{}'"
```

*What these do:* give Input Hook root, enable autostart, and start it now. *What
you should see:* `"returnValue":true` from the two luna calls (the elevate script
is usually quiet). Input Hook installs a boot hook named `inputhook` in
`/var/lib/webosbrew/init.d/`, so the binding survives reboots.

> **Trap we hit: the Input Hook UI overwrites your edit.** If you open Input
> Hook's on-TV settings/UI and save anything, it can rewrite
> `keybinds.json` from its own state and wipe the 773 binding. **Set the file
> last**, or re-apply it after touching the UI; then press HOME and confirm
> Lumina opens.

### 5.5.2 Guarded one-shot boot hook

`rootrun/lumina-boot.sh` is deliberately conservative:

- waits for the app manager to actually answer (up to 90 polls, 2 s apart),
- makes **one** launch attempt per boot — *never* a retry loop,
- only takes over when the **stock home** (or nothing) is on screen — if you
  started Netflix during boot, it leaves you alone,
- logs every decision to **`/tmp/lumina-boot.log`**.

Install it as a boot hook:

```sh
cd ~/tv-launcher
scp -i ~/.ssh/webos_tv rootrun/lumina-boot.sh root@192.168.0.10:/tmp/lumina-boot.sh
python3 tools/tvsh.py "cp /tmp/lumina-boot.sh /var/lib/webosbrew/init.d/60-tvl-launcher.sh; chmod 755 /var/lib/webosbrew/init.d/60-tvl-launcher.sh; chown root:root /var/lib/webosbrew/init.d/60-tvl-launcher.sh; ls -la /var/lib/webosbrew/init.d/60-tvl-launcher.sh"
```

*What this does:* copies the repo's current hook onto the TV and makes it
executable/owned by root. *What you should see:* an `-rwxr-xr-x ... root ...
60-tvl-launcher.sh` line.

Reboot the TV (Settings → General → Restart, or pull the power after a proper
off), then check:

```sh
python3 tools/tvsh.py "cat /tmp/lumina-boot.log"
```

*What this does:* reads the hook's own log. *What you should see:* lines like
`hook start`, `app manager ready after N polls`, `foreground: {...}` and either
`launched Lumina (single attempt, no retry)` or
`another app is running; not taking over`.

> **Do not use the retry-loop variant.** `dist/tv_push.sh` §4 and
> `rootrun/autoroot.sh` §6 write an earlier hook that tries up to **20 times**.
> On a TV where the launcher cannot start, that looks like "the launcher takes
> over whenever I open an app". The current file is the one-shot version — make
> sure that is what you installed. `docs/HOMEBREW-HOOKS.md` flags this ambiguity
> on the live TV ("verify on device").

### 5.5.3 The watchdog

`rootrun/lumina-watchdog.sh` polls `getForegroundAppInfo` every 2 s; when **LG's
own home** appears (you exited an app, HOME fell through, a reboot finished) it
launches Lumina again, with a **4 s cooldown** so it cannot flap. It writes
`/var/run/lumina-watchdog.pid` and tries not to start twice (with a caveat — see
below).

Start it so it survives your SSH session ending. Put the script on the TV first,
then start it with `nohup setsid`:

```sh
cd ~/tv-launcher
scp -i ~/.ssh/webos_tv rootrun/lumina-watchdog.sh root@192.168.0.10:/home/root/lumina-watchdog.sh
python3 tools/tvsh.py "chmod 755 /home/root/lumina-watchdog.sh; nohup setsid sh /home/root/lumina-watchdog.sh >/dev/null 2>&1 & sleep 1; cat /var/run/lumina-watchdog.pid"
```

*What this does:* installs the script and starts it detached from your shell.
*What you should see:* a PID, and later `cat /tmp/lumina-watchdog.log` shows
`watchdog start (pid ...)` and `LG home detected -> launching Lumina`.

> **Why `nohup setsid`:** anything you start from an interactive SSH/telnet
> session is a child of that session and dies when the session closes (SIGHUP).
> `setsid` detaches it into its own session. This exact trap is in Chapter 99 for
> a reason — we hit it with the screensaver too.

> **Read the pidfile with a pinch of salt.** The wrapper writes the PID it was
> started with, and the polling loop runs in a backgrounded subshell — so the
> file can name the short-lived wrapper rather than the loop. Treat it as
> best-effort and use the bracket `pkill` below when it matters.

> **The watchdog is not installed by a boot hook in this repo.** The repo ships
> exactly one launcher boot hook (`60-tvl-launcher.sh`, the one-shot above). If
> you want the watchdog running after every reboot, start it from a hook
> yourself, e.g. append to a new `/var/lib/webosbrew/init.d/61-tvl-watchdog.sh`:
>
> ```sh
> #!/bin/sh
> nohup setsid sh /home/root/lumina-watchdog.sh >/dev/null 2>&1 &
> ```
>
> Then `chmod 755` it. Do this only if the one-shot hook is not enough — more
> moving parts means more to undo.

**Kill switch:** stop the watchdog without rebooting:

```sh
python3 tools/tvsh.py "pkill -f '[l]umina-watchdog'; kill \$(cat /var/run/lumina-watchdog.pid) 2>/dev/null; rm -f /var/run/lumina-watchdog.pid; echo stopped"
```

*What this does:* kills the loop by its command line (the bracket trick keeps
`pkill` from matching its own shell — see Chapter 99.6), falls back to the
pidfile, and removes the file so a later start is clean. *What you should see:*
`stopped`, and `ps | grep lumina-watchdog` empty afterwards.

### 5.5.4 Optional: the power-on slot

`dist/tv_push.sh` §3 goes further and points the TV's **power-on slot** at the
launcher (`general.lastInputApp` / `physicalLastInputApp` /
`selectedInputApp`). The current setup **leaves this alone** and relies on the
boot hook + watchdog instead — a power-on slot pointing at a dev app can be hard
to recover if the app breaks.

If you want to try it anyway:

```sh
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings '{\"category\":\"general\",\"settings\":{\"homeAutoLaunch\":\"off\",\"selectedInputApp\":\"com.shashvat.launcher\",\"checkHomeAutoLaunchValue\":\"user\"}}'"
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings '{\"category\":\"general\",\"settings\":{\"lastInputApp\":\"com.shashvat.launcher\",\"physicalLastInputApp\":\"com.shashvat.launcher\"}}'"
```

Revert with `dist/tv_stop_launcher.sh` (Chapter 9).

---

## 5.6 Test the whole thing

1. Press **HOME**. → Lumina should open (Input Hook).
2. Open an app, then exit it. → Lumina should come back (watchdog).
3. Reboot the TV. → Lumina should open once, on its own (boot hook), and
   `/tmp/lumina-boot.log` should say so.
4. If LG's home appears for a second during boot, that is the watchdog doing its
   job — not a failure.

If any of these do not work, go to Chapter 99 before changing anything else.

---

**Next:** [6. Speed](06-speed.md)

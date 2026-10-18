# 7. See your TV without photos

**Goal:** debug the TV from your keyboard — screenshots, live layout numbers, the
page's console — and run commands in a root shell, without photographing the
screen with your phone.

**Time:** 5 minutes to set up; this is a tool you will use constantly.
**Risk:** none (read-only unless you deliberately inject CSS or evaluate code).

---

## 7.1 The TV has Chrome DevTools, over the network

webOS apps run in a Chromium-based web engine, and the TV exposes a **Chrome
DevTools Protocol** endpoint on **port 9998**. If the app is running in developer
mode (the `devmode_enabled` flag from Chapter 5), you can list its debug targets
from your computer:

```sh
curl -s http://192.168.0.10:9998/json | python3 -m json.tool | head -40
```

*What this does:* asks the TV's inspector for its targets. *What you should see:*
a JSON array of objects with `type` (`page`), `url` (the app's
`file:///media/developer/.../index.html`), `title`, and a
`webSocketDebuggerUrl` like `ws://192.168.0.10:9998/devtools/page/...`.

If this is empty or refused: the app is not running, or the TV is not in
developer mode. Launch Lumina and retry.

> This is **independent of SSH and telnet**. It works even after you close
> telnet, and it needs no root.

---

## 7.2 `tools/tv-cdp.js` — the everyday tool

The repo wraps the protocol in one small Node script. It needs a recent Node
(global `fetch` and `WebSocket`: **Node 21+**, or Node 20 with
`--experimental-websocket`). It reads three environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TV_IP` | `192.168.0.10` | the TV |
| `TV_CDP` | `9998` | the inspector port |
| `TV_APP` | `com.shashvat.launcher` | which target to attach to |

### `targets` — what is debuggable

```sh
node tools/tv-cdp.js targets
```

*What this does:* lists every debug target, tab-separated. *What you should see:*
one line per page with its type, URL and WebSocket URL. Use this first when
`shot`/`metrics` say "no debug target found" — it tells you whether the app is
running and under which URL.

### `shot` — a real screenshot

```sh
node tools/tv-cdp.js shot shots/home.png
```

*What this does:* captures the page as a PNG (`Page.captureScreenshot`) and
writes it to the path you give. *What you should see:*
`wrote shots/home.png (NNNNN bytes, .../index.html)`. Open the file — it is the
actual rendered frame, not a photo of a glossy panel, so colours and layout are
exact.

Defaults: with no path it writes **`shots/tv.png`** and creates the directory.

### `metrics` — the layout, as numbers

```sh
node tools/tv-cdp.js metrics
```

*What this does:* evaluates a measurement script in the page and prints JSON.
*What you should see:* a compact report including:

| Field | Meaning |
| --- | --- |
| `viewport.w/h/dpr` | should be `1920 × 1080`, dpr `1` |
| `rootFont` | the root font size the layout is built on |
| `topbar`, `hero`, `rails`, `hints` | `{x,y,w,h,bottom}` for each region |
| `railsScroll` | `scrollHeight` vs `clientHeight` — is the rail area overflowing? |
| `card` | the first card's size |
| `railRows` | each rail's top/bottom and `fullyVisible` |
| `images` | total / loaded / **broken** |
| `errors` | `window.__LUMINA_ERRORS__` from the app |

This is how you answer "is the hero clipped?", "did the posters load?", "is the
last rail off-screen?" without squinting at a photo.

### `eval` — run JavaScript in the page

```sh
node tools/tv-cdp.js eval "location.href"
node tools/tv-cdp.js eval "localStorage.getItem('lumina.rails.v3.at')"
node tools/tv-cdp.js eval "document.querySelectorAll('.card').length"
```

*What this does:* evaluates the expression in the running page and prints the
result as JSON. *What you should see:* the URL, the cache timestamp, the card
count. `awaitPromise` is on, so `fetch(...)`-style promises resolve.

### `console` — recent console messages

```sh
node tools/tv-cdp.js console
```

*What this does:* enables `Runtime`/`Log`, waits ~1.2 s, and prints buffered
console calls, log entries, and exceptions. *What you should see:* lines prefixed
`[console]`, `[log]`, or `[exception]`. **Note:** it only shows what the page
emits *while attached* plus a short backlog — to catch a startup error, run it,
then relaunch the app.

### `css` — try a fix live

```sh
node tools/tv-cdp.js css ".hero{height:38vh} .rails{gap:14px}"
```

*What this does:* injects/updates a `<style id="__live">` element. *What you
should see:* `injected NN chars of CSS`, and the TV updates immediately. Nothing
is saved — reload the app and it is gone. Perfect for finding the right value
before editing `app/css/style.css`.

### Attach to a different app

```sh
TV_APP=io.strem.webos node tools/tv-cdp.js shot shots/stremio.png
```

*What this does:* attaches to Stremio instead of Lumina. *What you should see:*
the screenshot of Stremio's page. Any webOS app in dev mode is fair game.

---

## 7.3 The root shell, for when you need the filesystem

DevTools shows you the *page*. `tools/tvsh.py` shows you the *box*:

```sh
cd ~/tv-launcher

# what is on screen, and what is installed
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}' | tr -d ' \n'"

# boot hooks
python3 tools/tvsh.py "ls -la /var/lib/webosbrew/init.d/"

# the last boot decisions
python3 tools/tvsh.py "cat /tmp/lumina-boot.log"

# watchdog log
python3 tools/tvsh.py "tail -20 /tmp/lumina-watchdog.log"

# system log, filtered
python3 tools/tvsh.py "grep -a -i -E 'wpa_supp|connman|wifi|dhcp' /tmp/var/log/messages | tail -20"

# free space and memory
python3 tools/tvsh.py "df -h /media/developer /tmp; grep -E 'MemTotal|MemAvailable' /proc/meminfo"
```

*What these do:* each runs one command as root over telnet and prints only its
output. *What you should see:* the foreground app id, the hook directory, the
logs, and the numbers.

Prefer SSH when it is set up (Chapter 3):

```sh
ssh -i ~/.ssh/webos_tv root@192.168.0.10 'ls -la /var/lib/webosbrew/init.d/'
```

And if a non-interactive SSH `luna-send` returns nothing, remember Chapter 3.3:
use `ssh -t`, `sh -lc`, or `tools/tvsh.py`.

---

## 7.4 The real debugging loop

This is the loop the project was built around:

```sh
# 1. edit app/... on your computer
$EDITOR app/css/style.css

# 2. build
python3 tools/build_ipk.py

# 3. (server already running in dist/ on 8123) copy + run the installer
scp -i ~/.ssh/webos_tv dist/tv_update.sh root@192.168.0.10:/tmp/tv_update.sh
ssh -t -i ~/.ssh/webos_tv root@192.168.0.10 'sh /tmp/tv_update.sh'

# 4. look at it
node tools/tv-cdp.js shot shots/iteration.png
node tools/tv-cdp.js metrics
node tools/tv-cdp.js console
```

*What this does:* edit → package → install → observe, with no phone camera and no
guessing. *What you should see:* a new IPK version on disk, the app relaunched,
and an exact screenshot plus numbers.

> **Remember the version bump.** If you rebuild without changing
> `app/appinfo.json`'s `version`, the install can be a no-op. Bump it, or you
> will debug a change that never shipped.

---

**Next:** [8. Extras](08-extras.md)

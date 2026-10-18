# 99. Troubleshooting

Every entry here is a problem this project actually hit. Format:
**symptom → cause → fix**. Commands assume `cd ~/tv-launcher`, the TV at
`192.168.0.10`, the computer at `192.168.0.3`, and a root shell available
(Chapter 3).

---

## 99.1 "User rejected pairing"

**Symptom.** SlopBro prints a pairing error / `User rejected pairing` and exits.
The TV showed a prompt and you pressed OK.

**Cause.** The TV's pairing dialog defaults its selection to **No / Deny**. Pressing
OK/Enter accepts the default, which rejects the pairing.

**Fix.** Run SlopBro again and, on the TV, press **left/right** to move the
highlight onto **Yes / Allow / Accept**, *then* OK. This is Chapter 2.4's trap.
The prompt reappears on every attempt; nothing is broken.

```sh
cd ~/slopbro && python3 slopbro.py --debug 192.168.0.10
```

---

## 99.2 Installs appear to succeed but don't

**Symptom.** The install command prints status / looks fine, but the app is not
there, or the version on disk is unchanged, or the launcher looks identical after
a "successful" install.

**Cause.** A development install needs the **dev-mode flag** and a **restarted
installer**; without them the install silently no-ops. (This is the top gotcha in
this whole project.)

**Fix.** Always do this first, exactly as the repo's scripts do:

```sh
python3 tools/tvsh.py "rm -f /var/luna/preferences/devmode_enabled; mkdir -- /var/luna/preferences/devmode_enabled; restart appinstalld"
```

Then install again and **verify the version on disk**, not the install message:

```sh
python3 tools/tvsh.py "grep -o '\"version\": \"[^\"]*\"' /media/developer/apps/usr/palm/applications/com.shashvat.launcher/appinfo.json"
```

*What you should see:* the version you just built. If it is the old one, the
install did not happen. Also bump `app/appinfo.json`'s `version` before rebuilding
— reinstalling the same version can be skipped.

---

## 99.3 "The launcher takes over whenever I open an app"

**Symptom.** You open Netflix (or anything), and Lumina keeps coming back /
fights you for the screen.

**Cause.** One of two things:

1. A **retry-loop boot hook** is installed. The earlier variants in
   `rootrun/autoroot.sh` §6 and `dist/tv_push.sh` §4 launch up to **20 times**;
   the current `rootrun/lumina-boot.sh` makes **one** attempt. If the TV has the
   retry version, it can keep grabbing focus.
2. The **watchdog** is running and bouncing LG's home back — which is by design
   when LG's home appears, but feels like a fight if you *want* LG's home.

**Fix.** Check which hook is on the TV:

```sh
python3 tools/tvsh.py "cat /var/lib/webosbrew/init.d/60-tvl-launcher.sh"
```

If it contains a `while [ "$n" -lt 20 ]` retry loop, replace it with the
conservative one (Chapter 5.5.2). If you want to stop the takeover entirely:

```sh
python3 tools/tvsh.py "rm -f /var/lib/webosbrew/init.d/60-tvl-launcher.sh; pkill -f '[l]umina-watchdog'; kill \$(cat /var/run/lumina-watchdog.pid) 2>/dev/null; rm -f /var/run/lumina-watchdog.pid; echo stopped"
```

Or run `dist/tv_stop_launcher.sh` (Chapter 9.1). Note `docs/HOMEBREW-HOOKS.md`
flags that the on-TV copy may be either version — **verify on device**, don't
assume.

---

## 99.4 Wi-Fi drops after our changes

**Symptom.** After the privacy/network changes, the TV loses Wi-Fi (sometimes
after a reboot, sometimes after a while), or is unreachable.

**Cause.** Several candidates, in rough order of likelihood:

1. A power-on-slot experiment (`dist/tv_push.sh` §3) that points boot at an app
   that cannot come up — the TV ends in a state with no usable network UI.
2. **Life's Good Without Spying** shutting down a collector/service that the
   network stack (or a UI path) was indirectly using.
3. The DNS/hosts block making a captive-portal/connectivity check fail.
4. Ordinary Wi-Fi (channel, distance, router) — always rule this out.

**Fix.** Run the dedicated revert/diagnostic script:

```sh
scp -i ~/.ssh/webos_tv dist/tv_wifi_revert.sh root@192.168.0.10:/tmp/tv_wifi_revert.sh
python3 tools/tvsh.py "sh /tmp/tv_wifi_revert.sh"
```

It reverts the power-on slot, prints Wi-Fi/link state, pings the gateway and
internet, and tails the Wi-Fi/connman/bootd logs. If Life's Good is suspected, it
prints the exact command to disable it:

```sh
/media/developer/apps/usr/palm/applications/ooo.lew.lifesgoodwithoutspying/init/nospy-ctl.sh disable
```

If the TV is completely unreachable: power-cycle it, rejoin Wi-Fi in the TV's own
Settings, or factory reset (Chapter 9.7). **Do not** keep changing more variables
while it is offline.

---

## 99.5 Port 8080 already in use (Glasshouse won't start)

**Symptom.** Glasshouse (or another local server) exits with `EADDRINUSE` /
"address already in use".

**Cause.** Port **8080** is already owned — in our setup by a Stremio-related
service/dev server, and SlopBro also uses 8080 while it runs. Glasshouse's
default port collides.

**Fix.** Give Glasshouse a different port in its `config.json` — this project
runs it on **8081** — then restart it. Point the tools at the new port:

```sh
curl -s http://192.168.0.10:8081/api/services | head -c 200
TVWEB=http://192.168.0.10:8081 python3 tools/glasshouse_services.py
```

Find the culprit if you need to:

```sh
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

*What this does:* shows which process holds 8080. *What you should see:* a
`COMMAND`/`PID` line — that is what to stop, or what to route around.

---

## 99.6 `pkill -f <name>` over SSH kills its own shell

**Symptom.** `ssh root@tv "pkill -f lumina-watchdog"` disconnects, or the
command dies with no output, and sometimes the watchdog survives anyway.

**Cause.** `pkill -f` matches the **full command line**. Your SSH command's own
`sh -c 'pkill -f lumina-watchdog'` contains the pattern `lumina-watchdog`, so
`pkill` matches **itself / its parent shell** and kills the session.

**Fix.** Use the bracket trick so the pattern does not match its own command
line, and only fall back to the pidfile:

```sh
ssh -i ~/.ssh/webos_tv root@192.168.0.10 "pkill -f '[l]umina-watchdog'"
# belt and braces (the pidfile can name the wrapper, not the loop):
ssh -i ~/.ssh/webos_tv root@192.168.0.10 "kill \$(cat /var/run/lumina-watchdog.pid) 2>/dev/null; rm -f /var/run/lumina-watchdog.pid"
```

*What this does:* `'[l]umina-watchdog'` matches the process but not the literal
string in its own command line; the pidfile is a best-effort fallback.
*What you should see:* the command returns cleanly and the process is gone
(`ps | grep '[l]umina-watchdog'`).

---

## 99.7 `luna-send -f` pretty-prints, so string matching fails

**Symptom.** A script says "not ready" or "not running" even though you can see
the value is right; `grep '"returnValue":true'` finds nothing.

**Cause.** `-f` pretty-prints the JSON, inserting spaces: `"returnValue": true`.
A pattern without the space never matches.

**Fix.** Strip spaces and newlines before matching, exactly as `rootrun/` does:

```sh
luna-send -n 1 -w 5000 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}' | tr -d ' \n'
```

*What you should see:* one long line, e.g.
`{"appId":"com.shashvat.launcher","returnValue":true,...}`. The watchdog source
comments this: *"strip spaces: -f pretty-prints"*. Do the same in anything you
write.

---

## 99.8 Telnet runs `luna-send`; non-interactive SSH doesn't

**Symptom.** `python3 tools/tvsh.py "luna-send …"` works. The same command over
`ssh root@tv 'luna-send …'` returns nothing or an error, so a script that relies
on SSH silently does nothing.

**Cause.** A non-interactive SSH command does not get the environment/session
`luna-send` expects ("Luna needs a login shell"). Telnet gives you a real shell,
so it works there.

**Fix.** Any of:

```sh
ssh -t root@192.168.0.10                                   # real TTY, run it interactively
ssh root@192.168.0.10 'sh -lc "luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo {}"'
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}'"
python3 tools/run_tv.py "luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo {}"
```

*What these do:* run the call with a login shell / TTY / over telnet / via
Homebrew's exec service. *What you should see:* the same JSON every way. When
writing automation, prefer `tools/run_tv.py` or `tools/tvsh.py` over bare
`ssh '…'`.

---

## 99.9 A service mask is runtime-only

**Symptom.** You disabled `contentminer` (etc.), it was gone, then after a reboot
it is back — or you re-enabled it, rebooted, and it is disabled again.

**Cause.** The mask stops the process **now**; it does not edit a unit file.
Glasshouse persists the choice and re-applies it at boot from its hook
`/var/lib/webosbrew/init.d/20-tvweb-services`. So both "it came back" and "my
re-enable was undone" are the same mechanism.

**Fix.** Change the state **through Glasshouse**, not with `kill`/`start`:

```sh
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"id":"contentminer","disabled":false}' \
  http://192.168.0.10:8081/api/services/toggle
```

Then verify and reboot:

```sh
curl -s http://192.168.0.10:8081/api/services | python3 -m json.tool | grep -E '"id"|"disabled"'
```

If you are removing Glasshouse entirely, re-enable everything **before** deleting
its hook (Chapter 9.3).

---

## 99.10 The Input Hook UI overwrote my keybinds

**Symptom.** HOME opened Lumina; you opened Input Hook's settings/UI to look at
something; now HOME goes to LG's home.

**Cause.** Input Hook's on-TV UI writes `keybinds.json` from its own state, which
can wipe the hand-written `773` binding.

**Fix.** Re-apply the binding **after** you finish with the UI:

```sh
python3 tools/tvsh.py "mkdir -p /home/root/.config/lginputhook && echo '{\"773\":{\"action\":\"launch\",\"id\":\"com.shashvat.launcher\"}}' > /home/root/.config/lginputhook/keybinds.json && cat /home/root/.config/lginputhook/keybinds.json"
```

*What you should see:* the JSON echoed back. Then press HOME to confirm. If it
still fails, check Input Hook is running:

```sh
python3 tools/tvsh.py "luna-send -n 1 -f luna://org.webosbrew.inputhook.service/start '{}'"
```

---

## 99.11 A screensaver/boot helper dies when you disconnect

**Symptom.** You start a script from SSH/telnet, it works, you close the session,
and it stops. Logs just end.

**Cause.** The process is a child of your session and receives **SIGHUP** when
the session closes.

**Fix.** Detach it into its own session with `nohup setsid`:

```sh
python3 tools/tvsh.py "nohup setsid sh /home/root/lumina-watchdog.sh >/dev/null 2>&1 & sleep 1; cat /var/run/lumina-watchdog.pid"
```

*What this does:* `setsid` gives it a new session (no controlling terminal),
`nohup` ignores SIGHUP, and the redirects stop it writing to a dead terminal.
*What you should see:* a PID, and the process still alive after you disconnect.

The same applies to anything you start by hand — including a screensaver helper.
Boot hooks are started by `run-parts` at boot, so they do **not** need this; only
things you launch from an interactive session do.

---

## 99.12 Apps look "installed" only after a refresh

**Symptom.** The install finished, but the app is not in the TV's app list; or
`probe_tv.py` does not see it; a minute later it appears.

**Cause.** webOS caches the app list and icon metadata. The install is real; the
UI has not re-read it.

**Fix.** Do one of:

- Open the TV's app list again (back out and re-enter), or
- Reboot the TV, or
- Verify over SSAP instead of trusting the UI:

```sh
python3 tools/probe_tv.py | grep -i '<app-id-fragment>'
```

If it is still absent after a refresh, it is **not** installed — go to 99.2 and
check the dev-mode flag/installer restart. `tools/launch_app.py` has a `--wait N`
flag that polls `getAppInfo` for exactly this race:

```sh
python3 tools/launch_app.py com.shashvat.launcher --wait 60
```

---

## 99.13 `tv_update.sh`: "could not find an ipk on the server"

**Symptom.** `[!] could not find an ipk on the server`, and nothing installs.

**Cause.** The TV fetched the directory listing from `http://192.168.0.3:8123/`
and did not find a `com.shashvat.launcher_*_all.ipk`. Either the server is not
running, is serving the wrong directory, or **`192.168.0.3` is not your
computer's IP**.

**Fix.**

```sh
# on the computer: serve dist/, and check what it lists
cd ~/tv-launcher/dist && python3 -m http.server 8123
curl -s http://192.168.0.3:8123/ | grep -o 'com\.shashvat\.launcher_[0-9.]*_all\.ipk' | sort | tail -1
```

If the `curl` prints nothing, the TV will too. If your computer's IP is not
`192.168.0.3`, edit `BASE=` in `dist/tv_update.sh` (Chapter 1.2) or use
`tools/deploy.py`, which guesses the local IP.

---

## 99.14 "no debug target found"

**Symptom.** `node tools/tv-cdp.js shot` prints `no debug target found (is the
app running?)`.

**Cause.** The app is not running, or the TV is not in developer mode, or you are
attached to a different app id.

**Fix.**

```sh
curl -s http://192.168.0.10:9998/json | python3 -m json.tool | head
node tools/tv-cdp.js targets
TV_APP=io.strem.webos node tools/tv-cdp.js targets
```

*What you should see:* a `page` target for the running app. If `/json` is empty,
launch the app and confirm the dev-mode flag is present (99.2). If it lists a
different app, set `TV_APP`.

---

## 99.15 `hbchannel installed: False` / `"root": false`

**Symptom.** `tools/probe_tv.py` says Homebrew is not installed, or
`getConfiguration` says root is false.

**Cause.** The SlopBro payload did not finish, or Homebrew's root service has not
been elevated.

**Fix.** Re-run SlopBro (Chapter 2) and watch the TV screen for an error. If
Homebrew is installed but root is false:

```sh
python3 tools/tvsh.py "/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service"
python3 tools/tvsh.py "luna-send -n 1 -f luna://org.webosbrew.hbchannel.service/getConfiguration '{}'"
```

*What you should see:* `"root": true`.

---

## 99.16 The boot hook never seems to run

**Symptom.** After a reboot, LG's home appears and Lumina only opens when you
press HOME (or not at all); `/tmp/lumina-boot.log` is missing or stale.

**Cause / fix, in order:**

1. **Quick Start+ is still on.** Standby is not a real boot, so `run-parts` never
   runs. Turn it off (Chapter 4.2).
2. **The hook is not executable / not owned by root.** `chmod 755`, `chown
   root:root` (Chapter 5.5.2).
3. **It decided not to take over.** By design it leaves you alone if another app
   is in the foreground. Read the log:
   `python3 tools/tvsh.py "cat /tmp/lumina-boot.log"` — `another app is running;
   not taking over` is a *success*, not a failure.
4. **The file is in the wrong place.** It must be
   `/var/lib/webosbrew/init.d/60-tvl-launcher.sh`. Check
   `python3 tools/tvsh.py "ls -la /var/lib/webosbrew/init.d/"`.

---

## 99.17 The TV is unreachable and nothing above helps

Work down this list; stop as soon as one works.

1. **Power-cycle properly:** hold the TV's power button (or unplug for 30 s),
   then turn it on. Wait **two minutes** before trying anything — the app
   manager/network really can take that long (Chapter 2.4).
2. **Check the router** for the TV's current IP. If DHCP moved it, every command
   here is pointed at the wrong address. Re-check with `TV_IP` (Chapter 1.2).
3. **Use the TV's own UI** to rejoin Wi-Fi (Settings → Network).
4. **Run `dist/tv_wifi_revert.sh`** if you can reach any shell (99.4).
5. **Factory reset** (Chapter 9.7). This always works, and it is the honest
   fallback after an unrecoverable network change. You lose the setup and redo
   the guide.

---

**Back to:** [the guide index](../GUIDE.md)

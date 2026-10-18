# 9. Undo and unroot

**Goal:** reverse anything in this guide — one piece at a time, or all the way
back to near-stock — without guessing.

**Time:** 5 minutes for a single piece; 20–30 for a full unroot; ~15 more for a
factory reset. **Risk:** read the section you need before running it.

> **The rule that makes this safe:** each mechanism was installed
> **independently**. Removing the boot hook does not remove the Home keybind;
> removing the keybind does not uninstall the app. You can stop at any line.

---

## 9.0 The quick map

| You want to… | Do this |
| --- | --- |
| Stop Lumina opening by itself | `dist/tv_stop_launcher.sh` (or 9.1) |
| Put the HOME key back | 9.2 |
| Bring back the masked services | 9.3 |
| Remove the launcher / Homebrew apps | 9.4 |
| Recover from broken networking | `dist/tv_wifi_revert.sh` (9.6) |
| Go back to near-stock | `dist/tv_unroot.sh` + 9.4/9.5 |
| Guaranteed clean slate | Factory reset (9.7) |

---

## 9.1 Stop the launcher from opening on its own

### The one-shot way: `dist/tv_stop_launcher.sh`

This is the repo's "stop making Lumina my home screen" script. It:

1. removes `/var/lib/webosbrew/init.d/60-tvl-launcher.sh` (the boot hook),
2. reverts the power-on slot to Live TV,
3. clears the Home keybind (`echo '{}' > …/keybinds.json`),
4. closes the launcher if it is running,
5. prints verification,
6. dumps the hook log, Wi-Fi/link logs and boot decisions.

Run it on the TV as root:

```sh
cd ~/tv-launcher
scp -i ~/.ssh/webos_tv dist/tv_stop_launcher.sh root@192.168.0.10:/tmp/tv_stop_launcher.sh
python3 tools/tvsh.py "sh /tmp/tv_stop_launcher.sh"
```

*What this does:* copies the script to the TV and runs it there. *What you should
see:* sections `== 1)` … `== 9)`, `hook present? no`, `keybinds: {}`, and a
`gateway OK`/`gateway FAIL` line at the end.

> "Close the launcher" only closes the **running instance**. The app stays
> installed; you can still open it from the app list.

### Or do each piece by hand

```sh
# boot hook
python3 tools/tvsh.py "rm -f /var/lib/webosbrew/init.d/60-tvl-launcher.sh; ls -la /var/lib/webosbrew/init.d/"

# a watchdog boot hook, if you added one
python3 tools/tvsh.py "rm -f /var/lib/webosbrew/init.d/61-tvl-watchdog.sh"

# the watchdog itself
python3 tools/tvsh.py "pkill -f '[l]umina-watchdog'; kill \$(cat /var/run/lumina-watchdog.pid) 2>/dev/null; rm -f /var/run/lumina-watchdog.pid; echo stopped"

# power-on slot back to Live TV
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings '{\"category\":\"general\",\"settings\":{\"selectedInputApp\":\"off\",\"lastInputApp\":\"com.webos.app.livetv\",\"physicalLastInputApp\":\"com.webos.app.livetv\",\"homeAutoLaunch\":\"off\"}}'"
```

*What these do:* remove the autostart hooks, stop the watchdog, and point
power-on back at Live TV. *What you should see:* the hook file gone, `stopped`,
and `"returnValue":true`.

Reboot and confirm LG's home comes up on its own.

---

## 9.2 Put the HOME key back

```sh
python3 tools/tvsh.py "mkdir -p /home/root/.config/lginputhook && echo '{}' > /home/root/.config/lginputhook/keybinds.json && cat /home/root/.config/lginputhook/keybinds.json"
```

*What this does:* empties the keybind file, so Input Hook has nothing to do for
HOME and LG's home opens as normal. *What you should see:* `{}`.

If you want Input Hook gone entirely:

```sh
python3 tools/tvsh.py "rm -f /home/root/.config/lginputhook/keybinds.json /var/lib/webosbrew/init.d/inputhook /media/developer/tvl-home.sh"
```

*What this does:* removes the binding, Input Hook's boot hook, and the old helper
script some earlier payloads used. *What you should see:* no output. Then
uninstall **LG Input Hook** from the TV's app list (9.4).

---

## 9.3 Unmask the services

Re-enable each id you masked (Chapter 4.5). The toggle is the same API:

```sh
for id in contentminer uploadd rdxd remotelogger nudge camera; do
  curl -s -X POST -H 'Content-Type: application/json' \
    -d "{\"id\":\"$id\",\"disabled\":false}" \
    http://192.168.0.10:8081/api/services/toggle
  echo
done
```

*What this does:* asks Glasshouse to re-enable all six. *What you should see:*
six `{"ok":true,...}` responses. Then verify:

```sh
curl -s http://192.168.0.10:8081/api/services | python3 -m json.tool | grep -E '"id"|"disabled"'
```

*What this does:* lists the services and their state. *What you should see:*
`"disabled": false` for the six.

> **If you also remove Glasshouse**, remember it re-applies masks at boot from
> `/var/lib/webosbrew/init.d/20-tvweb-services`. Re-enable *before* removing that
> hook, or the services stay off until the next reboot after the hook is gone.

---

## 9.4 Uninstall the apps

Do this **on the TV**, from the app list: highlight the app → long-press (or the
⋮ menu) → **delete**. There is no supported remote "uninstall" in this repo's
tooling.

Order matters only at the end:

1. **Lumina** — `com.shashvat.launcher`
2. **LG Input Hook** — `org.webosbrew.inputhook`
3. **Life's Good Without Spying** — `ooo.lew.lifesgoodwithoutspying`
4. **LG App Update Blocker** — `org.webosbrew.appupdateblocker`
5. **Bluetooth Disabler** — `pl.krzywro.webos-bluetooth-disabler` (if installed)
6. **Stremio** — `io.strem.webos` — keep it if you like; it does **not** need
   root.
7. **Homebrew Channel** — **LAST**. Uninstalling it wipes
   `/media/developer/`, i.e. root persistence and the apps installed under it.

> Do **not** reinstall the LG **Developer Mode** app while rooted. After you have
> unrooted, it is fine. (`dist/tv_unroot.sh` says the same.)

After uninstalling, the launcher's baked app list is stale — irrelevant once the
launcher is gone.

---

## 9.5 Full unroot: `dist/tv_unroot.sh`

**Read it before running it.** Its own header says: *"NOT run automatically. Run
it on the TV as root … only when you actually want to unroot. Order matters:
remove boot hooks and remote-access keys BEFORE uninstalling the apps they
reference, otherwise you leave hooks pointing at missing apps."*

What it does, in order:

1. **Boot hooks** — removes `60-tvl-launcher.sh`, `50-tvl-ssh.sh`,
   `inputhook`. (It *comments out* removing
   `50-lifesgoodwithoutspying`, because that hook belongs to an app you may be
   keeping.)
2. **Remote access + keybinds** — `rm -rf /home/root/.ssh`, removes
   `keybinds.json` and `/media/developer/tvl-home.sh`.
3. **Settings** — power-on slot back to Live TV, `selectedInputApp: off`,
   `homeAutoLaunch: off`, **Quick Start+ back `on`**.
4. **Prints the apps to uninstall** (do them on the TV — 9.4).
5. **Says Homebrew Channel must go last**, because it wipes root persistence.
6. **Offers the factory reset** as the final, guaranteed option.

> **Not covered by the script: Glasshouse.** If you installed Glasshouse, it has
> its own hooks — `50-tvweb.sh` (server + hosts block) and `20-tvweb-services`
> (service masks) — which `tv_unroot.sh` does not touch. Remove them with
> Glasshouse's own uninstall/deploy script, or by hand after re-enabling the
> services (9.3). Check what is actually there before deleting:
> `python3 tools/tvsh.py "ls -la /var/lib/webosbrew/init.d/"`.

Run it:

```sh
cd ~/tv-launcher
scp -i ~/.ssh/webos_tv dist/tv_unroot.sh root@192.168.0.10:/tmp/tv_unroot.sh
python3 tools/tvsh.py "sh /tmp/tv_unroot.sh"
```

*What this does:* copies the unroot script to the TV and runs it as root. *What
you should see:* `== 1)` … `== 6)`, a listing of `init.d/`, `removed ssh keys and
keybinds`, and the manual app-uninstall list.

Then:

- Do **9.4** (uninstall the apps, Homebrew Channel last).
- Turn off Homebrew's **telnet** and **SSH** services (if Homebrew is not yet
  uninstalled) — or just uninstall Homebrew, which takes them with it.
- Reboot.

> **What "near-stock" means here.** The apps and hooks are gone, settings are
> back, remote access is gone. What remains is whatever LG firmware was already
> on the TV. **Nothing here downgrades or reflashes it.** If you need a truly
> pristine device (e.g. before a service visit or sale), do 9.7.

---

## 9.6 If networking broke: `dist/tv_wifi_revert.sh`

If a power-on/network experiment left the TV unreachable, this script exists to
get it back. It reverts the power-on slot, prints the current settings, dumps
Wi-Fi link state and connectivity, and tails the relevant logs. It also prints
how to disable **Life's Good Without Spying** completely, in case that app is
implicated.

You need *some* access to run it — SSH/telnet if the TV is reachable, or the
router's client list to confirm the TV is even on the network.

```sh
cd ~/tv-launcher
scp -i ~/.ssh/webos_tv dist/tv_wifi_revert.sh root@192.168.0.10:/tmp/tv_wifi_revert.sh
python3 tools/tvsh.py "sh /tmp/tv_wifi_revert.sh"
```

*What this does:* runs the revert/diagnostic script. *What you should see:*
settings JSON, `ifconfig` link state, `gateway OK`/`internet OK`, and log tails.

If the TV is **not reachable at all**, the only local options are: reboot it
(power-cycle after holding the power button), use the TV's own Settings → Network
to rejoin Wi-Fi, or factory reset (9.7). Chapter 99 has the "Wi-Fi dropping after
our changes" entry.

---

## 9.7 The guaranteed reset: factory reset

When you want the TV to be *definitely* clean — selling it, a service visit, or
you have lost access and exhausted the alternatives:

**Settings → General → Reset to Initial Settings** (wording varies; some models:
**Settings → All Settings → General → Reset to Initial Settings**).

*What this does:* wipes accounts, apps, settings, and the developer/root
persistence, and returns the TV to its out-of-box state. *What you should see:*
a confirmation dialog, then the TV reboots into first-time setup.

**Before you reset:**

- Note your Wi-Fi password and LG account (if you use one).
- Understand that this is **not reversible** — you will redo Chapter 1 onwards if
  you want the setup back.
- A factory reset is also the honest answer to "I broke something and cannot get
  a shell." It always works.

---

## 9.8 Verify you are actually back

```sh
python3 tools/tvsh.py "ls -la /var/lib/webosbrew/init.d/ 2>/dev/null; cat /home/root/.config/lginputhook/keybinds.json 2>/dev/null; ls /home/root/.ssh 2>/dev/null"
```

*What this does:* checks the three things people forget. *What you should see:*
an empty/missing `init.d`, `{}` or no keybinds file, and no `.ssh` directory.

```sh
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.settingsservice/getSystemSettings '{\"category\":\"general\",\"keys\":[\"selectedInputApp\",\"lastInputApp\",\"physicalLastInputApp\"]}'"
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.settingsservice/getSystemSettings '{\"category\":\"option\",\"keys\":[\"quickStartMode\"]}'"
```

*What these do:* read the settings back. *What you should see:* Live TV in the
power-on slots and `"quickStartMode":"on"`.

Then reboot and confirm LG's own home screen appears with no Lumina, no Input
Hook, and no custom boot behaviour.

---

**Next:** [99. Troubleshooting](99-troubleshooting.md)

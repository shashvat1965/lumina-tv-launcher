# 3. Homebrew Channel and a root shell

**Goal:** confirm Homebrew Channel is really installed, turn on remote access,
get a root shell from your computer, and learn the `luna-send` quirks that will
bite you for the rest of this guide.

**Time:** 10 minutes. **Risk:** low (but see the telnet warning — it is the
single biggest security trade-off in this whole setup).

---

## 3.1 Confirm Homebrew Channel is installed

On the TV, open the app list. You should see **Homebrew Channel**. If it is not
there yet, reboot the TV once (Homebrew's install finishes during boot) and look
again.

From the computer, the repo's own probe prints a definitive answer:

```sh
cd ~/tv-launcher
python3 tools/probe_tv.py | tail -5
```

*What this does:* registers over SSAP with the saved key and lists apps. *What
you should see:* `hbchannel installed: True`.

Also check root status. From a shell **on the TV** (next section):

```sh
luna-send -n 1 -w 6000 -f luna://org.webosbrew.hbchannel.service/getConfiguration '{}'
```

*What this does:* reads Homebrew Channel's configuration. *What you should see:*
JSON with `"root": true`.

If it says `"root": false`, run Homebrew's elevation helper (this is exactly
what `rootrun/autoroot.sh` does):

```sh
/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/elevate-service
```

*What this does:* asks Homebrew Channel to elevate its root service. *What you
should see:* no output on success; re-run the `getConfiguration` call to confirm
`"root": true`.

---

## 3.2 Get a shell: pick SSH (recommended) or telnet

Homebrew Channel can expose **two** ways in:

| | SSH | Telnet |
| --- | --- | --- |
| Port | 22 | 23 |
| Auth | key (or password, depending on setup) | **none — anyone on the LAN gets root** |
| Status here | working, key at `~/.ssh/webos_tv` | **still enabled and unauthenticated** |
| Recommendation | use this | turn it off once SSH works |

`docs/PENDING.md` is blunt about it: *"Homebrew Channel's telnet service is still
enabled and unauthenticated — `tools/tvsh.py` simply connects to
`192.168.0.10:23` and gets a root shell, no credentials. Anything else on the LAN
can do the same."*

### Enable SSH in Homebrew Channel

Open **Homebrew Channel** on the TV → its **settings** (usually a gear, or the
menu inside the app) → enable the **SSH** service. Depending on your Homebrew
Channel version this is labelled "SSH server", "Enable SSH", or similar. Turn it
on and note any password it shows you.

Then from your computer:

```sh
ssh root@192.168.0.10
```

*What this does:* opens an SSH session to the TV as root. *What you should see:*
a password prompt (if password auth is on) and then a root shell — a prompt like
`root@lg-build:/home/root#`. Type `exit` to leave.

If you prefer key auth (and this repo does — `tools/glasshouse_services.py`
uses `ssh -i ~/.ssh/webos_tv root@192.168.0.10`), create a key if you do not
have one:

```sh
ls ~/.ssh/webos_tv || ssh-keygen -t ed25519 -f ~/.ssh/webos_tv -N ''
```

*What this does:* creates a password-less ed25519 key at `~/.ssh/webos_tv` only
if it does not already exist. *What you should see:* either the existing file, or
`ssh-keygen` output ending in a randomart image.

Install the public key on the TV (using telnet to bootstrap — this is the
chicken-and-egg step):

```sh
python3 tools/tvsh.py "mkdir -p /home/root/.ssh; echo '$(cat ~/.ssh/webos_tv.pub)' >> /home/root/.ssh/authorized_keys"
```

*What this does:* appends your public key to root's `authorized_keys` over
telnet. The `$(cat …)` is expanded by **your** shell, so the whole key arrives as
one argument. *What you should see:* little or no output on success.

Then lock the permissions down:

```sh
python3 tools/tvsh.py "chmod 700 /home/root/.ssh; chmod 600 /home/root/.ssh/authorized_keys"
ssh -i ~/.ssh/webos_tv root@192.168.0.10 'id'
```

*What this does:* fixes SSH's strict permission requirements, then tests key
login. *What you should see:* `uid=0(root) gid=0(root) ...`.

### The telnet fallback (and its warning)

`tools/tvsh.py` is the repo's telnet client. It is the most reliable way to run
one command as root **before** SSH is set up, and also when SSH misbehaves:

```sh
python3 tools/tvsh.py id
python3 tools/tvsh.py "ls -la /var/lib/webosbrew/init.d/"
```

*What this does:* opens a raw telnet connection to `192.168.0.10:23` and runs the
command as root, echoing only the output between its markers. *What you should
see:* `uid=0(root)...`, and the boot-hook directory listing.

> ⚠️ **Security warning — decide deliberately.** Telnet is plaintext and
> unauthenticated. While it is on, **every device on your LAN has root on your
> TV**. Keep it only while you are actively setting up, then turn it off in
> Homebrew Channel's settings (or block port 23 at the router). Once it is off,
> `tools/tvsh.py` stops working — use SSH, or `tools/run_tv.py`, or
> `tools/deploy.py` (SSAP). This is an open item in `docs/PENDING.md`; make the
> call yourself, but make it.

You can also run commands through Homebrew Channel's exec service, which needs
no shell at all:

```sh
python3 tools/run_tv.py "uname -a"
```

*What this does:* sends the command to `org.webosbrew.hbchannel.service/exec`
over SSAP. *What you should see:* the kernel string. This is the fallback when
both SSH and telnet are unavailable.

---

## 3.3 The `luna-send` quirks

Nearly everything in this guide is driven by **`luna-send`**, webOS's CLI for
calling its Luna services. It has two behaviours that waste hours if you do not
know them.

### Quirk 1 — it wants a login shell

A **non-interactive SSH command does not always get the environment `luna-send`
needs**, so this can fail or return nothing:

```sh
ssh root@192.168.0.10 'luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo {}'
```

If it does, use one of these instead:

```sh
ssh -t root@192.168.0.10          # allocate a TTY, then run luna-send interactively
ssh root@192.168.0.10 'sh -lc "luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo {}"'
python3 tools/tvsh.py "luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo {}"
```

*What this does:* runs the same call with a login shell / a real TTY / over
telnet. *What you should see:* the same JSON you would get interactively. This is
why scripts that must work over a plain SSH exec often fall back to telnet or to
Homebrew's `exec` service — the repo does exactly that.

### Quirk 2 — `-f` pretty-prints, so string matching needs the spaces stripped

`-f` is the "formatted / pretty JSON" flag, and this project uses it everywhere
because it makes output readable. But pretty-printing inserts **spaces and
newlines**, so a naive `grep` for `"returnValue":true` can miss
`"returnValue": true`.

The fix used throughout `rootrun/` is to strip them:

```sh
luna-send -n 1 -w 5000 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}' | tr -d ' \n'
```

*What this does:* prints the JSON with all spaces and newlines removed, so
matching is predictable. *What you should see:* a single long line, e.g.
`{"appId":"com.shashvat.launcher","returnValue":true,...}`.

The watchdog's source comments this explicitly: *"strip spaces: -f
pretty-prints"*. Do the same in anything you write.

### The invocation shape used in this repo

```sh
luna-send -n 1 -w 5000 -f <luna-uri> '<json-params>'
```

| Flag | Meaning |
| --- | --- |
| `-n 1` | Send once and exit (no subscription). |
| `-w 5000` | Wait up to 5000 ms for a reply. |
| `-f` | Pretty-print the reply (remember Quirk 2). |
| `-i` | Interactive: keep the call open for a subscription (used by the installer). |
| `-a <appid>` | Call as a given app id (used by SlopBro for toasts). |

Useful calls to know right now:

```sh
# what is on screen?
luna-send -n 1 -w 5000 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}'

# launch an app by id
luna-send -n 1 -w 5000 -f luna://com.webos.applicationManager/launch '{"id":"com.webos.app.livetv"}'

# close an app
luna-send -n 1 -w 5000 -f luna://com.webos.applicationManager/close '{"id":"com.shashvat.launcher"}'
```

*What these do:* read the foreground app, launch Live TV, and close Lumina.
*What you should see:* JSON with `"returnValue":true` and the `appId` you expect.

---

## 3.4 Map of what you can now reach

| Thing | Address | Tool |
| --- | --- | --- |
| Root shell | `ssh root@192.168.0.10` (key `~/.ssh/webos_tv`) | `ssh` |
| Root shell (fallback) | `192.168.0.10:23` | `python3 tools/tvsh.py` |
| Root shell (SSAP) | `org.webosbrew.hbchannel.service/exec` | `python3 tools/run_tv.py` |
| App list / SSAP | `192.168.0.10:3001` (TLS) | `tools/probe_tv.py` |
| Glasshouse dashboard | `http://192.168.0.10:8081` | browser / `tools/glasshouse_services.py` |
| TV Chrome DevTools | `192.168.0.10:9998` | `tools/tv-cdp.js` (Chapter 7) |

Turn the TV's telnet off when you are done setting up. Chapter 9 lists the undo
paths; the telnet decision is documented in `docs/PENDING.md` §3.

---

**Next:** [4. Declutter and privacy](04-declutter-and-privacy.md)

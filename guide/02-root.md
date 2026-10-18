# 2. Root it with SlopBro

**Goal:** install **Homebrew Channel** and root persistence on the TV using
**SlopBro**, the tool this project actually used.

**Time:** 10–20 minutes (plus waiting). **Risk:** medium — this is the one step
that exploits the TV. Read Chapter 1's risk section again if you skipped it.

---

## 2.1 What SlopBro is, and what it will do to your TV

SlopBro (`https://github.com/throwaway96/slopbro`) is a proof-of-concept for the
**jsserver vulnerability** in LG TVs. It is a single Python script plus a
`wwwroot/` directory of payload files. It works like this:

1. Starts a small HTTP server on **your computer** (port **8080**) serving the
   exploit page and payloads.
2. Opens an SSAP connection to the TV over TLS (port **3001**) and — the first
   time — asks the TV to pair with your computer.
3. Launches one of the TV's own built-in apps (on our TV it used
   `com.webos.app.voiceweb`) pointed at the exploit page on your computer.
4. That page, running inside a privileged app context, downloads a fake
   `com.webos.service.jsserver` package and runs it. The jsserver bug makes
   `main.js` execute **as root**.
5. `main.js` runs `autoroot.sh`, which installs **Homebrew Channel** and sets up
   persistence.

Nothing is flashed and no firmware is downgraded. Homebrew Channel is just an
app plus a root service; uninstalling it (much later) removes the persistence.

> **Why this tool and not another?** SlopBro reports success on webOS 4–11. For
> **webOS 3.5 and 4.x**, its own README recommends
> [`dejavuln-autoroot`](https://github.com/throwaway96/dejavuln-autoroot)
> instead. Use whatever `cani.rootmy.tv` recommended for your model in
> Chapter 1.

---

## 2.2 Get SlopBro

```sh
cd ~
git clone https://github.com/throwaway96/slopbro.git
cd slopbro
python3 slopbro.py --help
```

*What this does:* clones SlopBro into `~/slopbro` and prints its options.
*What you should see:* a `slopbro.py` file, a `wwwroot/` directory, and a usage
block listing `--debug`, `--local-ip`, `--webos-version`, `--curl-insecure`,
`--fake-service-path`, `--asset-source`, `--test-server`.

**Keep it at `~/slopbro`.** Several tools in this repo import it from exactly
that path (`sys.path.insert(0, os.path.expanduser("~/slopbro"))` in
`tools/probe_tv.py`, `tools/fetch_apps.py`, `tools/deploy.py`, and friends).

The repo's `.gitignore` and this guide assume SlopBro stays outside the project —
it is a separate project with its own licence, not vendored here.

---

## 2.3 Before you run it

- [ ] TV is **on** and on the same network as the computer (Chapter 1).
- [ ] You know the TV's IP (**`192.168.0.10`** in this repo — substitute yours).
- [ ] You have **not** accepted a firmware update (Chapter 1.4).
- [ ] The TV has been **awake for at least two minutes** since it booted. This
      matters: the TV's app manager can take **up to ~2 minutes after boot** to
      answer, and SlopBro will appear to hang or fail if you start too early.
      Turn the TV on, wait, then run.
- [ ] Your remote is in your hand. You will need it for the pairing prompt.

---

## 2.4 Run it

```sh
cd ~/slopbro
python3 slopbro.py --debug 192.168.0.10
```

*What this does:* starts the local HTTP server, connects to the TV, requests
pairing, launches the exploit. `--debug` adds extra output on the TV screen and
in SlopBro's log. *What you should see:* a line like

```
[...] connecting to wss://192.168.0.10:3001
[...] no stored client key; pairing will be requested
[...] accept the pairing prompt on the TV screen ...
```

**Now look at the TV.**

### The pairing prompt — and the trap we hit

The TV shows a dialog asking whether to allow the connection, with a **client
name** and **Allow / Deny** (wording varies by version). **The remote's default
selection is usually "No"/"Deny".**

> **Pitfall we actually hit: "User rejected pairing".**
> If you just press **OK/Enter**, you reject the pairing. You must press
> **left/right** to move the highlight onto **Yes / Allow** (or **Accept**), and
> *then* press OK. The TV then shows a confirmation/toast. On our TV the first
> attempt failed exactly this way; the second attempt, with the selection moved
> to "Yes", succeeded and SlopBro printed:

```
[...] registered; client key saved
[...] confirmed app is installed: com.webos.app.voiceweb
[...] launching com.webos.app.voiceweb -> http://192.168.0.3:8080/index.html?...
```

If you reject it, SlopBro exits with a pairing error. Just run it again — the
prompt returns. Nothing is broken.

The client key is saved as **`~/slopbro/<TV_IP>.key`** (e.g.
`192.168.0.10.key`). Future runs reuse it and do **not** prompt again.

### What the TV screen does during the exploit

- The screen switches to a plain page (the exploit's `index.html`) showing
  **status text and debug info** — a progress list, sometimes toasts.
- SlopBro's terminal prints each file the TV requests:
  `served required file: index.html (1/4)`, `autoroot.sh (2/4)`,
  `package.json (3/4)`, `main.js (4/4)`, then `done; all tracked files were
  requested`.
- The TV may flash a toast or briefly show Homebrew Channel installing.
- **The exploit page can stay open afterwards.** This is normal — it is a normal
  WAM app page and it does not close itself. Press **Home/Back** on the remote
  to leave it. It does not need to stay running.

> **Pitfall: the app manager takes up to two minutes to answer after boot.**
> If SlopBro says it cannot launch or the TV shows nothing, wait two minutes
> after power-on and try again. This is a timing problem, not a broken exploit.

---

## 2.5 If the launch fails: pass a webOS version

SlopBro picks a target app based on the TV's webOS version, but **it does not
auto-detect the version**. Its README says plainly: *"the version is not
currently auto-detected, so you may need to specify it if the selected app
fails."*

If the exploit page never appears, or SlopBro reports the launched app failed,
retry with your TV's **major** webOS version:

```sh
python3 slopbro.py --debug --webos-version 11 192.168.0.10
```

*What this does:* limits the target apps to those configured for that major
version. Dotted versions such as `6.5` are accepted and treated as major `6`.
*What you should see:* a different target app is launched, and the file requests
appear as above.

> **Be honest about the number.** This project's logs do not record which
> `--webos-version` value was passed on the successful run — the launch of
> `com.webos.app.voiceweb` succeeded without it being visible in the log. Use
> **your** TV's major version (Chapter 1). Our TV's SDK reports `11.0.1`, so
> `11` is the sensible first try there; try the marketing generation if that
> fails.

Other useful flags, straight from SlopBro's README:

| Flag | When to use it |
| --- | --- |
| `--local-ip 192.168.0.3` | SlopBro guessed the wrong LAN address and the TV never connects back. |
| `--curl-insecure` | The TV's clock is wrong (often because update/SDP domains are blocked), so TLS downloads fail. Use only when needed. |
| `--fake-service-path <path>` | Override the jsserver-bypass path; default is `/usr/palm/services/com.palm.service.devmode`. |
| `--test-server simple` | Prove the TV can reach your computer's HTTP server *before* dealing with pairing. |
| `--test-server payload` | Serve the exploit page only, so you can open it in a browser and inspect it. |

---

## 2.6 Verify the root

### On the TV

Homebrew Channel should now appear in the TV's app list (it may take a refresh —
open the app list, or reboot the TV). Its app id is
**`org.webosbrew.hbchannel`**.

### From the computer

```sh
cd ~/tv-launcher
python3 tools/probe_tv.py
```

*What this does:* connects over SSAP using the client key SlopBro saved, lists
installed apps, and checks for Homebrew Channel. *What you should see:*

```
stored key: xxxxxxxx...
registered ok
installed apps: NN
   ...
hbchannel installed: True
```

If it prints `hbchannel installed: False`, Homebrew Channel did not install —
re-run Chapter 2.4 (the key is already saved, so there will be no pairing
prompt) and watch the TV screen for an error.

> `tools/probe_tv.py` imports SlopBro from `~/slopbro` and changes into that
> directory so the saved key is found. If you moved SlopBro, this fails. Keep it
> at `~/slopbro`.

### Root status

Once you have a shell (Chapter 3), this is the exact call the project uses to
check whether Homebrew has root:

```sh
luna-send -n 1 -w 6000 -f luna://org.webosbrew.hbchannel.service/getConfiguration '{}'
```

*What this does:* asks Homebrew Channel for its configuration. *What you should
see:* pretty-printed JSON containing `"root": true`. If it says `"root": false`,
the `autoroot.sh` payload's elevation step has not run; Chapter 3 shows how to
elevate.

---

## 2.7 What just changed on the TV

SlopBro's payload installed:

- **Homebrew Channel** (`org.webosbrew.hbchannel`) — the app and its root
  service, under `/media/developer/`.
- Persistence under `/media/developer/` so root survives a reboot.

It did **not** (yet) install the privacy apps, the launcher, or any boot hook.
Those are Chapters 4 and 5. You are now at "rooted, otherwise mostly stock".

---

**Next:** [3. Homebrew Channel and a root shell](03-homebrew-and-a-shell.md)

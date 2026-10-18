# 1. Check your TV

**Goal:** know exactly what you have — model, firmware, and LAN address — and
whether it can be rooted *before* you change anything.

**Time:** 10 minutes. **Risk:** none. This chapter only reads information.

---

## 1.1 Find the model and firmware on the TV

Use the remote:

1. Press **Settings** (the gear) → **All Settings** → **General** → **About This
   TV** (on some models: **Support** → **TV Information**).
2. Write down:
   - **Model name / number** — e.g. `43NU885BPLA`
   - **Software version** — this is the firmware, e.g. `43.04.24`
   - **webOS version** — e.g. `webOS 26`, or an SDK number like `11.0.1`

The model string is usually longer than the marketing name. On our TV the full
model is **`43NU885BPLA.DTRDLJL`**.

> **The TV this repo was built on.** LG **`43NU885BPLA.DTRDLJL`** — the README
> calls its generation **webOS 26**, while the TV's own SDK reports webOS
> **11.0.1** with firmware **43.04.24** and board `K25LPN_DVB_AJ` (4-core ARM,
> 1.5 GB RAM). Both numbers are true and they are not in conflict: LG's
> year-style marketing name and the underlying SDK version are different
> labels. **Your TV will likely differ — that is the point of this chapter.**

**The model number is the single most important thing you will write down.** It
decides whether any of this works.

---

## 1.2 Find the TV's IP address

### Option A — on the TV (most reliable)

**Settings → All Settings → Connection → Network → Wi-Fi Connection → Advanced
Wi-Fi Settings** (or **Wired Connection**). The IP is shown there, e.g.
`192.168.0.10`.

### Option B — from your computer

List devices on the LAN and look for an LG entry:

```sh
arp -a | grep -i -E 'lg|inventec|wistron'
```

*What this does:* prints the computer's ARP table filtered to likely LG
manufacturer names. *What you should see:* a line containing an IP and a MAC
address. If nothing matches, run the TV's network screen once, then try again.

Or ping the address you think it is:

```sh
ping -c 3 192.168.0.10
```

*What this does:* sends three ICMP pings. *What you should see:* three replies
with times in milliseconds. (Some networks block ping; a failure here is not
proof the TV is unreachable.)

Then confirm it is the TV by opening this in a browser on your computer:

```sh
curl -s -m 5 http://192.168.0.10:3000 | head -c 200
```

*What this does:* tries LG's SSAP HTTP endpoint on port 3000. *What you should
see:* some JSON or an HTTP response (often a `401`/permission-ish body), which
confirms the port is open. Connection refused means you have the wrong IP, or
the TV is off, or the network isolates clients from each other.

> **Guest Wi-Fi and "AP isolation" break everything.** Your computer must be able
> to reach the TV *and* the TV must be able to reach your computer (SlopBro serves
> files back to the TV, and later the TV downloads installs from your computer on
> port 8123). If you are on a guest network, a hotel network, or a router with
> client isolation, move both onto the main network first.

**Reserve the address.** Give the TV a DHCP reservation in your router, or at
least note that it can change after a reboot. Every script here assumes it does
not — if it does, everything "mysteriously stops working". (This is exactly why
`TV_IP` exists; see the box below.)

### Using a different address

Both the Python tools and `tools/tv-cdp.js` read **`TV_IP`**:

```sh
TV_IP=192.168.1.55 python3 tools/probe_tv.py
TV_IP=192.168.1.55 node tools/tv-cdp.js shot
```

*What this does:* overrides the built-in default for that one command. *What you
should see:* the tool talks to `192.168.1.55` instead of `192.168.0.10`. Omitting
`TV_IP` keeps the old default, so every existing command in this repo still
works unchanged.

The **shell scripts in `dist/` and `rootrun/`** do **not** read `TV_IP` — they
hardcode the TV and the computer. If your addresses differ, edit these lines
before copying a script to the TV:

| File | Line to change |
| --- | --- |
| `dist/tv_update.sh` | `BASE="http://192.168.0.3:8123"` |
| `dist/tv_install.sh` | `BASE="http://192.168.0.3:8123"` |
| `dist/tv_lumina_install.sh` | `BASE="http://192.168.0.3:8123"` |
| `dist/tv_icons.sh` | `BASE="http://192.168.0.3:8123"` |
| `dist/tv_push.sh` | `BASE="http://192.168.0.3:8123"` |
| `rootrun/autoroot.sh` | `BASE="http://192.168.0.3:8123"` |

`192.168.0.3` is **your computer**, not the TV: it is where the little HTTP
server that hands `.ipk` files to the TV runs. If your computer's LAN address is
different, change it in those files (or pass `--port`/use `tools/deploy.py`,
which guesses the local IP automatically).

---

## 1.3 Check whether your TV is rootable

Rooting is not universal. It depends on the **model**, the **firmware version**,
and **which exploit still works** on that combination. Check, in this order:

1. **`https://cani.rootmy.tv`** — the community compatibility checker. Enter your
   model and/or firmware and it tells you whether a known method applies and
   which one.
2. **`https://webosbrew.org`** — the Homebrew Channel project's site. It links
   the supported-device / table-of-hardware information and the install guide for
   your platform generation.
3. **The rooting tool's own README** — for SlopBro (Chapter 2): it has been used
   on **webOS 4 through 11**, and its README recommends a *different* tool
   (`dejavuln-autoroot`) for webOS 3.5 and 4.x.

Write down the **recommended method** for your exact model. If the answer is
"no known method", **stop here** — the rest of this guide does not apply to your
TV, and no amount of retrying will change that.

### What "rootable" actually depends on

- **The firmware version matters more than the model.** A model that was rootable
  last year may not be after an update. This is why the next section exists.
- **Newer is not better here.** LG patches the vulnerabilities these tools use.
  A TV that shipped with a newer firmware may already be patched.
- **Region/model variants differ.** `43NU885BPLA` and `43NU885BPLA.DTRDLJL` can
  behave differently; the full string is what you check.

---

## 1.4 The do-not-update rule (read this twice)

> ## ⚠️ Do not accept a firmware update until you are rooted — and ideally not
> ## until you have finished this whole guide.

Concretely:

1. **Turn off automatic updates** if your TV offers the setting (Settings →
   General → About This TV → **Allow Automatic Updates** → off, wording varies).
2. When the TV shows an update prompt, **decline it**. Do not press "Update".
3. Do not use LG's "Software Update" menu to check for updates.
4. Keep the TV **off the internet** if you cannot trust yourself to decline —
   you can root over the LAN without internet, and you can re-enable internet
   after Chapter 4 has blocked the update domains.

**Why:** an update can close the exploit, and there is no supported way to
downgrade a webOS TV. If you update first, you may permanently lose the ability
to root *this* TV. There is no undo for that.

After Chapter 4, firmware-update domains are DNS-blocked at the TV, which makes
this much safer — but that protection only exists *after* you are rooted.

---

## 1.5 Record your details

Fill this in and keep it next to you:

```
Model:            ______________________
Firmware:         ______________________
webOS version:    ______________________
TV IP:            ______________________
Computer IP:      ______________________
Root method:      ______________________
Rootable?        yes / no / unclear
```

You will use the TV IP and computer IP constantly. The next chapter roots the TV.

---

**Next:** [2. Root it with SlopBro](02-root.md)

# Homebrew boot hooks on the TV

`/var/lib/webosbrew/init.d/` is Homebrew Channel's boot-hook directory: scripts here are run **as
root at boot**. Every hook below was either installed by one of the apps or written directly by a
script in this repo. Nothing here is required for the TV to boot, and each one can be removed
independently.

> Derived from `rootrun/*.sh`, `dist/*.sh` and the install scripts in this repo. Where a hook is
> only mentioned by name (never created or dumped here), it is marked **verify on device** — don't
> assume its contents.

## Hooks

| Hook (`/var/lib/webosbrew/init.d/`) | What it does | Where it comes from | How to remove it |
| --- | --- | --- | --- |
| `60-tvl-launcher.sh` | **Lumina boot autostart.** Waits for the app manager (`getForegroundAppInfo`) to answer, then launches `com.shashvat.launcher` — but only if the stock home or nothing is on screen. The current version makes a *single* attempt per boot and logs to `/tmp/lumina-boot.log`. | Written by `rootrun/lumina-boot.sh` (current, conservative) and by `rootrun/autoroot.sh` §6 / `dist/tv_push.sh` §4 (earlier, retry-loop variants). The on-TV copy is one of these — **verify on device** which. | `rm -f /var/lib/webosbrew/init.d/60-tvl-launcher.sh` (done by `dist/tv_stop_launcher.sh` and `dist/tv_unroot.sh`) |
| `50-tvl-ssh.sh` | Boot-time **remote access** (SSH/root shell). Only ever seen in the removal list of `dist/tv_unroot.sh`; it is not created by any script in this repo. | Not in this repo — **verify on device** (contents, and whether it exists at all). | `rm -f /var/lib/webosbrew/init.d/50-tvl-ssh.sh` (as `dist/tv_unroot.sh` does, *before* the SSH keys) |
| `inputhook` | Starts **LG Input Hook** (`org.webosbrew.inputhook`) so the keybind file is honoured — this is what makes the **HOME** key open Lumina. | Installed by the Input Hook app; the keybind itself is written by `rootrun/autoroot.sh` §2 / `dist/tv_push.sh` §5. | `rm -f /var/lib/webosbrew/init.d/inputhook` (one of the lines in `dist/tv_unroot.sh`); also clear the keybinds file below |
| `50-lifesgoodwithoutspying` | **Life's Good Without Spying**'s own boot hook, keeping its consent/service shutdown in force across boots. | Installed by the `ooo.lew.lifesgoodwithoutspying` package (not by a script here). | Keep it if you keep the app. If you uninstall that app: `rm -f /var/lib/webosbrew/init.d/50-lifesgoodwithoutspying` (commented out in `dist/tv_unroot.sh` for exactly that reason) |
| `50-tvweb.sh` | **Glasshouse**'s boot hook: starts the Glasshouse server and restores the ad-block `hosts` bind-mount (i.e. the firmware-update DNS block). | Shipped by the upstream **Glasshouse** project (vendored as `glasshouse/`, gitignored here — see `glasshouse/server/50-tvweb.sh`). | Via Glasshouse's own uninstall/deploy script (`glasshouse/server/deploy.sh`), or `rm -f /var/lib/webosbrew/init.d/50-tvweb.sh` — **verify on device** whether it is named exactly this on the TV |
| *(possibly)* App Update Blocker's hook | `org.webosbrew.appupdateblocker` blocks LG's silent app updates; a boot hook is plausible but this repo neither creates nor lists one. | — | **verify on device**: `ls -la /var/lib/webosbrew/init.d/` and look for an `appupdateblocker`-named entry before removing anything |

## Hooks and bindings outside `init.d/`

These are also installed on the TV and are easy to forget when unrooting:

| Thing | What it does | How to remove it |
| --- | --- | --- |
| `/home/root/.config/lginputhook/keybinds.json` | The Home-key rebind: `{"773":{"action":"launch","id":"com.shashvat.launcher"}}` (`773` = HOME). Requires Input Hook + its boot hook above. | `echo '{}' > /home/root/.config/lginputhook/keybinds.json` (as `dist/tv_stop_launcher.sh` does) or `rm -f` it (as `dist/tv_unroot.sh` does) |
| `/media/developer/tvl-home.sh` | Tiny helper written by `rootrun/autoroot.sh`: `luna-send` launching Lumina. Used as a Home-key action target. | `rm -f /media/developer/tvl-home.sh` |
| `settingsservice` **power-on slot** (`general`: `lastInputApp`, `physicalLastInputApp`, `selectedInputApp`) | Set to the launcher by `dist/tv_push.sh` §3 so a power-on lands in Lumina. The current setup leaves it alone, but older runs will still have it set. | `dist/tv_stop_launcher.sh` or `dist/tv_unroot.sh` set it back to `com.webos.app.livetv` |
| `option.quickStartMode` | Turned **off** so a power-on is a real boot and the boot hook runs. | `dist/tv_unroot.sh` sets it back to `on` |
| `/var/lib/webosbrew/init.d/` generally | Last stop before uninstalling Homebrew Channel. | `ls -la /var/lib/webosbrew/init.d/` first, then uninstall Homebrew Channel from the TV app list (it wipes `/media/developer`, i.e. root persistence) — see `dist/tv_unroot.sh` |

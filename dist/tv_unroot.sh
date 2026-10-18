#!/bin/sh
# tv_unroot.sh — return this TV to a near-stock state.
#
# NOT run automatically. Run it on the TV as root (over SSH: root@192.168.0.10)
# only when you actually want to unroot.
#
# Order matters: remove boot hooks and remote-access keys BEFORE uninstalling the
# apps they reference, otherwise you leave hooks pointing at missing apps.

echo "== 1) boot hooks =="
rm -f /var/lib/webosbrew/init.d/60-tvl-launcher.sh
rm -f /var/lib/webosbrew/init.d/50-tvl-ssh.sh
rm -f /var/lib/webosbrew/init.d/inputhook
# keep LGWS's hook only if you keep Life's Good Without Spying:
#   rm -f /var/lib/webosbrew/init.d/50-lifesgoodwithoutspying
ls -la /var/lib/webosbrew/init.d/ 2>/dev/null

echo "== 2) remote access + keybinds =="
rm -rf /home/root/.ssh
rm -f /home/root/.config/lginputhook/keybinds.json
rm -f /media/developer/tvl-home.sh
echo "removed ssh keys and keybinds"

echo "== 3) settings we changed =="
luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings \
  '{"category":"general","settings":{"lastInputApp":"com.webos.app.livetv","physicalLastInputApp":"com.webos.app.livetv","selectedInputApp":"off","homeAutoLaunch":"off"}}' >/dev/null 2>&1
luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings \
  '{"category":"option","settings":{"quickStartMode":"on"}}' >/dev/null 2>&1
echo "power-on screen back to Live TV; Quick Start+ back ON"

echo "== 4) apps to uninstall (do these from the TV: app list -> long press -> delete) =="
cat <<'LIST'
  - Launcher                (com.shashvat.launcher)        <- needs root/dev-mode
  - LG Input Hook           (org.webosbrew.inputhook)      <- needs root
  - Life's Good Without Spying (ooo.lew.lifesgoodwithoutspying) <- needs root
  - LG App Update Blocker   (org.webosbrew.appupdateblocker) <- needs root
  - (keep Stremio if you like - io.strem.webos does NOT need root)
LIST

echo "== 5) Homebrew Channel LAST (also wipes /media/developer, i.e. root persistence) =="
echo "  Uninstall 'Homebrew Channel' from the TV app list."
echo "  Do NOT reinstall the LG 'Developer Mode' app while rooted; after unrooting it is fine."

echo "== 6) optional full restore =="
echo "  Settings > General > Reset to Initial Settings  (factory state; simplest before a service visit)"

echo "== done (steps 4-6 are manual on the TV) =="

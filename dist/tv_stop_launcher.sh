#!/bin/sh
# tv_stop_launcher.sh — stop the launcher from opening on its own.
# Removes the boot hook, reverts the power-on slot, clears the Home keybind,
# closes the running instance, and reports what happened.

SS=luna://com.webos.settingsservice
AM=luna://com.webos.applicationManager
LAUNCHER=com.shashvat.launcher

echo "== 1) remove the boot hook (this was relaunching it after boot) =="
rm -f /var/lib/webosbrew/init.d/60-tvl-launcher.sh
ls -la /var/lib/webosbrew/init.d/ 2>/dev/null

echo
echo "== 2) revert the power-on slot to Live TV =="
luna-send -n 1 -f "$SS/setSystemSettings" \
  '{"category":"general","settings":{"selectedInputApp":"off","lastInputApp":"com.webos.app.livetv","physicalLastInputApp":"com.webos.app.livetv","homeAutoLaunch":"off"}}' 2>&1 | tr -d '\n '; echo

echo
echo "== 3) clear the Home key binding (HOME goes back to LG home) =="
mkdir -p /home/root/.config/lginputhook
echo '{}' > /home/root/.config/lginputhook/keybinds.json
cat /home/root/.config/lginputhook/keybinds.json

echo
echo "== 4) close the launcher if it is running =="
fg=$(luna-send -n 1 -f "$AM/getForegroundAppInfo" '{}' 2>/dev/null)
echo "foreground now: $fg"
case "$fg" in
  *$LAUNCHER*)
    luna-send -n 1 -f "$AM/close" "{\"id\":\"$LAUNCHER\"}" >/dev/null 2>&1
    echo "asked the launcher to close"
    ;;
  *) echo "launcher was not in the foreground" ;;
esac

echo
echo "== 5) verify =="
luna-send -n 1 -f "$SS/getSystemSettings" \
  '{"category":"general","keys":["selectedInputApp","lastInputApp","physicalLastInputApp"]}' 2>&1 | tr -d '\n '; echo
echo "hook present? $(ls /var/lib/webosbrew/init.d/60-tvl-launcher.sh 2>/dev/null || echo no)"
echo "keybinds: $(cat /home/root/.config/lginputhook/keybinds.json)"

echo
echo "== 6) what the hook was doing (its own log) =="
tail -20 /tmp/tvl-launcher.log 2>/dev/null || echo "(no hook log)"

echo
echo "== 7) why Wi-Fi dropped a while ago (link logs) =="
grep -a -i -E 'wpa_supp|connman|wifi|dhcp' /tmp/var/log/messages 2>/dev/null | tail -18

echo
echo "== 8) power-on decisions from bootd =="
grep -a -E 'boot settings|AutoLaunch|settings' /tmp/var/log/bootd.log 2>/dev/null | tail -8

echo
echo "== 9) link state =="
ifconfig 2>/dev/null | grep -E '^wlan0' -A2
ping -c1 -W2 192.168.0.1 >/dev/null 2>&1 && echo "gateway OK" || echo "gateway FAIL"

echo
echo "== DONE =="

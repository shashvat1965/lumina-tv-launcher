#!/bin/sh
# tv_lumina_install.sh — install the new Lumina launcher and refresh icons.
# Deliberately does NOT launch it: the app stays inert until you open it.
BASE="http://192.168.0.3:8123"
APPDIR="/media/developer/apps/usr/palm/applications/com.shashvat.launcher"

echo "[*] downloading package"
curl -s --max-time 240 -o /tmp/lum.ipk "$BASE/com.shashvat.launcher_0.2.0_all.ipk"
ls -la /tmp/lum.ipk

# dev-mode flag + appinstalld restart (silent install failures without this)
if [ ! -d /var/luna/preferences/devmode_enabled ]; then
  rm -f /var/luna/preferences/devmode_enabled
  mkdir -- /var/luna/preferences/devmode_enabled
fi
restart appinstalld >/dev/null 2>&1

echo "[*] installing"
luna-send -n 1 -w 60000 -i 'luna://com.webos.appInstallService/dev/install' \
  '{"id":"com.ares.defaultName","ipkUrl":"/tmp/lum.ipk","subscribe":true}' > /tmp/lum-install.log 2>&1
tail -2 /tmp/lum-install.log

echo "[*] version on disk: $(grep -o '"version": "[^"]*"' "$APPDIR/appinfo.json")"
echo "[*] layout: $(ls "$APPDIR" | tr '\n' ' ')"
echo "[*] posters: $(ls "$APPDIR/assets" 2>/dev/null | wc -l)  fonts: $(ls "$APPDIR/fonts" 2>/dev/null | wc -l)"

echo "[*] refreshing app icons (the package install clears them)"
curl -s --max-time 60 -o /tmp/tv_icons.sh "$BASE/tv_icons.sh" && sh /tmp/tv_icons.sh 2>&1 | tail -3

echo "[*] not launching — app is inert until opened"
echo "[*] DONE"

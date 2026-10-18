#!/bin/sh
# tv_update.sh — install the newest launcher build, refresh icons, relaunch.
# Runs on the TV as root (via Homebrew telnet). No flashes needed.
BASE="http://192.168.0.3:8123"
APPDIR="/media/developer/apps/usr/palm/applications/com.shashvat.launcher"
DST="$APPDIR/icons/apps"

IPK=$(curl -s "$BASE/" | grep -o 'com\.shashvat\.launcher_[0-9.]*_all\.ipk' | sort | tail -1)
[ -n "$IPK" ] || { echo "[!] could not find an ipk on the server"; exit 1; }

echo "[*] installing $IPK"
curl -s --max-time 120 -o /tmp/tvl-launcher.ipk "$BASE/$IPK" || echo "[!] download failed"
ls -la /tmp/tvl-launcher.ipk

# dev-mode flag + appinstalld restart: dev installs silently fail without this
if [ ! -d /var/luna/preferences/devmode_enabled ]; then
  rm -f /var/luna/preferences/devmode_enabled
  mkdir -- /var/luna/preferences/devmode_enabled
fi
restart appinstalld >/dev/null 2>&1

luna-send -n 1 -w 60000 -i 'luna://com.webos.appInstallService/dev/install' \
  "{\"id\":\"com.ares.defaultName\",\"ipkUrl\":\"/tmp/tvl-launcher.ipk\",\"subscribe\":true}" \
  > /tmp/tvl-launcher-install.log 2>&1
echo "install response:"
tail -6 /tmp/tvl-launcher-install.log
echo "version on disk: $(grep -o '\"version\": \"[^\"]*\"' "$APPDIR/appinfo.json")"

echo "[*] refreshing icons"
mkdir -p "$DST"

copy_icon() {
  id="$1"; folder="$2"; rel="$3"; url="$4"
  dest="$DST/$id.png"
  [ -s "$dest" ] && return 0
  if [ -n "$folder" ] && [ -n "$rel" ] && [ -f "$folder/$rel" ]; then
    cp -f "$folder/$rel" "$dest" 2>/dev/null && chmod 644 "$dest" && return 0
  fi
  if [ -n "$folder" ] && [ -d "$folder" ]; then
    f=$(find "$folder" -maxdepth 4 -iname 'icon*.png' 2>/dev/null | head -1)
    [ -z "$f" ] && f=$(find "$folder" -maxdepth 4 -iname '*icon*.png' 2>/dev/null | head -1)
    [ -n "$f" ] && cp -f "$f" "$dest" 2>/dev/null && chmod 644 "$dest" && return 0
  fi
  if [ -n "$url" ]; then
    curl -k -s --max-time 20 -o "$dest" "$url" 2>/dev/null && [ -s "$dest" ] && chmod 644 "$dest" && return 0
  fi
  rm -f "$dest" 2>/dev/null
  return 1
}

if curl -s --max-time 30 -o /tmp/tvl-icons.sh "$BASE/copy_icons.sh"; then
  . /tmp/tvl-icons.sh
fi
echo "[*] icons present: $(ls "$DST" 2>/dev/null | wc -l) of ${ICON_EXPECTED:-?}"
grep -o '"id": "[^"]*"' "$APPDIR/js/apps.js" | cut -d'"' -f4 | while read appid; do
  [ -f "$DST/$appid.png" ] || echo "    missing icon: $appid"
done

echo "[*] relaunching launcher"
luna-send -n 1 -f luna://com.webos.applicationManager/launch '{"id":"com.shashvat.launcher"}' >/dev/null 2>&1
echo "[*] DONE"

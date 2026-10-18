#!/bin/sh
# tv_install.sh <ipk-filename-on-the-Mac-server>
# Downloads an IPK from the Mac's HTTP server and installs it on the TV (root not required).
BASE="http://192.168.0.3:8123"
IPK="$1"

[ -n "$IPK" ] || { echo "usage: tv_install.sh <ipk-filename>"; exit 1; }

if [ ! -d /var/luna/preferences/devmode_enabled ]; then
  rm -f /var/luna/preferences/devmode_enabled
  mkdir -- /var/luna/preferences/devmode_enabled
fi
restart appinstalld >/dev/null 2>&1

echo "[*] downloading $IPK"
curl -s --max-time 300 -o /tmp/tvl-install.ipk "$BASE/$IPK" || echo "[!] download failed"
ls -la /tmp/tvl-install.ipk

echo "[*] installing"
luna-send -n 1 -w 90000 -i 'luna://com.webos.appInstallService/dev/install' \
  '{"id":"com.ares.defaultName","ipkUrl":"/tmp/tvl-install.ipk","subscribe":true}' 2>&1 | tail -5

echo "[*] DONE"

#!/bin/sh
# tv_push.sh — one-shot deploy:
#   1) launcher 0.1.8 + icon refresh (incl. Stremio)
#   2) Quick Start+ OFF  -> every power-on is a real boot, so the boot hook runs
#   3) power-on slot -> launcher (fast path experiment)
#   4) hardened boot hook
#   5) Home key -> launcher
#   6) verification readback
BASE="http://192.168.0.3:8123"
APPDIR=/media/developer/apps/usr/palm/applications/com.shashvat.launcher
DST="$APPDIR/icons/apps"
AM=luna://com.webos.applicationManager

echo "=== 1) launcher + icons ==="
curl -s -o /tmp/tvl_update.sh "$BASE/tv_update.sh" && sh /tmp/tvl_update.sh 2>&1 | tail -12

echo "=== 2) Quick Start+ OFF (so a power-on boots and the hook runs) ==="
luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings \
  '{"category":"option","settings":{"quickStartMode":"off"}}' 2>&1 | tr -d '\n'; echo

echo "=== 3) power-on slot -> launcher (fast path; revert = set back to com.webos.app.livetv) ==="
luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings \
  '{"category":"general","settings":{"homeAutoLaunch":"off","selectedInputApp":"com.shashvat.launcher","checkHomeAutoLaunchValue":"user"}}' 2>&1 | tr -d '\n'; echo
luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings \
  '{"category":"general","settings":{"lastInputApp":"com.shashvat.launcher","physicalLastInputApp":"com.shashvat.launcher"}}' 2>&1 | tr -d '\n'; echo

echo "=== 4) hardened boot hook ==="
cat > /var/lib/webosbrew/init.d/60-tvl-launcher.sh <<'EOS'
#!/bin/sh
export PATH=/usr/bin:/bin:/usr/sbin:/sbin
LOG=/tmp/tvl-launcher.log
AM=luna://com.webos.applicationManager
say() { echo "$(date) $*" >> "$LOG"; }
l()   { luna-send -n 1 -w 5000 -f "$1" "$2" 2>>"$LOG"; }
(
  say "hook start"
  i=0
  while [ "$i" -lt 60 ]; do
    out=$(l "$AM/getForegroundAppInfo" '{}')
    case "$out" in *'"returnValue":true'*) break ;; esac
    i=$((i+1)); sleep 2
  done
  say "appManager ready after $i polls"
  n=0
  while [ "$n" -lt 20 ]; do
    l "$AM/launch" '{"id":"com.shashvat.launcher"}' >/dev/null
    sleep 6
    fg=$(l "$AM/getForegroundAppInfo" '{}')
    case "$fg" in *com.shashvat.launcher*) say "OK after $n"; exit 0 ;; esac
    n=$((n+1))
  done
  say "gave up; last fg: $fg"
) &
EOS
chmod 755 /var/lib/webosbrew/init.d/60-tvl-launcher.sh
chown root:root /var/lib/webosbrew/init.d/60-tvl-launcher.sh
ls -la /var/lib/webosbrew/init.d/60-tvl-launcher.sh

echo "=== 5) Home key -> launcher ==="
mkdir -p /home/root/.config/lginputhook
echo '{"773":{"action":"launch","id":"com.shashvat.launcher"}}' > /home/root/.config/lginputhook/keybinds.json
cat /home/root/.config/lginputhook/keybinds.json; echo

echo "=== 6) verify ==="
echo "launcher version: $(grep -o '"version": "[^"]*"' $APPDIR/appinfo.json)"
echo "icons on disk:   $(ls $DST 2>/dev/null | wc -l)"
echo "stremio icon:    $(ls -la $DST/io.strem.webos.png 2>&1)"
echo "keybinds:        $(cat /home/root/.config/lginputhook/keybinds.json)"
echo "quickstart:      $(luna-send -n 1 -f luna://com.webos.settingsservice/getSystemSettings '{"category":"option","keys":["quickStartMode"]}' 2>&1 | tr -d '\n ')"
echo "power-on keys:   $(luna-send -n 1 -f luna://com.webos.settingsservice/getSystemSettings '{"category":"general","keys":["homeAutoLaunch","selectedInputApp","physicalLastInputApp","lastInputApp"]}' 2>&1 | tr -d '\n ')"
echo "=== DONE ==="

#!/bin/sh
# tv-launcher payload v6 — verify HB root, install + arm Input Hook, helper script,
# faster boot autostart.
BASE="http://192.168.0.3:8123"
HB="/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service"

beacon() { curl -s -o /dev/null --max-time 6 "$BASE/beacon/$1" 2>/dev/null; }
safe() { tr -d '\n\r' | sed 's/[^A-Za-z0-9._~-]/_/g' | head -c 500; }
b64() { if command -v base64 >/dev/null 2>&1; then base64 | tr -d '\n'; else openssl base64 | tr -d '\n'; fi; }
scrub() { tr -d '\n' | tr '+/=' '._-'; }

umask 022
beacon "start6/$(date +%s)"

install_ipk() {
  label="$1"; path="$2"
  payload=$(printf '{"id":"com.ares.defaultName","ipkUrl":"%s","subscribe":true}' "$path")
  fifo="/tmp/tvl-$label.fifo"; out="/tmp/tvl-$label.inst"
  rm -f "$fifo" "$out"; mkfifo -- "$fifo"
  luna-send -w 20000 -i 'luna://com.webos.appInstallService/dev/install' "$payload" > "$fifo" 2>&1 &
  lpid=$!
  cat "$fifo" > "$out" 2>/dev/null &
  cpid=$!
  n=0; res=""
  while [ "$n" -lt 30 ]; do
    sleep 2; n=$((n + 1))
    res=$(grep -m 1 -e installed -e failed -e 'Unknown method' "$out" 2>/dev/null)
    [ -n "$res" ] && break
  done
  kill "$cpid" "$lpid" 2>/dev/null
  rm -f "$fifo"
  case "$res" in
    *installed*) return 0 ;;
    *failed*)    beacon "fail_${label}/$(grep -o 'errorCode[^,}]*' "$out" 2>/dev/null | head -1 | safe)"; return 1 ;;
    *)           beacon "fail_${label}_timeout/$(tail -c 200 "$out" 2>/dev/null | safe)"; return 1 ;;
  esac
}

# --- 1) Homebrew root status -------------------------------------------------
cfg=$(luna-send -n 1 -w 6000 -f luna://org.webosbrew.hbchannel.service/getConfiguration '{}' 2>/dev/null)
beacon "hbcfg/$(echo "$cfg" | safe)"

if echo "$cfg" | grep -q '"root":false'; then
  "$HB/elevate-service" > /tmp/tvl6-hbelev.log 2>&1
  beacon "hb_elevated/$(tail -c 200 /tmp/tvl6-hbelev.log 2>/dev/null | safe)"
  cfg=$(luna-send -n 1 -w 6000 -f luna://org.webosbrew.hbchannel.service/getConfiguration '{}' 2>/dev/null)
  beacon "hbcfg2/$(echo "$cfg" | safe)"
fi

# --- 2) helper script for the Home keybind -----------------------------------
cat > /media/developer/tvl-home.sh <<'EOS'
#!/bin/sh
luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"com.shashvat.launcher"}' >/dev/null 2>&1
EOS
chmod 755 /media/developer/tvl-home.sh
beacon "helper_written"

# --- 3) install Input Hook from the local server ----------------------------
if [ ! -d /var/luna/preferences/devmode_enabled ]; then
  rm -f /var/luna/preferences/devmode_enabled
  mkdir -- /var/luna/preferences/devmode_enabled
fi
restart appinstalld >/dev/null 2>&1

curl -s --max-time 150 -o /tmp/tvl-inputhook.ipk "$BASE/inputhook.ipk" || beacon "dlfail_ih"
install_ipk inputhook /tmp/tvl-inputhook.ipk && beacon "ok_inputhook2"

# --- 4) elevate + arm Input Hook --------------------------------------------
"$HB/elevate-service" org.webosbrew.inputhook.service > /tmp/tvl6-ihelev.log 2>&1
beacon "ih_elevate/$(tail -c 200 /tmp/tvl6-ihelev.log 2>/dev/null | safe)"

auto=$(luna-send -n 1 -w 8000 -f luna://org.webosbrew.inputhook.service/autostart '{}' 2>/dev/null)
beacon "ih_autostart/$(echo "$auto" | safe)"

start=$(luna-send -n 1 -w 10000 -f luna://org.webosbrew.inputhook.service/start '{}' 2>/dev/null)
beacon "ih_start/$(echo "$start" | safe)"

# --- 5) diagnostics ----------------------------------------------------------
{
  echo "=== keybinds.json ==="; cat /home/root/.config/lginputhook/keybinds.json 2>&1
  echo "=== init.d ==="; ls -la /var/lib/webosbrew/init.d 2>&1
  echo "=== hb config ==="; luna-send -n 1 -w 6000 -f luna://org.webosbrew.hbchannel.service/getConfiguration '{}' 2>&1
  echo "=== ezinject logs ==="
  for f in /tmp/ezinject-*.log; do [ -f "$f" ] && { echo "--- $f"; tail -6 "$f" 2>&1; }; done
  echo "=== hook logs (head) ==="
  for f in /tmp/lginput-hook-*.log; do [ -f "$f" ] && { echo "--- $f"; head -6 "$f" 2>&1; }; done
} > /tmp/tvl6-diag.txt 2>&1

i=0; off=0; total=$(wc -c < /tmp/tvl6-diag.txt)
while [ "$off" -lt "$total" ]; do
  chunk=$(dd if=/tmp/tvl6-diag.txt bs=1 skip=$off count=700 2>/dev/null | b64 | scrub)
  beacon "d$i/$chunk"
  off=$((off + 700)); i=$((i + 1))
done
beacon "diag6/$i"

# --- 6) faster boot autostart -----------------------------------------------
cat > /var/lib/webosbrew/init.d/60-tvl-launcher.sh <<'EOS'
#!/bin/sh
(
  i=0
  while [ "$i" -lt 20 ]; do
    fg=$(luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}' 2>/dev/null)
    [ -n "$fg" ] && break
    sleep 2; i=$((i + 1))
  done
  n=0
  while [ "$n" -lt 3 ]; do
    luna-send -n 1 -f luna://com.webos.applicationManager/launch '{"id":"com.shashvat.launcher"}' >/dev/null 2>&1
    sleep 6
    fg=$(luna-send -n 1 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}' 2>/dev/null)
    case "$fg" in *com.shashvat.launcher*) exit 0 ;; esac
    n=$((n + 1))
  done
) &
EOS
chmod 755 /var/lib/webosbrew/init.d/60-tvl-launcher.sh
beacon "autostart2_set"

beacon "done6"

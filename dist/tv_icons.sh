#!/bin/sh
# tv_icons.sh — refresh the launcher's app icons from the TV's own app folders.
BASE="http://192.168.0.3:8123"
DST="/media/developer/apps/usr/palm/applications/com.shashvat.launcher/icons/apps"
APPDIR="/media/developer/apps/usr/palm/applications/com.shashvat.launcher"

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
else
  echo "[!] could not fetch the icon manifest"
fi

echo "[*] icons present: $(ls "$DST" 2>/dev/null | wc -l) of ${ICON_EXPECTED:-?}"
grep -o '"id": "[^"]*"' "$APPDIR/js/apps.js" | cut -d'"' -f4 | while read appid; do
  [ -f "$DST/$appid.png" ] || echo "    missing icon: $appid"
done
echo "[*] DONE"

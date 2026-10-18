#!/bin/sh
# Lumina boot autostart.
#
# Deliberately conservative:
#   * waits for the app manager to actually answer
#   * makes ONE launch attempt per boot — never a retry loop
#   * only takes over if the stock home (or nothing) is on screen
#     (if you started Netflix during boot, it leaves you alone)
# Decisions are logged to /tmp/lumina-boot.log

export PATH=/usr/bin:/bin:/usr/sbin:/sbin

LOG=/tmp/lumina-boot.log
AM=luna://com.webos.applicationManager
LUMINA=com.shashvat.launcher

say() { echo "$(date) $*" >> "$LOG"; }
l()   { luna-send -n 1 -w 5000 -f "$1" "$2" 2>/dev/null; }

(
  say "hook start"
  n=0
  while [ "$n" -lt 90 ]; do
    out=$(l "$AM/getForegroundAppInfo" '{}' | tr -d ' \n')
    case "$out" in *'"returnValue":true'*) break ;; esac
    n=$((n + 1))
    sleep 2
  done
  say "app manager ready after $n polls"

  fg=$(l "$AM/getForegroundAppInfo" '{}')
  say "foreground: $fg"

  case "$fg" in
    *"$LUMINA"*)
      say "Lumina already running; nothing to do"
      exit 0
      ;;
    *com.webos.app.home*|*'"appId":""'*|*'"appId": ""'*)
      # stock home (or nothing yet) — take over
      ;;
    *)
      say "another app is running; not taking over"
      exit 0
      ;;
  esac

  l "$AM/launch" "{\"id\":\"$LUMINA\"}" >/dev/null
  say "launched Lumina (single attempt, no retry)"
) &

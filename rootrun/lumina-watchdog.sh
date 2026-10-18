#!/bin/sh
# Lumina home watchdog.
#
# If LG's own home appears (an app exited, the Home key fell through, a reboot
# finished), bounce straight back to Lumina. Event-driven: it subscribes to
# foreground-app changes instead of polling, so it costs nothing while idle.
# A short cooldown stops it flapping if Lumina ever fails to come up.

export PATH=/usr/bin:/bin:/usr/sbin:/sbin

LOG=/tmp/lumina-watchdog.log
PIDFILE=/var/run/lumina-watchdog.pid
AM=luna://com.webos.applicationManager
LUMINA=com.shashvat.launcher

say() { echo "$(date) $*" >> "$LOG"; }

# idempotent: never start a second copy (boot hook + manual start can race)
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  say "already running (pid $(cat "$PIDFILE" 2>/dev/null))"
  exit 0
fi

(
  echo $$ > "$PIDFILE"
  say "watchdog start (pid $$)"

  # wait for the app manager to actually answer (strip spaces: -f pretty-prints)
  n=0
  while [ "$n" -lt 90 ]; do
    out=$(luna-send -n 1 -w 5000 -f "$AM/getForegroundAppInfo" '{}' 2>/dev/null | tr -d ' \n')
    case "$out" in *'"returnValue":true'*) break ;; esac
    n=$((n + 1))
    sleep 2
  done
  say "ready after $n polls"

  # Poll rather than subscribe: one tiny luna call every 2s, and it cannot
  # miss a transition the way a stream can if the socket drops.
  last=0
  while :; do
    fg=$(luna-send -n 1 -w 5000 -f "$AM/getForegroundAppInfo" '{}' 2>/dev/null | tr -d ' \n')
    case "$fg" in
      *com.webos.app.home*)
        now=$(date +%s)
        if [ $((now - last)) -gt 4 ]; then
          last=$now
          say "LG home detected -> launching Lumina"
          luna-send -n 1 -w 5000 -f "$AM/launch" "{\"id\":\"$LUMINA\"}" >/dev/null 2>&1
        fi
        ;;
    esac
    sleep 2
  done
) &

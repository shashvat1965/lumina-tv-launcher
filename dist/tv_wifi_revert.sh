#!/bin/sh
# tv_wifi_revert.sh — undo the changes most likely to affect power-on / networking,
# restore sane power-on settings, and dump the diagnostics we need.
# Run on the TV as root (over SSH) once it is reachable again.

AM=luna://com.webos.applicationManager
SS=luna://com.webos.settingsservice

echo "== 1) revert power-on slot to Live TV (undo the experiment) =="
luna-send -n 1 -f "$SS/setSystemSettings" \
  '{"category":"general","settings":{"selectedInputApp":"off","lastInputApp":"com.webos.app.livetv","physicalLastInputApp":"com.webos.app.livetv","homeAutoLaunch":"off"}}' 2>&1 | tr -d '\n '; echo

echo "== 2) current settings readback =="
luna-send -n 1 -f "$SS/getSystemSettings" \
  '{"category":"general","keys":["selectedInputApp","lastInputApp","physicalLastInputApp","homeAutoLaunch","lastInputAppType"]}' 2>&1 | tr -d '\n '; echo

echo "== 3) Wi-Fi link state =="
luna-send -n 1 -f luna://com.webos.service.wifi/getStatus '{}' 2>&1 | head -20
ifconfig 2>/dev/null | grep -E '^(wlan0|eth0)' -A2

echo "== 4) connectivity =="
ping -c1 -W2 192.168.0.1 >/dev/null 2>&1 && echo "gateway OK" || echo "gateway FAIL"
ping -c1 -W2 8.8.8.8 >/dev/null 2>&1 && echo "internet OK" || echo "internet FAIL"

echo "== 5) what actually went wrong at the last boot =="
grep -a -i -E 'wpa_supp|connman|wifi|dhcp|bootd' /tmp/var/log/messages 2>/dev/null | tail -25

echo "== 6) the de-crap app's own state (only needed if you want to rule it out) =="
echo "-- to disable it completely:"
echo "   /media/developer/apps/usr/palm/applications/ooo.lew.lifesgoodwithoutspying/init/nospy-ctl.sh disable"

echo "== done =="

#!/usr/bin/env python3
"""Disable Glasshouse's curated list of unnecessary background services on the TV,
and report the RAM/state change. Reversible: toggle them back with disabled=False."""
import json
import os
import subprocess
import time

BASE = os.environ.get("TVWEB", "http://192.168.0.10:8081")
KEY = os.path.expanduser("~/.ssh/webos_tv")
TV = "root@192.168.0.10"


def curl(path, body=None, timeout="30"):
    cmd = ["curl", "-s", "--max-time", timeout]
    if body is not None:
        cmd += ["-X", "POST", "-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(BASE + path)
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def meminfo():
    out = subprocess.run(
        ["ssh", "-i", KEY, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no",
         "-o", "ConnectTimeout=8", TV, "grep -E 'MemTotal|MemAvailable|MemFree' /proc/meminfo"],
        capture_output=True, text=True).stdout
    vals = {}
    for line in out.strip().splitlines():
        parts = line.split()
        if len(parts) >= 2:
            vals[parts[0].rstrip(":")] = int(parts[1])
    return vals


def services():
    try:
        return json.loads(curl("/api/services")).get("services", [])
    except Exception as exc:
        print("could not read services:", exc)
        return []


def show(label, svcs):
    print("%s:" % label)
    for s in svcs:
        print("   %-15s disabled=%-5s running=%-5s  %s" % (
            s.get("id"), s.get("disabled"), s.get("running"), (s.get("title") or "")[:38]))


def main():
    before = meminfo()
    svcs = services()
    if not svcs:
        raise SystemExit("no services reported")
    show("before", svcs)
    kb = before.get("MemAvailable")
    print("MemAvailable before: %s kB" % kb)

    for s in svcs:
        if s.get("disabled"):
            continue
        out = curl("/api/services/toggle", {"id": s.get("id"), "disabled": True}).strip()
        ok = '"ok":true' in out.replace(" ", "")
        print("  disable %-15s %s" % (s.get("id"), "ok" if ok else out[:110]))

    time.sleep(4)
    after_svcs = services()
    show("after", after_svcs)
    after = meminfo()
    kb2 = after.get("MemAvailable")
    print("MemAvailable after:  %s kB" % kb2)
    if kb and kb2:
        print("freed: %.1f MB" % ((kb2 - kb) / 1024.0))
    still = [s.get("id") for s in after_svcs if not s.get("disabled")]
    print("still enabled:", still or "none")


if __name__ == "__main__":
    main()

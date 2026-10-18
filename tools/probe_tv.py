#!/usr/bin/env python3
"""Probe the LG TV over SSAP using the client key saved by slopbro."""
import json
import os
import sys

sys.path.insert(0, os.path.expanduser("~/slopbro"))
os.chdir(os.path.expanduser("~/slopbro"))  # so the saved client key is found
import slopbro as sb  # noqa: E402

HOST = os.environ.get("TV_IP") or "192.168.0.10"


def main():
    ws = sb.WebSocket.connect(HOST, sb.PORT_TLS, secure=True)
    client = sb.SSAPClient(ws)
    key = sb.load_client_key(HOST)
    print("stored key:", (key[:12] + "...") if key else "(none)")
    new_key = client.register(key, sb.DEFAULT_MANIFEST)
    if new_key and new_key != key:
        sb.save_client_key(HOST, new_key)
    print("registered ok")

    resp = client.request(
        "ssap://com.webos.applicationManager/listApps", {}, timeout=10.0
    )
    if resp.get("type") == "error":
        print("listApps error:", resp.get("error"))
        client.close()
        return

    apps = (resp.get("payload") or {}).get("apps") or []
    ids = sorted(
        (a.get("id"), a.get("title") or "")
        for a in apps
        if isinstance(a, dict) and a.get("id")
    )
    print("installed apps: %d" % len(ids))
    for app_id, title in ids[:80]:
        print("   %-45s %s" % (app_id, title))
    if len(ids) > 80:
        print("   ... and %d more" % (len(ids) - 80))
    print(
        "hbchannel installed:",
        "org.webosbrew.hbchannel" in [a for a, _ in ids],
    )

    by_id = {a.get("id"): a for a in apps if isinstance(a, dict)}
    for sample in ("amazon", "com.webos.app.browser", "com.webos.app.discovery"):
        if sample in by_id:
            print("\n--- sample app: %s ---" % sample)
            print(json.dumps(by_id[sample], indent=2)[:2200])

    client.close()


if __name__ == "__main__":
    main()

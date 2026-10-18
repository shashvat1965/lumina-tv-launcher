#!/usr/bin/env python3
"""Install an .ipk over SSAP via appInstallService (no SSH needed)."""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.expanduser("~/slopbro"))
os.chdir(os.path.expanduser("~/slopbro"))
import slopbro as sb  # noqa: E402

HOST = "192.168.0.10"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ipk_url")
    ap.add_argument("--launch", default=None)
    ap.add_argument("--appid", default=None)
    args = ap.parse_args()

    ws = sb.WebSocket.connect(HOST, sb.PORT_TLS, secure=True)
    c = sb.SSAPClient(ws)
    key = sb.load_client_key(HOST)
    new_key = c.register(key, sb.DEFAULT_MANIFEST)
    if new_key and new_key != key:
        sb.save_client_key(HOST, new_key)
    print("registered")

    msg_id = "i1"
    c._send(
        {
            "id": msg_id,
            "type": "request",
            "uri": "ssap://com.webos.appInstallService/dev/install",
            "payload": {
                "id": "com.ares.defaultName",
                "ipkUrl": args.ipk_url,
                "subscribe": True,
            },
        }
    )
    deadline = time.time() + 180
    new_status = None
    done = False
    while time.time() < deadline:
        try:
            raw = c._ws.recv_text(timeout=10.0)
        except Exception:
            continue
        if raw is None:
            print("connection closed")
            break
        msg = json.loads(raw)
        if msg.get("id") != msg_id:
            continue
        if msg.get("type") == "error":
            print("install error:", msg.get("error"))
            break
        payload = msg.get("payload") or {}
        status = payload.get("statusText")
        progress = payload.get("progress")
        if status != new_status:
            if progress not in (None, ""):
                print("  %s (%s%%)" % (status, progress))
            else:
                print("  %s" % status)
            new_status = status
        if payload.get("finished"):
            done = True
            break
    print("finished:", done)

    if done and args.appid:
        resp = c.request(
            "ssap://com.webos.applicationManager/getAppInfo",
            {"id": args.appid},
            timeout=10.0,
        )
        print("getAppInfo ok:", json.dumps(resp.get("payload") or {})[:160])
    if done and args.launch:
        resp = c.request(
            "ssap://system.launcher/launch", {"id": args.launch}, timeout=15.0
        )
        print("launch:", json.dumps(resp.get("payload") or {})[:200])
    c.close()


if __name__ == "__main__":
    main()

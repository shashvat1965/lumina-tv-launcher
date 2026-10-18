#!/usr/bin/env python3
"""Wait for an app to be installed, then launch it on the TV over SSAP."""
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
    ap.add_argument("appid")
    ap.add_argument("--wait", type=int, default=0, help="seconds to wait for install")
    args = ap.parse_args()

    ws = sb.WebSocket.connect(HOST, sb.PORT_TLS, secure=True)
    c = sb.SSAPClient(ws)
    key = sb.load_client_key(HOST)
    new_key = c.register(key, sb.DEFAULT_MANIFEST)
    if new_key and new_key != key:
        sb.save_client_key(HOST, new_key)

    deadline = time.time() + args.wait
    present = False
    while True:
        resp = c.request(
            "ssap://com.webos.applicationManager/getAppInfo",
            {"id": args.appid},
            timeout=10.0,
        )
        present = bool((resp.get("payload") or {}).get("returnValue"))
        if present or time.time() >= deadline:
            break
        time.sleep(3)
    print("app present:", present)

    resp = c.request("ssap://system.launcher/launch", {"id": args.appid}, timeout=15.0)
    print("launch:", json.dumps(resp.get("payload") or {})[:200])
    c.close()


if __name__ == "__main__":
    main()

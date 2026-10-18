#!/usr/bin/env python3
"""Install an .ipk on the TV via the Homebrew Channel service (SSAP)."""
import argparse
import json
import os
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.expanduser("~/slopbro"))
os.chdir(os.path.expanduser("~/slopbro"))
import slopbro as sb  # noqa: E402

HOST = "192.168.0.10"
HTTP_PORT = 8123


class LoggingHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("  http: %s" % (fmt % args))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ipk")
    ap.add_argument("--launch", metavar="APP_ID", default=None)
    ap.add_argument("--port", type=int, default=HTTP_PORT)
    args = ap.parse_args()

    ipk_path = os.path.abspath(args.ipk)
    directory = os.path.dirname(ipk_path)
    filename = os.path.basename(ipk_path)

    handler = partial(LoggingHandler, directory=directory)
    httpd = ThreadingHTTPServer(("0.0.0.0", args.port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    try:
        local_ip = sb.guess_local_ip(HOST)
    except Exception:
        local_ip = None
    local_ip = local_ip or "192.168.0.3"
    url = "http://%s:%d/%s" % (local_ip, args.port, filename)
    print("serving %s -> %s" % (filename, url))

    try:
        ws = sb.WebSocket.connect(HOST, sb.PORT_TLS, secure=True)
        client = sb.SSAPClient(ws)
        key = sb.load_client_key(HOST)
        new_key = client.register(key, sb.DEFAULT_MANIFEST)
        if new_key and new_key != key:
            sb.save_client_key(HOST, new_key)
        print("registered with TV")

        msg_id = "install_1"
        client._send(
            {
                "id": msg_id,
                "type": "request",
                "uri": "ssap://org.webosbrew.hbchannel.service/install",
                "payload": {"ipkUrl": url, "subscribe": True},
            }
        )

        deadline = time.time() + 300
        finished = False
        last_status = None
        while time.time() < deadline:
            try:
                raw = client._ws.recv_text(timeout=15.0)
            except Exception:
                continue
            if raw is None:
                print("connection closed by TV")
                break
            msg = json.loads(raw)
            if msg.get("id") != msg_id:
                continue
            if msg.get("type") == "error":
                print("install error:", msg.get("error"))
                sys.exit(1)
            payload = msg.get("payload") or {}
            status = payload.get("statusText")
            progress = payload.get("progress")
            if status != last_status:
                if progress not in (None, ""):
                    print("  %s (%s%%)" % (status, progress))
                else:
                    print("  %s" % status)
                last_status = status
            if payload.get("finished"):
                finished = True
                break
        print("install finished:", finished)
        if not finished:
            sys.exit(2)

        if args.launch:
            resp = client.request(
                "ssap://system.launcher/launch", {"id": args.launch}, timeout=15.0
            )
            print("launch:", resp.get("type"), json.dumps(resp.get("payload") or {}))
        client.close()
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()

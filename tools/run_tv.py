#!/usr/bin/env python3
"""Run a shell command on the TV as root via the Homebrew Channel exec service."""
import argparse
import os
import sys

sys.path.insert(0, os.path.expanduser("~/slopbro"))
os.chdir(os.path.expanduser("~/slopbro"))
import slopbro as sb  # noqa: E402

HOST = "192.168.0.10"


def connect():
    ws = sb.WebSocket.connect(HOST, sb.PORT_TLS, secure=True)
    client = sb.SSAPClient(ws)
    key = sb.load_client_key(HOST)
    new_key = client.register(key, sb.DEFAULT_MANIFEST)
    if new_key and new_key != key:
        sb.save_client_key(HOST, new_key)
    return client


def exec_command(client, command, timeout=60.0):
    resp = client.request(
        "ssap://org.webosbrew.hbchannel.service/exec",
        {"command": command},
        timeout=timeout,
    )
    if resp.get("type") == "error":
        raise SystemExit("exec error: %s" % resp.get("error"))
    payload = resp.get("payload") or {}
    if payload.get("stdoutString"):
        sys.stdout.write(payload["stdoutString"])
    if payload.get("stderrString"):
        sys.stderr.write(payload["stderrString"])
    return payload


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command")
    ap.add_argument("--timeout", type=float, default=60.0)
    args = ap.parse_args()
    client = connect()
    exec_command(client, args.command, args.timeout)
    client.close()


if __name__ == "__main__":
    main()

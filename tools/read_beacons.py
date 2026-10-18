#!/usr/bin/env python3
"""Decode beacon lines from the temp HTTP server log."""
import base64
import re
import sys


def unscrub(s):
    return s.replace(".", "+").replace("_", "/").replace("-", "=")


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "dist/http.log"
    lines = open(path, errors="replace").read().splitlines()
    chunks = {}
    others = []
    rx = re.compile(r"GET\s+/beacon/(\S+)\s")
    for line in lines:
        m = rx.search(line)
        if not m:
            continue
        payload = m.group(1)
        if "/" in payload:
            label, data = payload.split("/", 1)
        else:
            label, data = payload, ""
        if re.fullmatch(r"d\d+", label):
            chunks[int(label[1:])] = data
        else:
            others.append((label, data))
    for label, data in others:
        print("BEACON %-12s %s" % (label, data))
    if chunks:
        joined = "".join(chunks[i] for i in sorted(chunks))
        b = unscrub(joined)
        b += "=" * (-len(b) % 4)
        print("\n===== DIAGNOSTICS =====")
        try:
            print(base64.b64decode(b).decode(errors="replace"))
        except Exception as exc:
            print("decode failed:", exc)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Run a shell command on the TV as root via Homebrew Channel's telnet service."""
import socket
import sys
import time

HOST = "192.168.0.10"
PORT = 23


def strip_iac(data):
    out = bytearray()
    i = 0
    while i < len(data):
        byte = data[i]
        if byte == 255:  # IAC
            if i + 2 < len(data):
                cmd = data[i + 1]
                if cmd == 250:  # subnegotiation ... IAC SE
                    j = data.find(b"\xff\xf0", i)
                    i = (j + 2) if j != -1 else len(data)
                    continue
                i += 3
                continue
            break
        out.append(byte)
        i += 1
    return bytes(out)


def run(command, timeout=30.0):
    sock = socket.create_connection((HOST, PORT), timeout=8)
    sock.settimeout(timeout)
    time.sleep(0.6)
    try:
        sock.recv(4096)
    except Exception:
        pass

    marker = "TVSH%d" % (int(time.time() * 1000) % 100000)
    sock.sendall(("echo %s_START\n" % marker).encode())
    sock.sendall((command + "\n").encode())
    sock.sendall(("echo %s_END\n" % marker).encode())

    buf = b""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            chunk = sock.recv(65536)
        except socket.timeout:
            break
        if not chunk:
            break
        buf += chunk
        if (marker + "_END").encode() in buf:
            break
    sock.close()

    text = strip_iac(buf).decode("utf-8", "replace").replace("\r", "")
    start = text.find(marker + "_START")
    end = text.find(marker + "_END")
    if start != -1 and end != -1:
        return text[start + len(marker) + 6:end].strip("\n")
    return text


def main():
    command = " ".join(sys.argv[1:]) or "id"
    print(run(command))


if __name__ == "__main__":
    main()

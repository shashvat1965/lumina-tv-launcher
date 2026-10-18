#!/usr/bin/env python3
"""Inspect an .ipk (ar archive): list members, dump control + appinfo.json."""
import io
import sys
import tarfile


def read_ar(path):
    """Yield (name, bytes) for each member of an ar archive."""
    with open(path, "rb") as fh:
        magic = fh.read(8)
        if magic != b"!<arch>\n":
            raise SystemExit("not an ar archive")
        while True:
            hdr = fh.read(60)
            if len(hdr) < 60:
                break
            raw_name = hdr[:16]
            name = raw_name.decode("ascii", "replace").strip()
            try:
                size = int(hdr[48:58].decode("ascii").strip())
            except ValueError:
                break
            data = fh.read(size)
            if size % 2:
                fh.read(1)
            yield name.rstrip("/"), raw_name, data


def main():
    path = sys.argv[1]
    with open(path, "rb") as fh:
        fh.seek(8)
        print("first 16 bytes of name field:", repr(fh.read(16)))

    members = list(read_ar(path))
    print("\nmembers:")
    for name, raw_name, data in members:
        print("   %-20s %8d bytes  raw=%-18r" % (name, len(data), raw_name))

    for name, _, data in members:
        if name == "control.tar.gz":
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
                print("\ncontrol.tar.gz contents:")
                for member in tf.getmembers():
                    print("   %r (%d bytes)" % (member.name, member.size))
                for member in tf.getmembers():
                    if member.name.endswith("control"):
                        ctrl = tf.extractfile(member)
                        if ctrl:
                            print("\n--- control ---\n" + ctrl.read().decode())
                        break
        if name == "data.tar.gz":
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
                print("\ndata.tar.gz contents:")
                for member in tf.getmembers():
                    print("   %r (%d bytes)" % (member.name, member.size))
                for member in tf.getmembers():
                    if member.name.endswith("appinfo.json"):
                        f = tf.extractfile(member)
                        if f:
                            print("\n--- %s ---\n%s" % (member.name, f.read().decode()))
                        break


if __name__ == "__main__":
    main()

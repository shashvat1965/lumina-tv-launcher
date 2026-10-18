#!/usr/bin/env python3
"""Build a webOS .ipk from the app/ source directory (no external dependencies)."""
import io
import json
import os
import shutil
import tarfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.abspath(os.path.join(HERE, "..", "app"))
DIST = os.path.abspath(os.path.join(HERE, "..", "dist"))


def add_dir(tf, name):
    info = tarfile.TarInfo(name)
    info.type = tarfile.DIRTYPE
    info.mode = 0o755
    info.mtime = 0
    info.uid = info.gid = 0
    tf.addfile(info)


def add_file(tf, name, data):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = 0o644
    info.mtime = 0
    info.uid = info.gid = 0
    tf.addfile(info, io.BytesIO(data))


def gz_tar(build):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        build(tf)
    return buf.getvalue()


def ar_write(members):
    out = bytearray(b"!<arch>\n")
    for name, data in members:
        hdr = (
            name.ljust(16)
            + str(int(time.time())).ljust(12)
            + "0".ljust(6)
            + "0".ljust(6)
            + "100644".ljust(8)
            + str(len(data)).ljust(10)
            + "`\n"
        )
        out += hdr.encode("ascii") + data
        if len(data) % 2:
            out += b"\n"
    return bytes(out)


def main():
    with open(os.path.join(APP_DIR, "appinfo.json")) as fh:
        info = json.load(fh)
    app_id = info["id"]
    version = info.get("version", "0.1.0")

    files = []
    for root, dirs, names in os.walk(APP_DIR):
        dirs.sort()
        for name in sorted(names):
            path = os.path.join(root, name)
            rel = os.path.relpath(path, APP_DIR).replace(os.sep, "/")
            with open(path, "rb") as fh:
                files.append((rel, fh.read()))

    app_base = "usr/palm/applications/%s" % app_id
    pkg_base = "usr/palm/packages/%s" % app_id
    packageinfo = (
        json.dumps({"id": app_id, "version": version, "app": app_id}, indent=2) + "\n"
    )

    def build_data(tf):
        for d in (
            "usr",
            "usr/palm",
            "usr/palm/applications",
            "usr/palm/packages",
            app_base,
            pkg_base,
        ):
            add_dir(tf, d)
        for rel, data in files:
            add_file(tf, "%s/%s" % (app_base, rel), data)
        add_file(tf, "%s/packageinfo.json" % pkg_base, packageinfo.encode())

    installed_size = sum(len(data) for _, data in files)
    control = (
        "Package: %s\n"
        "Version: %s\n"
        "Section: misc\n"
        "Priority: optional\n"
        "Architecture: all\n"
        "Installed-Size: %d\n"
        "Maintainer: tv-launcher <noreply@example.com>\n"
        "Description: This is a webOS application.\n"
        "webOS-Package-Format-Version: 2\n"
        "webOS-Packager-Version: x.y.x\n"
    ) % (app_id, version, installed_size)

    def build_control(tf):
        add_file(tf, "control", control.encode())

    ipk = ar_write(
        [
            ("debian-binary", b"2.0\n"),
            ("control.tar.gz", gz_tar(build_control)),
            ("data.tar.gz", gz_tar(build_data)),
        ]
    )

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "%s_%s_all.ipk" % (app_id, version))
    with open(out, "wb") as fh:
        fh.write(ipk)
    print("wrote %s (%d bytes, %d app files)" % (out, len(ipk), len(files)))

    # keep the TV-side icon manifest in sync with the app list
    manifest = os.path.abspath(
        os.path.join(HERE, "..", "rootrun", "copy_icons.sh")
    )
    if os.path.isfile(manifest):
        shutil.copyfile(manifest, os.path.join(DIST, "copy_icons.sh"))
        print("synced copy_icons.sh -> dist/")


if __name__ == "__main__":
    main()

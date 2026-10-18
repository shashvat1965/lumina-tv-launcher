#!/usr/bin/env python3
"""Generate the Lumina app icons (no external dependencies).

Dark canvas, amber rounded tile, dark play glyph — matching the design tokens.
"""
import math
import os
import struct
import zlib

BG = (11, 14, 20)        # #0B0E14
AMBER = (255, 180, 84)   # #FFB454
INK = (28, 18, 4)        # --accent-ink


def write_png(path, w, h, px):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw += px[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


def sd_round_rect(px, py, hw, hh, r):
    qx = abs(px) - (hw - r)
    qy = abs(py) - (hh - r)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def blend(buf, w, x, y, colour, a):
    i = (y * w + x) * 4
    for k in range(3):
        buf[i + k] = int(buf[i + k] * (1 - a) + colour[k] * a + 0.5)
    buf[i + 3] = 255


def canvas(w, h, colour):
    return bytearray(bytes(colour + (255,)) * (w * h))


def fill_round_rect(buf, w, h, cx, cy, size, r, colour, alpha=1.0):
    hw = hh = size / 2.0
    for y in range(max(0, int(cy - hh - 2)), min(h, int(cy + hh + 3))):
        for x in range(max(0, int(cx - hw - 2)), min(w, int(cx + hw + 3))):
            d = sd_round_rect(x + 0.5 - cx, y + 0.5 - cy, hw, hh, r)
            a = min(1.0, max(0.0, 0.5 - d)) * alpha
            if a > 0:
                blend(buf, w, x, y, colour, a)


def fill_triangle(buf, w, h, x1, y1, x2, y2, x3, y3, colour):
    """Top-left origin; barycentric coverage with 1px smoothing."""
    minx, maxx = int(min(x1, x2, x3)) - 2, int(max(x1, x2, x3)) + 3
    miny, maxy = int(min(y1, y2, y3)) - 2, int(max(y1, y2, y3)) + 3
    area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)
    if area == 0:
        return
    aa = 1.0 / max(2.0, math.hypot(x2 - x1, y2 - y1) * 0.5)
    for y in range(max(0, miny), min(h, maxy)):
        for x in range(max(0, minx), min(w, maxx)):
            px, py = x + 0.5, y + 0.5
            w1 = ((x2 - px) * (y3 - py) - (x3 - px) * (y2 - py)) / area
            w2 = ((x3 - px) * (y1 - py) - (x1 - px) * (y3 - py)) / area
            w3 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area
            inside = min(w1, w2, w3)
            a = min(1.0, max(0.0, inside / aa + 0.5))
            if a > 0:
                blend(buf, w, x, y, colour, a)


def draw_glyph(buf, w, h, cx, cy, size):
    fill_round_rect(buf, w, h, cx, cy, size, size * 0.22, AMBER)
    s = size * 0.30
    fill_triangle(buf, w, h, cx - s * 0.42, cy - s, cx - s * 0.42, cy + s, cx + s * 0.95, cy, INK)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    app = os.path.abspath(os.path.join(here, "..", "app"))

    for name, size in (("icon.png", 80), ("largeIcon.png", 130)):
        buf = canvas(size, size, BG)
        draw_glyph(buf, size, size, size / 2.0, size / 2.0, size * 0.66)
        write_png(os.path.join(app, name), size, size, buf)
        print("wrote %s (%dx%d)" % (name, size, size))

    W, H = 1920, 1080
    buf = canvas(W, H, BG)
    draw_glyph(buf, W, H, W / 2.0, H / 2.0, 360)
    write_png(os.path.join(app, "splashBackground.png"), W, H, buf)
    print("wrote splashBackground.png (%dx%d)" % (W, H))


if __name__ == "__main__":
    main()

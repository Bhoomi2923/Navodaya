#!/usr/bin/env python3
"""
Render a procedural elliptical galaxy to a 2048x2048 RGBA PNG with a
transparent background. A fat glowing oval (axis ratio ~0.64, UNROTATED —
the app applies tilt) with a smooth de Vaucouleurs-like falloff, ~900k
glitter stars sampled from the profile, faint inner dust filaments and a few
spiked foreground stars. Warm white core -> pink-peach body -> violet edge.

Usage:
    pip install numpy pillow scipy
    python scripts/generate-elliptical-galaxy.py
"""

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SIZE = 2048
SEED = 20260214
OUT = "assets/images/galaxy-elliptical-procedural.png"
PREVIEW = "scripts/elliptical-preview.png"

A = 0.47 * SIZE            # semi-major axis (horizontal)
B = 0.30 * SIZE            # semi-minor axis
C = SIZE / 2.0

N_STARS = 900_000
N_GLOW_STARS = 120
N_FG = 8

GLOW = ((6.0, 0.8), (24.0, 0.55), (70.0, 0.2))


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float64)


def splat(buf, px, py, color):
    x0 = np.floor(px).astype(np.int64)
    y0 = np.floor(py).astype(np.int64)
    fx = px - x0
    fy = py - y0
    ok = (x0 >= 0) & (x0 < SIZE - 1) & (y0 >= 0) & (y0 < SIZE - 1)
    x0, y0, fx, fy = x0[ok], y0[ok], fx[ok], fy[ok]
    col = color[ok]
    flat = buf.reshape(-1, 3)
    for dx, dy, w in ((0, 0, (1 - fx) * (1 - fy)),
                      (1, 0, fx * (1 - fy)),
                      (0, 1, (1 - fx) * fy),
                      (1, 1, fx * fy)):
        idx = (y0 + dy) * SIZE + (x0 + dx)
        np.add.at(flat, idx, col * w[:, None])


def add_gaussian_blob(buf, cx, cy, sigma, color):
    rad = int(np.ceil(sigma * 4))
    x0, x1 = max(0, int(cx) - rad), min(SIZE, int(cx) + rad + 1)
    y0, y1 = max(0, int(cy) - rad), min(SIZE, int(cy) + rad + 1)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    g = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma * sigma))
    buf[y0:y1, x0:x1, :] += g[:, :, None] * color


def add_spikes(buf, cx, cy, length, color):
    L = int(length)
    x0, x1 = max(0, int(cx) - L), min(SIZE, int(cx) + L + 1)
    y0, y1 = max(0, int(cy) - L), min(SIZE, int(cy) + L + 1)
    if x0 >= x1 or y0 >= y1:
        return
    hx = np.arange(x0, x1) - cx
    vy = np.arange(y0, y1) - cy
    along_x = np.exp(-(hx / (L * 0.55)) ** 2)
    along_y = np.exp(-(vy / (L * 0.55)) ** 2)
    across_y = np.exp(-(vy / 1.6) ** 2)
    across_x = np.exp(-(hx / 1.6) ** 2)
    buf[y0:y1, x0:x1, :] += (
        (along_x[None, :] * across_y[:, None])[:, :, None] * color
        + (along_y[:, None] * across_x[None, :])[:, :, None] * color
    )


FG = hex_to_rgb("#FFF6E8")

GMAP_POS = np.array([0.00, 0.20, 0.45, 0.70, 0.90, 1.00])
GMAP_RGB = np.array([
    [176, 108, 255],   # B06CFF violet edge
    [222, 128, 214],   # DE80D6
    [255, 154, 191],   # FF9ABF pink-peach body
    [255, 201, 143],   # FFC98F
    [255, 241, 214],   # FFF1D6
    [255, 255, 255],   # FFFFFF core
], dtype=np.float64) / 255.0


def gradient_map(b):
    return np.stack([np.interp(b, GMAP_POS, GMAP_RGB[:, ch]) for ch in range(3)], axis=-1)


def main():
    rng = np.random.default_rng(SEED)

    # ------------------------------------------------------------------
    # smooth de Vaucouleurs-like light field + tight nucleus
    # ------------------------------------------------------------------
    print("smooth light field ...")
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    re = np.sqrt(((xx - C) / A) ** 2 + ((yy - C) / B) ** 2)

    field = np.exp(-7.67 * re ** 0.25)               # normalised (max 1 at re=0)
    field += np.exp(-re ** 2 / (2 * 0.02 ** 2)) * 1.4  # tight nucleus
    field = np.clip(field, 0, 1.6)                    # don't blow the core out

    # smooth cosine falloff to exactly 0 between re=0.85 and re=1.0
    edge = np.clip((1.0 - re) / 0.15, 0, 1)
    field *= 0.5 * (1 + np.cos(np.pi * (1 - edge)))

    img = np.repeat(field[:, :, None], 3, axis=2).astype(np.float32)

    # ------------------------------------------------------------------
    # subtle inner dust filaments (only inside re < 0.5)
    # ------------------------------------------------------------------
    print("dust ...")
    noise = np.zeros((SIZE, SIZE), dtype=np.float32)
    for sigma, amp in ((10, 0.45), (30, 0.35), (80, 0.20)):
        f = gaussian_filter(rng.random((SIZE, SIZE)).astype(np.float32), sigma)
        f /= f.max() + 1e-9
        noise += amp * f
    noise /= noise.max() + 1e-9
    inner = np.clip((0.5 - re) / 0.2, 0, 1)
    dust = noise * (inner * inner * (3 - 2 * inner))
    img *= (1.0 - 0.18 * dust[:, :, None])

    # ------------------------------------------------------------------
    # 900k stars sampled from the de Vaucouleurs profile
    # (re = u^4 with u ~ Gamma(4, 7.67) matches the radial pdf)
    # ------------------------------------------------------------------
    print("stars ...")
    px_all, py_all, col_all = [], [], []
    need = N_STARS
    while need > 0:
        n = int(need * 1.3)
        u = rng.gamma(4.0, 1.0 / 7.67, n)
        ok = u <= 1.0
        u = u[ok][:need]
        re_s = u ** 4
        ang = rng.random(u.size) * 2 * np.pi
        px_all.append(C + np.cos(ang) * re_s * A)
        py_all.append(C + np.sin(ang) * re_s * B)
        col_all.append(np.repeat(((rng.random(u.size) ** 3) * 2.0)[:, None], 3, axis=1))
        need -= u.size
    stars = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    splat(stars, np.concatenate(px_all), np.concatenate(py_all),
          np.concatenate(col_all))
    img += stars

    print("bright glow stars ...")
    bi = np.argsort(col_all[-1][:, 0])[::-1][:N_GLOW_STARS]
    for si in bi:
        add_gaussian_blob(img, px_all[-1][si], py_all[-1][si], 2.0, np.full(3, 2.0))

    # ------------------------------------------------------------------
    # glow stack
    # ------------------------------------------------------------------
    print("glow layers ...")
    for sigma, strength in GLOW:
        img += strength * gaussian_filter(img, (sigma, sigma, 0))

    # ------------------------------------------------------------------
    # foreground stars (just outside / around the body)
    # ------------------------------------------------------------------
    print("foreground stars ...")
    accents = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    placed = 0
    while placed < N_FG:
        fa = rng.random() * 2 * np.pi
        fq = 0.9 + 0.3 * rng.random()
        fx = C + np.cos(fa) * fq * A
        fy = C + np.sin(fa) * fq * B
        if not (8 < fx < SIZE - 8 and 8 < fy < SIZE - 8):
            continue
        add_gaussian_blob(accents, fx, fy, 3.0, FG * 1.1)
        add_spikes(accents, fx, fy, 40 + rng.random() * 50, FG * 0.25)
        placed += 1
    accents += 0.5 * gaussian_filter(accents, (12, 12, 0))

    # ------------------------------------------------------------------
    # tone-map + floor + gradient map + alpha
    # ------------------------------------------------------------------
    print("tone-map + gradient map ...")
    b = 1.0 - np.exp(-1.7 * img.max(axis=2))
    b = np.clip((b - 0.06) / 0.94, 0, 1)

    rgb = gradient_map(b)
    alpha = np.clip(b ** 1.2 * 1.8, 0, 1)      # 0 wherever b == 0

    # foreground stars keep their own alpha even outside the body
    accent_a = np.clip(accents.max(axis=2) * 1.5, 0, 1)
    rgb += accents
    alpha = np.maximum(alpha, accent_a)

    rgb = np.where(alpha[:, :, None] > 0, rgb, 0.0)  # premultiplied-safe

    rgb8 = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    a8 = (alpha * 255).astype(np.uint8)
    Image.fromarray(np.dstack([rgb8, a8])).save(OUT)

    bg = np.tile(hex_to_rgb("#2A1470"), (SIZE, SIZE, 1))
    comp = bg * (1 - alpha[:, :, None]) + np.clip(rgb, 0, 1) * alpha[:, :, None]
    Image.fromarray((np.clip(comp, 0, 1) * 255).astype(np.uint8)).save(PREVIEW)

    transparent_pct = 100.0 * (a8 < 8).mean()
    corners = [a8[0, 0], a8[0, -1], a8[-1, 0], a8[-1, -1]]
    edges = [a8[0, SIZE // 2], a8[-1, SIZE // 2], a8[SIZE // 2, 0], a8[SIZE // 2, -1]]
    print(f"wrote {OUT} + {PREVIEW}")
    print(f"pixels with alpha < 8: {transparent_pct:.1f}%  (must be >= 50%)")
    print(f"corner alphas: {corners}  edge-mid alphas: {edges}  (all must be 0)")
    if transparent_pct < 50 or any(corners) or any(edges):
        raise SystemExit("FAIL: too much ambient glow — lower the sigma-70 glow")


if __name__ == "__main__":
    main()

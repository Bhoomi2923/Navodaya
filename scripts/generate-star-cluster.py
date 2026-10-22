#!/usr/bin/env python3
"""
Render a procedural globular star cluster with a smaller companion cluster
and a faint cyan nebula wisp, to a 2048x2048 RGBA PNG with a transparent
background. Thousands of resolved stars in a King/Plummer profile, a blazing
smooth core, varied star colours (mostly blue-white/cyan, few warm giants),
spiked foreground stars. Floating on space — no disc, circle or box.

Usage:
    pip install numpy pillow scipy
    python scripts/generate-star-cluster.py
"""

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SIZE = 2048
SEED = 20260307
OUT = "assets/images/galaxy-cluster-procedural.png"
PREVIEW = "scripts/cluster-preview.png"

CX, CY = 0.46 * SIZE, 0.54 * SIZE          # main cluster centre
RC = 0.07 * SIZE                            # King/Plummer core radius
RTRUNC = 0.33 * SIZE                        # truncation radius
N_MAIN = 350_000
N_RESOLVED = 400                            # brighter resolved outer stars

CCX, CCY = 0.70 * SIZE, 0.36 * SIZE        # companion cluster centre
N_COMP = 3_500
N_COMP_BRIGHT = 60

N_FG = 7                                    # spiked foreground stars

GLOW = ((3.0, 0.9), (14.0, 0.45), (50.0, 0.12))


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


def add_ring(buf, cx, cy, radius, sigma, color):
    """Soft glowing ring (cyan flare) of gaussian thickness `sigma`."""
    rad = int(radius + sigma * 5)
    x0, x1 = max(0, int(cx) - rad), min(SIZE, int(cx) + rad + 1)
    y0, y1 = max(0, int(cy) - rad), min(SIZE, int(cy) + rad + 1)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    g = np.exp(-((d - radius) ** 2) / (2 * sigma * sigma))
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


# ---------------------------------------------------------------------------
# colours
# ---------------------------------------------------------------------------

TINTS = np.array([
    hex_to_rgb("#BFEFFF"),  # blue-white
    hex_to_rgb("#8FE3FF"),  # cyan
    hex_to_rgb("#FFFFFF"),  # white
    hex_to_rgb("#FFE9B8"),  # pale gold
    hex_to_rgb("#FFB27A"),  # warm orange giant
])
# 62% blue-white/cyan (31+31), 24% white, 10% gold, 4% orange
TINT_P = np.array([0.31, 0.31, 0.24, 0.10, 0.04])

FG = hex_to_rgb("#F2FDFF")
NEB_A = hex_to_rgb("#3FC8D8")
NEB_B = hex_to_rgb("#2A6FD0")

GMAP_POS = np.array([0.00, 0.25, 0.50, 0.75, 1.00])
GMAP_RGB = np.array([
    [46, 140, 190],    # 2E8CBE
    [70, 190, 225],    # 46BEE1
    [127, 240, 224],   # 7FF0E0
    [200, 248, 255],   # C8F8FF
    [255, 255, 255],   # FFFFFF
], dtype=np.float64) / 255.0


def gradient_map(b):
    return np.stack([np.interp(b, GMAP_POS, GMAP_RGB[:, ch]) for ch in range(3)], axis=-1)


def pick_tints(rng, n, warm_outer_mask=None):
    """Return (n,3) per-star tint colours; warm picks re-roll to cool
    colours unless `warm_outer_mask` allows them."""
    pick = np.searchsorted(np.cumsum(TINT_P), rng.random(n))
    if warm_outer_mask is not None:
        warm = pick >= 3
        reroll = warm & ~warm_outer_mask
        pick[reroll] = np.searchsorted(np.cumsum(TINT_P[:3] / TINT_P[:3].sum()),
                                       rng.random(reroll.sum()))
    return TINTS[pick]


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    rng = np.random.default_rng(SEED)

    # ---- main cluster: King/Plummer profile --------------------------
    print("main cluster stars ...")
    # 2D surface density n(r) ~ (1+(r/rc)^2)^-1.5  =>  p(r) ~ r*(1+(r/rc)^2)^-1.5
    # CDF(r) = (1 - (1+(r/rc)^2)^-0.5) / (1 - (1+(rt/rc)^2)^-0.5)
    D = 1.0 - (1.0 + (RTRUNC / RC) ** 2) ** -0.5
    u = rng.random(N_MAIN)
    r = RC * np.sqrt((1.0 / (1.0 - u * D)) ** 2 - 1.0)
    r = np.clip(r, 0, RTRUNC)
    ang = rng.random(N_MAIN) * 2 * np.pi
    dx, dy = np.cos(ang) * r, np.sin(ang) * r
    # slight squash + 15deg rotation so it isn't perfectly round
    t15 = np.deg2rad(15.0)
    rx = dx * np.cos(t15) - dy * np.sin(t15)
    ry = (dx * np.sin(t15) + dy * np.cos(t15)) * 0.92
    px, py = CX + rx, CY + ry

    brightness = rng.random(N_MAIN) ** 3
    brightness *= 0.4 + 0.6 * np.exp(-(r / RTRUNC) * 2.0)

    outer = r / RTRUNC > 0.55                      # warm stars mostly outer
    tints = pick_tints(rng, N_MAIN, outer)

    stars_rgb = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    stars_gray = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    splat(stars_rgb, px, py, tints * (brightness[:, None] * 2.4))
    splat(stars_gray, px, py, np.repeat(brightness[:, None] * 2.4, 3, axis=1))

    # ---- resolved bright stars in the halo/outer ----------------------
    print("resolved bright stars ...")
    u = rng.random(N_RESOLVED)
    rr = RC * np.sqrt((1.0 / (1.0 - u * D)) ** 2 - 1.0)
    rr = np.clip(rr, 0.3 * RTRUNC, RTRUNC)
    aa = rng.random(N_RESOLVED) * 2 * np.pi
    bx = CX + np.cos(aa) * rr
    by = CY + np.sin(aa) * rr
    for i in range(N_RESOLVED):
        sig = 1.5 + rng.random()
        tt = TINTS[np.searchsorted(np.cumsum(TINT_P), rng.random())]
        add_gaussian_blob(stars_rgb, bx[i], by[i], sig, tt * 2.2)
        add_gaussian_blob(stars_gray, bx[i], by[i], sig, np.full(3, 2.2))

    # ---- companion cluster -------------------------------------------
    print("companion cluster ...")
    comp_rgb = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    comp_gray = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    cr = np.abs(rng.standard_normal(N_COMP)) * 0.045 * SIZE
    ca = rng.random(N_COMP) * 2 * np.pi
    cpx, cpy = CCX + np.cos(ca) * cr, CCY + np.sin(ca) * cr
    cb = (rng.random(N_COMP) ** 3) * 0.9            # ~40% brightness overall
    ct = pick_tints(rng, N_COMP)
    splat(comp_rgb, cpx, cpy, ct * (cb[:, None] * 2.4))
    splat(comp_gray, cpx, cpy, np.repeat(cb[:, None] * 2.4, 3, axis=1))
    for _ in range(N_COMP_BRIGHT):
        gx = CCX + rng.standard_normal() * 0.045 * SIZE
        gy = CCY + rng.standard_normal() * 0.045 * SIZE
        tt = TINTS[np.searchsorted(np.cumsum(TINT_P), rng.random())]
        add_gaussian_blob(comp_rgb, gx, gy, 1.8, tt * 1.8)
        add_gaussian_blob(comp_gray, gx, gy, 1.8, np.full(3, 1.8))
    comp_rgb += 0.4 * gaussian_filter(comp_rgb, (0.05 * SIZE,) * 2 + (0,))
    comp_gray += 0.4 * gaussian_filter(comp_gray, (0.05 * SIZE,) * 2 + (0,))
    stars_rgb += comp_rgb
    stars_gray += comp_gray

    # ---- nebula wisp ---------------------------------------------------
    print("nebula wisp ...")
    neb = np.zeros((SIZE, SIZE), dtype=np.float32)
    for sigma, amp in ((20, 0.35), (45, 0.30), (100, 0.22), (200, 0.13)):
        f = gaussian_filter(rng.random((SIZE, SIZE)).astype(np.float32), sigma)
        f /= f.max() + 1e-9
        neb += amp * f
    neb /= neb.max() + 1e-9
    neb = np.clip((neb - 0.45) / 0.55, 0, 1) ** 1.6       # threshold -> filaments
    # stretch into horizontal streaks
    neb_img = Image.fromarray((neb * 255).astype(np.uint8))
    neb = np.asarray(
        neb_img.resize((SIZE, SIZE // 3), Image.BILINEAR).resize((SIZE, SIZE), Image.BILINEAR),
        np.float32) / 255.0
    # broad radial mask hugging the pair, 0 well before the edge
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    rd = np.sqrt((xx - 0.55 * SIZE) ** 2 + (yy - 0.48 * SIZE) ** 2)
    neb *= np.clip((0.30 * SIZE - rd) / (0.14 * SIZE), 0, 1) ** 2
    neb_rgb = neb[:, :, None] * (NEB_A * 0.6 + NEB_B * 0.4)[None, None, :] * 0.14

    # ---- glow layers + core -------------------------------------------
    print("glow layers + core ...")
    img = stars_gray.copy()
    for sigma, strength in GLOW:
        img += strength * gaussian_filter(img, (sigma, sigma, 0))
    # nucleus + wide core glow around the main centre
    d2m = (xx - CX) ** 2 + (yy - CY) ** 2
    img += np.exp(-d2m / (2 * (0.025 * SIZE) ** 2))[:, :, None] * 2.2
    img += np.exp(-d2m / (2 * (0.07 * SIZE) ** 2))[:, :, None] * 0.9
    # faint halo of unresolved stars, gone before 0.45*SIZE
    halo_f = np.clip((0.45 * SIZE - np.sqrt(d2m)) / (0.08 * SIZE), 0, 1)
    img += (np.exp(-d2m / (2 * (0.14 * SIZE) ** 2))
            * halo_f * halo_f)[:, :, None] * 0.3

    # ---- foreground stars ---------------------------------------------
    print("foreground stars ...")
    accents = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    placed = 0
    while placed < N_FG:
        fa = rng.random() * 2 * np.pi
        fr = (0.18 + 0.30 * rng.random()) * SIZE
        fx, fy = CX + np.cos(fa) * fr, CY + np.sin(fa) * fr
        if not (12 < fx < SIZE - 12 and 12 < fy < SIZE - 12):
            continue
        add_gaussian_blob(accents, fx, fy, 3.0, FG * 1.2)
        add_spikes(accents, fx, fy, 50 + rng.random() * 60, FG * 0.3)
        if placed < 2:
            add_ring(accents, fx, fy, 42 + rng.random() * 18, 6.0, NEB_A * 0.35)
        placed += 1

    # ---- tone-map + floor + gradient map + tints ----------------------
    print("tone-map + gradient map ...")
    b = 1.0 - np.exp(-1.7 * img.max(axis=2))
    b = np.clip((b - 0.05) / 0.95, 0, 1)

    rgb = gradient_map(b)
    # per-star tint: modulate mapped colour by the local star hue
    sg = stars_gray.max(axis=2) + 1e-6
    tint = stars_rgb / sg[:, :, None]
    tint = np.clip(gaussian_filter(tint, (1.2, 1.2, 0)), 0.4, 2.0)
    rgb *= tint
    rgb += neb_rgb + accents

    alpha = np.clip(b ** 1.2 * 1.8, 0, 1)
    accent_a = np.clip((neb_rgb + accents).max(axis=2) * 2.2, 0, 1)
    alpha = np.maximum(alpha, accent_a)

    # radial mask around the main cluster: 1 inside 0.40*SIZE, 0 at 0.48*SIZE
    fade = np.clip((0.48 * SIZE - np.sqrt(d2m)) / (0.08 * SIZE), 0, 1)
    alpha *= fade * fade * (3 - 2 * fade)

    rgb = np.where(alpha[:, :, None] > 0, rgb, 0.0)

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
        raise SystemExit("FAIL: too much ambient glow — lower nebula/halo strengths")


if __name__ == "__main__":
    main()

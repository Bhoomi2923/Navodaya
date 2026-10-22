#!/usr/bin/env python3
"""
Render a procedural FACE-ON spiral galaxy (M51 / NGC 1232 in violet light) to
a 2048x2048 RGBA PNG with a transparent background. Two bold arms + two weak
secondary arms, feathered spurs, clumpy star formation, dust lanes, pink HII
knots, a smooth glowing bulge and a faint extended disc. Everything is
accumulated additively into a GRAYSCALE buffer and a gradient map converts
brightness to the lavender palette — no yellow or gold anywhere. Alpha comes
from brightness with a hard floor + radial mask, so there is no disc or oval
behind the galaxy. The app applies tilt/rotation — rendered face-on here.

Usage:
    pip install numpy pillow scipy
    python scripts/generate-spiral-galaxy.py
"""

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

SIZE = 2048
SEED = 20261021
OUT = "assets/images/galaxy-spiral-procedural.png"
PREVIEW = "scripts/spiral-preview.png"

R = 0.47 * SIZE            # galaxy radius — arms reach almost to the canvas edge
C = SIZE / 2.0
PITCH_DEG = 16.0           # open spiral, ~1.25 turns of winding
R0 = 0.105 * R             # inner spiral reference radius
A = 1.0 / np.tan(np.deg2rad(PITCH_DEG))  # theta = A * ln(r / R0)

N_STARS = 700_000
ARM_FRACTION = 0.70
N_SPURS = 12
N_HALO_GLOW = 400          # bright in-disc stars with a soft glow
N_HII = 180                # pink star-forming knots on the arms
N_FG = 25                  # bright foreground-style stars
N_FG_SPIKES = 8            # of those, with diffraction spikes

GLOW = ((3.0, 0.9), (12.0, 0.5), (36.0, 0.12))  # blur sigma px -> strength


def hex_to_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float64)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def splat(buf, px, py, color):
    """Bilinear-splat soft points into an (H, W, 3) float buffer (np.add.at)."""
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


def gaussian_blur(img, sigma):
    return gaussian_filter(img, sigma=(sigma, sigma, 0) if img.ndim == 3 else sigma)


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
    """Faint 4-point diffraction spikes centred on a bright star."""
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
# gradient map: brightness -> lavender-violet (bright end is pure white)
# ---------------------------------------------------------------------------

HII_A = hex_to_rgb("#FF8FD8")
HII_B = hex_to_rgb("#FF6FC0")
FG = hex_to_rgb("#F3E8FF")

GMAP_POS = np.array([0.00, 0.25, 0.50, 0.75, 0.92, 1.00])
GMAP_RGB = np.array([
    [140, 96, 232],    # 8C60E8
    [126, 90, 240],    # 7E5AF0
    [170, 124, 250],   # AA7CFA main arm
    [208, 172, 255],   # D0ACFF bright ridge
    [238, 220, 255],   # EEDCFF
    [255, 255, 255],   # FFFFFF core
], dtype=np.float64) / 255.0


def gradient_map(b):
    return np.stack([np.interp(b, GMAP_POS, GMAP_RGB[:, ch]) for ch in range(3)], axis=-1)


# ---------------------------------------------------------------------------
# star field (face-on: image coords = disc coords). Grayscale brightness only.
# ---------------------------------------------------------------------------

def build_stars(rng):
    u = rng.random(N_STARS)
    r = -0.30 * R * np.log(1.0 - u * (1 - np.exp(-1 / 0.30)))
    r = np.clip(r, 0.001 * R, R)

    on_arm = rng.random(N_STARS) < ARM_FRACTION
    theta_arm = A * np.log(np.maximum(r, R0) / R0)

    # 2 bold main arms + 4 weaker secondaries at ~40% density,
    # interleaved between the mains so the disc reads richer
    choice = rng.random(N_STARS)
    sec_pick = rng.random(N_STARS)
    arm_offset = np.where(
        choice < 0.6,
        np.where(rng.random(N_STARS) < 0.5, 0.0, np.pi),
        np.select(
            [sec_pick < 0.25, sec_pick < 0.5, sec_pick < 0.75],
            [0.75, np.pi - 0.75, np.pi + 0.75],
            default=2 * np.pi - 0.75,
        ),
    )
    arm_str = np.where(choice < 0.6, 1.0, 0.4)

    rn = r / R
    # arm width grows linearly with radius: 0.06R centre -> 0.14R edge
    sigma_ang = np.minimum((0.06 + 0.08 * rn) / np.maximum(rn, 0.05), 1.2)
    angle = np.where(on_arm,
                     theta_arm + arm_offset + rng.standard_normal(N_STARS) * sigma_ang,
                     rng.random(N_STARS) * 2 * np.pi)

    px = C + np.cos(angle) * r
    py = C + np.sin(angle) * r

    brightness = rng.random(N_STARS) ** 3.5        # mostly faint, few bright
    brightness *= np.where(on_arm, arm_str, 0.5)   # inter-arm disc dimmer
    brightness *= 0.35 + 0.65 * np.exp(-rn / 0.7)

    col = np.repeat(brightness[:, None] * 2.4, 3, axis=1)
    return px, py, col, brightness


def build_spurs(rng):
    """~12 short feathers leaving the main arms at a small angle."""
    px_l, py_l, col_l = [], [], []
    for _ in range(N_SPURS):
        base = 0.0 if rng.random() < 0.5 else np.pi
        r_start = R * (0.30 + rng.random() * 0.5)
        length = R * (0.10 + rng.random() * 0.08)
        n = 2800
        rr = r_start + rng.random(n) * length
        drift = (rr - r_start) * (0.9 / R)          # curves gently off the arm
        ang = A * np.log(np.maximum(rr, R0) / R0) + base + drift \
            + rng.standard_normal(n) * 0.045
        amp = (1 - (rr - r_start) / length) ** 1.4 * 0.9 * (0.5 + 0.5 * rng.random(n))
        px_l.append(C + np.cos(ang) * rr)
        py_l.append(C + np.sin(ang) * rr)
        col_l.append(np.repeat(amp[:, None] * 2.2, 3, axis=1))
    return np.concatenate(px_l), np.concatenate(py_l), np.concatenate(col_l)


# ---------------------------------------------------------------------------
# dust lanes — inner (concave) edge of each main arm, broken + filamentary
# ---------------------------------------------------------------------------

def build_dust(rng, noise):
    n = 80_000
    u = rng.random(n)
    r = -0.36 * R * np.log(1.0 - u * 0.995)
    r = np.clip(r, 0.05 * R, R)
    theta = A * np.log(np.maximum(r, R0) / R0)

    offset = np.where(rng.random(n) < 0.5, 0.0, np.pi)
    rn = r / R
    # -0.08 rad puts the lane on the inner (concave) edge of a trailing arm
    angle = theta + offset - 0.08 + rng.standard_normal(n) * (0.04 + 0.09 * rn)

    px = C + np.cos(angle) * r
    py = C + np.sin(angle) * r
    w = (0.4 + 0.6 * rng.random(n))[:, None] * np.ones(3)

    dust = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    splat(dust, px, py, w)
    dust = gaussian_blur(dust, 7.0)[:, :, 0]

    # break the lanes up with the same noise fields -> filamentary patches
    dust *= 0.25 + 1.6 * noise

    # a few dark filaments crossing the bulge's edge
    for _ in range(10):
        br = R * (0.10 + rng.random() * 0.06)
        ba = A * np.log(br / R0) + (0.0 if rng.random() < 0.5 else np.pi) - 0.08 \
            + rng.standard_normal() * 0.05
        bx, by = C + np.cos(ba) * br, C + np.sin(ba) * br
        sig = 5 + rng.random() * 4
        rad = int(sig * 4)
        yy, xx = np.mgrid[int(by) - rad:int(by) + rad, int(bx) - rad:int(bx) + rad]
        g = np.exp(-((xx - bx) ** 2 + (yy - by) ** 2) / (2 * sig * sig))
        y0, y1 = max(0, int(by) - rad), min(SIZE, int(by) + rad)
        x0, x1 = max(0, int(bx) - rad), min(SIZE, int(bx) + rad)
        dust[y0:y1, x0:x1] += g[: y1 - y0, : x1 - x0] * 0.6

    m = dust.max()
    if m > 0:
        dust /= m
    return np.clip(dust, 0, 1)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    rng = np.random.default_rng(SEED)

    print("noise fields ...")
    noise = np.zeros((SIZE, SIZE), dtype=np.float32)
    for sigma, amp in ((6, 0.45), (18, 0.35), (50, 0.20)):
        f = gaussian_filter(rng.random((SIZE, SIZE)).astype(np.float32), sigma)
        f /= f.max() + 1e-9
        noise += amp * f
    noise /= noise.max() + 1e-9
    clump = 0.35 + 1.3 * noise          # patchy, knotted arms

    print("placing stars ...")
    px, py, col, brightness = build_stars(rng)
    stars = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    splat(stars, px, py, col)
    sx, sy, scol = build_spurs(rng)
    splat(stars, sx, sy, scol)
    stars *= clump[:, :, None]          # clumpiness modulation

    print("bright-star glows ...")
    order = np.argsort(brightness)[::-1]
    for si in order[:N_HALO_GLOW]:
        add_gaussian_blob(stars, px[si], py[si], 2.0 + rng.random(),
                          np.full(3, 2.4))

    print("dust lanes ...")
    dust = build_dust(rng, noise)

    print("glow layers ...")
    img = stars.copy()
    for sigma, strength in GLOW:
        img += strength * gaussian_blur(stars, sigma)
    img *= (1.0 - 0.45 * dust[:, :, None])

    print("bulge + outer disc ...")
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    rd2 = (xx - C) ** 2 + (yy - C) ** 2
    rell = np.sqrt(rd2) / R
    # smooth round bulge (Sersic-like) + tight nucleus
    img += np.exp(-(rell / 0.07) ** 0.5)[:, :, None] * 1.2
    img += np.exp(-rd2 / (2 * (0.015 * R) ** 2))[:, :, None] * 1.5
    # faint extended disc, exactly 0 by 0.95R
    edge_fade = np.clip((0.95 - rell) / 0.10, 0, 1)
    img += (np.exp(-rd2 / (2 * (0.35 * R) ** 2))
            * (edge_fade * edge_fade * (3 - 2 * edge_fade)))[:, :, None] * 0.12

    print("pink HII knots + foreground stars ...")
    accents = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    u = 0.40 + 0.60 * rng.random(N_HII)   # biased to the outer 60% of the disc
    rh = -0.30 * R * np.log(1.0 - u * (1 - np.exp(-1 / 0.30)))
    rh = np.clip(rh, 0.10 * R, R * 0.95)
    th = A * np.log(np.maximum(rh, R0) / R0)
    k_choice = rng.random(N_HII)
    k_sec = rng.random(N_HII)
    off = np.where(
        k_choice < 0.6,
        np.where(rng.random(N_HII) < 0.5, 0.0, np.pi),
        np.select(
            [k_sec < 0.25, k_sec < 0.5, k_sec < 0.75],
            [0.75, np.pi - 0.75, np.pi + 0.75],
            default=2 * np.pi - 0.75,
        ),
    )
    ang = th + off + rng.standard_normal(N_HII) * 0.035
    hx, hy = C + np.cos(ang) * rh, C + np.sin(ang) * rh
    for i in range(N_HII):
        sig = 3.0 + rng.random() * 6.0
        c = HII_A if rng.random() < 0.5 else HII_B
        amp = (0.4 + 0.6 * (rh[i] / R)) * (0.5 + 0.5 * rng.random())
        add_gaussian_blob(accents, hx[i], hy[i], sig, c * amp)

    for i in range(N_FG):
        fr = R * (0.15 + 0.75 * rng.random())
        fa = rng.random() * 2 * np.pi
        fx, fy = C + np.cos(fa) * fr, C + np.sin(fa) * fr
        add_gaussian_blob(accents, fx, fy, 3.0, FG * 1.1)
        if i < N_FG_SPIKES:
            add_spikes(accents, fx, fy, 40 + rng.random() * 50, FG * 0.25)
    accents += 0.5 * gaussian_blur(accents, 14.0)

    print("tone-map + floor + gradient map ...")
    b = 1.0 - np.exp(-1.8 * img.max(axis=2))
    b = np.clip((b - 0.08) / 0.92, 0, 1)

    rgb = gradient_map(b)
    # cooler periwinkle edge + faint pink-white warmth in the bulge
    rgb[:, :, 2] = np.where(rell > 0.55, rgb[:, :, 2] * 1.08, rgb[:, :, 2])
    rgb[:, :, 0] = np.where(rell < 0.10, rgb[:, :, 0] + 10 / 255.0, rgb[:, :, 0])

    alpha = np.clip(b ** 1.2 * 1.8, 0, 1)   # 0 wherever b == 0

    # accents: additive colour with their own alpha contribution
    accent_a = np.clip(accents.max(axis=2) * 1.5, 0, 1)
    rgb += accents
    alpha = np.maximum(alpha, accent_a)

    # radial mask: solid inside 0.82R, smooth fade to 0 at 0.99R
    fade = np.clip((0.99 - rell) / 0.17, 0, 1)
    alpha *= fade * fade * (3 - 2 * fade)

    # premultiplied-safe: no stray colour where fully transparent
    rgb = np.where(alpha[:, :, None] > 0, rgb, 0.0)

    rgb8 = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    a8 = (alpha * 255).astype(np.uint8)
    out = np.dstack([rgb8, a8])
    Image.fromarray(out).save(OUT)

    # preview composited on the app's deep-space colour
    bg = np.tile((hex_to_rgb("#2A1470")), (SIZE, SIZE, 1))
    comp = bg * (1 - alpha[:, :, None]) + np.clip(rgb, 0, 1) * alpha[:, :, None]
    Image.fromarray((np.clip(comp, 0, 1) * 255).astype(np.uint8)).save(PREVIEW)

    # ---- verification ----
    transparent_pct = 100.0 * (a8 < 8).mean()
    corners = [a8[0, 0], a8[0, -1], a8[-1, 0], a8[-1, -1]]
    edges = [a8[0, SIZE // 2], a8[-1, SIZE // 2], a8[SIZE // 2, 0], a8[SIZE // 2, -1]]
    print(f"wrote {OUT} + {PREVIEW}")
    print(f"pixels with alpha < 8: {transparent_pct:.1f}%  (must be >= 45%)")
    print(f"corner alphas: {corners}  edge-mid alphas: {edges}  (all must be 0)")
    if transparent_pct < 45 or any(corners) or any(edges):
        raise SystemExit("FAIL: too much ambient glow — lower the sigma-36 glow")


if __name__ == "__main__":
    main()

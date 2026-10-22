/**
 * Shared helpers for the procedurally drawn particle galaxies.
 */

export type Rng = () => number;

/** Deterministic PRNG so a galaxy's particles are stable between renders. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal sample via Box-Muller. */
export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface GalaxyParticle {
  x: number;
  y: number;
  r: number;
  fill: string;
  opacity: number;
  /** True when this particle also gets an animated twinkle overlay. */
  twinkle: boolean;
}

export interface TwinkleParticle {
  x: number;
  y: number;
  r: number;
  fill: string;
  duration: number;
  delay: number;
}

/**
 * Flag ~`count` of the brighter particles for the animated twinkle overlay
 * and return their animation specs.
 */
export function markTwinkles(
  particles: GalaxyParticle[],
  count: number,
  rng: Rng
): TwinkleParticle[] {
  const pool = particles.filter((p) => !p.twinkle && p.r >= 0.9 && p.opacity >= 0.55);
  const picked: TwinkleParticle[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const p = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    p.twinkle = true;
    const duration = 900 + rng() * 2600;
    picked.push({ x: p.x, y: p.y, r: p.r, fill: p.fill, duration, delay: rng() * duration });
  }
  return picked;
}

/** 4-point sparkle star path centred at (cx, cy). */
export function sparklePath(cx: number, cy: number, r: number): string {
  const i = r * 0.22;
  return `M ${cx} ${cy - r} L ${cx + i} ${cy - i} L ${cx + r} ${cy} L ${cx + i} ${cy + i} L ${cx} ${cy + r} L ${cx - i} ${cy + i} L ${cx - r} ${cy} L ${cx - i} ${cy - i} Z`;
}

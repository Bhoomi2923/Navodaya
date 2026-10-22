import { LinearGradient } from 'expo-linear-gradient';
import { memo, useId, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

/** Small 4-point sparkle icon (also used by the top bar / badges). */
export function Sparkle({
  size = 16,
  color = '#FFD66E',
  opacity = 1,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <Path
        d="M12 0.8 L14.7 9.3 L23.2 12 L14.7 14.7 L12 23.2 L9.3 14.7 L0.8 12 L9.3 9.3 Z"
        fill={color}
      />
    </Svg>
  );
}

/** Deterministic PRNG so the sky is stable between renders. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starPath(cx: number, cy: number, r: number) {
  const i = r * 0.22;
  return `M ${cx} ${cy - r} L ${cx + i} ${cy - i} L ${cx + r} ${cy} L ${cx + i} ${cy + i} L ${cx} ${cy + r} L ${cx - i} ${cy + i} L ${cx - r} ${cy} L ${cx - i} ${cy - i} Z`;
}

/** Circle expressed as two arcs so dots can be batched into one Path. */
function circlePath(x: number, y: number, r: number) {
  return `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
}

// ---------------------------------------------------------------------------
// Sky: dots + colourful sparkles batched into a handful of <Path> elements.
// Everything is static — no twinkling, drifting or shooting stars.
// ---------------------------------------------------------------------------

const DOT_COLORS = ['#FFFFFF', '#BFD6FF', '#FFD0EA', '#FFF0BE'];
const SPARKLE_COLORS = ['#FFD76A', '#6FE3FF', '#FF8FD0', '#8FFFB0', '#FFFFFF'];
const OPACITY_BUCKETS = [0.4, 0.65, 0.9];

interface PathGroup {
  d: string;
  color: string;
  opacity: number;
}

function bucket(o: number) {
  return o < 0.5 ? OPACITY_BUCKETS[0] : o < 0.75 ? OPACITY_BUCKETS[1] : OPACITY_BUCKETS[2];
}

function buildSky(width: number, height: number) {
  const rng = mulberry32(20261021);
  const area = (width * height) / (390 * 900);
  const dotCount = Math.min(700, Math.round(220 * area));
  const sparkleCount = Math.min(100, Math.round(35 * area));
  const groups = new Map<string, PathGroup>();

  const add = (d: string, color: string, opacity: number) => {
    const o = bucket(opacity);
    const key = `${color}|${o}`;
    let g = groups.get(key);
    if (!g) {
      g = { d: '', color, opacity: o };
      groups.set(key, g);
    }
    g.d += d;
  };

  for (let i = 0; i < dotCount; i++) {
    add(
      circlePath(rng() * width, rng() * height, 0.5 + rng() * 0.9),
      DOT_COLORS[Math.floor(rng() * DOT_COLORS.length)],
      0.3 + rng() * 0.6
    );
  }
  for (let i = 0; i < sparkleCount; i++) {
    add(
      starPath(rng() * width, rng() * height, 4 + rng() * 4),
      SPARKLE_COLORS[Math.floor(rng() * SPARKLE_COLORS.length)],
      0.5 + rng() * 0.5
    );
  }
  return [...groups.values()];
}

// ---------------------------------------------------------------------------
// Nebula streaks: long, thin, rotated gradient ellipses + grainy dust dots.
// ---------------------------------------------------------------------------

interface StreakDef {
  color: string;
  opacity: number;
  /** Centre as a fraction of layer width / height. */
  cx: number;
  cy: number;
  /** Semi-major axis as a fraction of layer width (55-70% of screen). */
  rx: number;
  rot: number;
}

const STREAKS: StreakDef[] = [
  { color: '#C0348F', opacity: 0.5, cx: 0.06, cy: 0.1, rx: 0.4, rot: -18 },
  { color: '#4FD18B', opacity: 0.38, cx: 0.88, cy: 0.22, rx: 0.38, rot: -15 },
  { color: '#3F6BFF', opacity: 0.4, cx: 0.14, cy: 0.36, rx: 0.42, rot: -20 },
  { color: '#FF9A4D', opacity: 0.34, cx: 0.86, cy: 0.5, rx: 0.36, rot: -16 },
  { color: '#E0509F', opacity: 0.34, cx: 0.1, cy: 0.64, rx: 0.4, rot: -18 },
  { color: '#2ED0C4', opacity: 0.34, cx: 0.8, cy: 0.8, rx: 0.38, rot: -18 },
];

const STREAK_DUST = 35;
const STREAK_RY = (rx: number) => Math.min(rx * 0.14, 56);

function Nebula({ width, height }: { width: number; height: number }) {
  const gid = `nb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // Grainy dust riding the streak edges — one batched path per streak.
  const dustPaths = useMemo(() => {
    const rng = mulberry32(4451);
    return STREAKS.map((s) => {
      const cx = s.cx * width;
      const cy = s.cy * height;
      const rx = s.rx * width;
      const ry = STREAK_RY(rx);
      const rad = (s.rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      let d = '';
      for (let i = 0; i < STREAK_DUST; i++) {
        const along = (rng() * 2 - 1) * rx * 1.05;
        const perp = (rng() + rng() + rng() - 1.5) * ry * 0.9;
        d += circlePath(
          cx + along * cos - perp * sin,
          cy + along * sin + perp * cos,
          0.3 + rng() * 0.9
        );
      }
      return { d, color: s.color };
    });
  }, [width, height]);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        {STREAKS.map((s, i) => (
          <RadialGradient key={i} id={`${gid}${i}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={s.color} stopOpacity={s.opacity} />
            <Stop offset="0.55" stopColor={s.color} stopOpacity={s.opacity * 0.45} />
            <Stop offset="1" stopColor={s.color} stopOpacity="0" />
          </RadialGradient>
        ))}
      </Defs>
      {STREAKS.map((s, i) => {
        const cx = s.cx * width;
        const cy = s.cy * height;
        const rx = s.rx * width;
        const ry = STREAK_RY(rx);
        return (
          <G key={i} transform={`rotate(${s.rot} ${cx} ${cy})`}>
            <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${gid}${i})`} />
          </G>
        );
      })}
      {dustPaths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.color} opacity={0.15} />
      ))}
    </Svg>
  );
}

/**
 * One shared space layer for the whole page: diagonal nebula streaks, a blue
 * haze near the bottom, and stars & sparkles. Fully static — the sky is drawn
 * once and never animates or re-renders (except on width/height change).
 * Renders behind every card — pointerEvents are off.
 */
export const StarField = memo(function StarField({
  width,
  height,
}: {
  width?: number;
  height?: number;
}) {
  const dims = useWindowDimensions();
  const w = width ?? dims.width;
  const h = height ?? dims.height;

  const groups = useMemo(() => buildSky(w, h), [w, h]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Nebula width={w} height={h} />

      {/* Subtle blue haze near the bottom of the page. */}
      <LinearGradient
        colors={['rgba(43, 63, 184, 0)', 'rgba(43, 63, 184, 0.15)']}
        locations={[0, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.22 }}
      />

      {/* Stars & sparkles — a few batched paths, not hundreds of nodes. */}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {groups.map((g, i) => (
          <Path key={i} d={g.d} fill={g.color} opacity={g.opacity} />
        ))}
      </Svg>
    </View>
  );
});

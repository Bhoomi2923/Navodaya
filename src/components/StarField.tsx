import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useId, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
  LinearGradient as SvgLinearGradient,
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
// Sky: dots + colourful sparkles batched into a handful of <Path> elements;
// only the 25 twinkling stars get their own animated node.
// ---------------------------------------------------------------------------

const DOT_COLORS = ['#FFFFFF', '#BFD6FF', '#FFD0EA', '#FFF0BE'];
const SPARKLE_COLORS = ['#FFD76A', '#6FE3FF', '#FF8FD0', '#8FFFB0', '#FFFFFF'];
const TWINKLE_COUNT = 25;
const OPACITY_BUCKETS = [0.4, 0.65, 0.9];

interface TwinkleStarSpec {
  x: number;
  y: number;
  /** Radius for dots, half-size for sparkles. */
  r: number;
  color: string;
  opacity: number;
  sparkle: boolean;
  duration: number;
  delay: number;
}

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
  const stars: TwinkleStarSpec[] = [];
  const area = (width * height) / (390 * 900);
  const dotCount = Math.min(700, Math.round(220 * area));
  const sparkleCount = Math.min(100, Math.round(35 * area));
  for (let i = 0; i < dotCount; i++) {
    stars.push({
      x: rng() * width,
      y: rng() * height,
      r: 0.5 + rng() * 0.9,
      color: DOT_COLORS[Math.floor(rng() * DOT_COLORS.length)],
      opacity: 0.3 + rng() * 0.6,
      sparkle: false,
      duration: 0,
      delay: 0,
    });
  }
  for (let i = 0; i < sparkleCount; i++) {
    stars.push({
      x: rng() * width,
      y: rng() * height,
      r: 4 + rng() * 4,
      color: SPARKLE_COLORS[Math.floor(rng() * SPARKLE_COLORS.length)],
      opacity: 0.5 + rng() * 0.5,
      sparkle: true,
      duration: 0,
      delay: 0,
    });
  }
  // Pull out a small subset that gets its own twinkle loop.
  const twinkles: TwinkleStarSpec[] = [];
  const picked = new Set<number>();
  while (picked.size < TWINKLE_COUNT && picked.size < stars.length) {
    picked.add(Math.floor(rng() * stars.length));
  }
  [...picked].sort((a, b) => b - a).forEach((i) => {
    const s = stars.splice(i, 1)[0];
    twinkles.push({ ...s, duration: 2000 + rng() * 3000, delay: rng() * 4000 });
  });

  // Batch the static stars: one path per (color, opacity bucket).
  const groups = new Map<string, PathGroup>();
  for (const s of stars) {
    const o = bucket(s.opacity);
    const key = `${s.color}|${o}`;
    let g = groups.get(key);
    if (!g) {
      g = { d: '', color: s.color, opacity: o };
      groups.set(key, g);
    }
    g.d += s.sparkle ? starPath(s.x, s.y, s.r) : circlePath(s.x, s.y, s.r);
  }
  return { groups: [...groups.values()], twinkles };
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
    <>
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Animated pieces: twinkling stars + shooting stars that reposition each pass.
// ---------------------------------------------------------------------------

function TwinkleStar({ s }: { s: TwinkleStarSpec }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0.3);

  useEffect(() => {
    if (reduceMotion) {
      t.value = s.opacity;
      return;
    }
    t.value = withDelay(
      s.delay,
      withRepeat(
        withTiming(1, { duration: s.duration, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );
  }, [reduceMotion, s.delay, s.duration, s.opacity, t]);

  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  const box = s.sparkle ? s.r * 2.6 : Math.max(6, s.r * 4);

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: s.x - box / 2, top: s.y - box / 2 }, style]}>
      <Svg width={box} height={box} style={{ overflow: 'visible' }}>
        {s.sparkle ? (
          <Path d={starPath(box / 2, box / 2, s.r)} fill={s.color} />
        ) : (
          <Circle cx={box / 2} cy={box / 2} r={s.r} fill={s.color} />
        )}
      </Svg>
    </Animated.View>
  );
}

function ShootingStar({
  width,
  height,
  delay,
  band,
  head,
  tail,
}: {
  width: number;
  height: number;
  delay: number;
  /** Vertical slice of the page this star is confined to, e.g. [0, 0.5]. */
  band: [number, number];
  head: string;
  tail: string;
}) {
  const gid = `ss${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  // Shared values so each pass repositions without a React re-render.
  const px = useSharedValue(-200);
  const py = useSharedValue(0);
  const ang = useSharedValue(20);

  useEffect(() => {
    if (reduceMotion) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function later() {
      // A new pass every ~3-6s including the 1.2s flight.
      if (alive) timer = setTimeout(fly, 1800 + Math.random() * 3000);
    }
    function fly() {
      px.value = -width * 0.12 + Math.random() * width * 0.4;
      py.value = height * (band[0] + Math.random() * (band[1] - band[0]));
      ang.value = 14 + Math.random() * 16;
      progress.value = 0;
      progress.value = withTiming(1, { duration: 1200, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(later)();
      });
    }
    timer = setTimeout(fly, delay);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [ang, band, delay, height, progress, px, py, reduceMotion, width]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 0.95, 0.9, 0]),
    transform: [
      { translateX: px.value + interpolate(progress.value, [0, 1], [0, width * 0.85]) },
      { translateY: py.value },
      { rotate: `${ang.value}deg` },
    ],
  }));

  const trail = Math.min(230, width * 0.5);
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <Svg width={trail} height={12} style={{ overflow: 'visible' }}>
        <Defs>
          <SvgLinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={tail} stopOpacity="0" />
            <Stop offset="0.7" stopColor={tail} stopOpacity="0.75" />
            <Stop offset="1" stopColor={head} stopOpacity="0.95" />
          </SvgLinearGradient>
        </Defs>
        <Line
          x1={0}
          y1={6}
          x2={trail - 4}
          y2={6}
          stroke={`url(#${gid})`}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <Circle cx={trail - 3} cy={6} r={6} fill={head} opacity={0.4} />
        <Circle cx={trail - 3} cy={6} r={2.2} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

/**
 * One shared space layer for the whole page: diagonal nebula streaks, a blue
 * haze near the bottom, stars & sparkles, and a couple of shooting stars.
 * Renders behind every card — pointerEvents are off. Memoized so scrolling
 * never re-renders it.
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

  const { groups, twinkles } = useMemo(() => buildSky(w, h), [w, h]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Nebula width={w} height={h} />

      {/* Subtle blue haze near the bottom of the page. */}
      <LinearGradient
        colors={['rgba(43, 63, 184, 0)', 'rgba(43, 63, 184, 0.15)']}
        locations={[0, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.22 }}
      />

      {/* Static stars & sparkles — a few dozen batched paths, not hundreds. */}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {groups.map((g, i) => (
          <Path key={i} d={g.d} fill={g.color} opacity={g.opacity} />
        ))}
      </Svg>

      {/* Twinkling subset. */}
      {twinkles.map((s, i) => (
        <TwinkleStar key={i} s={s} />
      ))}

      {/* Shooting stars, staggered — each confined to its own vertical band. */}
      <ShootingStar width={w} height={h} delay={600} band={[0, 0.5]} head="#FFE3F4" tail="#FF9AC8" />
      <ShootingStar width={w} height={h} delay={2600} band={[0.5, 1]} head="#E8F2FF" tail="#9FC4FF" />
    </View>
  );
});

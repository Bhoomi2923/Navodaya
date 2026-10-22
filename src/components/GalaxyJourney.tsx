import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { StarField } from '@/components/StarField';
import { FontFamily } from '@/constants/config';
import { GALAXIES, type GalaxySection } from '@/constants/galaxies';
import { JOURNEYS, type JourneyStar } from '@/constants/journeys';
import { getStarKit } from '@/content';
import { useJourneyProgress } from '@/lib/progress';
import { useLazyCards } from '@/lib/useLazyCards';

const PLANET = 124;
const PLANET_CURRENT = 128;
const ITEM_W = 200;
const ITEM_H = PLANET_CURRENT + 68;
const ROW_H = 250;
const TOP_PAD = 60;
const BOTTOM_PAD = 80;
const MAX_COLUMN_WIDTH = 480;

/** Highlight -> mid -> edge sphere shading. */
function Sphere({
  size,
  stops,
}: {
  size: number;
  stops: [string, string, string];
}) {
  const gid = `sph${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} style={{ overflow: 'visible' }}>
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="60%" fx="35%" fy="30%">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="0.55" stopColor={stops[1]} />
          <Stop offset="1" stopColor={stops[2]} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={`url(#${gid})`} />
    </Svg>
  );
}

/** Slowly rotating dashed orbit ring around the current star. */
function OrbitRing({ size, active = true }: { size: number; active?: boolean }) {
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !active) return;
    spin.value = withRepeat(
      withTiming(1, { duration: 30000, easing: Easing.linear }),
      -1
    );
  }, [reduceMotion, spin, active]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const box = size * 1.5;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: (size - box) / 2, top: (size - box) / 2 },
        style,
      ]}>
      <Svg width={box} height={box}>
        <Circle
          cx={box / 2}
          cy={box / 2}
          r={size * 0.62}
          stroke="#FFD76A"
          strokeOpacity={0.6}
          strokeWidth={1}
          strokeDasharray="4 6"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const LOCKED_TINTS: [string, string, string][] = [
  ['#FFFFFF', '#C9C3F2', '#9C92D6'],
  ['#FFFFFF', '#BFE3FF', '#8FB8E0'],
  ['#FFFFFF', '#F3D1EC', '#C89FC0'],
  ['#FFFFFF', '#CFF5E6', '#8FD8B8'],
];
const CURRENT_STOPS: [string, string, string] = ['#FFFDE8', '#FFE27A', '#F5B93B'];

type StarState = 'current' | 'locked' | 'completed';

/** Scroll position + visible height shared by every planet on the journey. */
interface JourneyZoom {
  scrollY: SharedValue<number>;
  viewH: SharedValue<number>;
  reduced: boolean;
}
const ZoomContext = createContext<JourneyZoom | null>(null);

/** Scale/fade for one planet as it passes the focus point of the screen. */
function zoomValues(zoom: JourneyZoom, centerY: number) {
  'worklet';
  const focusY = zoom.scrollY.value + zoom.viewH.value * 0.45;
  const dist = Math.abs(centerY - focusY);
  const scale = interpolate(
    dist,
    [0, zoom.viewH.value * 0.25, zoom.viewH.value * 0.6],
    [1, 0.85, 0.45],
    Extrapolation.CLAMP
  );
  const opacity = interpolate(
    dist,
    [0, zoom.viewH.value * 0.3, zoom.viewH.value * 0.65],
    [1, 0.9, 0.4],
    Extrapolation.CLAMP
  );
  return { scale, opacity };
}

/** Wraps a planet: grows to full size as it scrolls into focus. */
const StarScale = memo(function StarScale({
  centerY,
  children,
}: {
  centerY: number;
  children: React.ReactNode;
}) {
  const zoom = useContext(ZoomContext)!;
  const style = useAnimatedStyle(() => {
    if (zoom.reduced) return { transform: [{ scale: 1 }], opacity: 1 };
    const { scale, opacity } = zoomValues(zoom, centerY);
    return { transform: [{ scale }], opacity };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
});

/** Same fade for a planet's label group, kept near the shrinking lower edge. */
const StarLabel = memo(function StarLabel({
  centerY,
  radius,
  children,
}: {
  centerY: number;
  radius: number;
  children: React.ReactNode;
}) {
  const zoom = useContext(ZoomContext)!;
  const style = useAnimatedStyle(() => {
    if (zoom.reduced) return { opacity: 1, transform: [{ translateY: 0 }] };
    const { scale, opacity } = zoomValues(zoom, centerY);
    return { opacity, transform: [{ translateY: (1 - scale) * radius }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
});

function JourneyPlanet({
  star,
  index,
  state,
  x,
  y,
  galaxy,
  active = true,
  onCurrent,
  onLocked,
  onCompleted,
}: {
  star: JourneyStar;
  index: number;
  state: StarState;
  x: number;
  y: number;
  galaxy: GalaxySection;
  /** Pause the float/orbit loops while the star is off screen. */
  active?: boolean;
  onCurrent: (s: JourneyStar) => void;
  onLocked: () => void;
  onCompleted: (s: JourneyStar) => void;
}) {
  const reduceMotion = useReducedMotion();
  const size = state === 'current' ? PLANET_CURRENT : PLANET;

  // Gentle float for the current star only.
  const float = useSharedValue(0);
  // Horizontal shake for locked taps.
  const shake = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || state !== 'current' || !active) return;
    float.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [float, reduceMotion, state, active]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: state === 'current' ? interpolate(float.value, [0, 1], [-4, 4]) : 0 },
      { translateX: shake.value },
    ],
  }));

  const onPress = () => {
    if (state === 'current') {
      onCurrent(star);
    } else if (state === 'completed') {
      onCompleted(star);
    } else {
      // eslint-disable-next-line react-hooks/immutability -- reanimated shared values are mutable by design
      shake.value = withSequence(
        withTiming(6, { duration: 60 }),
        withTiming(-6, { duration: 80 }),
        withTiming(4, { duration: 60 }),
        withTiming(-2, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      onLocked();
    }
  };

  const stops =
    state === 'current'
      ? CURRENT_STOPS
      : state === 'completed'
        ? ([galaxy.colors.accent, galaxy.colors.primary, galaxy.colors.secondary] as [
            string,
            string,
            string,
          ])
        : LOCKED_TINTS[index % LOCKED_TINTS.length];

  const centerY = y + size / 2;

  return (
    <View style={[styles.item, { left: x - ITEM_W / 2, top: y }]}>
      <StarScale centerY={centerY}>
        <Animated.View style={animStyle}>
          <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={star.name}>
            <View
              style={[
                styles.planet,
                { width: size, height: size },
                state === 'current' && styles.glowCurrent,
                state === 'locked' && styles.glowLocked,
              ]}>
              <Sphere size={size} stops={stops} />
              {state === 'current' && <OrbitRing size={size} active={active} />}
              <View style={styles.badge}>
                {state === 'completed' ? (
                  <Text style={styles.badgeCheck}>✓</Text>
                ) : (
                  <Text style={styles.badgeText}>{index + 1}</Text>
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </StarScale>

      <StarLabel centerY={centerY} radius={size / 2}>
        <Text
          style={[
            styles.starLabel,
            state === 'current' && { color: '#F5B93B' },
            state === 'completed' && { color: galaxy.colors.primary },
          ]}>
          {state === 'current' ? 'YOUR NEXT MISSION' : state.toUpperCase()}
        </Text>
        <Text style={[styles.starName, state !== 'current' && styles.starNameSmall]}>
          {star.name}
        </Text>
        <Text style={styles.starMeta}>
          {state === 'locked'
            ? 'Complete the previous star'
            : `${star.kind} · ${star.questions} questions`}
        </Text>
      </StarLabel>
    </View>
  );
}

/**
 * One galaxy's vertical "star journey": a zigzag path of glowing planets
 * joined by dashed curves, floating on the shared space background.
 */
export function GalaxyJourney({ galaxyId }: { galaxyId: GalaxySection['id'] }) {
  const { width, height: viewport } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const galaxy = GALAXIES.find((g) => g.id === galaxyId)!;
  const stars = JOURNEYS[galaxyId];
  const { completedCount, currentIndex, isCompleted } = useJourneyProgress(
    galaxyId,
    stars
  );

  const { mounted, active, onScroll, registerLayout } = useLazyCards(
    stars.length,
    viewport
  );

  // UI-thread scroll tracking for the planet zoom effect.
  const scrollY = useSharedValue(0);
  const viewH = useSharedValue(Math.max(300, viewport - 140));
  const lastLazyY = useSharedValue(0);
  const reduced = useReducedMotion();
  const zoom = useMemo(() => ({ scrollY, viewH, reduced }), [scrollY, viewH, reduced]);

  const lazyScroll = (y: number) => {
    onScroll({
      nativeEvent: { contentOffset: { y } },
    } as Parameters<typeof onScroll>[0]);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      // eslint-disable-next-line react-hooks/immutability -- reanimated shared values are mutable by design
      scrollY.value = e.contentOffset.y;
      // Feed lazy mounting from the worklet, throttled by distance.
      if (Math.abs(e.contentOffset.y - lastLazyY.value) > 40) {
        lastLazyY.value = e.contentOffset.y;
        runOnJS(lazyScroll)(e.contentOffset.y);
      }
    },
  });

  const columnWidth = Math.min(width, MAX_COLUMN_WIDTH);
  const contentHeight = TOP_PAD + (stars.length - 1) * ROW_H + PLANET_CURRENT + 90 + BOTTOM_PAD;

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 1600);
  };

  const positions = useMemo(
    () =>
      stars.map((_, i) => ({
        x: columnWidth * (i % 2 === 0 ? 0.28 : 0.7),
        y: TOP_PAD + i * ROW_H,
      })),
    [columnWidth, stars]
  );

  // Star positions are known up front — register them directly with the hook.
  useEffect(() => {
    positions.forEach((p, i) => registerLayout(i, p.y, ITEM_H));
  }, [positions, registerLayout]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const openStar = (star: JourneyStar) => {
    const i = stars.findIndex((s) => s.id === star.id);
    if (getStarKit(galaxyId, i + 1)) {
      router.push(`/star/${galaxyId}/${i + 1}` as Href);
    } else {
      showNotice(`Quiz for ${star.name} coming soon`);
    }
  };

  const handleCurrent = (star: JourneyStar) => openStar(star);
  const handleCompleted = (star: JourneyStar) => openStar(star);

  return (
    <View style={styles.root}>
      {/* Same deep indigo-to-purple backdrop as the home screen. */}
      <LinearGradient
        colors={['#07031A', '#120A3A', '#1E0F4F', '#2A1470', '#1B1550']}
        locations={[0, 0.25, 0.55, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Window-sized sky, fixed behind the scrolling journey. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <StarField width={width} height={viewport} />
      </View>

      <SafeAreaView style={styles.flex} edges={['top']}>
        {/* Fixed header. */}
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Return to universe"
            style={({ pressed }) => [styles.backPill, pressed && { opacity: 0.8 }]}>
            <Text style={styles.backText}>← Return to universe</Text>
          </Pressable>
          <View style={styles.counterWrap}>
            <Text style={styles.counterLabel}>STARS EXPLORED</Text>
            <Text style={styles.counterValue}>
              {completedCount} / {stars.length}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {stars.length}-star starter journey · Later stars revisit the existing practice
          sets.
        </Text>

        <Animated.ScrollView
          style={[styles.flex, styles.stretch]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onLayout={(e) => {
            // eslint-disable-next-line react-hooks/immutability -- reanimated shared values are mutable by design
            viewH.value = e.nativeEvent.layout.height;
          }}>
          <View style={[styles.page, { height: contentHeight }]}>
            {/* Only the zigzag is width-limited and centred. */}
            <ZoomContext.Provider value={zoom}>
            <View style={{ width: columnWidth, height: contentHeight, alignSelf: 'center' }}>
              {/* Dashed connectors, behind the planets. */}
              <Svg
                width={columnWidth}
                height={contentHeight}
                style={StyleSheet.absoluteFill}
                pointerEvents="none">
                {positions.slice(0, -1).map((p, i) => {
                  const n = positions[i + 1];
                  const c0x = p.x;
                  const c0y = p.y + PLANET / 2;
                  const c1x = n.x;
                  const c1y = n.y + PLANET / 2;
                  const dx = c1x - c0x;
                  const dy = c1y - c0y;
                  const len = Math.hypot(dx, dy) || 1;
                  const off = PLANET / 2 + 16;
                  const x0 = c0x + (dx / len) * off;
                  const y0 = c0y + (dy / len) * off;
                  const x1 = c1x - (dx / len) * off;
                  const y1 = c1y - (dy / len) * off;
                  return (
                    <Path
                      key={i}
                      d={`M ${x0} ${y0} C ${c0x} ${y0 + 90}, ${c1x} ${y1 - 90}, ${x1} ${y1}`}
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth={1.2}
                      strokeDasharray="5 7"
                      fill="none"
                    />
                  );
                })}
              </Svg>

                {stars.map((star, i) =>
                i < 3 || mounted[i] ? (
                  <JourneyPlanet
                    key={star.id}
                    star={star}
                    index={i}
                    state={
                      isCompleted(star.id)
                        ? 'completed'
                        : i === currentIndex
                          ? 'current'
                          : 'locked'
                    }
                    x={positions[i].x}
                    y={positions[i].y}
                    galaxy={galaxy}
                    active={active[i]}
                    onCurrent={handleCurrent}
                    onLocked={() => showNotice('Complete the previous star')}
                    onCompleted={handleCompleted}
                  />
                ) : (
                  <View
                    key={star.id}
                    style={[
                      styles.item,
                      { left: positions[i].x - ITEM_W / 2, top: positions[i].y, height: ITEM_H },
                    ]}
                  />
                )
              )}
            </View>
            </ZoomContext.Provider>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>

      {/* Transient toast for locked taps / quiz placeholder. */}
      {notice && (
        <View
          pointerEvents="none"
          style={[styles.toast, { bottom: insets.bottom + 28 }]}>
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07031A',
  },
  flex: {
    flex: 1,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    boxShadow: '0 0 18px rgba(155, 92, 255, 0.35)',
  },
  backText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  counterWrap: {
    alignItems: 'flex-end',
  },
  counterLabel: {
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    letterSpacing: 2.5,
  },
  counterValue: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 15,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  scrollContent: {
    alignItems: 'center',
  },
  page: {
    position: 'relative',
    alignSelf: 'stretch',
  },
  item: {
    position: 'absolute',
    width: ITEM_W,
    alignItems: 'center',
  },
  planet: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCurrent: {
    boxShadow: '0 0 42px rgba(255, 215, 106, 0.55)',
    borderRadius: 999,
  },
  glowLocked: {
    boxShadow: '0 0 18px rgba(255, 255, 255, 0.22)',
    borderRadius: 999,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14123A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgeText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  badgeCheck: {
    fontFamily: FontFamily.bold,
    color: '#7CF2B0',
    fontSize: 13,
  },
  starLabel: {
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 12,
    textAlign: 'center',
  },
  starName: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 3,
    textAlign: 'center',
  },
  starNameSmall: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
  },
  starMeta: {
    fontFamily: FontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toastText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 18, 58, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
});

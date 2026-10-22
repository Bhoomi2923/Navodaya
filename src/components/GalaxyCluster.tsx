import { Image } from 'expo-image';
import { useEffect, useId, useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { TwinkleDot } from '@/components/GalaxyTwinkle';
import {
  gaussian,
  markTwinkles,
  mulberry32,
  type GalaxyParticle,
} from '@/lib/galaxyMath';

export const CLUSTER_PNG = require('@/assets/images/galaxy-cluster-procedural.png');

const TWINKLE_COUNT = 10;

/**
 * A procedurally rendered globular star cluster with a companion cluster and
 * a faint nebula wisp (generated once by scripts/generate-star-cluster.py).
 * Gentle sway instead of rotation so the diffraction spikes stay put, plus a
 * twinkling overlay and a breathing core pulse.
 */
export function GalaxyCluster({
  size,
  seed = 7,
  active = true,
  imagePriority = 'normal',
}: {
  size: number;
  seed?: number;
  /** Pause the loops and hide the twinkles while the card is off screen. */
  active?: boolean;
  /** expo-image load priority. */
  imagePriority?: 'low' | 'normal' | 'high' | null;
}) {
  const gid = `clu${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduceMotion = useReducedMotion();

  const [sway] = useState(() => new Animated.Value(-1));
  const [breath] = useState(() => new Animated.Value(1));

  const twinkles = useMemo(() => {
    const rng = mulberry32(seed);
    // main cluster centre in PNG-space: (0.46, 0.54) of the canvas
    const cx = 0.46 * size;
    const cy = 0.54 * size;
    const pool: GalaxyParticle[] = Array.from({ length: 70 }, () => ({
      x: cx + gaussian(rng) * 0.14 * size,
      y: cy + gaussian(rng) * 0.14 * size,
      r: 0.9 + rng() * 0.7,
      fill: rng() < 0.6 ? '#BFEFFF' : '#FFFFFF',
      opacity: 0.6 + rng() * 0.35,
      twinkle: false,
    }));
    return markTwinkles(pool, TWINKLE_COUNT, rng);
  }, [seed, size]);

  useEffect(() => {
    if (reduceMotion || !active) return;
    const ease = { duration: 1333, easing: Easing.inOut(Easing.sin) };
    const swayAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          ...ease,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(sway, {
          toValue: -1,
          ...ease,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ])
    );
    const breathAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1.05,
          duration: 2500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(breath, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ])
    );
    swayAnim.start();
    breathAnim.start();
    return () => {
      swayAnim.stop();
      breathAnim.stop();
    };
  }, [sway, breath, reduceMotion, active]);

  const swayDeg = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-2deg', '2deg'],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          { width: size, height: size },
          { transform: [{ rotate: swayDeg }] },
          Platform.OS === 'web' && ({ willChange: 'transform' } as const),
        ]}>
        <Image
          source={CLUSTER_PNG}
          style={{ width: size, height: size }}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority={imagePriority}
        />
      </Animated.View>

      {/* Twinkling overlay, centred on the main cluster — only while on screen. */}
      {active && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {twinkles.map((t, i) => (
            <TwinkleDot key={i} p={t} />
          ))}
        </View>
      )}

      {/* Breathing core pulse at the main cluster's centre (0.46, 0.54). */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { transform: [{ scale: breath }] }]}>
        <Svg width={size} height={size} style={styles.svg}>
          <Defs>
            <RadialGradient id={`${gid}Core`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
              <Stop offset="0.55" stopColor="#BFF3FF" stopOpacity="0.2" />
              <Stop offset="1" stopColor="#BFF3FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={0.46 * size}
            cy={0.54 * size}
            r={size * 0.1}
            fill={`url(#${gid}Core)`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    overflow: 'visible',
  },
});

import { Image } from 'expo-image';
import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/** One very slow revolution. */
const SPIN_MS = 120000;

export const SPIRAL_PNG = require('@/assets/images/galaxy-spiral-procedural.png');

/**
 * A procedurally rendered spiral galaxy (generated once by
 * scripts/generate-spiral-galaxy.py) that floats directly on the space
 * background — transparent PNG, slow rotation, breathing core.
 */
export function GalaxySpiral({
  size,
  active = true,
  imagePriority = 'normal',
}: {
  size: number;
  seed?: number;
  /** Pause the loops while the card is off screen. */
  active?: boolean;
  /** expo-image load priority. */
  imagePriority?: 'low' | 'normal' | 'high' | null;
}) {
  const gid = `sp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduceMotion = useReducedMotion();

  const [spin] = useState(() => new Animated.Value(0));
  const [breath] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduceMotion || !active) return;
    const spinAnim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      })
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
    spinAnim.start();
    breathAnim.start();
    return () => {
      spinAnim.stop();
      breathAnim.stop();
    };
  }, [spin, breath, reduceMotion, active]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const c = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* Fixed tilt — the face-on artwork is inclined in the app, not baked in. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: '-22deg' }, { scaleY: 0.78 }] },
        ]}>
        <Animated.View
          style={[
            { width: size, height: size },
            { transform: [{ rotate }] },
            Platform.OS === 'web' && ({ willChange: 'transform' } as const),
          ]}>
          <Image
            source={SPIRAL_PNG}
            style={{ width: size, height: size }}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority={imagePriority}
          />
        </Animated.View>
      </View>

      {/* Gentle additive-style pulse over the baked-in bright core. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { transform: [{ scale: breath }] }]}>
        <Svg width={size} height={size} style={styles.svg}>
          <Defs>
            <RadialGradient id={`${gid}Core`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFE3F8" stopOpacity="0.4" />
              <Stop offset="0.55" stopColor="#F3C8FF" stopOpacity="0.15" />
              <Stop offset="1" stopColor="#F3C8FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={size * 0.1} fill={`url(#${gid}Core)`} />
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

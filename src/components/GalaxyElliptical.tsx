import { Image } from 'expo-image';
import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export const ELLIPTICAL_PNG = require('@/assets/images/galaxy-elliptical-procedural.png');

/**
 * A procedurally rendered elliptical galaxy (generated once by
 * scripts/generate-elliptical-galaxy.py): a fat glowing oval with a warm
 * white core, pink-peach body and violet edge, floating on the space
 * background. Fixed tilt + a gentle sway, breathing core pulse.
 */
export function GalaxyElliptical({
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
  const gid = `ell${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduceMotion = useReducedMotion();

  const [sway] = useState(() => new Animated.Value(-1));
  const [breath] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduceMotion || !active) return;
    const ease = { duration: 1667, easing: Easing.inOut(Easing.sin) };
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
          toValue: 1.06,
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
    outputRange: ['-2.5deg', '2.5deg'],
  });
  const c = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* Fixed tilt — the oval is rendered unrotated, inclined here. */}
      <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-25deg' }] }]}>
        <Animated.View
          style={[
            { width: size, height: size },
            { transform: [{ rotate: swayDeg }] },
            Platform.OS === 'web' && ({ willChange: 'transform' } as const),
          ]}>
          <Image
            source={ELLIPTICAL_PNG}
            style={{ width: size, height: size }}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority={imagePriority}
          />
        </Animated.View>
      </View>

      {/* Gentle warm pulse over the baked-in bright core. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { transform: [{ scale: breath }] }]}>
        <Svg width={size} height={size} style={styles.svg}>
          <Defs>
            <RadialGradient id={`${gid}Core`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
              <Stop offset="0.55" stopColor="#FFE0CC" stopOpacity="0.18" />
              <Stop offset="1" stopColor="#FFE0CC" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={size * 0.12} fill={`url(#${gid}Core)`} />
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

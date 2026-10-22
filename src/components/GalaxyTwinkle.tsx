import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { TwinkleParticle } from '@/lib/galaxyMath';

/**
 * One galaxy particle whose opacity loops between 0.3 and 1 at its own
 * rhythm. Runs entirely on the UI thread via reanimated (no JS driver).
 */
export function TwinkleDot({ p }: { p: TwinkleParticle }) {
  const opacity = useSharedValue(0.3);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.8;
      return;
    }
    opacity.value = withDelay(
      p.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: p.duration, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.3, { duration: p.duration, easing: Easing.inOut(Easing.quad) })
        ),
        -1
      )
    );
  }, [opacity, p, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: p.x - p.r,
          top: p.y - p.r,
          width: p.r * 2,
          height: p.r * 2,
          borderRadius: p.r,
          backgroundColor: p.fill,
        },
        style,
      ]}
    />
  );
}

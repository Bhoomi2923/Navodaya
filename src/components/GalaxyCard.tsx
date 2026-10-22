import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GalaxyArt } from '@/components/GalaxyArt';
import { FontFamily } from '@/constants/config';
import type { GalaxySection } from '@/constants/galaxies';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Fraction of the square art box that the visible galaxy actually occupies. */
const ART_HEIGHT_FACTOR: Partial<Record<GalaxySection['type'], number>> = {
  spiral: 0.74,
  elliptical: 0.62,
  cluster: 0.72,
};

/** "#RRGGBB" -> "rgba(r,g,b,a)" for glows and borders. */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** One scrollable section: galaxy art, caption label, glass name button, progress track. */
export const GalaxyCard = memo(function GalaxyCard({
  galaxy,
  size,
  isLast,
  mounted,
  active,
  imagePriority,
}: {
  galaxy: GalaxySection;
  size: number;
  /** Last card on the page: drop the empty progress track and bottom padding. */
  isLast?: boolean;
  /** Render the heavy art — latches true once the card nears the viewport. */
  mounted: boolean;
  /** Card is on screen: run the art's animation loops. */
  active: boolean;
  /** expo-image load priority for the galaxy PNG. */
  imagePriority?: 'low' | 'normal' | 'high' | null;
}) {
  const artHeight = size * (ART_HEIGHT_FACTOR[galaxy.type] ?? 0.8);
  const scale = useSharedValue(1);
  const artFade = useSharedValue(0);
  const [pressed, setPressed] = useState(false);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const artFadeStyle = useAnimatedStyle(() => ({ opacity: artFade.value }));
  const open = () => router.push(galaxy.route);

  // Slight scale-down feedback while the button is held.
  useEffect(() => {
    scale.value = withTiming(pressed ? 0.96 : 1, { duration: pressed ? 120 : 180 });
  }, [pressed, scale]);

  // Fade the art in the first time it mounts.
  useEffect(() => {
    if (mounted) {
      artFade.value = withTiming(1, { duration: 600 });
    }
  }, [mounted, artFade, galaxy.index]);

  return (
    <View style={[styles.card, isLast && { paddingBottom: 12 }]}>
      <View style={{ width: size, height: artHeight, overflow: 'visible' }}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={galaxy.name}
          style={({ pressed }) => [
            { width: size, height: artHeight, overflow: 'visible' },
            { opacity: pressed ? 0.8 : 1 },
          ]}>
          {/* Full-size art centred in — and overflowing — the shorter box. */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: (artHeight - size) / 2,
              width: size,
              height: size,
              overflow: 'visible',
            }}>
            {mounted ? (
              <Animated.View style={artFadeStyle}>
                <GalaxyArt
                  type={galaxy.type}
                  colors={galaxy.colors}
                  size={size}
                  seed={galaxy.index.charCodeAt(1)}
                  active={active}
                  imagePriority={imagePriority}
                />
              </Animated.View>
            ) : (
              <View style={{ width: size, height: size }} />
            )}
          </View>
        </Pressable>
        <View
          style={[
            styles.badge,
            { top: Math.max(0, artHeight * 0.02), right: size * 0.08 },
          ]}>
          <Text style={styles.badgeText}>{galaxy.marks} marks</Text>
        </View>
      </View>

      <Text style={[styles.label, { color: galaxy.colors.primary }]}>
        {galaxy.index} / {galaxy.label}
      </Text>

      <AnimatedPressable
        onPress={open}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[
          styles.button,
          {
            borderColor: withAlpha(galaxy.colors.primary, 0.55),
            boxShadow: `0 0 24px ${withAlpha(galaxy.colors.primary, 0.45)}`,
          },
          pressStyle,
        ]}>
        <Text style={[styles.buttonText, { color: galaxy.textColor }]}>{galaxy.name}</Text>
      </AnimatedPressable>

      {/* Empty progress track — progress lands in a later milestone. */}
      {!isLast && <View style={styles.track} />}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 0,
    gap: 2,
    overflow: 'visible',
  },
  badge: {
    position: 'absolute',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 8, 30, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  badgeText: {
    fontFamily: FontFamily.medium,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 9,
    letterSpacing: 3.5,
    marginTop: -6,
  },
  button: {
    paddingHorizontal: 34,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    marginTop: 6,
  },
  buttonText: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  track: {
    width: 180,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    marginTop: 6,
  },
});

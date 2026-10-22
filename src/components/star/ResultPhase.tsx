import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';

import { Sparkle } from '@/components/StarField';
import { PrimaryButton } from '@/components/star/ui';
import { FontFamily } from '@/constants/config';

export interface SessionResult {
  passed: boolean;
  correct: number;
  total: number;
  awarded: number;
}

const BURST = [
  { x: -90, y: -70, s: 20, c: '#FFD76A' },
  { x: 90, y: -80, s: 16, c: '#6FE3FF' },
  { x: -120, y: 10, s: 14, c: '#FF8FD0' },
  { x: 120, y: 0, s: 18, c: '#8FFFB0' },
  { x: -55, y: 70, s: 15, c: '#FFD76A' },
  { x: 55, y: 80, s: 20, c: '#FFFFFF' },
  { x: 0, y: -110, s: 17, c: '#FF8FD0' },
  { x: 0, y: 100, s: 13, c: '#6FE3FF' },
];

function BurstSparkle({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  const reduceMotion = useReducedMotion();
  const p = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    p.value = withDelay(150, withTiming(1, { duration: 700 }));
  }, [reduceMotion, p]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x * p.value },
      { translateY: y * p.value },
      { scale: 0.4 + 0.6 * p.value },
    ],
    opacity: p.value * (1 - p.value * 0.55),
  }));

  return (
    <Animated.View style={[styles.sparkle, style]}>
      <Sparkle size={s} color={c} />
    </Animated.View>
  );
}

/** End-of-star result screen: celebration on pass, encouragement on miss. */
export function ResultPhase({
  result,
  practice,
  onExit,
  onRetry,
}: {
  result: SessionResult;
  /** Practice run on a completed star: no award, softer copy. */
  practice: boolean;
  onExit: () => void;
  onRetry: () => void;
}) {
  const { passed, correct, total, awarded } = result;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {passed ? (
        <>
          <View style={styles.burstWrap}>
            {!practice &&
              BURST.map((b, i) => <BurstSparkle key={i} {...b} />)}
            <Sparkle size={64} color="#FFD66E" />
          </View>
          <Text style={styles.title}>
            {practice ? 'Well done, explorer!' : 'Next star unlocked!'}
          </Text>
          <Text style={styles.sub}>
            You got {correct} out of {total}!
          </Text>
          {!practice && awarded > 0 && (
            <View style={styles.awardPill}>
              <Sparkle size={15} color="#FFD66E" />
              <Text style={styles.awardText}>+{awarded}</Text>
            </View>
          )}
          <View style={styles.buttons}>
            <PrimaryButton label="Back to the journey" onPress={onExit} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>Almost there!</Text>
          <Text style={styles.sub}>
            You got {correct} out of {total} — so close! One more try and
            you&apos;ve got this.
          </Text>
          <View style={styles.buttons}>
            <PrimaryButton label="Try again" onPress={onRetry} />
            <PrimaryButton label="Back to the journey" onPress={onExit} tone="ghost" />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  burstWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sparkle: {
    position: 'absolute',
  },
  title: {
    fontFamily: FontFamily.extraBold,
    color: '#FFFFFF',
    fontSize: 28,
    textAlign: 'center',
  },
  sub: {
    fontFamily: FontFamily.regular,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 23,
  },
  awardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 214, 110, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 110, 0.5)',
  },
  awardText: {
    fontFamily: FontFamily.bold,
    color: '#FFE9B3',
    fontSize: 18,
  },
  buttons: {
    marginTop: 28,
    gap: 12,
    alignItems: 'center',
  },
});

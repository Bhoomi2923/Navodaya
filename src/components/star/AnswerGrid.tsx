import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { describeFigure, FigureView } from '@/components/figures/ExamFigure';
import { FontFamily } from '@/constants/config';
import type { FigureSpec, Question } from '@/lib/content/types';

export type CardState = 'idle' | 'correct' | 'wrong' | 'dim';
type CardMark = 'check' | 'x' | null;

/** Option labels shown in the card corner — swap to A/B/C/D to match papers. */
export const OPTION_LABELS = ['1', '2', '3', '4'] as const;

const GAP = 14;
const INK = '#1B1550';

function FigureCard({
  spec,
  size,
  label,
  state,
  mark,
  onPress,
}: {
  spec: FigureSpec;
  size: number;
  label: string;
  state: CardState;
  mark: CardMark;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    if (state === 'wrong') {
      shake.value = withSequence(
        withTiming(6, { duration: 60 }),
        withTiming(-6, { duration: 80 }),
        withTiming(4, { duration: 60 }),
        withTiming(-2, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    } else if (state === 'correct') {
      pop.value = withSequence(
        withTiming(1.08, { duration: 140 }),
        withTiming(1, { duration: 140 })
      );
    }
  }, [state, reduceMotion, shake, pop]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: pop.value }],
    opacity: state === 'dim' ? 0.45 : 1,
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Option ${label}: ${describeFigure(spec)}`}
      disabled={state !== 'idle'}>
      <Animated.View
        style={[
          styles.card,
          { width: size, height: size },
          state === 'correct' && styles.cardCorrect,
          state === 'wrong' && styles.cardWrong,
          style,
        ]}>
        <FigureView spec={spec} size={size * 0.78} />
        <View style={styles.labelBadge}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
        {mark && (
          <View style={[styles.mark, mark === 'check' ? styles.markOk : styles.markNo]}>
            <Text style={styles.markText}>{mark === 'check' ? '✓' : '✕'}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/**
 * The 2x2 answer grid used by Mission / Game / Checkpoint.
 * For figure-match questions the target sits in a glowing frame on top.
 */
export function AnswerGrid({
  question,
  picked,
  reveal,
  onPick,
}: {
  question: Question;
  picked: number | null;
  /** Show correct/wrong state on the cards. */
  reveal: boolean;
  onPick: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const gridWidth = Math.min(width, 480) - 32;
  const cardSize = Math.min(170, Math.max(140, (gridWidth - GAP) / 2));
  const specs =
    question.type === 'figure-match' ? question.options : question.figures;

  const stateFor = (i: number): CardState => {
    if (!reveal) return 'idle';
    if (i === question.correctIndex) return 'correct';
    if (i === picked) return 'wrong';
    return 'dim';
  };
  const markFor = (i: number): CardMark => {
    if (!reveal) return null;
    if (i === question.correctIndex) return 'check';
    if (i === picked) return 'x';
    return null;
  };

  return (
    <View style={styles.wrap}>
      {question.type === 'figure-match' && (
        <View style={styles.targetFrame} accessibilityLabel="Find this figure">
          <FigureView spec={question.target} size={88} />
        </View>
      )}
      <View style={[styles.grid, { width: cardSize * 2 + GAP }]}>
        {specs.map((f, i) => (
          <FigureCard
            key={i}
            spec={f}
            size={cardSize}
            label={OPTION_LABELS[i]}
            state={stateFor(i)}
            mark={markFor(i)}
            onPress={() => onPick(i)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  targetFrame: {
    padding: 8,
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: '#F7F5FF',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 106, 0.8)',
    boxShadow: '0 0 24px rgba(255, 215, 106, 0.35)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F5FF',
    borderWidth: 2,
    borderColor: 'rgba(27, 21, 80, 0.15)',
    minHeight: 44,
  },
  cardCorrect: {
    borderColor: '#0F766E',
    boxShadow: '0 0 26px rgba(124, 242, 176, 0.55)',
  },
  cardWrong: {
    borderColor: '#DC2626',
    boxShadow: '0 0 22px rgba(248, 113, 113, 0.45)',
  },
  labelBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(27, 21, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(27, 21, 80, 0.2)',
  },
  labelText: {
    fontFamily: FontFamily.bold,
    color: INK,
    fontSize: 12,
  },
  mark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOk: {
    backgroundColor: 'rgba(124, 242, 176, 0.95)',
  },
  markNo: {
    backgroundColor: 'rgba(248, 113, 113, 0.95)',
  },
  markText: {
    fontFamily: FontFamily.bold,
    color: '#10142B',
    fontSize: 14,
  },
});

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FigureView } from '@/components/figures/ExamFigure';
import type { SessionApi } from '@/components/star/session';
import { PrimaryButton } from '@/components/star/ui';
import { FontFamily } from '@/constants/config';
import type { FigureSpec, TipPage } from '@/lib/content/types';

const GAP = 14;
const PAPER = '#F7F5FF';

/** Second example shown when the tip replays after checkpoint misses. */
const BOOSTER_EXAMPLE: { figures: FigureSpec[]; highlightIndex: number } = {
  figures: [
    { frame: 'square', gap: false, shade: 'none', marks: [{ cell: 4, kind: 'dot', filled: true }], lines: 'none', rotation: 0, mirror: false },
    { frame: 'square', gap: false, shade: 'none', marks: [{ cell: 4, kind: 'dot', filled: true }], lines: 'none', rotation: 0, mirror: false },
    { frame: 'square', gap: false, shade: 'none', marks: [{ cell: 4, kind: 'dot', filled: true }], lines: 'none', rotation: 0, mirror: false },
    {
      frame: 'square',
      gap: false,
      shade: 'none',
      marks: [
        { cell: 4, kind: 'dot', filled: true },
        { cell: 1, kind: 'dot', filled: true },
      ],
      lines: 'none',
      rotation: 0,
      mirror: false,
    },
  ],
  highlightIndex: 3,
};

function StepLine({ text, index }: { text: string; index: number }) {
  const reduceMotion = useReducedMotion();
  const o = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => {
      o.value = withTiming(1, { duration: 400 });
    }, 400 * index);
    return () => clearTimeout(t);
  }, [index, reduceMotion, o]);

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: (1 - o.value) * 8 }],
  }));

  return (
    <Animated.View style={[styles.stepRow, style]}>
      <View style={styles.stepDot}>
        <Text style={styles.stepNum}>{index + 1}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </Animated.View>
  );
}

function FigureCard({
  spec,
  size,
  highlight,
}: {
  spec: FigureSpec;
  size: number;
  highlight: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const glow = useSharedValue(0.4);

  useEffect(() => {
    if (reduceMotion || !highlight) return;
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.4, { duration: 900 })
      ),
      -1
    );
  }, [reduceMotion, highlight, glow]);

  const style = useAnimatedStyle(() => ({
    borderColor: `rgba(255, 215, 106, ${highlight ? glow.value : 0})`,
    boxShadow: highlight ? `0 0 ${10 + glow.value * 18}px rgba(255, 215, 106, 0.45)` : 'none',
  }));

  return (
    <Animated.View style={[styles.exampleCard, { width: size, height: size }, style]}>
      <FigureView spec={spec} size={size * 0.78} />
    </Animated.View>
  );
}

function ExampleGrid({
  figures,
  highlightIndex,
  cardSize,
}: {
  figures: FigureSpec[];
  highlightIndex: number;
  cardSize: number;
}) {
  return (
    <View style={[styles.exampleGrid, { width: cardSize * 2 + GAP }]}>
      {figures.map((f, i) => (
        <FigureCard key={i} spec={f} size={cardSize} highlight={i === highlightIndex} />
      ))}
    </View>
  );
}

/** Matching-example display: target in a glowing frame + options below. */
function MatchExample({
  page,
  cardSize,
}: {
  page: TipPage;
  cardSize: number;
}) {
  if (!page.target || !page.options) return null;
  return (
    <View style={styles.matchWrap}>
      <View style={styles.targetFrame}>
        <FigureView spec={page.target} size={cardSize * 0.8} />
      </View>
      <View style={[styles.exampleGrid, { width: cardSize * 2 + GAP }]}>
        {page.options.map((f, i) => (
          <FigureCard
            key={i}
            spec={f}
            size={cardSize}
            highlight={i === page.correctIndex}
          />
        ))}
      </View>
    </View>
  );
}

/** The "Space Tip" phase: two short pages of steps + live examples. */
export function TipPhase({
  session,
  booster,
  onDone,
  onProgress,
}: {
  session: SessionApi;
  /** Replayed after 2+ checkpoint misses: adds a second example. */
  booster: boolean;
  onDone: () => void;
  onProgress: (p: number) => void;
}) {
  const { width } = useWindowDimensions();
  const tip = session.kit.tip;
  const pages = tip.pages;
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[pageIndex];
  const cardSize = Math.min(110, (Math.min(width, 480) - 32 - GAP) / 2);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    onProgress(pageIndex / pages.length);
    const t = setTimeout(
      () => onProgress((pageIndex + 1) / pages.length),
      reduceMotion ? 0 : 400 * page.steps.length
    );
    return () => clearTimeout(t);
  }, [pageIndex, reduceMotion, onProgress, page.steps.length, pages.length]);

  const last = pageIndex === pages.length - 1;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{tip.title}</Text>

      <View style={styles.steps}>
        {page.steps.map((s, i) => (
          <StepLine key={i} text={s} index={i} />
        ))}
      </View>

      {page.exampleFigures && page.highlightIndex != null && (
        <ExampleGrid
          figures={page.exampleFigures}
          highlightIndex={page.highlightIndex}
          cardSize={cardSize}
        />
      )}
      {page.target && page.options && <MatchExample page={page} cardSize={cardSize} />}

      {booster && pageIndex === 0 && (
        <View style={styles.boosterBlock}>
          <Text style={styles.boosterLabel}>One more look:</Text>
          <ExampleGrid
            figures={BOOSTER_EXAMPLE.figures}
            highlightIndex={BOOSTER_EXAMPLE.highlightIndex}
            cardSize={cardSize}
          />
        </View>
      )}

      <View style={styles.cta}>
        {last ? (
          <PrimaryButton label="Got it, let's go" onPress={onDone} />
        ) : (
          <PrimaryButton label="Next" onPress={() => setPageIndex(pageIndex + 1)} tone="violet" />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 32,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    color: '#FFFFFF',
    fontSize: 26,
    letterSpacing: 0.5,
    marginBottom: 18,
  },
  steps: {
    alignSelf: 'stretch',
    gap: 12,
    marginBottom: 22,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(155, 92, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.6)',
  },
  stepNum: {
    fontFamily: FontFamily.bold,
    color: '#E9D5FF',
    fontSize: 13,
  },
  stepText: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  exampleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
  },
  exampleCard: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: 'rgba(27, 21, 80, 0.15)',
  },
  matchWrap: {
    alignItems: 'center',
  },
  targetFrame: {
    padding: 8,
    borderRadius: 18,
    marginBottom: 14,
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 106, 0.8)',
    boxShadow: '0 0 24px rgba(255, 215, 106, 0.35)',
  },
  boosterBlock: {
    marginTop: 20,
    alignItems: 'center',
  },
  boosterLabel: {
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 10,
  },
  cta: {
    marginTop: 26,
  },
});


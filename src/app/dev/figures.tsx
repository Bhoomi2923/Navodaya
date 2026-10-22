import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ExamFigure } from '@/components/figures/ExamFigure';
import { FontFamily } from '@/constants/config';
import { getStarKit } from '@/content';
import type { FigureMatchQuestion, FigureSpec, OddOneOutQuestion } from '@/lib/content/types';

const INK = '#1B1550';
const PAPER = '#F7F5FF';

function FigureCard({ spec, correct, size }: { spec: FigureSpec; correct: boolean; size: number }) {
  return (
    <View style={[styles.card, { width: size, height: size }, correct && styles.cardCorrect]}>
      <ExamFigure spec={spec} size={size * 0.78} />
    </View>
  );
}

function OddRow({ q, size }: { q: OddOneOutQuestion; size: number }) {
  return (
    <View style={styles.row}>
      {q.figures.map((f, i) => (
        <FigureCard key={i} spec={f} correct={i === q.correctIndex} size={size} />
      ))}
    </View>
  );
}

function MatchRow({ q, size }: { q: FigureMatchQuestion; size: number }) {
  return (
    <View style={styles.matchRow}>
      <View style={[styles.card, styles.target, { width: size, height: size }]}>
        <ExamFigure spec={q.target} size={size * 0.78} />
      </View>
      {q.options.map((f, i) => (
        <FigureCard key={i} spec={f} correct={i === q.correctIndex} size={size} />
      ))}
    </View>
  );
}

/** Dev-only gallery of generated figures — eyeball check for content. */
export default function DevFigures() {
  const { width } = useWindowDimensions();
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  const kit = getStarKit('mental', 1);
  const size = Math.max(80, Math.min(110, (width - 32) / 5.5));
  if (!kit) {
    return (
      <View style={styles.page}>
        <Text style={styles.h1}>No kit</Text>
      </View>
    );
  }
  const odd = kit.questions.filter(
    (q): q is OddOneOutQuestion => q.type === 'figure-odd-one-out'
  );
  const match = kit.questions.filter(
    (q): q is FigureMatchQuestion => q.type === 'figure-match'
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Dev figure check — STAR 1</Text>
      <Text style={styles.h2}>Odd one out (correct = green)</Text>
      {odd.slice(0, 12).map((q) => (
        <View key={q.id} style={styles.qblock}>
          <Text style={styles.label}>
            {q.id} · d{q.difficulty} · {q.rule}
          </Text>
          <OddRow q={q} size={size} />
        </View>
      ))}
      <Text style={styles.h2}>Figure matching</Text>
      {match.slice(0, 8).map((q) => (
        <View key={q.id} style={styles.qblock}>
          <Text style={styles.label}>
            {q.id} · d{q.difficulty}
          </Text>
          <MatchRow q={q} size={size} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
    gap: 8,
  },
  h1: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: INK,
    marginBottom: 8,
  },
  h2: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: INK,
    marginTop: 16,
  },
  qblock: {
    marginTop: 10,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: 'rgba(27, 21, 80, 0.6)',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  matchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: 'rgba(27, 21, 80, 0.15)',
  },
  cardCorrect: {
    borderColor: '#0F766E',
  },
  target: {
    borderColor: 'rgba(27, 21, 80, 0.5)',
    borderStyle: 'dashed',
  },
});

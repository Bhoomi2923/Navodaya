import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnswerGrid } from '@/components/star/AnswerGrid';
import type { SessionApi } from '@/components/star/session';
import { FontFamily } from '@/constants/config';
import type { Question } from '@/lib/content/types';
import { interleave } from '@/lib/pickQuestions';

const ADVANCE_MS = 600;

/**
 * The Checkpoint: 5 questions, brief reveal only — no explanation and no
 * Next button until all five are done, then the result screen.
 */
export function CheckpointPhase({
  session,
  onDone,
  onProgress,
}: {
  session: SessionApi;
  onDone: (correct: number, total: number) => void;
  onProgress: (p: number) => void;
}) {
  const recipe = session.kit.recipe.checkpoint;
  const slots = useMemo(() => interleave(recipe.mix).slice(0, recipe.questions), [recipe]);

  const [questions] = useState<Question[]>(() =>
    slots
      .map((t) => session.pickOne(t, session.checkpointLevel(t)))
      .filter((q): q is Question => q != null)
  );
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const correctRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  useEffect(() => {
    onProgress(Math.min(1, index / Math.max(1, questions.length)));
  }, [index, questions.length, onProgress]);

  const total = questions.length;
  const q = questions[index];

  const onPickCard = (i: number) => {
    if (picked != null || !q) return;
    const correct = i === q.correctIndex;
    setPicked(i);
    if (correct) correctRef.current += 1;
    session.recordAnswer(q, correct);
    timerRef.current = setTimeout(() => {
      if (index === total - 1) {
        onDone(correctRef.current, total);
      } else {
        setIndex(index + 1);
        setPicked(null);
      }
    }, ADVANCE_MS);
  };

  if (!q) return <View style={styles.loading} />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.count}>
        {index + 1} / {total}
      </Text>
      <Text style={styles.prompt}>{q.prompt}</Text>
      <AnswerGrid question={q} picked={picked} reveal={picked != null} onPick={onPickCard} />
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
    paddingTop: 14,
    paddingBottom: 32,
  },
  loading: {
    minHeight: 200,
  },
  count: {
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    letterSpacing: 2,
  },
  prompt: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 20,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
});

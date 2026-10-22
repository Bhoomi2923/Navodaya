import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnswerGrid } from '@/components/star/AnswerGrid';
import type { SessionApi } from '@/components/star/session';
import { PrimaryButton } from '@/components/star/ui';
import { FontFamily } from '@/constants/config';
import type { Question } from '@/lib/content/types';
import { interleave } from '@/lib/pickQuestions';

const HINTS = {
  'odd-man-out': 'Space hint: check the shape, the shading, the marks and the lines.',
  'figure-matching': 'Space hint: check every mark and where it sits.',
} as const;

/** The Mission phase: a mixed set of questions with instant feedback. */
export function MissionPhase({
  session,
  onDone,
  onProgress,
}: {
  session: SessionApi;
  onDone: () => void;
  onProgress: (p: number) => void;
}) {
  const slots = useMemo(() => interleave(session.kit.recipe.mission), [session.kit]);
  const total = slots.length;

  const [index, setIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>(() => {
    const first = session.pickOne(slots[0], session.levels[slots[0]]);
    return first ? [first] : [];
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const answersRef = useRef<boolean[]>([]);

  const q = questions[index];

  useEffect(() => {
    onProgress((index + (picked != null ? 1 : 0)) / total);
  }, [index, picked, total, onProgress]);

  const onPickCard = (i: number) => {
    if (picked != null || !q) return;
    const correct = i === q.correctIndex;
    setPicked(i);
    setWasCorrect(correct);
    answersRef.current[index] = correct;
    session.recordAnswer(q, correct);
    // After the 5th answer, adapt the difficulty of 6-7 and the checkpoint.
    if (index === 4) {
      const correct5 = answersRef.current.slice(0, 5).filter(Boolean).length;
      session.applyBlock(correct5);
    }
  };

  const onNext = () => {
    if (index === total - 1) {
      onDone();
      return;
    }
    const nextIndex = index + 1;
    // Pick here (event handler, not effect) so post-block levels apply to
    // questions 6-7.
    if (!questions[nextIndex]) {
      const topic = slots[nextIndex];
      const next = session.pickOne(topic, session.levels[topic]);
      if (next) {
        setQuestions((prev) => {
          const copy = [...prev];
          copy[nextIndex] = next;
          return copy;
        });
      }
    }
    setIndex(nextIndex);
    setPicked(null);
    setWasCorrect(null);
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

      {session.hint && index >= 5 && picked == null && (
        <View style={styles.hintCard}>
          <Text style={styles.hintText}>{HINTS[q.topic]}</Text>
        </View>
      )}

      <AnswerGrid question={q} picked={picked} reveal={picked != null} onPick={onPickCard} />

      {picked != null && (
        <View style={styles.feedback}>
          <Text style={[styles.feedbackTitle, wasCorrect ? styles.ok : styles.no]}>
            {wasCorrect ? 'Yes!' : 'Not quite.'}
          </Text>
          <Text style={styles.feedbackText}>{q.explanation}</Text>
          <View style={styles.nextWrap}>
            <PrimaryButton
              label={index === total - 1 ? 'To the game' : 'Next'}
              onPress={onNext}
              tone="violet"
            />
          </View>
        </View>
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
  hintCard: {
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 106, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 106, 0.4)',
  },
  hintText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFE9B3',
    fontSize: 13,
    textAlign: 'center',
  },
  feedback: {
    marginTop: 20,
    alignSelf: 'stretch',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 18, 58, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
  },
  feedbackTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    marginBottom: 4,
  },
  ok: {
    color: '#7CF2B0',
  },
  no: {
    color: '#FDA4AF',
  },
  feedbackText: {
    fontFamily: FontFamily.regular,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    textAlign: 'center',
  },
  nextWrap: {
    marginTop: 12,
  },
});

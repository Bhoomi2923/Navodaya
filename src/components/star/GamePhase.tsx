import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { AnswerGrid } from '@/components/star/AnswerGrid';
import type { SessionApi } from '@/components/star/session';
import { PrimaryButton } from '@/components/star/ui';
import { FontFamily } from '@/constants/config';
import type { Question } from '@/lib/content/types';

const ROUND_DELAY_MS = 450;

/** "Spot the Odd Planet": 60 seconds, +10 per find, streak bonuses. */
export function GamePhase({
  session,
  onDone,
  onProgress,
}: {
  session: SessionApi;
  onDone: () => void;
  onProgress: (p: number) => void;
}) {
  const seconds = session.kit.recipe.game.seconds;

  const [left, setLeft] = useState(seconds);
  const ended = left <= 0;
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [spotted, setSpotted] = useState(0);
  const [q, setQ] = useState<Question | null>(() =>
    session.pickOne('odd-man-out', session.levels['odd-man-out'])
  );
  const [picked, setPicked] = useState<number | null>(null);

  const gameOverRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const roundRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bar = useSharedValue(1);

  /** (Re)start the smooth bar + the 1-second ticker — no setState, effect-safe. */
  const armTimer = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability -- reanimated shared values mutate by design
    bar.value = 1;
    bar.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear });
    timerRef.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
  }, [bar, seconds]);

  const newRound = useCallback(() => {
    setQ(session.pickOne('odd-man-out', session.levels['odd-man-out']));
    setPicked(null);
  }, [session]);

  // Start the clock once on mount.
  useEffect(() => {
    armTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (roundRef.current) clearTimeout(roundRef.current);
    };
  }, [armTimer]);

  // Phase progress = elapsed fraction; at 0 freeze everything.
  useEffect(() => {
    if (left === 0) {
      gameOverRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (roundRef.current) clearTimeout(roundRef.current);
      onProgress(1);
    } else {
      onProgress(1 - left / seconds);
    }
  }, [left, seconds, onProgress]);

  const onReplay = () => {
    gameOverRef.current = false;
    setScore(0);
    setStreak(0);
    setSpotted(0);
    setLeft(seconds);
    newRound();
    armTimer();
  };

  const onPickCard = (i: number) => {
    if (picked != null || ended || !q) return;
    const correct = i === q.correctIndex;
    setPicked(i);
    session.recordAnswer(q, correct, 0.5); // game answers count at half weight
    if (correct) {
      setSpotted((s) => s + 1);
      setScore((s) => s + 10 + Math.min(streak * 2, 10));
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
    roundRef.current = setTimeout(() => {
      if (!gameOverRef.current) newRound();
    }, ROUND_DELAY_MS);
  };

  const barStyle = useAnimatedStyle(() => ({
    width: `${bar.value * 100}%`,
  }));

  if (ended) {
    return (
      <View style={styles.endWrap}>
        <Text style={styles.endTitle}>You spotted {spotted} planets!</Text>
        <View style={styles.scorePill}>
          <Text style={styles.scoreText}>{score} points</Text>
        </View>
        <View style={styles.endButtons}>
          <PrimaryButton label="Play again" onPress={onReplay} tone="ghost" />
          <PrimaryButton label="Continue" onPress={onDone} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.hud}>
        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerFill, barStyle]} />
        </View>
        <Text style={styles.timerText}>{left}s</Text>
        <Text style={styles.scoreHud}>{score}</Text>
      </View>

      <Text style={styles.prompt}>Spot the odd one!</Text>

      {q && (
        <AnswerGrid question={q} picked={picked} reveal={picked != null} onPick={onPickCard} />
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
  hud: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  timerTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#6FE3FF',
  },
  timerText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 14,
    width: 36,
    textAlign: 'right',
  },
  scoreHud: {
    fontFamily: FontFamily.bold,
    color: '#FFD66E',
    fontSize: 14,
    width: 40,
    textAlign: 'right',
  },
  prompt: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  endWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  endTitle: {
    fontFamily: FontFamily.extraBold,
    color: '#FFFFFF',
    fontSize: 26,
    textAlign: 'center',
  },
  scorePill: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 214, 110, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 110, 0.5)',
  },
  scoreText: {
    fontFamily: FontFamily.bold,
    color: '#FFE9B3',
    fontSize: 18,
  },
  endButtons: {
    marginTop: 26,
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});

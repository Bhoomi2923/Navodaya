import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckpointPhase } from '@/components/star/CheckpointPhase';
import { GamePhase } from '@/components/star/GamePhase';
import { MissionPhase } from '@/components/star/MissionPhase';
import { ResultPhase, type SessionResult } from '@/components/star/ResultPhase';
import type { SessionApi } from '@/components/star/session';
import { TipPhase } from '@/components/star/TipPhase';
import { StarField } from '@/components/StarField';
import { FontFamily } from '@/constants/config';
import { GALAXIES } from '@/constants/galaxies';
import { JOURNEYS } from '@/constants/journeys';
import { getStarKit } from '@/content';
import { levelAfterBlock } from '@/lib/adaptive';
import type { Difficulty, Question, TopicId } from '@/lib/content/types';
import { pick } from '@/lib/pickQuestions';
import { getCheckpointFails, recordCheckpointFail, useJourneyProgress } from '@/lib/progress';
import {
    getSeen,
    getSkill,
    markSeen,
    setSkillLevel,
    recordAnswer as skillRecordAnswer,
} from '@/lib/skills';

type Phase = 'tip' | 'mission' | 'game' | 'checkpoint' | 'result';

const STEP_LABELS = ['Space Tip', 'Mission', 'Game', 'Checkpoint'];
const PHASE_STEP: Record<Phase, number> = {
  tip: 0,
  mission: 1,
  game: 2,
  checkpoint: 3,
  result: 3,
};
const TOPICS: TopicId[] = ['odd-man-out', 'figure-matching'];

/**
 * One playable star: tip -> mission -> game -> checkpoint -> result.
 * Driven entirely by the star's JSON kit.
 */
export function StarSession({
  galaxyId,
  starIndex,
}: {
  galaxyId: string;
  starIndex: number;
}) {
  const { width, height } = useWindowDimensions();
  const kit = useMemo(() => getStarKit(galaxyId, starIndex), [galaxyId, starIndex]);
  const galaxy = GALAXIES.find((g) => g.id === galaxyId);
  const journeyStars = galaxy ? JOURNEYS[galaxy.id] : [];
  const journeyStar = journeyStars[starIndex - 1];
  const { isCompleted, complete } = useJourneyProgress(galaxyId, journeyStars);
  const practice = journeyStar ? isCompleted(journeyStar.id) : false;

  const [phase, setPhase] = useState<Phase>('tip');
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState(false);
  const [levels, setLevels] = useState<Record<TopicId, number>>(() => ({
    'odd-man-out': kit ? getSkill(kit.starId, 'odd-man-out').level : 1,
    'figure-matching': kit ? getSkill(kit.starId, 'figure-matching').level : 1,
  }));
  const usedIds = useRef(new Set<string>());
  const [fails, setFails] = useState(() =>
    journeyStar ? getCheckpointFails(galaxyId, journeyStar.id) : 0
  );
  const [checkpointTries, setCheckpointTries] = useState(0);
  const [boosterTip, setBoosterTip] = useState(() => fails >= 2);
  const [tipDest, setTipDest] = useState<'mission' | 'checkpoint'>('mission');
  const [result, setResult] = useState<SessionResult | null>(null);

  const onProgress = useCallback((p: number) => setProgress(p), []);

  const pickOne = useCallback(
    (topic: TopicId, difficulty: number): Question | null => {
      if (!kit) return null;
      const args = {
        bank: kit.questions,
        topics: [{ topic, count: 1 }],
        difficulty,
        seen: getSeen(kit.starId),
      };
      // Prefer never-used-this-session questions; relax if the bank ran dry.
      let [q] = pick({ ...args, exclude: usedIds.current });
      if (!q) [q] = pick(args);
      if (q) {
        usedIds.current.add(q.id);
        markSeen(kit.starId, [q.id]);
      }
      return q ?? null;
    },
    [kit]
  );

  const session: SessionApi | null = kit
    ? {
        kit,
        practice,
        levels,
        hint,
        pickOne,
        recordAnswer: (q, correct, weight = 1) =>
          skillRecordAnswer(kit.starId, q.topic, q.difficulty, correct, weight),
        applyBlock: (correctOutOf5: number) => {
          let showHint = false;
          const next = { ...levels };
          for (const t of TOPICS) {
            const r = levelAfterBlock(correctOutOf5, next[t]);
            next[t] = r.level;
            showHint = showHint || r.showHint;
            setSkillLevel(kit.starId, t, r.level);
          }
          setLevels(next);
          setHint(showHint);
        },
        checkpointLevel: (t: TopicId): Difficulty => {
          let l = levels[t];
          if (checkpointTries === 0 && fails === 0) l = Math.min(l, 3); // first attempt
          if (fails >= 2) l -= 1; // post-miss booster: one level gentler
          return Math.max(1, Math.min(5, l)) as Difficulty;
        },
      }
    : null;

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else if (galaxy) router.replace(galaxy.route);
    else router.replace('/');
  }, [galaxy]);

  const confirmLeave = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('Leave this mission?')) goBack();
    } else {
      Alert.alert('Leave this mission?', 'Your progress in this star will be lost.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: goBack },
      ]);
    }
  }, [goBack]);

  const onTipDone = useCallback(() => {
    setProgress(0);
    setPhase(tipDest === 'checkpoint' ? 'checkpoint' : 'mission');
  }, [tipDest]);

  const onMissionDone = useCallback(() => {
    setProgress(0);
    setPhase('game');
  }, []);

  const onGameDone = useCallback(() => {
    setProgress(0);
    setPhase('checkpoint');
  }, []);

  const onCheckpointDone = useCallback(
    (correct: number, total: number) => {
      if (!kit || !journeyStar) return;
      const passed = correct >= kit.recipe.checkpoint.passAt;
      let awarded = 0;
      if (passed) {
        if (!practice) {
          awarded = 3 + (correct === total ? 1 : 0);
          complete(journeyStar.id, awarded);
        }
      } else {
        setFails(recordCheckpointFail(galaxyId, journeyStar.id));
      }
      setResult({ passed, correct, total, awarded });
      setProgress(1);
      setPhase('result');
    },
    [kit, journeyStar, practice, complete, galaxyId]
  );

  const onRetry = useCallback(() => {
    setResult(null);
    setProgress(0);
    if (fails >= 2) {
      // After 2 misses, replay the Space Tip (with a second example) and drop
      // the checkpoint level by one. TODO: hidden Booster star later.
      setBoosterTip(true);
      setTipDest('checkpoint');
      setPhase('tip');
    } else {
      setCheckpointTries((t) => t + 1);
      setPhase('checkpoint');
    }
  }, [fails]);

  const stepIndex = PHASE_STEP[phase];

  // eslint-disable-next-line react-hooks/refs -- `session` is a plain object, not a ref
  if (!kit || !journeyStar || !session) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#07031A', '#120A3A', '#1E0F4F', '#2A1470', '#1B1550']}
          locations={[0, 0.25, 0.55, 0.8, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <View style={styles.column}>
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [styles.backPill, pressed && { opacity: 0.8 }]}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>This star isn&apos;t ready yet.</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Same backdrop as the journey, full width. */}
      <LinearGradient
        colors={['#07031A', '#120A3A', '#1E0F4F', '#2A1470', '#1B1550']}
        locations={[0, 0.25, 0.55, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <StarField width={width} height={height} />
      </View>

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.column}>
          {/* Top row: back pill + step chips. */}
          <View style={styles.topRow}>
            <Pressable
              onPress={confirmLeave}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [styles.backPill, pressed && { opacity: 0.8 }]}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <View style={styles.chips}>
              {STEP_LABELS.map((label, i) => (
                <View key={label} style={[styles.chip, i === stepIndex && styles.chipActive]}>
                  <Text style={[styles.chipText, i === stepIndex && styles.chipTextActive]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Thin progress bar for the current phase. */}
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(1, progress) * 100}%` }]} />
          </View>

          {/* Phase content. */}
          <View style={styles.content}>
            {phase === 'tip' && (
              <TipPhase session={session} booster={boosterTip} onDone={onTipDone} onProgress={onProgress} />
            )}
            {phase === 'mission' && (
              <MissionPhase session={session} onDone={onMissionDone} onProgress={onProgress} />
            )}
            {phase === 'game' && (
              <GamePhase session={session} onDone={onGameDone} onProgress={onProgress} />
            )}
            {phase === 'checkpoint' && (
              <CheckpointPhase
                key={checkpointTries}
                session={session}
                onDone={onCheckpointDone}
                onProgress={onProgress}
              />
            )}
            {phase === 'result' && result && (
              <ResultPhase result={result} practice={practice} onExit={goBack} onRetry={onRetry} />
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07031A',
  },
  flex: {
    flex: 1,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  backPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    boxShadow: '0 0 18px rgba(155, 92, 255, 0.35)',
  },
  backText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  chipActive: {
    backgroundColor: 'rgba(255, 214, 110, 0.14)',
    borderColor: 'rgba(255, 214, 110, 0.6)',
  },
  chipText: {
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
  },
  chipTextActive: {
    color: '#FFE9B3',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    marginTop: 12,
    marginBottom: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FFD66E',
  },
  content: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
});

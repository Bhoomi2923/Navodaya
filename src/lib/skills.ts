import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { TopicId } from '@/lib/content/types';

/**
 * Per-topic skill state, persisted to AsyncStorage under navodaya.skills.v1.
 * score: running mastery 0..100, level: current difficulty band 1..5.
 * Also keeps a ring buffer of the last 200 seen question ids per star so the
 * picker can prefer fresh content.
 */

const STORAGE_KEY = 'navodaya.skills.v1';
const SEEN_LIMIT = 200;

export interface Skill {
  score: number;
  level: number;
  attempts: number;
  lastSeen: number;
}

interface SkillsState {
  version: 1;
  /** `${starId}|${topic}` -> Skill */
  skills: Record<string, Skill>;
  /** starId -> question ids, oldest first, capped at SEEN_LIMIT. */
  seen: Record<string, string[]>;
}

const DEFAULT_SKILL: Skill = Object.freeze({
  score: 50,
  level: 1,
  attempts: 0,
  lastSeen: 0,
});

let state: SkillsState = { version: 1, skills: {}, seen: {} };
const listeners = new Set<() => void>();

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

// Hydrate once at module load; renders fine while empty.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<SkillsState> | null;
    if (parsed?.version === 1) {
      state = {
        version: 1,
        skills: parsed.skills ?? {},
        seen: parsed.seen ?? {},
      };
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const skillKey = (starId: string, topic: TopicId) => `${starId}|${topic}`;

export function getSkill(starId: string, topic: TopicId): Skill {
  return state.skills[skillKey(starId, topic)] ?? DEFAULT_SKILL;
}

export function useSkill(starId: string, topic: TopicId): Skill {
  return useSyncExternalStore(
    subscribe,
    () => getSkill(starId, topic),
    () => DEFAULT_SKILL
  );
}

/** Update mastery after an answer. `weight` 0.5 halves alpha (game answers). */
export function recordAnswer(
  starId: string,
  topic: TopicId,
  difficulty: number,
  correct: boolean,
  weight = 1
): void {
  const key = skillKey(starId, topic);
  const prev = state.skills[key] ?? DEFAULT_SKILL;
  const alpha = (0.15 + 0.05 * difficulty) * weight;
  const next: Skill = {
    score: (1 - alpha) * prev.score + alpha * (correct ? 100 : 0),
    level: prev.level,
    attempts: prev.attempts + 1,
    lastSeen: Date.now(),
  };
  state = { ...state, skills: { ...state.skills, [key]: next } };
  emit();
}

export function setSkillLevel(starId: string, topic: TopicId, level: number): void {
  const key = skillKey(starId, topic);
  const prev = state.skills[key] ?? DEFAULT_SKILL;
  const clamped = Math.max(1, Math.min(5, Math.round(level)));
  if (prev.level === clamped) return;
  state = {
    ...state,
    skills: { ...state.skills, [key]: { ...prev, level: clamped } },
  };
  emit();
}

export function markSeen(starId: string, ids: string[]): void {
  const cur = state.seen[starId] ?? [];
  const next = [...cur, ...ids].slice(-SEEN_LIMIT);
  state = { ...state, seen: { ...state.seen, [starId]: next } };
  emit();
}

export function getSeen(starId: string): string[] {
  return state.seen[starId] ?? [];
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { JourneyStar } from '@/constants/journeys';

/**
 * Journey progress store, persisted to AsyncStorage under
 * navodaya.progress.v1: completed star ids per galaxy, the ✦ stars total
 * (TopBar counter) and checkpoint miss counts per star.
 */

const STORAGE_KEY = 'navodaya.progress.v1';

interface ProgressState {
  version: 1;
  /** galaxyId -> completed journey star ids. */
  completed: Record<string, string[]>;
  /** Total ✦ earned across galaxies; feeds the TopBar counter. */
  starsTotal: number;
  /** `${galaxyId}/${starId}` -> checkpoint misses. */
  failedCheckpoints: Record<string, number>;
}

let state: ProgressState = {
  version: 1,
  completed: {},
  starsTotal: 0,
  failedCheckpoints: {},
};
const listeners = new Set<() => void>();
const EMPTY: string[] = [];

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

// Hydrate once at module load; UI renders correctly while empty.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ProgressState> | null;
    if (parsed?.version === 1) {
      state = {
        version: 1,
        completed: parsed.completed ?? {},
        starsTotal: parsed.starsTotal ?? 0,
        failedCheckpoints: parsed.failedCheckpoints ?? {},
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

/** Mark a journey star done and award ✦ (only the first completion awards). */
export function completeStar(galaxyId: string, starId: string, starsAwarded = 0) {
  const done = new Set(state.completed[galaxyId] ?? EMPTY);
  const already = done.has(starId);
  if (already && starsAwarded === 0) return;
  done.add(starId);
  state = {
    ...state,
    completed: { ...state.completed, [galaxyId]: [...done] },
    starsTotal: state.starsTotal + (already ? 0 : starsAwarded),
  };
  emit();
}

const failKey = (galaxyId: string, starId: string) => `${galaxyId}/${starId}`;

/** Count a checkpoint miss; returns the new total for that star. */
export function recordCheckpointFail(galaxyId: string, starId: string): number {
  const key = failKey(galaxyId, starId);
  const count = (state.failedCheckpoints[key] ?? 0) + 1;
  state = {
    ...state,
    failedCheckpoints: { ...state.failedCheckpoints, [key]: count },
  };
  emit();
  return count;
}

export function getCheckpointFails(galaxyId: string, starId: string): number {
  return state.failedCheckpoints[failKey(galaxyId, starId)] ?? 0;
}

export interface JourneyProgress {
  completedCount: number;
  /** Index of the first not-yet-completed star; === stars.length when all done. */
  currentIndex: number;
  isCompleted: (starId: string) => boolean;
  complete: (starId: string, starsAwarded?: number) => void;
  checkpointFails: (starId: string) => number;
}

export function useJourneyProgress(galaxyId: string, stars: JourneyStar[]): JourneyProgress {
  const done = useSyncExternalStore(
    subscribe,
    () => state.completed[galaxyId] ?? EMPTY,
    () => EMPTY
  );
  const isCompleted = (starId: string) => done.includes(starId);
  const idx = stars.findIndex((s) => !done.includes(s.id));
  return {
    completedCount: stars.filter((s) => done.includes(s.id)).length,
    currentIndex: idx === -1 ? stars.length : idx,
    isCompleted,
    complete: (starId, starsAwarded) => completeStar(galaxyId, starId, starsAwarded),
    checkpointFails: (starId) => getCheckpointFails(galaxyId, starId),
  };
}

/** Total ✦ earned — shown in the TopBar counter. */
export function useStarsTotal(): number {
  return useSyncExternalStore(
    subscribe,
    () => state.starsTotal,
    () => 0
  );
}

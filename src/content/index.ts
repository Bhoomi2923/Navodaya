import type { Question, StarKit } from '@/lib/content/types';
import { validateQuestion } from '@/lib/content/validateQuestion';

import matStar01 from './mental-ability/star-01.json';

/**
 * Star kits keyed by the galaxy ids from constants/galaxies.ts
 * ('mental' | 'arithmetic' | 'language'), then 1-based star index.
 */
const KITS: Partial<Record<string, Record<number, StarKit>>> = {
  mental: {
    1: matStar01 as unknown as StarKit,
  },
};

const validatedCache = new Map<string, StarKit>();

/** Filter out invalid questions (dev only) and log bank stats once per kit. */
function prepare(kit: StarKit): StarKit {
  const cached = validatedCache.get(kit.starId);
  if (cached) return cached;

  let questions: Question[] = kit.questions;
  if (__DEV__) {
    const counts = new Map<string, number>();
    const valid: Question[] = [];
    for (const q of kit.questions) {
      const errors = validateQuestion(q);
      if (errors.length > 0) {
        console.warn(`[content] skipping invalid question ${q.id}: ${errors.join('; ')}`);
        continue;
      }
      valid.push(q);
      const key = `${q.topic}/d${q.difficulty}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    console.warn(
      `[content] ${kit.starId}: ${valid.length} questions`,
      Object.fromEntries([...counts.entries()].sort())
    );
    questions = valid;
  }

  const prepared = { ...kit, questions };
  validatedCache.set(kit.starId, prepared);
  return prepared;
}

/** The kit for a star, or null when the star has no content yet. */
export function getStarKit(galaxyId: string, starIndex: number): StarKit | null {
  const kit = KITS[galaxyId]?.[starIndex];
  return kit ? prepare(kit) : null;
}

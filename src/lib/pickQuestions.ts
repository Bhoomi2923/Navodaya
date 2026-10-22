import type { Question, TopicCount, TopicId } from '@/lib/content/types';

/**
 * Pure question picker.
 * Prefers unseen questions at the target difficulty, then unseen at the
 * nearest difficulty, then the least recently seen questions.
 */
export function pick({
  bank,
  topics,
  difficulty,
  exclude = new Set<string>(),
  seen = [],
  rng = Math.random,
}: {
  bank: Question[];
  topics: TopicCount[];
  difficulty: number;
  /** Hard-excluded ids (e.g. already used this session). */
  exclude?: Set<string>;
  /** Ids seen before, oldest first (the per-star ring buffer). */
  seen?: string[];
  rng?: () => number;
}): Question[] {
  const seenIndex = new Map(seen.map((id, i) => [id, i]));
  const chosen = new Set<string>();
  const out: Question[] = [];

  const shuffled = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const dist = (q: Question) => Math.abs(q.difficulty - difficulty);

  for (const { topic, count } of topics) {
    const pool = bank.filter(
      (q) => q.topic === topic && !exclude.has(q.id) && !chosen.has(q.id)
    );

    // Unseen first, nearest difficulty first, random inside a tier.
    const unseen = shuffled(pool.filter((q) => !seenIndex.has(q.id))).sort(
      (a, b) => dist(a) - dist(b)
    );
    // Then seen ones: nearest difficulty, least recently seen wins ties.
    const seenPool = pool
      .filter((q) => seenIndex.has(q.id))
      .sort(
        (a, b) =>
          dist(a) - dist(b) || seenIndex.get(a.id)! - seenIndex.get(b.id)!
      );

    for (const q of [...unseen, ...seenPool].slice(0, count)) {
      chosen.add(q.id);
      out.push(q);
    }
  }
  return out;
}

/** Interleave a topic mix, e.g. [odd,match,odd,match,odd,match,odd]. */
export function interleave(mix: TopicCount[]): TopicId[] {
  const buckets = mix.map(({ topic, count }) => ({ topic, left: count }));
  const slots: TopicId[] = [];
  const total = mix.reduce((n, t) => n + t.count, 0);
  // Cyclic passes: take one from each non-empty bucket in order, repeat.
  while (slots.length < total) {
    let took = false;
    for (const b of buckets) {
      if (b.left > 0) {
        slots.push(b.topic);
        b.left -= 1;
        took = true;
      }
    }
    if (!took) break;
  }
  return slots;
}

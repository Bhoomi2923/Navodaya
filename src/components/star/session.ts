import type { Question, StarKit, TopicId } from '@/lib/content/types';

/** What StarSession hands to each phase component. */
export interface SessionApi {
  kit: StarKit;
  /** Replay of an already-completed star: no stars awarded, no progress change. */
  practice: boolean;
  /** Current per-topic difficulty level for this session. */
  levels: Record<TopicId, number>;
  /** Show a hint card (set when the child struggles in the mission block). */
  hint: boolean;
  /** Pick a fresh question, never repeating an id used this session. */
  pickOne: (topic: TopicId, difficulty: number) => Question | null;
  /** Record an answer into the skills store (weight 0.5 = game). */
  recordAnswer: (q: Question, correct: boolean, weight?: number) => void;
  /** Adapt levels + hint flag after the first 5 mission answers. */
  applyBlock: (correctOutOf5: number) => void;
  /** Effective checkpoint difficulty for a topic (caps/boosters applied). */
  checkpointLevel: (topic: TopicId) => number;
}

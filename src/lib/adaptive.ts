/** Difficulty adaptation after a block of 5 answered questions. */

export interface BlockResult {
  level: number;
  showHint: boolean;
}

/**
 * 4-5 correct -> level up (maxLevel 4 for star 1), 2 or fewer -> level down
 * (min 1) and flag a hint, 3 -> stay.
 */
export function levelAfterBlock(
  correctOutOf5: number,
  level: number,
  maxLevel = 4
): BlockResult {
  if (correctOutOf5 >= 4) {
    return { level: Math.min(level + 1, maxLevel), showHint: false };
  }
  if (correctOutOf5 <= 2) {
    return { level: Math.max(level - 1, 1), showHint: true };
  }
  return { level, showHint: false };
}

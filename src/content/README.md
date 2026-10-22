# Star kits (JSON content)

Each playable star is a JSON "kit" in `content/<galaxy>/star-NN.json`.
Content is pure data — figures are exam-style black-and-white line drawings
rendered in code (`react-native-svg`), never image files.

## Adding a new star kit

1. Write the JSON (or extend the generator) — see format below.
2. Register it in `src/content/index.ts` (`getStarKit`).
3. In `__DEV__` every question is validated on load (`lib/content/validateQuestion.ts`);
   invalid ones are skipped with a console warning.
4. The session UI (`/star/<galaxy>/<index>`) reads the kit's `recipe`, so new
   stars can change mission/game/checkpoint mixes and review pools without
   code changes.

## FigureSpec

```ts
{
  frame: 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'none';
  gap: boolean;        // small opening in the outline
  shade: 'none' | 'solid' | 'left' | 'right' | 'top' | 'bottom' | 'stripes';
  marks: { cell: 0-8; kind: 'dot'|'ring'|'square'|'triangle'|'cross'|'bar-h'|'bar-v'; filled: boolean }[];
  lines: 'none' | 'horizontal' | 'vertical' | 'diag-down' | 'diag-up' | 'cross';
  rotation: 0 | 90 | 180 | 270;
  mirror: boolean;     // applied before rotation
}
```

Marks sit on a 3×3 grid (0 = top-left). Each frame restricts which cells marks
may occupy (`ALLOWED_CELLS` in `lib/content/types.ts`) so they never touch the
outline: triangle `[1,4,6,7,8]`, diamond `[1,3,4,5,7]`, everything else `0-8`.
No colours — figures are always black ink on paper.

## Question format

```jsonc
{
  "id": "mat-s01-0001",
  "schemaVersion": 1,
  "locale": "en",
  "galaxy": "mental-ability",
  "starId": "mat-star-01",
  "type": "figure-odd-one-out" | "figure-match",
  "topic": "odd-man-out" | "figure-matching",
  "difficulty": 1..5,
  "prompt": "Which figure is the odd one out?",
  "explanation": "Three figures are circles. This one is a square.",
  "tags": ["figures", "odd-one-out"],
  // odd-one-out:
  "figures": [FigureSpec x4], "correctIndex": 0-3, "rule": "...",
  // or figure-match:
  "target": FigureSpec, "options": [FigureSpec x4], "correctIndex": 0-3
}
```

Rules for odd-one-out: `fill`, `frame-shape`, `mark-count`, `gap`, `mark-kind`,
`mark-position`, `half-shading`, `lines`, `mirror`. Exactly one visual property
may split the four figures 3-1 — the validator enforces it (mirrors are checked
via rotation classes: `lib/content/figureMath.ts`).

## Recipe

```jsonc
"recipe": {
  "mission":    [ { "topic": "odd-man-out", "count": 4 }, { "topic": "figure-matching", "count": 3 } ],
  "game":       { "type": "spot-the-odd-planet", "seconds": 60 },
  "checkpoint": { "questions": 5, "mix": [...], "passAt": 4 },
  "reviewPool": []   // reserved for later stars; non-empty = warm-up phase first
}
```

## Generator

`scripts/generate-mat-star1.py` (Python 3, stdlib only, seed `20261022`)
writes `content/mental-ability/star-01.json` — 72 questions, difficulty and
`correctIndex` balanced, every question validated before writing. Run:

```bash
python scripts/generate-mat-star1.py
```

Dev figure check: `http://localhost:<port>/dev/figures` renders sample
questions with the real renderer (`__DEV__` only).

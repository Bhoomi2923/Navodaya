import type { FigureSpec, LineType, ShadeType } from '@/lib/content/types';

/**
 * Rotation/mirror transforms for FigureSpec.
 * Used by the dev validator so "same figure turned around / mirrored" is
 * understood the same way the generator means it.
 */

const cellPos = (cell: number): [number, number] => [
  Math.floor(cell / 3),
  cell % 3,
];
const cellOf = (r: number, c: number) => r * 3 + c;

export function rotateCell(cell: number, rot: 90 | 180 | 270): number {
  const [r, c] = cellPos(cell);
  if (rot === 90) return cellOf(c, 2 - r);
  if (rot === 180) return cellOf(2 - r, 2 - c);
  return cellOf(2 - c, r);
}

export function mirrorCell(cell: number): number {
  const [r, c] = cellPos(cell);
  return cellOf(r, 2 - c);
}

const ROT90_LINE: Record<LineType, LineType> = {
  none: 'none',
  horizontal: 'vertical',
  vertical: 'horizontal',
  'diag-down': 'diag-up',
  'diag-up': 'diag-down',
  cross: 'cross',
};
const MIRROR_LINE: Record<LineType, LineType> = {
  none: 'none',
  horizontal: 'horizontal',
  vertical: 'vertical',
  'diag-down': 'diag-up',
  'diag-up': 'diag-down',
  cross: 'cross',
};

function rotateLine(l: LineType, rot: 90 | 180 | 270): LineType {
  if (rot === 180) return l;
  return rot === 90 ? ROT90_LINE[l] : ROT90_LINE[ROT90_LINE[ROT90_LINE[l]]];
}

const ROT90_SHADE: Record<ShadeType, ShadeType> = {
  none: 'none',
  solid: 'solid',
  stripes: 'stripes',
  left: 'top',
  top: 'right',
  right: 'bottom',
  bottom: 'left',
};
const MIRROR_SHADE: Record<ShadeType, ShadeType> = {
  none: 'none',
  solid: 'solid',
  stripes: 'stripes',
  left: 'right',
  right: 'left',
  top: 'top',
  bottom: 'bottom',
};

function rotateShade(s: ShadeType, rot: 90 | 180 | 270): ShadeType {
  if (rot === 180) {
    return ROT90_SHADE[ROT90_SHADE[s]];
  }
  return rot === 90 ? ROT90_SHADE[s] : ROT90_SHADE[ROT90_SHADE[ROT90_SHADE[s]]];
}

/** Apply rotation+mirror to the geometry; flags reset to identity. */
export function transformGeometry(
  spec: FigureSpec,
  rot: 0 | 90 | 180 | 270,
  mir: boolean
): FigureSpec {
  let marks = spec.marks;
  let lines = spec.lines;
  let shade = spec.shade;
  if (mir) {
    marks = marks.map((m) => ({ ...m, cell: mirrorCell(m.cell) }));
    lines = MIRROR_LINE[lines];
    shade = MIRROR_SHADE[shade];
  }
  if (rot !== 0) {
    marks = marks.map((m) => ({ ...m, cell: rotateCell(m.cell, rot) }));
    lines = rotateLine(lines, rot);
    shade = rotateShade(shade, rot);
  }
  return { ...spec, marks, lines, shade, rotation: 0, mirror: false };
}

/** Bake the spec's own rotation/mirror into the geometry. */
export function effective(spec: FigureSpec): FigureSpec {
  return transformGeometry(spec, spec.rotation, spec.mirror);
}

/** Stable key for a spec (marks order-independent). */
function keyOf(spec: FigureSpec): string {
  const marks = spec.marks
    .map((m) => `${m.cell}:${m.kind}:${m.filled ? 1 : 0}`)
    .sort()
    .join(',');
  return [
    spec.frame,
    spec.gap ? 1 : 0,
    spec.shade,
    marks,
    spec.lines,
    spec.rotation,
    spec.mirror ? 1 : 0,
  ].join('|');
}

const ROTATIONS: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];

/** Same figure under any rotation/mirror. */
export function canonicalKey(spec: FigureSpec): string {
  const e = effective(spec);
  let best = keyOf(e);
  for (const r of ROTATIONS) {
    for (const m of [false, true]) {
      const k = keyOf(transformGeometry(e, r, m));
      if (k < best) best = k;
    }
  }
  return best;
}

/** Same figure under rotation only (a mirror image is a different class). */
export function rotationClassKey(spec: FigureSpec): string {
  const e = effective(spec);
  let best = keyOf(e);
  for (const r of ROTATIONS) {
    const k = keyOf(transformGeometry(e, r, false));
    if (k < best) best = k;
  }
  return best;
}

/** Exact same orientation — matching questions need this, not canonical. */
export function exactEqual(a: FigureSpec, b: FigureSpec): boolean {
  return keyOf(effective(a)) === keyOf(effective(b));
}

/** Content key ignoring orientation entirely (canonical marks/shade/lines). */
export function canonicalContent(spec: FigureSpec): {
  frame: string;
  gap: boolean;
  shade: string;
  lines: string;
  marks: string;
} {
  const e = effective(spec);
  let bestKey = canonicalKey(spec);
  let best = e;
  for (const r of ROTATIONS) {
    for (const m of [false, true]) {
      const t = transformGeometry(e, r, m);
      const k = keyOf(t);
      if (k < bestKey) {
        bestKey = k;
        best = t;
      }
    }
  }
  return {
    frame: best.frame,
    gap: best.gap,
    shade: best.shade,
    lines: best.lines,
    marks: best.marks
      .map((m) => `${m.cell}:${m.kind}:${m.filled ? 1 : 0}`)
      .sort()
      .join(','),
  };
}

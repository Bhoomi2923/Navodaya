import {
    effective,
    exactEqual,
    rotationClassKey
} from '@/lib/content/figureMath';
import {
    ALLOWED_CELLS,
    type FigureSpec,
    type OddRule,
    type Question,
} from '@/lib/content/types';

/**
 * Pure question validation. Returns a list of problems (empty = valid).
 * Used in __DEV__ to warn about and skip broken content.
 */

const FRAMES = new Set(['circle', 'square', 'triangle', 'diamond', 'hexagon', 'none']);
const SHADES = new Set(['none', 'solid', 'left', 'right', 'top', 'bottom', 'stripes']);
const KINDS = new Set(['dot', 'ring', 'square', 'triangle', 'cross', 'bar-h', 'bar-v']);
const LINES = new Set(['none', 'horizontal', 'vertical', 'diag-down', 'diag-up', 'cross']);

const CONTENT_PROPS = ['frame', 'gap', 'shade', 'lines', 'marks'] as const;
type PropName = (typeof CONTENT_PROPS)[number] | 'transform';

/** Which property a rule is allowed to split 3-1. */
const RULE_PROP: Record<OddRule, PropName> = {
  fill: 'shade',
  'frame-shape': 'frame',
  'mark-count': 'marks',
  gap: 'gap',
  'mark-kind': 'marks',
  'mark-position': 'marks',
  'half-shading': 'shade',
  lines: 'lines',
  mirror: 'transform',
};

function validateFigure(f: unknown, where: string, errors: string[]) {
  if (typeof f !== 'object' || f === null) {
    errors.push(`${where}: not an object`);
    return;
  }
  const s = f as FigureSpec;
  if (!FRAMES.has(s.frame)) errors.push(`${where}: bad frame "${String(s.frame)}"`);
  if (typeof s.gap !== 'boolean') errors.push(`${where}: bad gap`);
  if (!SHADES.has(s.shade)) errors.push(`${where}: bad shade "${String(s.shade)}"`);
  if (!LINES.has(s.lines)) errors.push(`${where}: bad lines "${String(s.lines)}"`);
  if (![0, 90, 180, 270].includes(s.rotation)) {
    errors.push(`${where}: bad rotation ${String(s.rotation)}`);
  }
  if (typeof s.mirror !== 'boolean') errors.push(`${where}: bad mirror`);
  if (!Array.isArray(s.marks) || s.marks.length < 1 || s.marks.length > 4) {
    errors.push(`${where}: marks must be 1-4`);
  } else {
    const allowed = new Set(ALLOWED_CELLS[s.frame] ?? []);
    const cells = new Set<number>();
    s.marks.forEach((m, i) => {
      if (
        typeof m.cell !== 'number' ||
        !Number.isInteger(m.cell) ||
        m.cell < 0 ||
        m.cell > 8
      ) {
        errors.push(`${where}: marks[${i}].cell ${String(m.cell)} out of range`);
      } else {
        if (!allowed.has(m.cell)) {
          errors.push(`${where}: marks[${i}].cell ${m.cell} not inside ${s.frame}`);
        }
        if (cells.has(m.cell)) errors.push(`${where}: duplicate mark cell ${m.cell}`);
        cells.add(m.cell);
      }
      if (!KINDS.has(m.kind)) errors.push(`${where}: bad mark kind "${String(m.kind)}"`);
      if (typeof m.filled !== 'boolean') errors.push(`${where}: bad mark filled`);
    });
  }
}

/**
 * The "properties" a child can see — computed on the effective figure
 * (orientation baked in, not canonicalized: left vs right shading is a real
 * difference). marks is one bundled multiset (position, kind and filled
 * together), because any mark difference is "the inside".
 * transform = the figure's rotation class (mirrors are a different class).
 */
function propsOf(spec: FigureSpec): Record<PropName, string> {
  const e = effective(spec);
  return {
    frame: e.frame,
    gap: String(e.gap),
    shade: e.shade,
    lines: e.lines,
    marks: e.marks
      .map((m) => `${m.cell}:${m.kind}:${m.filled ? 1 : 0}`)
      .sort()
      .join(','),
    transform: rotationClassKey(spec),
  };
}

/** Indexes of the single figure that differs from three equal ones (3-1 split). */
function oddIndexOf(values: string[]): number {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  if (counts.size !== 2) return -1;
  const entry = [...counts.entries()].find(([, c]) => c === 1);
  if (!entry) return -1;
  return values.indexOf(entry[0]);
}

export function validateQuestion(q: Question): string[] {
  const errors: string[] = [];
  if (!q || typeof q !== 'object') return ['not an object'];
  if (q.schemaVersion !== 1) errors.push(`schemaVersion ${String(q.schemaVersion)}`);
  if (!q.id) errors.push('missing id');
  if (q.locale !== 'en') errors.push(`locale "${String(q.locale)}"`);
  if (q.galaxy !== 'mental-ability') errors.push(`galaxy "${String(q.galaxy)}"`);
  if (typeof q.difficulty !== 'number' || q.difficulty < 1 || q.difficulty > 5) {
    errors.push(`difficulty ${String(q.difficulty)}`);
  }
  if (!q.prompt) errors.push('missing prompt');
  if (!q.explanation) errors.push('missing explanation');
  if (!Array.isArray(q.tags)) errors.push('tags not an array');

  if (q.type === 'figure-odd-one-out') {
    const topic: string = q.topic;
    if (topic !== 'odd-man-out') errors.push(`topic "${topic}" for odd-one-out`);
    if (!Array.isArray(q.figures) || q.figures.length !== 4) {
      errors.push('figures must be 4');
    } else {
      q.figures.forEach((f, i) => validateFigure(f, `figures[${i}]`, errors));
      // Exactly ONE property may split the figures 3-1, at correctIndex, and
      // it must be the rule's property. The transform (rotation class) prop is
      // only meaningful for the mirror rule — any content difference changes
      // the class too, so it is not checked for other rules.
      const props = q.figures.map(propsOf);
      const splitters = new Set<PropName>();
      for (const p of CONTENT_PROPS) {
        const idx = oddIndexOf(props.map((x) => x[p]));
        if (idx >= 0) {
          splitters.add(p);
          if (idx !== q.correctIndex) {
            errors.push(`${p} splits at ${idx}, not correctIndex ${q.correctIndex}`);
          }
        }
      }
      const want = RULE_PROP[q.rule];
      if (want === 'transform') {
        const tIdx = oddIndexOf(props.map((x) => x.transform));
        if (tIdx !== q.correctIndex) {
          errors.push('transform does not split at correctIndex');
        }
        if (splitters.size > 0) {
          errors.push(`content also splits: [${[...splitters].join(',')}]`);
        }
      } else if (splitters.size !== 1 || !splitters.has(want)) {
        errors.push(`splits [${[...splitters].join(',')}] != rule prop "${want}"`);
      }
    }
  } else if (q.type === 'figure-match') {
    const topic: string = q.topic;
    if (topic !== 'figure-matching') errors.push(`topic "${topic}" for figure-match`);
    validateFigure(q.target, 'target', errors);
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push('options must be 4');
    } else {
      q.options.forEach((f, i) => validateFigure(f, `options[${i}]`, errors));
      const matches = q.options.filter((o) => exactEqual(o, q.target)).length;
      if (matches !== 1) errors.push(`${matches} options match target (want 1)`);
      if (q.correctIndex >= 0 && q.correctIndex < 4) {
        if (!exactEqual(q.options[q.correctIndex], q.target)) {
          errors.push('options[correctIndex] does not match target');
        }
      } else {
        errors.push(`correctIndex ${q.correctIndex}`);
      }
      for (let i = 0; i < q.options.length; i++) {
        for (let j = i + 1; j < q.options.length; j++) {
          if (exactEqual(q.options[i], q.options[j])) {
            errors.push(`options ${i} and ${j} are identical`);
          }
        }
      }
    }
  } else {
    errors.push(`unknown type "${String((q as { type?: string }).type)}"`);
  }
  return errors;
}

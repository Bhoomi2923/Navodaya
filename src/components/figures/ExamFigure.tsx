import { memo, useId } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
} from 'react-native-svg';

import type { FigureMark, FigureSpec, MarkKind } from '@/lib/content/types';

/**
 * Exam-style figure renderer: ink-on-paper line drawings like a printed
 * question paper. viewBox 0 0 100 100, everything stays inside.
 */

const INK = '#1B1550';
const PAPER = '#F7F5FF';
const STROKE = 3.5;

const CX = 50;
const CY = 50;

/** Cell centres on the 3x3 grid: {30, 50, 70}. */
function cellCenter(cell: number): { x: number; y: number } {
  return { x: 30 + (cell % 3) * 20, y: 30 + Math.floor(cell / 3) * 20 };
}

/** Frame outlines as paths, plus perimeter + where the 'gap' opening sits. */
const FRAMES: Record<
  string,
  { d: string; perimeter: number; gapAt: number }
> = {
  circle: {
    d: 'M 88 50 A 38 38 0 1 1 12 50 A 38 38 0 1 1 88 50 Z',
    perimeter: 2 * Math.PI * 38,
    gapAt: 0.87, // top-right of the circle
  },
  square: {
    d: 'M 88 12 L 88 88 L 12 88 L 12 12 Z',
    perimeter: 304,
    gapAt: 0.85, // top edge near the right corner
  },
  triangle: {
    d: 'M 50 12 L 88 82 L 12 82 Z',
    perimeter: 76 + 2 * Math.hypot(38, 70),
    gapAt: 0.17, // middle of the right edge
  },
  diamond: {
    d: 'M 50 12 L 88 50 L 50 88 L 12 50 Z',
    perimeter: 4 * Math.hypot(38, 38),
    gapAt: 0.13, // middle of the top-right edge
  },
  hexagon: {
    d: 'M 88 50 L 69 83 L 31 83 L 12 50 L 31 17 L 69 17 Z',
    perimeter: 228,
    gapAt: 0.92, // top-right slant
  },
};

/** Half-shade clip rects (in frame coordinates). */
const HALF_RECTS: Record<string, { x: number; y: number; w: number; h: number }> = {
  left: { x: 12, y: 12, w: 38, h: 76 },
  right: { x: 50, y: 12, w: 38, h: 76 },
  top: { x: 12, y: 12, w: 76, h: 38 },
  bottom: { x: 12, y: 50, w: 76, h: 38 },
};

/** Diagonal stripe paths for the 'stripes' shade (45 degrees). */
const STRIPE_LINES = [-40, -20, 0, 20, 40].map(
  (c) => `M 0 ${c} L 100 ${c + 100}`
);

const FIGURE_LINES: Record<string, string[]> = {
  horizontal: ['M 12 50 L 88 50'],
  vertical: ['M 50 12 L 50 88'],
  'diag-down': ['M 12 12 L 88 88'],
  'diag-up': ['M 12 88 L 88 12'],
  cross: ['M 12 50 L 88 50', 'M 50 12 L 50 88'],
};

/** Whether a point sits on an ink-shaded area (so marks switch to paper ink). */
function onInk(x: number, y: number, shade: FigureSpec['shade']): boolean {
  switch (shade) {
    case 'solid':
      return true;
    case 'left':
      return x < 50;
    case 'right':
      return x > 50;
    case 'top':
      return y < 50;
    case 'bottom':
      return y > 50;
    default:
      return false;
  }
}

function Mark({ mark, color }: { mark: FigureMark; color: string }) {
  const { x, y } = cellCenter(mark.cell);
  const fill = mark.filled ? color : 'none';
  const stroke = { stroke: color, strokeWidth: STROKE - 1, strokeLinecap: 'round' as const };
  switch (mark.kind as MarkKind) {
    case 'dot':
      return <Circle cx={x} cy={y} r={5} fill={fill} {...stroke} />;
    case 'ring':
      return <Circle cx={x} cy={y} r={6} fill={fill} {...stroke} />;
    case 'square':
      return <Rect x={x - 5} y={y - 5} width={10} height={10} fill={fill} {...stroke} />;
    case 'triangle':
      return (
        <Path
          d={`M ${x} ${y - 5.5} L ${x + 5} ${y + 4} L ${x - 5} ${y + 4} Z`}
          fill={fill}
          {...stroke}
          strokeLinejoin="round"
        />
      );
    case 'cross':
      return (
        <Path
          d={`M ${x - 4.5} ${y - 4.5} L ${x + 4.5} ${y + 4.5} M ${x + 4.5} ${y - 4.5} L ${x - 4.5} ${y + 4.5}`}
          fill="none"
          stroke={color}
          strokeWidth={mark.filled ? 4.5 : 2.6}
          strokeLinecap="round"
        />
      );
    case 'bar-h':
      return <Rect x={x - 6} y={y - 2} width={12} height={4} fill={fill} {...stroke} />;
    case 'bar-v':
      return <Rect x={x - 2} y={y - 6} width={4} height={12} fill={fill} {...stroke} />;
    default:
      return null;
  }
}

export const ExamFigure = memo(function ExamFigure({
  spec,
  size = 100,
}: {
  spec: FigureSpec;
  size?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const frameClip = `fc${uid}`;
  const shadeClip = `sc${uid}`;

  const frame = spec.frame !== 'none' ? FRAMES[spec.frame] : null;
  const half = HALF_RECTS[spec.shade];
  const hasShade = frame != null && spec.shade !== 'none';

  // Mirror first, then rotate, around the centre.
  const transform = [
    spec.rotation ? `rotate(${spec.rotation} ${CX} ${CY})` : '',
    spec.mirror ? `translate(100 0) scale(-1 1)` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const gapDash = frame
    ? {
        strokeDasharray: `${frame.perimeter * 0.43} ${frame.perimeter * 0.14} ${frame.perimeter * 0.43}`,
        strokeDashoffset: (0.5 - frame.gapAt) * frame.perimeter,
      }
    : null;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        {frame && (
          <ClipPath id={frameClip}>
            <Path d={frame.d} />
          </ClipPath>
        )}
        {half && (
          <ClipPath id={shadeClip}>
            <Rect x={half.x} y={half.y} width={half.w} height={half.h} />
          </ClipPath>
        )}
      </Defs>

      <G transform={transform || undefined}>
        {/* Shading inside the frame. */}
        {hasShade && (
          <G clipPath={`url(#${frameClip})`}>
            {spec.shade === 'solid' && <Rect x={0} y={0} width={100} height={100} fill={INK} />}
            {half && <Rect x={half.x} y={half.y} width={half.w} height={half.h} fill={INK} />}
            {spec.shade === 'stripes' &&
              STRIPE_LINES.map((d, i) => (
                <Path key={i} d={d} stroke={INK} strokeWidth={2.5} fill="none" />
              ))}
          </G>
        )}

        {/* Frame outline (with the optional opening). */}
        {frame && (
          <Path
            d={frame.d}
            fill="none"
            stroke={INK}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...(spec.gap ? gapDash! : {})}
          />
        )}

        {/* Internal lines, kept inside the frame; paper ink over shading. */}
        {spec.lines !== 'none' &&
          FIGURE_LINES[spec.lines].map((d, i) => {
            const paper = spec.shade === 'solid' || half != null;
            return (
              <G key={i} clipPath={frame ? `url(#${frameClip})` : undefined}>
                <Path d={d} stroke={INK} strokeWidth={3} fill="none" />
                {paper && (
                  <G clipPath={spec.shade === 'solid' ? undefined : `url(#${shadeClip})`}>
                    <Path d={d} stroke={PAPER} strokeWidth={3} fill="none" />
                  </G>
                )}
              </G>
            );
          })}

        {/* Marks — paper ink when they sit on a shaded area. */}
        {spec.marks.map((m, i) => {
          const p = cellCenter(m.cell);
          const color = hasShade && onInk(p.x, p.y, spec.shade) ? PAPER : INK;
          return <Mark key={i} mark={m} color={color} />;
        })}
      </G>
    </Svg>
  );
});

/** Switches on spec shape — only exam figures in this star. */
export const FigureView = memo(function FigureView({
  spec,
  size = 100,
}: {
  spec: FigureSpec;
  size?: number;
}) {
  return <ExamFigure spec={spec} size={size} />;
});

const FRAME_NAMES: Record<string, string> = {
  circle: 'Circle',
  square: 'Square',
  triangle: 'Triangle',
  diamond: 'Diamond',
  hexagon: 'Hexagon',
  none: 'Figure',
};
const CELL_NAMES = [
  'top-left',
  'top-middle',
  'top-right',
  'middle-left',
  'centre',
  'middle-right',
  'bottom-left',
  'bottom-middle',
  'bottom-right',
];
const SHADE_NAMES: Record<string, string> = {
  solid: 'solidly shaded',
  left: 'left half shaded',
  right: 'right half shaded',
  top: 'top half shaded',
  bottom: 'bottom half shaded',
  stripes: 'striped',
};
const LINE_NAMES: Record<string, string> = {
  horizontal: 'a horizontal line',
  vertical: 'a vertical line',
  'diag-down': 'a diagonal line',
  'diag-up': 'a diagonal line',
  cross: 'crossed lines',
};

function describeMark(m: FigureMark): string {
  const where = CELL_NAMES[m.cell] ?? 'inside';
  if (m.kind === 'cross') return `a cross at ${where}`;
  const kind = m.kind === 'bar-h' || m.kind === 'bar-v' ? 'bar' : m.kind;
  return `${m.filled ? 'a filled' : 'an empty'} ${kind} at ${where}`;
}

/** "Circle with a filled dot at top-left, left half shaded" — accessibility. */
export function describeFigure(spec: FigureSpec): string {
  const parts: string[] = [];
  for (const m of spec.marks) parts.push(describeMark(m));
  if (spec.shade !== 'none') parts.push(SHADE_NAMES[spec.shade]);
  if (spec.lines !== 'none') parts.push(LINE_NAMES[spec.lines]);
  if (spec.gap) parts.push('an opening');
  if (parts.length === 0) return FRAME_NAMES[spec.frame];
  return `${FRAME_NAMES[spec.frame]} with ${parts.join(', ')}`;
}

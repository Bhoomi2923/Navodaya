/**
 * Content format for star kits — JSON-driven, no images.
 * Figures are exam-style black-and-white line drawings described by data
 * and drawn in code (react-native-svg).
 */

export type FrameShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'none';
export type ShadeType = 'none' | 'solid' | 'left' | 'right' | 'top' | 'bottom' | 'stripes';
export type MarkKind = 'dot' | 'ring' | 'square' | 'triangle' | 'cross' | 'bar-h' | 'bar-v';
export type LineType = 'none' | 'horizontal' | 'vertical' | 'diag-down' | 'diag-up' | 'cross';
export type Rotation = 0 | 90 | 180 | 270;

/** A small mark placed on the 3x3 grid inside the frame (0 = top-left). */
export interface FigureMark {
  cell: number;
  kind: MarkKind;
  filled: boolean;
}

/** One drawable figure — pure data, rendered by ExamFigure. */
export interface FigureSpec {
  frame: FrameShape;
  /** Outline has a small opening. */
  gap: boolean;
  shade: ShadeType;
  marks: FigureMark[];
  lines: LineType;
  rotation: Rotation;
  /** Mirrored left to right (applied before rotation). */
  mirror: boolean;
}

/** Cells a frame can hold marks in — keeps marks off the outline. */
export const ALLOWED_CELLS: Record<FrameShape, number[]> = {
  circle: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  square: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  hexagon: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  triangle: [1, 4, 6, 7, 8],
  diamond: [1, 3, 4, 5, 7],
  none: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

export type TopicId = 'odd-man-out' | 'figure-matching';

export type OddRule =
  | 'fill'
  | 'frame-shape'
  | 'mark-count'
  | 'gap'
  | 'mark-kind'
  | 'mark-position'
  | 'half-shading'
  | 'lines'
  | 'mirror';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

interface QuestionBase {
  id: string;
  schemaVersion: 1;
  locale: 'en';
  galaxy: 'mental-ability';
  starId: string;
  topic: TopicId;
  difficulty: Difficulty;
  prompt: string;
  explanation: string;
  tags: string[];
}

export interface OddOneOutQuestion extends QuestionBase {
  type: 'figure-odd-one-out';
  topic: 'odd-man-out';
  figures: [FigureSpec, FigureSpec, FigureSpec, FigureSpec];
  correctIndex: 0 | 1 | 2 | 3;
  rule: OddRule;
}

export interface FigureMatchQuestion extends QuestionBase {
  type: 'figure-match';
  topic: 'figure-matching';
  target: FigureSpec;
  options: [FigureSpec, FigureSpec, FigureSpec, FigureSpec];
  correctIndex: 0 | 1 | 2 | 3;
}

export type Question = OddOneOutQuestion | FigureMatchQuestion;

export interface TopicCount {
  topic: TopicId;
  count: number;
}

/** One page of the Space Tip — either an odd-one-out or a matching example. */
export interface TipPage {
  steps: [string, string, string];
  /** Odd-one-out example: 4 figures, one is the odd one. */
  exampleFigures?: FigureSpec[];
  highlightIndex?: number;
  /** Matching example: a target plus options to compare. */
  target?: FigureSpec;
  options?: FigureSpec[];
  correctIndex?: number;
}

export interface StarTip {
  title: string;
  pages: TipPage[];
}

export interface StarRecipe {
  mission: TopicCount[];
  game: { type: 'spot-the-odd-planet'; seconds: number };
  checkpoint: { questions: number; mix: TopicCount[]; passAt: number };
  /** Reserved for later stars; when non-empty a warm-up phase runs first. */
  reviewPool: TopicCount[];
}

export interface StarKit {
  schemaVersion: 1;
  galaxy: 'mental-ability';
  starId: string;
  starIndex: number;
  tip: StarTip;
  recipe: StarRecipe;
  questions: Question[];
}

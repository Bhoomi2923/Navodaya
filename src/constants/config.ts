/**
 * App-wide configuration.
 */

// Sample exam date — replace with the real Navodaya entrance exam date.
export const EXAM_DATE = new Date('2027-01-26T09:00:00');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days from now until the exam, clamped at 0. */
export function getDaysToExam(now: Date = new Date()): number {
  return Math.max(0, Math.ceil((EXAM_DATE.getTime() - now.getTime()) / MS_PER_DAY));
}

/** Loaded via @expo-google-fonts/outfit in src/app/_layout.tsx. */
export const FontFamily = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semiBold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extraBold: 'Outfit_800ExtraBold',
} as const;

import type { GalaxySection } from '@/constants/galaxies';

/** One stop on a galaxy's star journey. */
export interface JourneyStar {
  id: string;
  name: string;
  kind: string;
  questions: number;
}

function stars(galaxyId: GalaxySection['id'], names: string[]): JourneyStar[] {
  return names.map((name, i) => ({
    id: `${galaxyId}-${String(i + 1).padStart(2, '0')}`,
    name,
    kind: 'Practice',
    questions: 3 + (i % 3),
  }));
}

/** Placeholder 10-star journeys per galaxy — swap for real content later. */
export const JOURNEYS: Record<GalaxySection['id'], JourneyStar[]> = {
  mental: stars('mental', [
    'Pattern Planet',
    'Odd One Out',
    'Analogy Moon',
    'Series Star',
    'Mirror World',
    'Coding Comet',
    'Venn Nebula',
    'Puzzle Prime',
    'Logic Lagoon',
    'Blood Relation Belt',
  ]),
  arithmetic: stars('arithmetic', [
    'Number Nova',
    'Fraction Field',
    'Percent Planet',
    'Ratio Rings',
    'Speed Star',
    'Time Tides',
    'Profit Pulsar',
    'Average Asteroid',
    'Algebra Arc',
    'Geometry Galaxy',
  ]),
  language: stars('language', [
    'Word Wonder',
    'Synonym Sun',
    'Antonym Aurora',
    'Idiom Island',
    'Grammar Globe',
    'Spelling Spark',
    'Story Star',
    'Phrase Planet',
    'Verb Void',
    'Reading Rocket',
  ]),
};

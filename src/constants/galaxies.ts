import type { Href } from 'expo-router';

/** Shape of the SVG artwork drawn for each section. */
export type GalaxyType = 'spiral' | 'elliptical' | 'cluster';

export interface GalaxyColors {
  /** Bright core / near-white tint. */
  accent: string;
  /** Main tint used for mid-radius dots and accents. */
  primary: string;
  /** Outer / shadow tint. */
  secondary: string;
}

export interface GalaxySection {
  id: 'mental' | 'arithmetic' | 'language';
  /** Small index shown in the label, e.g. "01". */
  index: string;
  name: string;
  /** Letter-spaced caption above the name, e.g. "SPIRAL GALAXY". */
  label: string;
  type: GalaxyType;
  marks: number;
  /** Colour used for the section name text. */
  textColor: string;
  colors: GalaxyColors;
  route: Href;
}

export const GALAXIES: GalaxySection[] = [
  {
    id: 'mental',
    index: '01',
    name: 'Mental Ability',
    label: 'SPIRAL GALAXY',
    type: 'spiral',
    marks: 40,
    textColor: '#D8B4FE',
    colors: { accent: '#F5EDFF', primary: '#C084FC', secondary: '#7C3AED' },
    route: '/mental',
  },
  {
    id: 'arithmetic',
    index: '02',
    name: 'Arithmetic',
    label: 'ELLIPTICAL GALAXY',
    type: 'elliptical',
    marks: 20,
    textColor: '#FCD34D',
    colors: { accent: '#FFF7D6', primary: '#FB923C', secondary: '#F472B6' },
    route: '/arithmetic',
  },
  {
    id: 'language',
    index: '03',
    name: 'Language',
    label: 'STAR CLUSTER',
    type: 'cluster',
    marks: 20,
    textColor: '#67E8F9',
    colors: { accent: '#E0FAFF', primary: '#38BDF8', secondary: '#2563EB' },
    route: '/language',
  },
];

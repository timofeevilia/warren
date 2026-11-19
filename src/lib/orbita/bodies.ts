// One source of truth for both halves of Orbita:
// the Svelte scroll journey reads the copy and the shader "look",
// the Solid simulator reads the orbital elements.

export interface Look {
  /** 0 rocky · 1 gas · 2 star · 3 earth-like */
  kind: 0 | 1 | 2 | 3;
  colors: [string, string, string];
  atmosphere: string;
  atmospherePower: number;
  bands: number;
  scale: number;
  /** Axis roll in radians (0 = upright). */
  tilt: number;
  /** Spin speed in rad/s of wall-clock time. Purely cosmetic. */
  spin: number;
  /** On-screen radius as a fraction of viewport height. */
  size: number;
  /** Extra horizontal offset as a fraction of viewport width (pushes big bodies off-screen). */
  shift?: number;
  ring?: { inner: number; outer: number; opacity: number; color: string };
}

/** Keplerian elements at J2000 (JPL approximate elements, angles in degrees). */
export interface Orbit {
  a: number; // semi-major axis, AU
  e: number; // eccentricity
  i: number; // inclination
  L: number; // mean longitude
  peri: number; // longitude of perihelion
  node: number; // longitude of ascending node
}

export interface Body {
  id: string;
  name: string;
  kind: string;
  accent: string;
  blurb: string;
  /** Mean distance from the Sun in AU, drives the scroll odometer. */
  au: number;
  stats: [label: string, value: string][];
  look: Look;
  orbit?: Orbit;
}

export const bodies: Body[] = [
  {
    id: 'sun',
    name: 'Sun',
    kind: 'G-type star',
    accent: '#ffb454',
    blurb:
      'Everything else is a rounding error. The Sun holds 99.86% of the mass of the whole system and burns four million tonnes of itself every second.',
    au: 0,
    stats: [
      ['Diameter', '1.39 M km'],
      ['Surface', '5 772 K'],
      ['Age', '4.6 bn yr'],
      ['Share of mass', '99.86 %'],
    ],
    look: {
      kind: 2,
      colors: ['#ff7a14', '#ffd98a', '#fff6dc'],
      atmosphere: '#ff9a3c',
      atmospherePower: 1.5,
      bands: 0,
      scale: 6,
      tilt: 0.1,
      spin: 0.012,
      size: 0.56,
      shift: 0.17,
    },
  },
  {
    id: 'mercury',
    name: 'Mercury',
    kind: 'Rocky planet',
    accent: '#c9c2b8',
    blurb:
      'A scorched iron ball barely larger than the Moon. One day here lasts two of its years: the Sun rises, stalls, and takes 176 Earth days to come back.',
    au: 0.39,
    stats: [
      ['Distance from Sun', '0.39 AU'],
      ['Orbital period', '88 days'],
      ['Solar day', '176 days'],
      ['Moons', '0'],
    ],
    look: {
      kind: 0,
      colors: ['#57514b', '#958e85', '#c9c2b8'],
      atmosphere: '#b0a89c',
      atmospherePower: 0.08,
      bands: 0,
      scale: 4.5,
      tilt: 0.03,
      spin: 0.02,
      size: 0.16,
    },
    orbit: { a: 0.3871, e: 0.20563, i: 7.005, L: 252.251, peri: 77.457, node: 48.331 },
  },
  {
    id: 'venus',
    name: 'Venus',
    kind: 'Rocky planet',
    accent: '#f0dda8',
    blurb:
      'Earth’s twin, gone wrong. A runaway greenhouse keeps the surface at 464 °C under clouds of sulphuric acid, and it spins backwards.',
    au: 0.72,
    stats: [
      ['Distance from Sun', '0.72 AU'],
      ['Orbital period', '225 days'],
      ['Surface', '464 °C'],
      ['Moons', '0'],
    ],
    look: {
      kind: 1,
      colors: ['#d6ad62', '#f0dda8', '#b9843f'],
      atmosphere: '#ffd98a',
      atmospherePower: 0.9,
      bands: 2.6,
      scale: 2.2,
      tilt: -0.05,
      spin: -0.015,
      size: 0.24,
    },
    orbit: { a: 0.72333, e: 0.00677, i: 3.395, L: 181.98, peri: 131.602, node: 76.68 },
  },
  {
    id: 'earth',
    name: 'Earth',
    kind: 'Rocky planet',
    accent: '#6fa8ff',
    blurb:
      'The only place we know of where the universe looks back at itself. A thin blue film of air and water over rock, at exactly the right distance.',
    au: 1,
    stats: [
      ['Distance from Sun', '1.00 AU'],
      ['Orbital period', '365.25 days'],
      ['Day length', '24 h'],
      ['Moons', '1'],
    ],
    look: {
      kind: 3,
      colors: ['#0a2f6b', '#3c6e35', '#a89262'],
      atmosphere: '#5aa8ff',
      atmospherePower: 1.2,
      bands: 0,
      scale: 2.6,
      tilt: 0.41,
      spin: 0.03,
      size: 0.26,
    },
    orbit: { a: 1.0, e: 0.01671, i: 0.0, L: 100.464, peri: 102.937, node: 0 },
  },
  {
    id: 'mars',
    name: 'Mars',
    kind: 'Rocky planet',
    accent: '#e0704a',
    blurb:
      'A cold desert the colour of rust, with a volcano three times the height of Everest and river valleys that have been dry for three billion years.',
    au: 1.52,
    stats: [
      ['Distance from Sun', '1.52 AU'],
      ['Orbital period', '687 days'],
      ['Day length', '24 h 37 m'],
      ['Moons', '2'],
    ],
    look: {
      kind: 0,
      colors: ['#7f331d', '#c0633a', '#e0a06c'],
      atmosphere: '#ff9a6a',
      atmospherePower: 0.45,
      bands: 0,
      scale: 3.2,
      tilt: 0.44,
      spin: 0.03,
      size: 0.19,
    },
    orbit: { a: 1.52371, e: 0.09339, i: 1.85, L: -4.553, peri: -23.944, node: 49.56 },
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    kind: 'Gas giant',
    accent: '#ffb454',
    blurb:
      'A failed star with a storm older than the telescope. More than twice the mass of every other planet combined.',
    au: 5.2,
    stats: [
      ['Distance from Sun', '5.20 AU'],
      ['Orbital period', '11.86 yr'],
      ['Day length', '9 h 56 m'],
      ['Moons', '95'],
    ],
    look: {
      kind: 1,
      colors: ['#e8c9a0', '#a05c3a', '#f3e3c6'],
      atmosphere: '#ffcf9a',
      atmospherePower: 0.55,
      bands: 9,
      scale: 3.2,
      tilt: 0.05,
      spin: 0.05,
      size: 0.4,
    },
    orbit: { a: 5.20289, e: 0.04839, i: 1.304, L: 34.396, peri: 14.728, node: 100.474 },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    kind: 'Gas giant',
    accent: '#ebd9a8',
    blurb:
      'Light enough to float in a bathtub, if you could find one. Its rings span 280 000 km and are, in most places, about ten metres thick.',
    au: 9.58,
    stats: [
      ['Distance from Sun', '9.58 AU'],
      ['Orbital period', '29.45 yr'],
      ['Day length', '10 h 33 m'],
      ['Moons', '274'],
    ],
    look: {
      kind: 1,
      colors: ['#e6d3a0', '#c2a064', '#f5ebc8'],
      atmosphere: '#ffe2a8',
      atmospherePower: 0.5,
      bands: 6.5,
      scale: 2,
      tilt: 0.42,
      spin: 0.045,
      size: 0.27,
      ring: { inner: 1.25, outer: 2.3, opacity: 0.85, color: '#d9c59a' },
    },
    orbit: { a: 9.53668, e: 0.05386, i: 2.486, L: 49.954, peri: 92.599, node: 113.662 },
  },
  {
    id: 'uranus',
    name: 'Uranus',
    kind: 'Ice giant',
    accent: '#9fe0e8',
    blurb:
      'Knocked onto its side by something the size of Earth, it rolls around the Sun like a ball. Each pole gets 42 years of daylight, then 42 of night.',
    au: 19.19,
    stats: [
      ['Distance from Sun', '19.19 AU'],
      ['Orbital period', '84.0 yr'],
      ['Day length', '17 h 14 m'],
      ['Axial tilt', '97.8°'],
    ],
    look: {
      kind: 1,
      colors: ['#a6e2e6', '#8ed0d8', '#c8f2f3'],
      atmosphere: '#9fe8f0',
      atmospherePower: 0.9,
      bands: 1.6,
      scale: 1.2,
      tilt: 1.42,
      spin: 0.03,
      size: 0.25,
      ring: { inner: 1.62, outer: 1.95, opacity: 0.16, color: '#bfeff2' },
    },
    orbit: { a: 19.18916, e: 0.04726, i: 0.773, L: 313.238, peri: 170.954, node: 74.017 },
  },
  {
    id: 'neptune',
    name: 'Neptune',
    kind: 'Ice giant',
    accent: '#5b7cff',
    blurb:
      'Found with a pencil before it was seen through a lens. Out here sunlight is 900 times weaker, and the winds still reach 2 000 km/h.',
    au: 30.07,
    stats: [
      ['Distance from Sun', '30.07 AU'],
      ['Orbital period', '164.8 yr'],
      ['Day length', '16 h 6 m'],
      ['Moons', '16'],
    ],
    look: {
      kind: 1,
      colors: ['#2c4ccc', '#182a8e', '#6f9bff'],
      atmosphere: '#5b8cff',
      atmospherePower: 1.0,
      bands: 4.5,
      scale: 2.4,
      tilt: 0.49,
      spin: 0.035,
      size: 0.24,
    },
    orbit: { a: 30.06992, e: 0.00859, i: 1.77, L: -55.12, peri: 44.965, node: 131.784 },
  },
];

export const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

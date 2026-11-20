export type ExperimentId = 'orbita' | 'pulse' | 'synesthesia' | 'atelier';

export interface Experiment {
  id: ExperimentId;
  number: string;
  title: string;
  description: string;
  tags: string;
  accent: string;
  href: string | null; // null = not built yet
}

export const experiments: Experiment[] = [
  {
    id: 'orbita',
    number: '01',
    title: 'Orbita',
    description:
      'A cinematic atlas of the Solar System. Scroll from the Sun to Neptune, then bend time in a live orbit simulator.',
    tags: 'Svelte × Solid · WebGL',
    accent: 'var(--color-accent-orbita)',
    href: '/orbita/',
  },
  {
    id: 'pulse',
    number: '02',
    title: 'Pulse',
    description:
      "The planet's magnetic pulse, live. Watch the aurora ovals breathe as the solar wind arrives from the Sun.",
    tags: 'Svelte × Solid · Live NOAA data',
    accent: 'var(--color-accent-pulse)',
    href: '/pulse/',
  },
  {
    id: 'synesthesia',
    number: '03',
    title: 'Synesthesia',
    description:
      'An instrument you can see. Play the keys or sing into the mic and watch sound become colour and shape.',
    tags: 'Svelte × Solid · Web Audio',
    accent: 'var(--color-accent-synesthesia)',
    href: '/synesthesia/',
  },
  {
    id: 'atelier',
    number: '04',
    title: 'Atelier',
    description:
      "A watchmaker that doesn't exist, selling a watch you'll want anyway. Build yours down to the engraving.",
    tags: 'Svelte × Solid · Configurator',
    accent: 'var(--color-accent-atelier)',
    href: '/atelier/',
  },
];

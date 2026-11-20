// Everything about the (fictional) Terrier 38: the options, what they cost, and the
// two pieces of shared state the page runs on.
//   config — which watch is being built. Written by the Solid configurator and by the
//            Svelte story (the materials chapter), read by the Solid watch.
//   view   — how the watch should be posed. Written by whichever section is on screen.

import { createStore } from '../store';

export interface Option<Id extends string = string> {
  id: Id;
  name: string;
  note?: string;
  price: number;
  /** Colours used to draw it. */
  colors: string[];
}

// Four stops of a brushed-metal gradient: highlight, mid, shadow, rim light.
export const metals = [
  { id: 'steel', name: 'Steel', note: '316L, brushed', price: 0, colors: ['#f6f7f8', '#b7bcc2', '#7b8188', '#e3e6ea'] },
  { id: 'black', name: 'Black', note: 'DLC-coated steel', price: 250, colors: ['#56585d', '#1e1f22', '#0b0c0d', '#3e4045'] },
  { id: 'bronze', name: 'Bronze', note: 'Will darken with wear', price: 400, colors: ['#e8c296', '#ab763f', '#6c431f', '#d6a676'] },
  { id: 'gold', name: 'Rose gold', note: '18 carat', price: 6200, colors: ['#fbe0c4', '#dba679', '#a26c45', '#f3cda8'] },
] as const satisfies readonly Option[];

// Dial colour, then the colour of everything printed on it.
export const dials = [
  { id: 'ivory', name: 'Ivory', price: 0, colors: ['#efe6d3', '#1c1a16'] },
  { id: 'midnight', name: 'Midnight', price: 0, colors: ['#15244a', '#f2ede2'] },
  { id: 'forest', name: 'Forest', price: 0, colors: ['#173a2d', '#f2ede2'] },
  { id: 'salmon', name: 'Salmon', price: 120, colors: ['#e3a78c', '#2a1a14'] },
  { id: 'onyx', name: 'Onyx', price: 0, colors: ['#131315', '#f2ede2'] },
] as const satisfies readonly Option[];

export const hands = [
  { id: 'dauphine', name: 'Dauphine', note: 'Faceted', price: 0, colors: [] },
  { id: 'leaf', name: 'Leaf', note: 'Curved', price: 0, colors: [] },
  { id: 'baton', name: 'Baton', note: 'Straight, with lume', price: 0, colors: [] },
] as const satisfies readonly Option[];

export const complications = [
  { id: 'none', name: 'Time only', price: 0, colors: [] },
  { id: 'date', name: 'Date', note: 'At three', price: 180, colors: [] },
  { id: 'seconds', name: 'Small seconds', note: 'At six', price: 320, colors: [] },
] as const satisfies readonly Option[];

export const straps = [
  { id: 'tan', name: 'Tan leather', price: 0, colors: ['#b0763f', '#8a5a2e'] },
  { id: 'black', name: 'Black leather', price: 0, colors: ['#26231f', '#141210'] },
  { id: 'green', name: 'Green leather', price: 0, colors: ['#2f4a39', '#1f3327'] },
  { id: 'rubber', name: 'Rubber', note: 'Ribbed, waterproof', price: 0, colors: ['#2b2c30', '#18191c'] },
  { id: 'bracelet', name: 'Bracelet', note: 'In the case metal', price: 350, colors: [] },
] as const satisfies readonly Option[];

export const sizes = [36, 38, 40] as const;

export interface Config {
  metal: (typeof metals)[number]['id'];
  dial: (typeof dials)[number]['id'];
  hands: (typeof hands)[number]['id'];
  comp: (typeof complications)[number]['id'];
  strap: (typeof straps)[number]['id'];
  size: (typeof sizes)[number];
  engraving: string;
}

export const BASE_PRICE = 2400;
export const ENGRAVING_PRICE = 90;
export const ENGRAVING_MAX = 22;

export const defaults: Config = {
  metal: 'steel',
  dial: 'midnight',
  hands: 'dauphine',
  comp: 'date',
  strap: 'tan',
  size: 38,
  engraving: '',
};

const find = <T extends { id: string }>(list: readonly T[], id: string) => list.find((item) => item.id === id) ?? list[0];
export const pick = (c: Config) => ({
  metal: find(metals, c.metal),
  dial: find(dials, c.dial),
  hands: find(hands, c.hands),
  comp: find(complications, c.comp),
  strap: find(straps, c.strap),
});

export function priceOf(c: Config) {
  const p = pick(c);
  return (
    BASE_PRICE + p.metal.price + p.dial.price + p.hands.price + p.comp.price + p.strap.price +
    (c.engraving.trim() ? ENGRAVING_PRICE : 0)
  );
}

/** A catalogue-style reference, e.g. TR38-ST-MID-D-TAN. */
export function referenceOf(c: Config) {
  const code = (id: string, n: number) => id.slice(0, n).toUpperCase();
  const comp = c.comp === 'none' ? 'T' : c.comp === 'date' ? 'D' : 'S';
  return `TR${c.size}-${code(c.metal, 2)}-${code(c.dial, 3)}-${comp}-${code(c.strap, 3)}`;
}

// --- The configuration lives in the URL, so a link is a watch ---------------------------
export function encode(c: Config) {
  const parts = [c.metal, c.dial, c.hands, c.comp, c.strap, String(c.size)];
  if (c.engraving.trim()) parts.push(encodeURIComponent(c.engraving.trim()));
  return parts.join('.');
}

export function decode(text: string): Config {
  const [metal, dial, hand, comp, strap, size, engraving] = text.split('.');
  const has = <T extends { id: string }>(list: readonly T[], id: string | undefined) => list.some((item) => item.id === id);
  let words = '';
  try {
    words = decodeURIComponent(engraving ?? '').slice(0, ENGRAVING_MAX);
  } catch {
    // A mangled link just loses its engraving.
  }
  return {
    metal: has(metals, metal) ? (metal as Config['metal']) : defaults.metal,
    dial: has(dials, dial) ? (dial as Config['dial']) : defaults.dial,
    hands: has(hands, hand) ? (hand as Config['hands']) : defaults.hands,
    comp: has(complications, comp) ? (comp as Config['comp']) : defaults.comp,
    strap: has(straps, strap) ? (strap as Config['strap']) : defaults.strap,
    size: sizes.includes(Number(size) as Config['size']) ? (Number(size) as Config['size']) : defaults.size,
    engraving: words,
  };
}

export const config = createStore<Config>({ ...defaults });

/** How the watch is posed on its stage. */
export type View = 'hero' | 'dial' | 'movement' | 'metal' | 'build' | 'engrave';
export const view = createStore<View>('hero');

export const euros = (amount: number) => '€ ' + Math.round(amount).toLocaleString('en').replace(/,/g, ' ');

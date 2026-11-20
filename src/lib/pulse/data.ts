// Live space-weather data from NOAA's Space Weather Prediction Center.
// Public domain, no key, CORS-enabled — the browser talks to NOAA directly.

import { createStore } from '../store';

const BASE = 'https://services.swpc.noaa.gov';
export const GRID_W = 360;
export const GRID_H = 181;

export interface Aurora {
  observed: Date;
  forecast: Date;
  /** Probability (0..100) of visible aurora overhead; index = (lat + 90) * 360 + lon. */
  grid: Uint8Array;
  peak: number;
}
export interface WindSample {
  time: number;
  speed: number; // km/s
  density: number; // protons per cm³
  bz: number; // nT, north-south component of the interplanetary magnetic field
}
export interface KpSample {
  time: number;
  kp: number;
  predicted: boolean;
}
export type Status = 'loading' | 'live' | 'snapshot' | 'offline';

export const aurora = createStore<Aurora | null>(null);
export const wind = createStore<WindSample[]>([]);
export const kp = createStore<KpSample[]>([]);
export const status = createStore<Status>('loading');

/** Where the globe should look. Written by the Svelte story, read by the Solid globe. */
export interface View {
  lat: number;
  /** A fixed longitude, or follow the midnight / noon meridian as the Earth turns. */
  lon: number | 'night' | 'day';
  marker?: { lat: number; lon: number; name: string } | null;
}
export const view = createStore<View>({ lat: 58, lon: 'night' });

type RawOvation = { 'Observation Time': string; 'Forecast Time': string; coordinates: [number, number, number][] };
type RawWind = (string | number | null)[][];
type RawKp = { time_tag: string; kp: number; observed: string }[];

function parseOvation(raw: RawOvation): Aurora {
  const grid = new Uint8Array(GRID_W * GRID_H);
  let peak = 0;
  for (const [lon, lat, value] of raw.coordinates) {
    grid[(lat + 90) * GRID_W + (lon % 360)] = value;
    if (value > peak) peak = value;
  }
  return { observed: new Date(raw['Observation Time']), forecast: new Date(raw['Forecast Time']), grid, peak };
}

function parseWind(raw: RawWind): WindSample[] {
  const head = raw[0] as string[];
  const col = (name: string) => head.indexOf(name);
  const [t, speed, density, bz] = [col('time_tag'), col('speed'), col('density'), col('bz')];
  return raw
    .slice(1)
    .filter((row) => row[speed] !== null && row[bz] !== null)
    .map((row) => ({
      time: Date.parse(row[t] as string),
      speed: row[speed] as number,
      density: (row[density] as number) ?? 0,
      bz: row[bz] as number,
    }));
}

const parseKp = (raw: RawKp): KpSample[] =>
  raw.map((row) => ({
    time: Date.parse(row.time_tag + 'Z'),
    kp: row.kp,
    predicted: row.observed === 'predicted',
  }));

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function refreshAurora() {
  aurora.set(parseOvation(await getJson<RawOvation>(`${BASE}/json/ovation_aurora_latest.json`)));
}
async function refreshWind() {
  wind.set(parseWind(await getJson<RawWind>(`${BASE}/products/geospace/propagated-solar-wind-1-hour.json`)));
}
async function refreshKp() {
  kp.set(parseKp(await getJson<RawKp>(`${BASE}/products/noaa-planetary-k-index-forecast.json`)));
}

/** Falls back to the copy saved at build time, so the page is never empty. */
async function loadSnapshot() {
  const snap = await getJson<{
    ovation: { observed: string; forecast: string; grid: string };
    wind: RawWind;
    kp: RawKp;
  }>('/pulse/snapshot.json');
  const bytes = Uint8Array.from(atob(snap.ovation.grid), (c) => c.charCodeAt(0));
  let peak = 0;
  for (const value of bytes) if (value > peak) peak = value;
  aurora.set({
    observed: new Date(snap.ovation.observed),
    forecast: new Date(snap.ovation.forecast),
    grid: bytes,
    peak,
  });
  wind.set(parseWind(snap.wind));
  kp.set(parseKp(snap.kp));
}

let started = false;
/** Starts polling. Safe to call from every island; only the first call does anything. */
export function start() {
  if (started) return;
  started = true;
  const quiet = (job: () => Promise<void>) => () => job().catch(() => {});
  Promise.all([refreshAurora(), refreshWind(), refreshKp()])
    .then(() => status.set('live'))
    .catch(() =>
      loadSnapshot()
        .then(() => status.set('snapshot'))
        .catch(() => status.set('offline')),
    );
  // NOAA republishes the aurora model about every 5 minutes and the wind every minute.
  setInterval(quiet(refreshAurora), 5 * 60_000);
  setInterval(quiet(refreshWind), 60_000);
  setInterval(quiet(refreshKp), 15 * 60_000);
}

/** Aurora probability (0..100) above a point on the ground. */
export function probabilityAt(data: Aurora, lat: number, lon: number) {
  const row = Math.round(Math.max(-90, Math.min(90, lat))) + 90;
  const column = ((Math.round(lon) % 360) + 360) % 360;
  return data.grid[row * GRID_W + column];
}

/** The point on Earth where the Sun is directly overhead right now (degrees). */
export function subsolarPoint(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86_400_000;
  const lat = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
  // Equation of time: the Sun runs up to ~16 minutes fast or slow against the clock.
  const b = ((2 * Math.PI) / 364) * (day - 81);
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let lon = -15 * (hours - 12 + eot / 60);
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat, lon };
}

export const kpLabel = (value: number) =>
  value >= 9 ? 'Extreme storm · G5'
  : value >= 8 ? 'Severe storm · G4'
  : value >= 7 ? 'Strong storm · G3'
  : value >= 6 ? 'Moderate storm · G2'
  : value >= 5 ? 'Minor storm · G1'
  : value >= 4 ? 'Active'
  : value >= 3 ? 'Unsettled'
  : 'Quiet';

export const places = [
  { name: 'Tromsø', country: 'Norway', lat: 69.65, lon: 18.96 },
  { name: 'Murmansk', country: 'Russia', lat: 68.97, lon: 33.07 },
  { name: 'Reykjavík', country: 'Iceland', lat: 64.15, lon: -21.94 },
  { name: 'Fairbanks', country: 'Alaska', lat: 64.84, lon: -147.72 },
  { name: 'Yellowknife', country: 'Canada', lat: 62.45, lon: -114.37 },
  { name: 'Nuuk', country: 'Greenland', lat: 64.18, lon: -51.72 },
  { name: 'Ushuaia', country: 'Argentina', lat: -54.8, lon: -68.3 },
  { name: 'Hobart', country: 'Tasmania', lat: -42.88, lon: 147.33 },
];

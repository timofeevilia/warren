// Saves a compact copy of the NOAA feeds next to the site, so the page still has
// something real to show if NOAA is unreachable from the visitor's browser.
// Runs before every build; if NOAA can't be reached here, the previous snapshot is kept.
import { writeFileSync } from 'node:fs';

const BASE = 'https://services.swpc.noaa.gov';
const get = async (path) => {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

try {
  const [ovation, wind, kp] = await Promise.all([
    get('/json/ovation_aurora_latest.json'),
    get('/products/geospace/propagated-solar-wind-1-hour.json'),
    get('/products/noaa-planetary-k-index-forecast.json'),
  ]);
  // 360 x 181 probabilities (0..100) packed one byte each, row = latitude from -90.
  const grid = new Uint8Array(360 * 181);
  for (const [lon, lat, value] of ovation.coordinates) grid[(lat + 90) * 360 + (lon % 360)] = value;
  const snapshot = {
    saved: new Date().toISOString(),
    ovation: {
      observed: ovation['Observation Time'],
      forecast: ovation['Forecast Time'],
      grid: Buffer.from(grid).toString('base64'),
    },
    wind,
    kp,
  };
  writeFileSync('public/pulse/snapshot.json', JSON.stringify(snapshot));
  console.log(`snapshot saved (${ovation['Observation Time']})`);
} catch (error) {
  console.warn(`snapshot not refreshed: ${error.message}`);
}

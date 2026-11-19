// Two-body orbital mechanics, just enough to place everything on a given date.
// Time is measured in days since J2000 (2000-01-01 12:00 UTC).

import type { Orbit } from './bodies';

const DEG = Math.PI / 180;
export const J2000_MS = Date.UTC(2000, 0, 1, 12);
export const DAY_MS = 86_400_000;

export const daysSinceJ2000 = (ms: number) => (ms - J2000_MS) / DAY_MS;
export const dateFromDays = (days: number) => new Date(J2000_MS + days * DAY_MS);

/**
 * An orbit baked into the form the render loop wants: position = x'·P + y'·Q,
 * where (x', y') is the position inside the orbital plane and P, Q are that
 * plane's axes expressed in ecliptic coordinates. Baking the three rotations
 * once means the hot loop is a Kepler solve plus six multiplications per body.
 */
export const STRIDE = 10; // a, e, M0, n, Px, Py, Pz, Qx, Qy, Qz

export function bake(out: Float32Array, index: number, o: Orbit) {
  const w = (o.peri - o.node) * DEG; // argument of perihelion
  const node = o.node * DEG;
  const inc = o.i * DEG;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  const k = index * STRIDE;
  out[k] = o.a;
  out[k + 1] = o.e;
  out[k + 2] = (o.L - o.peri) * DEG; // mean anomaly at J2000
  out[k + 3] = (2 * Math.PI) / (Math.pow(o.a, 1.5) * 365.25); // mean motion, rad/day (Kepler III)
  out[k + 4] = cw * cn - sw * sn * ci;
  out[k + 5] = cw * sn + sw * cn * ci;
  out[k + 6] = sw * si;
  out[k + 7] = -sw * cn - cw * sn * ci;
  out[k + 8] = -sw * sn + cw * cn * ci;
  out[k + 9] = cw * si;
}

/** Solve Kepler's equation M = E − e·sin E by Newton's method. */
export function eccentricAnomaly(M: number, e: number) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 6; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-6) break;
  }
  return E;
}

/** Positions (AU, ecliptic) of `count` baked orbits at time `days`. */
export function propagate(elements: Float32Array, count: number, days: number, out: Float32Array) {
  const TAU = Math.PI * 2;
  for (let b = 0; b < count; b++) {
    const k = b * STRIDE;
    const a = elements[k];
    const e = elements[k + 1];
    let M = (elements[k + 2] + elements[k + 3] * days) % TAU;
    if (M > Math.PI) M -= TAU;
    else if (M < -Math.PI) M += TAU;
    const E = eccentricAnomaly(M, e);
    const x = a * (Math.cos(E) - e);
    const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const o = b * 3;
    out[o] = x * elements[k + 4] + y * elements[k + 7];
    out[o + 1] = x * elements[k + 5] + y * elements[k + 8];
    out[o + 2] = x * elements[k + 6] + y * elements[k + 9];
  }
}

/** Orbital speed in km/s from the vis-viva equation (r and a in AU). */
export const orbitalSpeed = (r: number, a: number) => 29.7847 * Math.sqrt(2 / r - 1 / a);

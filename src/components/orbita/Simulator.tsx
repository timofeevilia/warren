// The orbit simulator. Solid owns this page.
//
// The split that makes it fast: the simulation itself lives in plain typed arrays
// and a canvas, outside of any framework. Solid signals are used only for the
// handful of values a human reads (date, speed, the selected body's telemetry).
// When a signal changes, Solid updates that one text node — no component re-runs,
// no diffing — so the HUD can refresh every frame without costing the frame.

import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { bodies, type Orbit } from '../../lib/orbita/bodies';
import {
  bake,
  dateFromDays,
  daysSinceJ2000,
  orbitalSpeed,
  propagate,
  STRIDE,
} from '../../lib/orbita/kepler';
import './simulator.css';

interface Major {
  name: string;
  color: string;
  size: number; // dot radius in px
  orbit: Orbit;
  comet?: boolean;
}

const majors: Major[] = [
  ...bodies
    .filter((b) => b.orbit)
    .map((b) => ({
      name: b.name,
      color: b.accent,
      size: 2.5 + Math.sqrt(b.look.size) * 7,
      orbit: b.orbit!,
    })),
  {
    // 1P/Halley. Retrograde (i > 90°), last perihelion 9 Feb 1986, next one in July 2061.
    name: 'Halley',
    color: '#c8f2ff',
    size: 3,
    comet: true,
    orbit: { a: 17.834, e: 0.96714, i: 162.26, L: 236.15, peri: 169.75, node: 58.42 },
  },
];

const ASTEROIDS = 4200;
const TROJANS = 500;
const KUIPER = 900;
const MINOR = ASTEROIDS + TROJANS + KUIPER;
const ORBIT_STEPS = 128;
const TAU = Math.PI * 2;

// Deterministic PRNG so the belt looks the same on every visit.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMinorBodies() {
  const rnd = mulberry32(1986);
  const elements = new Float32Array(MINOR * STRIDE);
  // Kirkwood gaps: orbits in resonance with Jupiter get cleared out. Skipping
  // these radii is what makes the belt look like the real one rather than a donut.
  const gaps = [2.502, 2.825, 2.958];
  let n = 0;
  while (n < ASTEROIDS) {
    const a = 2.1 + rnd() * 1.2;
    if (gaps.some((g) => Math.abs(a - g) < 0.03)) continue;
    bake(elements, n++, {
      a,
      e: rnd() * rnd() * 0.3,
      i: rnd() * rnd() * 22,
      L: rnd() * 360,
      peri: rnd() * 360,
      node: rnd() * 360,
    });
  }
  // Trojans share Jupiter's orbit, clustered 60° ahead of and behind the planet.
  const jupiter = bodies.find((b) => b.id === 'jupiter')!.orbit!;
  for (let k = 0; k < TROJANS; k++) {
    const camp = k % 2 ? 60 : -60;
    bake(elements, n++, {
      a: jupiter.a + (rnd() - 0.5) * 0.25,
      e: rnd() * 0.1,
      i: rnd() * rnd() * 25,
      L: jupiter.L + camp + (rnd() + rnd() - 1) * 22,
      peri: rnd() * 360,
      node: rnd() * 360,
    });
  }
  for (let k = 0; k < KUIPER; k++) {
    bake(elements, n++, {
      a: 39 + rnd() * 9,
      e: rnd() * 0.15,
      i: rnd() * rnd() * 20,
      L: rnd() * 360,
      peri: rnd() * 360,
      node: rnd() * 360,
    });
  }
  return elements;
}

/** Slider position (0..1) → simulated days per real second, on a log scale. */
const warpToDays = (w: number) => Math.pow(10, -1 + w * 4.4);

function formatWarp(days: number) {
  if (days < 1) return `${(days * 24).toFixed(1)} hours / s`;
  if (days < 60) return `${days.toFixed(1)} days / s`;
  if (days < 365.25) return `${(days / 30.44).toFixed(1)} months / s`;
  return `${(days / 365.25).toFixed(1)} years / s`;
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function Simulator() {
  let canvas!: HTMLCanvasElement;

  const [dateLabel, setDateLabel] = createSignal('');
  const [warp, setWarp] = createSignal(0.5);
  const [direction, setDirection] = createSignal(1);
  const [paused, setPaused] = createSignal(false);
  const [frameMs, setFrameMs] = createSignal(0);
  const [selected, setSelected] = createSignal<number | null>(null);
  const [distance, setDistance] = createSignal(0);
  const [speed, setSpeed] = createSignal(0);
  const [panelOpen, setPanelOpen] = createSignal(true);

  const daysPerSecond = createMemo(() => warpToDays(warp()));
  const selectedBody = createMemo(() => {
    const index = selected();
    return index === null ? null : majors[index];
  });

  // --- Simulation state: deliberately not reactive ---------------------------------
  let simDays = daysSinceJ2000(Date.now());
  const camera = { yaw: 0.6, pitch: 0.95, zoom: 60, zoomGoal: 60, tx: 0, ty: 0, tz: 0 };
  let resetView = () => {};
  let jumpToToday = () => {
    simDays = daysSinceJ2000(Date.now());
  };

  onMount(() => {
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const majorElements = new Float32Array(majors.length * STRIDE);
    majors.forEach((m, i) => bake(majorElements, i, m.orbit));
    const majorPos = new Float32Array(majors.length * 3);
    const minorElements = buildMinorBodies();
    const minorPos = new Float32Array(MINOR * 3);
    const screen = new Float32Array(majors.length * 2);

    // Each orbit's outline, sampled once in 3D; only projected per frame.
    const outlines = majors.map((_, index) => {
      const points = new Float32Array(ORBIT_STEPS * 3);
      const k = index * STRIDE;
      const a = majorElements[k];
      const e = majorElements[k + 1];
      for (let s = 0; s < ORBIT_STEPS; s++) {
        const E = (s / ORBIT_STEPS) * TAU;
        const x = a * (Math.cos(E) - e);
        const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
        points[s * 3] = x * majorElements[k + 4] + y * majorElements[k + 7];
        points[s * 3 + 1] = x * majorElements[k + 5] + y * majorElements[k + 8];
        points[s * 3 + 2] = x * majorElements[k + 6] + y * majorElements[k + 9];
      }
      return points;
    });

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    let frameAvg = 0;
    let hudClock = 0;
    let lastDay = NaN;

    const fitZoom = (au: number) => (Math.min(width, height) * 0.42) / au;
    resetView = () => {
      setSelected(null);
      camera.yaw = 0.6;
      camera.pitch = 0.95;
      camera.zoomGoal = fitZoom(6.2);
    };

    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    // Orthographic camera: spin around the ecliptic pole (yaw), then tip (pitch).
    let cosY = 1;
    let sinY = 0;
    let sinP = 1;
    let cosP = 0;
    let originX = 0;
    let originY = 0;
    const projectX = (x: number, y: number) => originX + (x * cosY - y * sinY) * camera.zoom;
    const projectY = (x: number, y: number, z: number) =>
      originY - ((x * sinY + y * cosY) * sinP + z * cosP) * camera.zoom;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t0 = performance.now();

      if (!paused()) simDays += dt * daysPerSecond() * direction();
      propagate(majorElements, majors.length, simDays, majorPos);
      propagate(minorElements, MINOR, simDays, minorPos);

      // Camera: ease zoom, and ease the look-at point toward the followed body.
      camera.zoom += (camera.zoomGoal - camera.zoom) * 0.12;
      const follow = selected();
      const gx = follow === null ? 0 : majorPos[follow * 3];
      const gy = follow === null ? 0 : majorPos[follow * 3 + 1];
      const gz = follow === null ? 0 : majorPos[follow * 3 + 2];
      camera.tx += (gx - camera.tx) * 0.1;
      camera.ty += (gy - camera.ty) * 0.1;
      camera.tz += (gz - camera.tz) * 0.1;
      cosY = Math.cos(camera.yaw);
      sinY = Math.sin(camera.yaw);
      sinP = Math.sin(camera.pitch);
      cosP = Math.cos(camera.pitch);
      originX = 0;
      originY = 0;
      const ox = projectX(camera.tx, camera.ty);
      const oy = projectY(camera.tx, camera.ty, camera.tz);
      originX = width / 2 - ox;
      originY = height / 2 - oy;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#07070b';
      ctx.fillRect(0, 0, width, height);

      // Sun
      const sx = projectX(0, 0);
      const sy = projectY(0, 0, 0);
      const glowR = Math.max(40, camera.zoom * 0.9);
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      glow.addColorStop(0, 'rgba(255, 242, 208, 1)');
      glow.addColorStop(0.08, 'rgba(255, 180, 84, 0.75)');
      glow.addColorStop(0.35, 'rgba(255, 180, 84, 0.12)');
      glow.addColorStop(1, 'rgba(255, 180, 84, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);

      // Orbit outlines
      ctx.lineWidth = 1;
      for (let m = 0; m < majors.length; m++) {
        const pts = outlines[m];
        ctx.beginPath();
        for (let s = 0; s <= ORBIT_STEPS; s++) {
          const k = (s % ORBIT_STEPS) * 3;
          const x = projectX(pts[k], pts[k + 1]);
          const y = projectY(pts[k], pts[k + 1], pts[k + 2]);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        if (m === follow) {
          ctx.strokeStyle = majors[m].color;
          ctx.globalAlpha = 0.7;
        } else {
          ctx.strokeStyle = majors[m].comet ? 'rgba(200, 242, 255, 0.16)' : 'rgba(237, 235, 230, 0.13)';
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Minor bodies: three batches so fillStyle changes only three times.
      const dot = camera.zoom > 120 ? 1.6 : 1.15;
      const batches: [number, number, string][] = [
        [0, ASTEROIDS, 'rgba(237, 235, 230, 0.42)'],
        [ASTEROIDS, ASTEROIDS + TROJANS, 'rgba(255, 180, 84, 0.5)'],
        [ASTEROIDS + TROJANS, MINOR, 'rgba(140, 170, 255, 0.4)'],
      ];
      for (const [from, to, style] of batches) {
        ctx.fillStyle = style;
        for (let b = from; b < to; b++) {
          const k = b * 3;
          const x = projectX(minorPos[k], minorPos[k + 1]);
          if (x < 0 || x > width) continue;
          const y = projectY(minorPos[k], minorPos[k + 1], minorPos[k + 2]);
          if (y < 0 || y > height) continue;
          ctx.fillRect(x, y, dot, dot);
        }
      }

      // Planets, comet, labels
      ctx.font = '11px "Geist Mono Variable", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      for (let m = 0; m < majors.length; m++) {
        const k = m * 3;
        const body = majors[m];
        const x = projectX(majorPos[k], majorPos[k + 1]);
        const y = projectY(majorPos[k], majorPos[k + 1], majorPos[k + 2]);
        screen[m * 2] = x;
        screen[m * 2 + 1] = y;
        if (body.comet) {
          // The tail always points away from the Sun and grows near perihelion.
          const r = Math.hypot(majorPos[k], majorPos[k + 1], majorPos[k + 2]);
          const dx = x - sx;
          const dy = y - sy;
          const len = Math.hypot(dx, dy) || 1;
          const tail = Math.min(140, (camera.zoom * 1.6) / Math.max(r, 0.5));
          const grad = ctx.createLinearGradient(x, y, x + (dx / len) * tail, y + (dy / len) * tail);
          grad.addColorStop(0, 'rgba(200, 242, 255, 0.8)');
          grad.addColorStop(1, 'rgba(200, 242, 255, 0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (dx / len) * tail, y + (dy / len) * tail);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        ctx.fillStyle = body.color;
        ctx.beginPath();
        ctx.arc(x, y, body.size, 0, TAU);
        ctx.fill();
        if (m === follow) {
          ctx.strokeStyle = body.color;
          ctx.beginPath();
          ctx.arc(x, y, body.size + 7, 0, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = m === follow ? '#edebe6' : 'rgba(237, 235, 230, 0.6)';
        ctx.fillText(body.name.toUpperCase(), x + body.size + 8, y);
      }

      // --- HUD: push fresh values into signals --------------------------------------
      const day = Math.floor(simDays);
      if (day !== lastDay) {
        lastDay = day;
        const d = dateFromDays(simDays);
        setDateLabel(`${d.getUTCFullYear()} · ${pad(d.getUTCMonth() + 1)} · ${pad(d.getUTCDate())}`);
      }
      if (follow !== null) {
        const k = follow * 3;
        const r = Math.hypot(majorPos[k], majorPos[k + 1], majorPos[k + 2]);
        setDistance(r);
        setSpeed(orbitalSpeed(r, majors[follow].orbit.a));
      }
      frameAvg += (performance.now() - t0 - frameAvg) * 0.1;
      hudClock += dt;
      if (hudClock > 0.25) {
        hudClock = 0;
        setFrameMs(frameAvg);
      }
    };

    // --- Input ------------------------------------------------------------------------
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      pinch = 0;
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const spread = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) camera.zoomGoal = clampZoom(camera.zoomGoal * (spread / pinch));
        pinch = spread;
        moved = 99;
        return;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      camera.yaw -= dx * 0.006;
      camera.pitch = Math.max(0.12, Math.min(Math.PI / 2, camera.pitch + dy * 0.005));
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = 0;
      if (moved > 6) return;
      // A click without a drag: pick the nearest body, or let go of the current one.
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      let best = -1;
      let bestDist = 24;
      for (let m = 0; m < majors.length; m++) {
        const dist = Math.hypot(screen[m * 2] - px, screen[m * 2 + 1] - py);
        if (dist < bestDist) {
          bestDist = dist;
          best = m;
        }
      }
      setSelected(best < 0 ? null : best);
    };
    const clampZoom = (z: number) => Math.max(3, Math.min(1400, z));
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.zoomGoal = clampZoom(camera.zoomGoal * Math.exp(-e.deltaY * 0.0015));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };

    resize();
    camera.zoom = camera.zoomGoal = fitZoom(6.2);
    if (width < 700) setPanelOpen(false);
    addEventListener('resize', resize);
    addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    raf = requestAnimationFrame(frame);

    onCleanup(() => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('keydown', onKey);
    });
  });

  const zoomTo = (au: number) => {
    setSelected(null);
    camera.zoomGoal = (Math.min(innerWidth, innerHeight) * 0.42) / au;
  };

  return (
    <div class="sim">
      <canvas ref={canvas} class="sim-canvas" />

      <header class="sim-nav">
        <a href="/orbita/" class="label-md muted">
          ← Orbita
        </a>
        <span class="label-md">Orbita / Simulator</span>
        <button class="label-md sim-toggle" onClick={() => setPanelOpen((open) => !open)}>
          {panelOpen() ? 'Hide panel' : 'Show panel'}
        </button>
      </header>

      <Show when={panelOpen()}>
        <aside class="sim-panel">
          <p class="label-md sim-accent">Simulation</p>

          <div class="sim-stat">
            <span class="label-sm muted">Date</span>
            <span class="data-lg">{dateLabel()}</span>
          </div>

          <div class="sim-stat">
            <span class="label-sm muted">Time warp</span>
            <span class="data-lg">
              {direction() < 0 ? '− ' : ''}
              {formatWarp(daysPerSecond())}
            </span>
            <input
              class="sim-slider"
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={warp()}
              aria-label="Time warp"
              style={{ '--fill': `${warp() * 100}%` }}
              onInput={(e) => setWarp(e.currentTarget.valueAsNumber)}
            />
          </div>

          <div class="sim-buttons">
            <button class="label-sm" onClick={() => setPaused((p) => !p)}>
              {paused() ? '▶ Play' : '❙❙ Pause'}
            </button>
            <button class="label-sm" onClick={() => setDirection((d) => -d)}>
              ⇄ Reverse
            </button>
            <button class="label-sm" onClick={() => jumpToToday()}>
              ◎ Today
            </button>
          </div>

          <div class="sim-row">
            <div class="sim-stat">
              <span class="label-sm muted">Bodies</span>
              <span class="data-lg">{(MINOR + majors.length + 1).toLocaleString('en').replace(',', ' ')}</span>
            </div>
            <div class="sim-stat">
              <span class="label-sm muted">Frame</span>
              <span class="data-lg">{frameMs().toFixed(1)} ms</span>
            </div>
          </div>

          <div class="sim-stat">
            <span class="label-sm muted">View</span>
            <div class="sim-buttons">
              <button class="label-sm" onClick={() => zoomTo(2)}>
                Inner
              </button>
              <button class="label-sm" onClick={() => resetView()}>
                Belt
              </button>
              <button class="label-sm" onClick={() => zoomTo(34)}>
                Outer
              </button>
              <button class="label-sm" onClick={() => zoomTo(52)}>
                Kuiper
              </button>
            </div>
          </div>

          <div class="sim-stat">
            <span class="label-sm muted">Follow</span>
            <div class="sim-chips">
              <For each={majors}>
                {(body, index) => (
                  <button
                    class="label-sm"
                    classList={{ current: selected() === index() }}
                    style={{ '--accent': body.color }}
                    onClick={() => setSelected(selected() === index() ? null : index())}
                  >
                    {body.name}
                  </button>
                )}
              </For>
            </div>
          </div>

          <Show when={selectedBody()}>
            {(body) => (
              <div class="sim-selected" style={{ '--accent': body().color }}>
                <p class="display-md">{body().name}</p>
                <div class="sim-row">
                  <div class="sim-stat">
                    <span class="label-sm muted">From the Sun</span>
                    <span class="data-lg">{distance().toFixed(3)} AU</span>
                  </div>
                  <div class="sim-stat">
                    <span class="label-sm muted">Speed</span>
                    <span class="data-lg">{speed().toFixed(2)} km/s</span>
                  </div>
                </div>
                <div class="sim-row">
                  <div class="sim-stat">
                    <span class="label-sm muted">Period</span>
                    <span class="data-lg">{Math.pow(body().orbit.a, 1.5).toFixed(2)} yr</span>
                  </div>
                  <div class="sim-stat">
                    <span class="label-sm muted">Eccentricity</span>
                    <span class="data-lg">{body().orbit.e.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </aside>
      </Show>

      <p class="label-sm faint sim-hint">
        Drag to rotate · Scroll to zoom · Click a body to follow · Space to pause
      </p>
    </div>
  );
}

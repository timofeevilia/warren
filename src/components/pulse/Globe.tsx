// The Solid half of Pulse: the globe itself and the live instruments.
//
// It shares the page with a Svelte island (the story). The two never import each
// other — they meet in src/lib/pulse/data.ts, a set of plain stores. The story
// writes where to look into `view`; this component reads it. Both read the same
// NOAA data, fetched once.

import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import {
  aurora,
  kp,
  kpLabel,
  start,
  status,
  subsolarPoint,
  view,
  wind,
  type View,
} from '../../lib/pulse/data';
import { createGlobeRenderer, geoVector, viewBasis } from '../../lib/pulse/globe-shader';
import type { Store } from '../../lib/pulse/store';
import './pulse.css';

/** Bridge a framework-agnostic store into a Solid signal. */
function fromStore<T>(store: Store<T>) {
  const [value, setValue] = createSignal(store.get(), { equals: false });
  onCleanup(store.subscribe((next) => setValue(() => next)));
  return value;
}

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

export default function Globe() {
  let canvas!: HTMLCanvasElement;
  let marker!: HTMLDivElement;

  const windData = fromStore(wind);
  const kpData = fromStore(kp);
  const auroraData = fromStore(aurora);
  const state = fromStore(status);
  const target = fromStore(view);

  const [now, setNow] = createSignal(Date.now());
  const [webgl, setWebgl] = createSignal(true);

  const latest = createMemo(() => windData().at(-1));
  const currentKp = createMemo(() => {
    const observed = kpData().filter((sample) => !sample.predicted);
    return observed.at(-1)?.kp;
  });
  const age = createMemo(() => {
    const data = auroraData();
    if (!data) return '';
    const minutes = Math.max(0, Math.round((now() - data.observed.getTime()) / 60_000));
    if (minutes < 1) return 'just now';
    if (minutes < 90) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
  });
  // Sparkline of the last hour of wind speed, as an SVG path in a 100x24 box.
  const sparkline = createMemo(() => {
    const samples = windData();
    if (samples.length < 2) return '';
    const speeds = samples.map((sample) => sample.speed);
    const min = Math.min(...speeds);
    const span = Math.max(1, Math.max(...speeds) - min);
    return speeds
      .map((speed, i) => `${i ? 'L' : 'M'}${((i / (speeds.length - 1)) * 100).toFixed(1)} ${(22 - ((speed - min) / span) * 20).toFixed(1)}`)
      .join(' ');
  });

  onMount(() => {
    start();
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    onCleanup(() => clearInterval(clock));

    let renderer: ReturnType<typeof createGlobeRenderer> = null;
    try {
      renderer = createGlobeRenderer(canvas);
    } catch (error) {
      console.error(error);
    }
    if (!renderer) {
      setWebgl(false);
      return;
    }
    const gl = renderer;
    onCleanup(aurora.subscribe((data) => data && gl.setAurora(data.grid)));

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rotation = new Float32Array(9);
    let width = 0;
    let height = 0;
    let raf = 0;
    // Camera: where it is, and (while the visitor is dragging) where they put it.
    let lat = 30;
    let lon = 0;
    let dragging = false;
    let userLat = 0;
    let userLon = 0;
    let userControl = false;
    let lastTarget: View | null = null;
    const started = performance.now();

    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      gl.resize(width, height);
    };

    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      const date = new Date();
      const sun = subsolarPoint(date);

      // A new instruction from the story takes the camera back from the visitor.
      const goal = target();
      if (goal !== lastTarget) {
        lastTarget = goal;
        userControl = false;
      }
      let goalLat = goal.lat;
      let goalLon = goal.lon === 'night' ? sun.lon + 180 : goal.lon === 'day' ? sun.lon - 55 : goal.lon;
      if (userControl) {
        goalLat = userLat;
        goalLon = userLon;
      }
      const ease = dragging ? 0.35 : reduce ? 1 : 0.045;
      lat += (goalLat - lat) * ease;
      lon += wrap180(goalLon - lon) * ease; // shortest way round

      const narrow = width < 860;
      const radius = narrow ? Math.min(width * 0.44, height * 0.24) : Math.min(height * 0.4, width * 0.27);
      const x = narrow ? width / 2 : width * 0.68;
      const y = narrow ? height * 0.29 : height * 0.5;
      viewBasis(lat, lon, rotation);
      gl.draw({ x, y, radius, time: reduce ? 0 : (ms - started) / 1000, rotation, sun: geoVector(sun.lat, sun.lon) });

      // The marker is a DOM node: project its position with the same basis.
      const pin = goal.marker;
      if (pin) {
        const v = geoVector(pin.lat, pin.lon);
        const px = v[0] * rotation[0] + v[1] * rotation[1] + v[2] * rotation[2];
        const py = v[0] * rotation[3] + v[1] * rotation[4] + v[2] * rotation[5];
        const pz = v[0] * rotation[6] + v[1] * rotation[7] + v[2] * rotation[8];
        marker.style.transform = `translate(${x + px * radius}px, ${y - py * radius}px)`;
        marker.style.opacity = pz > 0.05 ? '1' : '0';
        marker.dataset.name = pin.name;
      } else {
        marker.style.opacity = '0';
      }
    };

    // Drag to look around. The page still scrolls with the wheel / a vertical swipe.
    let px = 0;
    let py = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // on phones, swipes scroll the story
      dragging = true;
      userControl = true;
      userLat = lat;
      userLon = lon;
      px = e.clientX;
      py = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      userLon = wrap180(userLon - (e.clientX - px) * 0.3);
      userLat = Math.max(-89, Math.min(89, userLat + (e.clientY - py) * 0.3));
      px = e.clientX;
      py = e.clientY;
    };
    const onUp = () => (dragging = false);

    resize();
    addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    raf = requestAnimationFrame(frame);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    });
  });

  return (
    <>
      <canvas ref={canvas} class="pulse-canvas" aria-hidden="true" />
      <div ref={marker} class="pulse-marker" aria-hidden="true" />

      <Show when={!webgl()}>
        <p class="pulse-nogl label-sm faint">WebGL is unavailable — the globe can't be drawn in this browser.</p>
      </Show>

      <aside class="pulse-hud" aria-label="Live space weather">
        <div class="pulse-hud-head">
          <span class="label-sm pulse-status" classList={{ live: state() === 'live' }}>
            {state() === 'live'
              ? '● Live · NOAA SWPC'
              : state() === 'snapshot'
                ? '○ Saved snapshot'
                : state() === 'offline'
                  ? '○ NOAA unreachable'
                  : '○ Connecting…'}
          </span>
          <span class="label-sm faint">{age()}</span>
        </div>
        <div class="pulse-hud-grid">
          <div class="pulse-stat">
            <span class="label-sm muted">Wind</span>
            <span class="data-lg">
              {latest() ? Math.round(latest()!.speed) : '—'} <small>km/s</small>
            </span>
            <svg class="pulse-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
              <path d={sparkline()} />
            </svg>
          </div>
          <div class="pulse-stat">
            <span class="label-sm muted">Density</span>
            <span class="data-lg">
              {latest() ? latest()!.density.toFixed(1) : '—'} <small>p/cm³</small>
            </span>
          </div>
          <div class="pulse-stat">
            <span class="label-sm muted">Bz</span>
            <span class="data-lg" classList={{ 'pulse-south': (latest()?.bz ?? 0) < 0 }}>
              {latest() ? (latest()!.bz > 0 ? '+' : '') + latest()!.bz.toFixed(1) : '—'} <small>nT</small>
            </span>
          </div>
          <div class="pulse-stat">
            <span class="label-sm muted">Kp</span>
            <span class="data-lg">
              {currentKp() !== undefined ? currentKp()!.toFixed(1) : '—'}{' '}
              <small>{currentKp() !== undefined ? kpLabel(currentKp()!).split(' · ')[0] : ''}</small>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

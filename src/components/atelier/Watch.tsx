// The watch. One Solid component, drawn entirely in SVG — no photographs, no 3D engine.
//
// It is always running: the hands show the visitor's real time and, like a real
// 28 800 vph movement, the seconds hand advances eight times a second.
// Each moving part reads its angle from a signal, so a frame costs a handful of
// attribute writes, however complicated the drawing is.

import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { config, pick, view, type View } from '../../lib/atelier/catalog';
import type { Store } from '../../lib/store';
import './atelier.css';

function fromStore<T>(store: Store<T>) {
  const [value, setValue] = createSignal(store.get(), { equals: false });
  onCleanup(store.subscribe((next) => setValue(() => next)));
  return value;
}

/** How the watch sits for each section of the page. Angles in degrees. */
const poses: Record<View, { scale: number; rx: number; ry: number; y: number }> = {
  hero: { scale: 1, rx: 8, ry: -16, y: 0 },
  dial: { scale: 1.9, rx: 0, ry: 0, y: 0 },
  movement: { scale: 1.5, rx: 0, ry: 180, y: 0 },
  metal: { scale: 1.12, rx: 12, ry: 34, y: 0 },
  build: { scale: 1, rx: 0, ry: 0, y: 0 },
  engrave: { scale: 1.5, rx: 0, ry: 180, y: -12 },
};

const VERMILION = '#c8452c';
const TAU = Math.PI * 2;

function gearPath(radius: number, teeth: number) {
  const inner = radius * 0.84;
  const step = TAU / teeth;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const point = (r: number, angle: number) => `${(Math.cos(angle) * r).toFixed(2)},${(Math.sin(angle) * r).toFixed(2)}`;
    d += `${i ? 'L' : 'M'}${point(inner, a)}L${point(radius, a + step * 0.2)}L${point(radius, a + step * 0.5)}L${point(inner, a + step * 0.7)}`;
  }
  return d + 'Z';
}

// Train of wheels behind the caseback: position, size, teeth, degrees per second.
const wheels = [
  { x: 40, y: -44, r: 36, teeth: 30, speed: 1.2 },
  { x: 0, y: 0, r: 24, teeth: 22, speed: -4 },
  { x: -40, y: -26, r: 19, teeth: 18, speed: 9 },
  { x: -14, y: 38, r: 15, teeth: 14, speed: -22 },
];

const sunburst = Array.from({ length: 48 }, (_, i) => {
  const a0 = (i / 48) * TAU;
  const a1 = ((i + 1) / 48) * TAU;
  return {
    d: `M0,0L${Math.cos(a0) * 130},${Math.sin(a0) * 130}A130,130 0 0 1 ${Math.cos(a1) * 130},${Math.sin(a1) * 130}Z`,
    light: i % 2 === 0,
    strength: 0.03 + 0.05 * Math.abs(Math.sin(i * 1.7)),
  };
});

export default function Watch() {
  const c = fromStore(config);
  const current = fromStore(view);
  const parts = createMemo(() => pick(c()));
  const metal = () => parts().metal.colors;
  const ink = () => parts().dial.colors[1];
  // Black hands on a dark dial would vanish: a black case gets steel hands.
  const handMetal = () => (c().metal === 'black' ? ['#ffffff', '#c9cdd2', '#8b9097', '#eef0f2'] : metal());

  const [now, setNow] = createSignal(Date.now());
  const [tiltX, setTiltX] = createSignal(0);
  const [tiltY, setTiltY] = createSignal(0);

  const clock = createMemo(() => {
    const date = new Date(now());
    // Eight beats per second, like the escapement it pretends to have.
    const seconds = date.getSeconds() + Math.floor(date.getMilliseconds() / 125) / 8;
    const minutes = date.getMinutes() + seconds / 60;
    const hours = (date.getHours() % 12) + minutes / 60;
    return { second: seconds * 6, minute: minutes * 6, hour: hours * 30, day: date.getDate() };
  });
  const elapsed = () => now() / 1000;
  // The balance wheel swings back and forth four times a second.
  const balance = () => Math.sin(elapsed() * TAU * 4) * 130;

  const pose = createMemo(() => poses[current()]);
  const sizeScale = () => c().size / 38;

  onMount(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let goalX = 0;
    let goalY = 0;
    let x = 0;
    let y = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      setNow(Date.now());
      x += (goalX - x) * 0.06;
      y += (goalY - y) * 0.06;
      setTiltX(x);
      setTiltY(y);
    };
    const onPointer = (e: PointerEvent) => {
      if (reduce || e.pointerType === 'touch') return;
      goalX = (e.clientX / innerWidth - 0.5) * 22;
      goalY = (0.5 - e.clientY / innerHeight) * 14;
    };
    addEventListener('pointermove', onPointer, { passive: true });
    raf = requestAnimationFrame(frame);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onPointer);
    });
  });

  const MetalDefs = (props: { id: string; colors: () => readonly string[] }) => (
    <>
      <linearGradient id={`${props.id}-a`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color={props.colors()[0]} />
        <stop offset="0.42" stop-color={props.colors()[1]} />
        <stop offset="0.72" stop-color={props.colors()[2]} />
        <stop offset="1" stop-color={props.colors()[3]} />
      </linearGradient>
      <linearGradient id={`${props.id}-b`} x1="1" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color={props.colors()[0]} />
        <stop offset="0.5" stop-color={props.colors()[1]} />
        <stop offset="1" stop-color={props.colors()[2]} />
      </linearGradient>
      <linearGradient id={`${props.id}-h`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color={props.colors()[2]} />
        <stop offset="0.3" stop-color={props.colors()[0]} />
        <stop offset="0.6" stop-color={props.colors()[1]} />
        <stop offset="1" stop-color={props.colors()[2]} />
      </linearGradient>
    </>
  );

  /** The strap half above the case; the lower half is this, mirrored. */
  const Strap = (props: { id: string }) => (
    <Show
      when={c().strap === 'bracelet'}
      fallback={
        <g>
          <path d="M-56,-130 L-47,-330 L47,-330 L56,-130 Z" fill={`url(#${props.id}-strap)`} />
          <Show
            when={c().strap === 'rubber'}
            fallback={
              <path
                d="M-47,-140 L-39.5,-322 M47,-140 L39.5,-322"
                fill="none"
                stroke="#efe3cb"
                stroke-opacity="0.65"
                stroke-width="1.4"
                stroke-dasharray="5 4"
              />
            }
          >
            <For each={[...Array(11).keys()]}>
              {(i) => {
                // Grooves stop at the strap's edge, which tapers toward the buckle.
                const y = -170 - i * 14;
                const half = 53 - (-y - 130) * 0.045;
                return <path d={`M${-half},${y} H${half}`} stroke="#000" stroke-opacity="0.35" stroke-width="3" />;
              }}
            </For>
          </Show>
        </g>
      }
    >
      <For each={[...Array(9).keys()]}>
        {(i) => (
          <g transform={`translate(0 ${-150 - i * 21})`}>
            <rect x="-54" y="-20" width="108" height="19" rx="3" fill={`url(#${props.id}-h)`} />
            <rect x="-22" y="-20" width="44" height="19" rx="3" fill={`url(#${props.id}-b)`} />
            <rect x="-54" y="-20" width="108" height="19" rx="3" fill="none" stroke="#000" stroke-opacity="0.25" />
          </g>
        )}
      </For>
    </Show>
  );

  const StrapDefs = (props: { id: string }) => (
    <linearGradient id={`${props.id}-strap`} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color={parts().strap.colors[1] ?? '#222'} />
      <stop offset="0.5" stop-color={parts().strap.colors[0] ?? '#333'} />
      <stop offset="1" stop-color={parts().strap.colors[1] ?? '#222'} />
    </linearGradient>
  );

  const Case = (props: { id: string; crown: 1 | -1 }) => (
    <>
      <Strap id={props.id} />
      <g transform="scale(1 -1)">
        <Strap id={props.id} />
      </g>
      <For each={[[-1, -1], [1, -1], [-1, 1], [1, 1]]}>
        {([sx, sy]) => (
          <rect
            x={sx < 0 ? -84 : 58}
            y={sy < 0 ? -186 : 106}
            width="26"
            height="80"
            rx="9"
            fill={`url(#${props.id}-a)`}
          />
        )}
      </For>
      <g transform={`scale(${props.crown} 1)`}>
        <rect x="146" y="-15" width="24" height="30" rx="4" fill={`url(#${props.id}-h)`} />
        <For each={[-9, -3, 3, 9]}>
          {(dy) => <path d={`M150,${dy} H168`} stroke="#000" stroke-opacity="0.3" stroke-width="1.5" />}
        </For>
      </g>
      <circle r="150" fill={`url(#${props.id}-a)`} />
    </>
  );

  const Hand = (props: { kind: 'hour' | 'minute' }) => {
    const long = props.kind === 'minute';
    const tip = long ? -116 : -80;
    const half = long ? 5 : 6.5;
    return (
      <g filter="url(#f-hand-shadow)">
        <Show when={c().hands === 'dauphine'}>
          <path d={`M0,${tip} L${half},0 L0,13 L${-half},0 Z`} fill="url(#f-hand-a)" />
          <path d={`M0,${tip} L${half},0 L0,13 Z`} fill="#000" fill-opacity="0.22" />
        </Show>
        <Show when={c().hands === 'leaf'}>
          <path
            d={`M0,12 C${half * 1.7},-18 ${half * 1.5},${tip * 0.6} 0,${tip} C${-half * 1.5},${tip * 0.6} ${-half * 1.7},-18 0,12 Z`}
            fill="url(#f-hand-a)"
          />
        </Show>
        <Show when={c().hands === 'baton'}>
          <rect x={-half * 0.6} y={tip} width={half * 1.2} height={-tip + 12} rx="1.5" fill="url(#f-hand-a)" />
          <rect x={-half * 0.25} y={tip + 6} width={half * 0.5} height={-tip * 0.62} rx="1" fill="#f3f7e6" />
        </Show>
      </g>
    );
  };

  return (
    <div class="atl-stage" data-view={current()} aria-hidden="true">
      <div
        class="atl-pose"
        style={{
          transform: `translateY(${pose().y}%) scale(${pose().scale * sizeScale()}) rotateX(${pose().rx}deg) rotateY(${pose().ry}deg)`,
        }}
      >
        <div class="atl-tilt" style={{ transform: `rotateX(${tiltY()}deg) rotateY(${tiltX()}deg)` }}>
          {/* A stack of discs between the two faces gives the case its thickness when it turns. */}
          <For each={[-6, -4, -2, 0, 2, 4, 6]}>
            {(z) => <div class="atl-rim" style={{ transform: `translateZ(${z}px) scale(0.33334)`, background: metal()[z > 0 ? 1 : 2] }} />}
          </For>

          {/* ---------------- Front ---------------- */}
          <svg class="atl-face atl-front" viewBox="-200 -330 400 660">
            <defs>
              <MetalDefs id="f" colors={metal} />
              <MetalDefs id="f-hand" colors={handMetal} />
              <StrapDefs id="f" />
              <radialGradient id="f-dial-shade" cx="0.42" cy="0.36" r="0.75">
                <stop offset="0" stop-color="#fff" stop-opacity="0.16" />
                <stop offset="0.6" stop-color="#000" stop-opacity="0" />
                <stop offset="1" stop-color="#000" stop-opacity="0.38" />
              </radialGradient>
              <linearGradient id="f-glare" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#fff" stop-opacity="0.34" />
                <stop offset="0.35" stop-color="#fff" stop-opacity="0.04" />
                <stop offset="1" stop-color="#fff" stop-opacity="0" />
              </linearGradient>
              <filter id="f-hand-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="1.5" dy="3" stdDeviation="2" flood-color="#000" flood-opacity="0.45" />
              </filter>
              <clipPath id="f-dial-clip">
                <circle r="129" />
              </clipPath>
            </defs>

            <Case id="f" crown={1} />
            <circle r="141" fill="none" stroke="url(#f-b)" stroke-width="12" />
            <circle r="133" fill="#000" fill-opacity="0.55" />

            <g clip-path="url(#f-dial-clip)">
              <circle r="129" fill={parts().dial.colors[0]} />
              <For each={sunburst}>
                {(wedge) => <path d={wedge.d} fill={wedge.light ? '#fff' : '#000'} fill-opacity={wedge.strength} />}
              </For>
              <circle r="129" fill="url(#f-dial-shade)" />
            </g>

            {/* Minute track */}
            <For each={[...Array(60).keys()]}>
              {(i) => (
                <path
                  d={i % 5 === 0 ? 'M0,-126 V-118' : 'M0,-126 V-122'}
                  stroke={ink()}
                  stroke-opacity={i % 5 === 0 ? 0.9 : 0.5}
                  stroke-width={i % 5 === 0 ? 1.6 : 1}
                  transform={`rotate(${i * 6})`}
                />
              )}
            </For>
            {/* Applied hour markers; the one under a complication is left out. */}
            <For each={[...Array(12).keys()]}>
              {(i) => (
                <Show when={!(c().comp === 'date' && i === 3) && !(c().comp === 'seconds' && i === 6)}>
                  <g transform={`rotate(${i * 30})`} filter="url(#f-hand-shadow)">
                    <Show when={i === 0} fallback={<rect x="-2.8" y="-112" width="5.6" height="22" rx="1" fill="url(#f-hand-a)" />}>
                      <rect x="-7" y="-112" width="5.2" height="24" rx="1" fill="url(#f-hand-a)" />
                      <rect x="1.8" y="-112" width="5.2" height="24" rx="1" fill="url(#f-hand-a)" />
                    </Show>
                  </g>
                </Show>
              )}
            </For>

            <text class="atl-logo" y="-50" text-anchor="middle" fill={ink()}>
              LIÈVRE
            </text>
            <g fill={ink()} fill-opacity="0.75" text-anchor="middle" class="atl-small">
              <text y={c().comp === 'seconds' ? -32 : 60}>TERRIER</text>
              <Show when={c().comp !== 'seconds'}>
                <text y="72">AUTOMATIC</text>
              </Show>
            </g>

            <Show when={c().comp === 'date'}>
              <rect x="76" y="-12" width="30" height="24" rx="2.5" fill="#f4f0e6" stroke="url(#f-hand-a)" stroke-width="2" />
              <text class="atl-date" x="91" y="6.5" text-anchor="middle" fill="#17150f">
                {clock().day}
              </text>
            </Show>

            <Show when={c().comp === 'seconds'}>
              <g transform="translate(0 64)">
                <circle r="27" fill="#000" fill-opacity="0.16" />
                <circle r="27" fill="none" stroke={ink()} stroke-opacity="0.35" />
                <For each={[...Array(12).keys()]}>
                  {(i) => <path d="M0,-26 V-21" stroke={ink()} stroke-opacity="0.7" transform={`rotate(${i * 30})`} />}
                </For>
                <g transform={`rotate(${clock().second})`}>
                  <path d="M0,6 V-23" stroke={VERMILION} stroke-width="1.6" stroke-linecap="round" />
                </g>
                <circle r="2.4" fill="url(#f-hand-a)" />
              </g>
            </Show>

            <g transform={`rotate(${clock().hour})`}>
              <Hand kind="hour" />
            </g>
            <g transform={`rotate(${clock().minute})`}>
              <Hand kind="minute" />
            </g>
            <Show when={c().comp !== 'seconds'}>
              <g transform={`rotate(${clock().second})`} filter="url(#f-hand-shadow)">
                <path d="M0,30 V-122" stroke={VERMILION} stroke-width="1.4" stroke-linecap="round" />
                <circle cy="22" r="4.5" fill={VERMILION} />
              </g>
            </Show>
            <circle r="5.5" fill="url(#f-hand-a)" />
            <circle r="1.6" fill="#000" fill-opacity="0.5" />

            {/* Sapphire crystal: a soft reflection that slides as the watch tilts. */}
            <g clip-path="url(#f-dial-clip)">
              <path
                d="M-150,-150 H40 L-70,150 H-150 Z"
                fill="url(#f-glare)"
                transform={`translate(${tiltX() * 3.2} ${-tiltY() * 2})`}
              />
            </g>
          </svg>

          {/* ---------------- Back ---------------- */}
          <svg class="atl-face atl-back" viewBox="-200 -330 400 660">
            <defs>
              <MetalDefs id="b" colors={metal} />
              <StrapDefs id="b" />
              <pattern id="b-stripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
                <rect width="5" height="10" fill="#fff" fill-opacity="0.09" />
              </pattern>
              <clipPath id="b-window">
                <circle r="104" />
              </clipPath>
              <path id="b-arc-top" d="M-126,0 A126,126 0 0 1 126,0" />
              <path id="b-arc-bottom" d="M-132,0 A132,132 0 0 0 132,0" />
              <radialGradient id="b-glass" cx="0.35" cy="0.3" r="0.8">
                <stop offset="0" stop-color="#fff" stop-opacity="0.2" />
                <stop offset="0.5" stop-color="#fff" stop-opacity="0" />
              </radialGradient>
            </defs>

            <Case id="b" crown={-1} />
            <circle r="150" fill="url(#b-b)" />
            <circle r="110" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2" />
            <text class="atl-engraved" fill="#000" fill-opacity="0.62">
              <textPath href="#b-arc-top" startOffset="50%" text-anchor="middle">
                ATELIER LIÈVRE · TERRIER {c().size} · AUTOMATIC · 5 ATM
              </textPath>
            </text>
            <text class="atl-engraved" classList={{ custom: !!c().engraving.trim() }} fill="#000" fill-opacity="0.62">
              <textPath href="#b-arc-bottom" startOffset="50%" text-anchor="middle">
                {c().engraving.trim() || 'N° 0042 / 1000'}
              </textPath>
            </text>

            <g clip-path="url(#b-window)">
              <circle r="104" fill="#2b2620" />
              <circle r="104" fill="url(#b-stripes)" />
              {/* Wheels */}
              <For each={wheels}>
                {(wheel) => (
                  <g transform={`translate(${wheel.x} ${wheel.y}) rotate(${elapsed() * wheel.speed})`}>
                    <path d={gearPath(wheel.r, wheel.teeth)} fill="#c7a25a" stroke="#7d6127" stroke-width="0.8" />
                    <circle r={wheel.r * 0.62} fill="#2b2620" />
                    <path d={`M${-wheel.r * 0.7},0 H${wheel.r * 0.7} M0,${-wheel.r * 0.7} V${wheel.r * 0.7}`} stroke="#c7a25a" stroke-width="3" />
                    <circle r="3" fill="#e9d6a2" />
                  </g>
                )}
              </For>
              {/* Bridge, with Geneva stripes, jewels and blued screws */}
              <path d="M-8,-104 A104,104 0 0 1 104,-12 L62,2 Q34,-22 8,-14 Q-20,-30 -8,-104 Z" fill="#cdd0d4" />
              <path d="M-8,-104 A104,104 0 0 1 104,-12 L62,2 Q34,-22 8,-14 Q-20,-30 -8,-104 Z" fill="url(#b-stripes)" />
              <For each={[[40, -44], [0, -8], [78, -30]]}>
                {([x, y]) => (
                  <g transform={`translate(${x} ${y})`}>
                    <circle r="6.5" fill="#d9b25a" />
                    <circle r="4.2" fill="#b3122e" />
                    <circle r="1.4" fill="#ff8fa0" fill-opacity="0.8" />
                  </g>
                )}
              </For>
              <For each={[[14, -84], [86, -6], [24, -24]]}>
                {([x, y], i) => (
                  <g transform={`translate(${x} ${y}) rotate(${i() * 50 + 20})`}>
                    <circle r="5" fill="#2c4f9e" />
                    <path d="M-4,0 H4" stroke="#0e1f45" stroke-width="1.4" />
                  </g>
                )}
              </For>
              {/* Balance wheel and hairspring */}
              <g transform="translate(-54 46)">
                <g transform={`rotate(${balance()})`}>
                  <circle r="27" fill="none" stroke="#d9b25a" stroke-width="4.5" />
                  <path d="M-27,0 H27 M0,-27 V27" stroke="#d9b25a" stroke-width="2.5" />
                </g>
                <path
                  d="M0,0 m2,0 a2,2 0 1 1 -4,0 a4,4 0 1 1 8,0 a6,6 0 1 1 -12,0 a8,8 0 1 1 16,0 a10,10 0 1 1 -20,0 a12,12 0 1 1 24,0"
                  fill="none"
                  stroke="#8fb0e6"
                  stroke-width="0.7"
                  transform={`rotate(${balance() * 0.5}) scale(${1 + balance() / 1300})`}
                />
                <path d="M-36,22 Q0,-12 36,22 L30,30 Q0,6 -30,30 Z" fill="#cdd0d4" />
                <circle r="4.6" fill="#d9b25a" />
                <circle r="2.8" fill="#b3122e" />
              </g>
              {/* Winding rotor: a weighted half-disc that never quite stops. */}
              <g transform={`rotate(${elapsed() * 14 + tiltX() * 7})`}>
                <path d="M-102,0 A102,102 0 0 1 102,0 L66,0 A66,66 0 0 0 -66,0 Z" fill="url(#b-a)" />
                <path d="M-102,0 A102,102 0 0 1 102,0 L66,0 A66,66 0 0 0 -66,0 Z" fill="url(#b-stripes)" />
                <path d="M-66,0 A66,66 0 0 1 66,0 L12,0 A12,12 0 0 0 -12,0 Z" fill="url(#b-b)" fill-opacity="0.55" />
                <circle r="12" fill="url(#b-a)" />
                <circle r="4.5" fill="#2c4f9e" />
              </g>
              <circle r="104" fill="url(#b-glass)" />
            </g>
            <circle r="104" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="3" />
          </svg>
        </div>
      </div>
      <div class="atl-shadow" />
    </div>
  );
}

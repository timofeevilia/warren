// The Solid half of Synesthesia: everything you touch while playing.
//
// Why Solid here: a knob being dragged fires dozens of updates a second, and each
// one has to move the knob, rewrite its label and change the sound. With signals
// each of those is a direct write to one DOM attribute — nothing re-renders.

import { createMemo, createSignal, For, onCleanup, onMount, Show, type Accessor } from 'solid-js';
import {
  analyse,
  autoplay,
  current,
  describe,
  held,
  hueOf,
  listenNotes,
  mic,
  noteOff,
  noteOn,
  params,
  presets,
  SCENES,
  setAutoplay,
  setParam,
  start,
  started,
  toggleMic,
  WAVES,
  type Params,
} from '../../lib/synesthesia/engine';
import { createVisuals, hexToRgb, hueToRgb } from '../../lib/synesthesia/visuals';
import type { Store } from '../../lib/store';
import './synesthesia.css';

function fromStore<T>(store: Store<T>) {
  const [value, setValue] = createSignal(store.get(), { equals: false });
  onCleanup(store.subscribe((next) => setValue(() => next)));
  return value;
}

// --- Knob ---------------------------------------------------------------------------
const ARC = 270; // degrees of travel
function Knob(props: { label: string; name: keyof Params; value: Accessor<number> }) {
  let startY = 0;
  let startValue = 0;
  const set = (value: number) => setParam(props.name, Math.max(0, Math.min(1, value)));
  const angle = () => -ARC / 2 + props.value() * ARC;
  // Circumference of r=20 is ~125.66; the arc covers 3/4 of it.
  const dash = () => `${props.value() * 94.25} 200`;

  return (
    <div
      class="syn-knob"
      role="slider"
      tabindex="0"
      aria-label={props.label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(props.value() * 100)}
      aria-valuetext={describe[props.name](props.value())}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        startY = e.clientY;
        startValue = props.value();
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        set(startValue + (startY - e.clientY) / 160);
      }}
      onWheel={(e) => {
        e.preventDefault();
        set(props.value() - Math.sign(e.deltaY) * 0.03);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(props.value() + 0.03);
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(props.value() - 0.03);
      }}
    >
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle class="syn-knob-track" cx="28" cy="28" r="20" stroke-dasharray="94.25 200" transform="rotate(135 28 28)" />
        <circle class="syn-knob-value" cx="28" cy="28" r="20" stroke-dasharray={dash()} transform="rotate(135 28 28)" />
        <line class="syn-knob-hand" x1="28" y1="28" x2="28" y2="13" transform={`rotate(${angle()} 28 28)`} />
      </svg>
      <span class="label-sm muted">{props.label}</span>
      <span class="label-sm syn-knob-read">{describe[props.name](props.value())}</span>
    </div>
  );
}

// --- Keyboard ---------------------------------------------------------------------------
const KEY_ROW = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const FIRST = 48; // C3
const LAST = 72; // C5

const keys = Array.from({ length: LAST - FIRST + 1 }, (_, i) => {
  const midi = FIRST + i;
  const [r, g, b] = hueToRgb(hueOf(midi));
  return {
    midi,
    black: BLACK.has(midi % 12),
    color: `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`,
  };
});
const whiteKeys = keys.filter((key) => !key.black);
const whiteIndex = new Map(whiteKeys.map((key, i) => [key.midi, i]));

export default function Instrument() {
  let canvas!: HTMLCanvasElement;

  const p = fromStore(params);
  const heldNotes = fromStore(held);
  const isStarted = fromStore(started);
  const isAuto = fromStore(autoplay);
  const micState = fromStore(mic);
  const now = fromStore(current);

  const [octave, setOctave] = createSignal(0);
  const [panel, setPanel] = createSignal(true);
  const [saved, setSaved] = createSignal(false);
  const [webgl, setWebgl] = createSignal(true);

  // One memo per knob, so dragging "Echo" doesn't touch "Attack".
  const knob = (name: keyof Params) => createMemo(() => p()[name]);
  const values = {
    attack: knob('attack'), release: knob('release'), filter: knob('filter'),
    echo: knob('echo'), space: knob('space'),
    glow: knob('glow'), detail: knob('detail'), speed: knob('speed'),
  };
  const wave = createMemo(() => Math.round(p().wave));
  const scene = createMemo(() => Math.round(p().scene));
  const letterFor = (midi: number) => KEY_ROW[midi - 60 - octave() * 12]?.toUpperCase() ?? '';

  let capture = false;
  const savePoster = () => (capture = true);

  // --- Playing: pointer on the on-screen keys ---
  let pointerNote: number | null = null;
  const press = (midi: number) => {
    start();
    if (pointerNote !== null && pointerNote !== midi) noteOff(pointerNote);
    pointerNote = midi;
    noteOn(midi);
  };
  const lift = () => {
    if (pointerNote !== null) noteOff(pointerNote);
    pointerNote = null;
  };

  onMount(() => {
    if (innerWidth < 760) setPanel(false);

    // --- Playing: computer keyboard ---
    const down = new Map<string, number>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      // Letters must keep playing after a button has been clicked and holds focus.
      if ((e.target as HTMLElement).closest?.('input, textarea')) return;
      const key = e.key.toLowerCase();
      if (key === 'z') return setOctave((o) => Math.max(-1, o - 1));
      if (key === 'x') return setOctave((o) => Math.min(1, o + 1));
      const index = KEY_ROW.indexOf(key);
      if (index < 0 || down.has(key)) return;
      start();
      const midi = 60 + octave() * 12 + index;
      down.set(key, midi);
      noteOn(midi);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const midi = down.get(key);
      if (midi === undefined) return;
      down.delete(key);
      noteOff(midi);
    };
    addEventListener('keydown', onKeyDown);
    addEventListener('keyup', onKeyUp);
    addEventListener('pointerup', lift);
    addEventListener('pointercancel', lift);
    onCleanup(() => {
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('pointerup', lift);
      removeEventListener('pointercancel', lift);
      setAutoplay(false);
    });

    // --- Visuals ---
    let visuals: ReturnType<typeof createVisuals> = null;
    try {
      visuals = createVisuals(canvas);
    } catch (error) {
      console.error(error);
    }
    if (!visuals) {
      setWebgl(false);
      return;
    }
    const gl = visuals;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Notes arrive as events; the shader wants "the six most recent, with their age".
    const notes = new Float32Array(24);
    const born = new Float64Array(6).fill(-100);
    let slot = 0;
    const tint: [number, number, number] = [1, 1, 1];
    let tintAmount = 0;
    listenNotes((midi, velocity) => {
      slot = (slot + 1) % 6;
      born[slot] = performance.now() / 1000;
      notes[slot * 4] = hueOf(midi);
      notes[slot * 4 + 2] = velocity;
      notes[slot * 4 + 3] = Math.max(0, Math.min(1, (midi - 40) / 40));
      // Pull the overall tint toward this note's colour.
      const rgb = hueToRgb(hueOf(midi));
      for (let i = 0; i < 3; i++) tint[i] += (rgb[i] - tint[i]) * 0.45;
      // Capped low: the note colours season the preset's palette, they don't replace it.
      tintAmount = Math.min(0.38, tintAmount + 0.2);
    });
    onCleanup(() => listenNotes(null));

    const palette = new Float32Array(9);
    const paletteGoal = new Float32Array(9);
    let sceneShown = Math.round(params.get().scene);
    let fade = 1;
    let clock = 0;
    let last = performance.now();
    let raf = 0;

    const resize = () => gl.resize(innerWidth, innerHeight);
    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((ms - last) / 1000, 0.1);
      last = ms;
      const state = params.get();
      if (!reduce) clock += dt * (0.2 + state.speed * 1.8);

      // Glide the palette toward the current preset's colours.
      const preset = presets.find((item) => item.id === current.get().id) ?? presets[0];
      preset.palette.forEach((hex, i) => paletteGoal.set(hexToRgb(hex), i * 3));
      for (let i = 0; i < 9; i++) palette[i] += (paletteGoal[i] - palette[i]) * Math.min(1, dt * 4);

      // Changing scene: fade out, swap, fade back in.
      const sceneGoal = Math.round(state.scene);
      if (sceneGoal !== sceneShown) {
        fade -= dt * 5;
        if (fade <= 0) {
          fade = 0;
          sceneShown = sceneGoal;
        }
      } else {
        fade = Math.min(1, fade + dt * 3);
      }

      const seconds = ms / 1000;
      for (let i = 0; i < 6; i++) notes[i * 4 + 1] = seconds - born[i];
      tintAmount *= Math.exp(-dt * 0.6);

      gl.draw({
        time: clock,
        scene: sceneShown,
        fade,
        glow: state.glow,
        detail: state.detail,
        palette,
        tint,
        tintAmount,
        notes,
        audio: analyse(),
      });

      if (capture) {
        capture = false;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `synesthesia-${current.get().id}-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
          setSaved(true);
          setTimeout(() => setSaved(false), 1800);
        }, 'image/png');
      }
    };

    resize();
    preset0();
    function preset0() {
      const preset = presets.find((item) => item.id === current.get().id) ?? presets[0];
      preset.palette.forEach((hex, i) => palette.set(hexToRgb(hex), i * 3));
    }
    addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    });
  });

  return (
    <div class="syn" classList={{ 'syn-live': isStarted() }}>
      <canvas ref={canvas} class="syn-canvas" aria-hidden="true" />
      <Show when={!webgl()}>
        <p class="syn-nogl label-sm muted">WebGL is unavailable — you can still play, but there is nothing to see.</p>
      </Show>

      <button class="syn-panel-toggle label-md" onClick={() => setPanel((open) => !open)}>
        {panel() ? 'Hide controls' : 'Controls'}
      </button>

      <Show when={panel()}>
        <aside class="syn-panel">
          <section>
            <p class="label-md syn-accent">Sound</p>
            <div class="syn-segment" role="radiogroup" aria-label="Waveform">
              <For each={WAVES}>
                {(name, i) => (
                  <button
                    class="label-sm"
                    role="radio"
                    aria-checked={wave() === i()}
                    classList={{ current: wave() === i() }}
                    onClick={() => setParam('wave', i())}
                  >
                    {name === 'sawtooth' ? 'saw' : name === 'triangle' ? 'tri' : name}
                  </button>
                )}
              </For>
            </div>
            <div class="syn-knobs">
              <Knob label="Attack" name="attack" value={values.attack} />
              <Knob label="Release" name="release" value={values.release} />
              <Knob label="Filter" name="filter" value={values.filter} />
              <Knob label="Echo" name="echo" value={values.echo} />
              <Knob label="Space" name="space" value={values.space} />
            </div>
          </section>

          <section>
            <p class="label-md syn-accent">Vision</p>
            <div class="syn-segment" role="radiogroup" aria-label="Scene">
              <For each={SCENES}>
                {(name, i) => (
                  <button
                    class="label-sm"
                    role="radio"
                    aria-checked={scene() === i()}
                    classList={{ current: scene() === i() }}
                    onClick={() => setParam('scene', i())}
                  >
                    {name}
                  </button>
                )}
              </For>
            </div>
            <div class="syn-knobs">
              <Knob label="Glow" name="glow" value={values.glow} />
              <Knob label="Detail" name="detail" value={values.detail} />
              <Knob label="Speed" name="speed" value={values.speed} />
            </div>
          </section>

          <section class="syn-actions">
            <button class="label-sm" classList={{ current: isAuto() }} onClick={() => setAutoplay(!isAuto())}>
              {isAuto() ? '■ Stop' : '▶ Play for me'}
            </button>
            <button class="label-sm" classList={{ current: micState() === 'on' }} onClick={() => void toggleMic()}>
              {micState() === 'on' ? '● Mic on' : micState() === 'denied' ? 'Mic blocked' : '○ Use mic'}
            </button>
            <button class="label-sm" onClick={savePoster}>
              {saved() ? 'Saved ✓' : '↓ Save poster'}
            </button>
          </section>
          <p class="label-sm faint">{now().edited ? 'Edited from' : 'Preset'} · {now().id}</p>
        </aside>
      </Show>

      <div class="syn-keys" onPointerLeave={lift}>
        <div class="syn-keys-inner" style={{ '--whites': whiteKeys.length }}>
          <For each={keys}>
            {(key) => (
              <button
                class="syn-key"
                classList={{ black: key.black, on: heldNotes().has(key.midi) }}
                style={{
                  '--hue': key.color,
                  '--at': key.black ? whiteIndex.get(key.midi - 1)! + 1 : whiteIndex.get(key.midi)!,
                }}
                aria-label={`Note ${key.midi}`}
                tabindex="-1"
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                  press(key.midi);
                }}
                onPointerEnter={(e) => e.buttons > 0 && press(key.midi)}
              >
                <span class="label-sm">{letterFor(key.midi)}</span>
              </button>
            )}
          </For>
        </div>
        <p class="label-sm faint syn-hint">
          Play with the keys A–; and W E T Y U O P · Z / X shift the octave ({octave() >= 0 ? '+' : ''}
          {octave()})
        </p>
      </div>
    </div>
  );
}

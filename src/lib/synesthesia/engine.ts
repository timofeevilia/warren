// The instrument itself: a small polyphonic synth on the Web Audio API, plus the
// analysis the visuals read each frame. No framework in here — the Svelte shell
// and the Solid controls both drive this one module.

import { createStore } from '../store';

/** Every knob is a number from 0 to 1; the engine maps it to real units. */
export interface Params {
  wave: number; // 0 sine · 1 triangle · 2 saw · 3 square
  attack: number;
  release: number;
  filter: number;
  echo: number;
  space: number;
  scene: number; // 0 silk · 1 bloom · 2 liquid · 3 strata
  glow: number;
  detail: number;
  speed: number;
}

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  palette: [string, string, string];
  params: Params;
}

export const presets: Preset[] = [
  {
    id: 'glass',
    name: 'Glass',
    blurb: 'Pure tones, long tails',
    palette: ['#3d7bff', '#7cf4ff', '#f2f7ff'],
    params: { wave: 0, attack: 0.05, release: 0.7, filter: 0.85, echo: 0.35, space: 0.75, scene: 0, glow: 0.55, detail: 0.5, speed: 0.4 },
  },
  {
    id: 'neon',
    name: 'Neon',
    blurb: 'Plucked squares, pinging echo',
    palette: ['#ff2fb0', '#9b6bff', '#34e5ff'],
    params: { wave: 3, attack: 0, release: 0.3, filter: 0.55, echo: 0.7, space: 0.3, scene: 1, glow: 0.6, detail: 0.45, speed: 0.6 },
  },
  {
    id: 'ember',
    name: 'Ember',
    blurb: 'Warm saws through smoke',
    palette: ['#7a1206', '#ff6a1f', '#ffd98a'],
    params: { wave: 2, attack: 0.15, release: 0.55, filter: 0.38, echo: 0.3, space: 0.55, scene: 2, glow: 0.6, detail: 0.5, speed: 0.35 },
  },
  {
    id: 'tide',
    name: 'Tide',
    blurb: 'A slow pad that leaves a trace',
    palette: ['#0b4f6c', '#2ee6a6', '#e9ffd6'],
    params: { wave: 1, attack: 0.6, release: 0.8, filter: 0.6, echo: 0.45, space: 0.7, scene: 3, glow: 0.55, detail: 0.6, speed: 0.5 },
  },
];

export const WAVES: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
export const SCENES = ['Silk', 'Bloom', 'Liquid', 'Strata'];

// --- Shared state -----------------------------------------------------------------
export const params = createStore<Params>({ ...presets[0].params });
/** Which preset the current sound came from, and whether it has been tweaked since. */
export const current = createStore<{ id: string; edited: boolean }>({ id: presets[0].id, edited: false });
/** False while the welcome screen is up, true while the instrument is on screen. */
export const started = createStore(false);
export const autoplay = createStore(false);
export const mic = createStore<'off' | 'on' | 'denied'>('off');
/** MIDI numbers that are sounding right now, for lighting up the keyboard. */
export const held = createStore<ReadonlySet<number>>(new Set());

// --- Knob value -> real units --------------------------------------------------------
const attackSeconds = (v: number) => 0.004 + v * v * 1.6;
const releaseSeconds = (v: number) => 0.06 + v * v * 4.5;
const cutoffHz = (v: number) => 180 * Math.pow(70, v); // 180 Hz .. 12.6 kHz
export const describe: Record<keyof Params, (v: number) => string> = {
  wave: (v) => WAVES[Math.round(v)],
  attack: (v) => `${Math.round(attackSeconds(v) * 1000)} ms`,
  release: (v) => `${releaseSeconds(v).toFixed(1)} s`,
  filter: (v) => (cutoffHz(v) >= 1000 ? `${(cutoffHz(v) / 1000).toFixed(1)} kHz` : `${Math.round(cutoffHz(v))} Hz`),
  echo: (v) => `${Math.round(v * 100)} %`,
  space: (v) => `${Math.round(v * 100)} %`,
  scene: (v) => SCENES[Math.round(v)],
  glow: (v) => `${Math.round(v * 100)} %`,
  detail: (v) => `${Math.round(v * 100)} %`,
  speed: (v) => `×${(0.2 + v * 1.8).toFixed(1)}`,
};

/** Pitch to colour: neighbours on the circle of fifths get neighbouring hues. */
export const hueOf = (midi: number) => (((midi % 12) * 7) % 12) / 12;

// --- Audio graph --------------------------------------------------------------------
let ctx: AudioContext | null = null;
let bus: GainNode;
let echoSend: GainNode;
let spaceSend: GainNode;
let analyser: AnalyserNode;
let micAnalyser: AnalyserNode | null = null;
let micStream: MediaStream | null = null;

interface Voice {
  oscillators: OscillatorNode[];
  amp: GainNode;
  filter: BiquadFilterNode;
}
const voices = new Map<number, Voice>();

/** A reverb tail made from decaying noise: no audio file to download. */
function impulse(context: AudioContext, seconds: number) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
  }
  return buffer;
}

/** Must be called from a click or key press: browsers only allow sound after a gesture. */
export function start() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.55;
  const limiter = ctx.createDynamicsCompressor();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  master.connect(limiter).connect(analyser).connect(ctx.destination);

  bus = ctx.createGain();
  bus.connect(master);

  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.34;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.42;
  echoSend = ctx.createGain();
  bus.connect(echoSend).connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(master);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.2);
  spaceSend = ctx.createGain();
  bus.connect(spaceSend).connect(reverb).connect(master);
  delay.connect(spaceSend);

  applySends(params.get());
}

/** Welcome screen -> instrument. */
export function enter() {
  start();
  started.set(true);
}

/** Instrument -> welcome screen: silence everything and put the controls away. */
export function leave() {
  setAutoplay(false);
  for (const midi of [...voices.keys()]) releaseVoice(midi, 0.3);
  pending.clear();
  publishHeld();
  if (mic.get() === 'on') void toggleMic();
  started.set(false);
}

function applySends(p: Params) {
  if (!ctx) return;
  echoSend.gain.setTargetAtTime(p.echo * 0.6, ctx.currentTime, 0.05);
  spaceSend.gain.setTargetAtTime(p.space * 0.8, ctx.currentTime, 0.05);
  // Sounding notes follow the filter knob too.
  for (const voice of voices.values()) voice.filter.frequency.setTargetAtTime(cutoffHz(p.filter), ctx.currentTime, 0.04);
}
params.subscribe(applySends);

const publishHeld = () => held.set(new Set([...voices.keys(), ...pending]));
/** Notes whose key is down; a voice can outlive its key while it fades. */
const pending = new Set<number>();

export function noteOn(midi: number, velocity = 0.8) {
  if (!ctx) return;
  releaseVoice(midi, 0.02);
  const p = params.get();
  const now = ctx.currentTime;
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 5;
  // The filter opens with each note and settles: that is the "pluck".
  filter.frequency.setValueAtTime(Math.min(16000, cutoffHz(p.filter) * 2.5), now);
  filter.frequency.setTargetAtTime(cutoffHz(p.filter), now, 0.18);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, now);
  amp.gain.linearRampToValueAtTime(velocity * 0.3, now + attackSeconds(p.attack));

  // Two oscillators a few cents apart: the slow beating makes one note sound wide.
  const oscillators = [-6, 6].map((cents) => {
    const oscillator = ctx!.createOscillator();
    oscillator.type = WAVES[Math.round(p.wave)];
    oscillator.frequency.value = frequency;
    oscillator.detune.value = cents;
    oscillator.connect(filter);
    oscillator.start(now);
    return oscillator;
  });
  filter.connect(amp).connect(bus);

  voices.set(midi, { oscillators, amp, filter });
  pending.add(midi);
  publishHeld();
  onNote?.(midi, velocity);
}

function releaseVoice(midi: number, seconds: number) {
  const voice = voices.get(midi);
  if (!voice || !ctx) return;
  voices.delete(midi);
  const now = ctx.currentTime;
  voice.amp.gain.cancelScheduledValues(now);
  voice.amp.gain.setTargetAtTime(0, now, seconds / 4);
  for (const oscillator of voice.oscillators) oscillator.stop(now + seconds * 1.5 + 0.1);
}

export function noteOff(midi: number) {
  pending.delete(midi);
  releaseVoice(midi, releaseSeconds(params.get().release));
  publishHeld();
}

/** The visuals register here to learn about each new note. */
let onNote: ((midi: number, velocity: number) => void) | null = null;
export const listenNotes = (listener: typeof onNote) => (onNote = listener);

// --- Changing the sound -------------------------------------------------------------
export function setParam(key: keyof Params, value: number) {
  params.set({ ...params.get(), [key]: value });
  const now = current.get();
  if (!now.edited) current.set({ ...now, edited: true });
}

export function applyPreset(id: string) {
  const preset = presets.find((p) => p.id === id);
  if (!preset) return;
  params.set({ ...preset.params });
  current.set({ id, edited: false });
}

// --- "Play for me": a random walk over a pentatonic scale -----------------------------
const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic: any two notes sound fine together
let autoTimer = 0;
let step = 7;

function autoStep() {
  const beat = 150 + (1 - params.get().speed) * 260;
  step = Math.max(2, Math.min(14, step + Math.round((Math.random() - 0.5) * 5)));
  const midi = 45 + Math.floor(step / 5) * 12 + SCALE[step % 5];
  const length = beat * (Math.random() < 0.25 ? 3 : 1.4);
  noteOn(midi, 0.45 + Math.random() * 0.4);
  setTimeout(() => noteOff(midi), length);
  // Now and then, a low root note underneath.
  if (Math.random() < 0.18) {
    const root = 33 + SCALE[Math.floor(Math.random() * 3)];
    noteOn(root, 0.6);
    setTimeout(() => noteOff(root), beat * 6);
  }
  autoTimer = window.setTimeout(autoStep, Math.random() < 0.2 ? beat * 2 : beat);
}

export function setAutoplay(on: boolean) {
  clearTimeout(autoTimer);
  autoplay.set(on);
  if (on) {
    start();
    autoStep();
  }
}

// --- Microphone -----------------------------------------------------------------------
export async function toggleMic() {
  if (mic.get() === 'on') {
    micStream?.getTracks().forEach((track) => track.stop());
    micAnalyser = null;
    mic.set('off');
    return;
  }
  start();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micAnalyser = ctx!.createAnalyser();
    micAnalyser.fftSize = 2048;
    micAnalyser.smoothingTimeConstant = 0.78;
    // Analysed only, never sent to the speakers, so it can't feed back.
    ctx!.createMediaStreamSource(micStream).connect(micAnalyser);
    mic.set('on');
  } catch {
    mic.set('denied');
  }
}

// --- Analysis for the visuals ---------------------------------------------------------
export const BANDS = 64;
export const WAVE = 256;
const bins = new Uint8Array(1024);
const micBins = new Uint8Array(1024);
const time = new Uint8Array(2048);

export interface Analysis {
  spectrum: Uint8Array; // BANDS values, low to high, log-spaced
  waveform: Uint8Array; // WAVE values, 128 = silence
  bass: number;
  mid: number;
  high: number;
  level: number;
}
const analysis: Analysis = {
  spectrum: new Uint8Array(BANDS),
  waveform: new Uint8Array(WAVE).fill(128),
  bass: 0,
  mid: 0,
  high: 0,
  level: 0,
};

export function analyse(): Analysis {
  if (!ctx) return analysis;
  analyser.getByteFrequencyData(bins);
  const source = micAnalyser ?? analyser;
  if (micAnalyser) {
    micAnalyser.getByteFrequencyData(micBins);
    for (let i = 0; i < bins.length; i++) if (micBins[i] > bins[i]) bins[i] = micBins[i];
  }
  // Fold 1024 linear bins into 64 log-spaced bands: equal width per octave,
  // which is how pitch is heard.
  for (let band = 0; band < BANDS; band++) {
    const from = Math.floor(Math.pow(band / BANDS, 2.2) * 700) + 1;
    const to = Math.max(from + 1, Math.floor(Math.pow((band + 1) / BANDS, 2.2) * 700) + 1);
    let peak = 0;
    for (let i = from; i < to; i++) if (bins[i] > peak) peak = bins[i];
    analysis.spectrum[band] = peak;
  }
  source.getByteTimeDomainData(time);
  for (let i = 0; i < WAVE; i++) analysis.waveform[i] = time[i * 4];

  const average = (from: number, to: number) => {
    let sum = 0;
    for (let i = from; i < to; i++) sum += analysis.spectrum[i];
    return sum / (to - from) / 255;
  };
  analysis.bass = average(0, 12);
  analysis.mid = average(12, 36);
  analysis.high = average(36, BANDS);
  analysis.level = analysis.bass * 0.5 + analysis.mid * 0.35 + analysis.high * 0.15;
  return analysis;
}

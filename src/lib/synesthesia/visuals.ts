// Four ways of looking at the same sound, in one fragment shader.
// The audio reaches the GPU as three tiny textures, rewritten every frame:
//   uSpec — the spectrum right now (64 x 1)
//   uWave — the waveform right now (256 x 1)
//   uHist — the last 64 spectra, one per row: a scrolling memory of what was played

import { BANDS, WAVE, type Analysis } from './engine';

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uScene;
uniform float uFade;
uniform float uBass, uMid, uHigh, uLevel;
uniform float uGlow, uDetail;
uniform vec3 uA, uB, uC;      // palette: dark, main, highlight
uniform vec3 uTint;           // colour of the notes being played
uniform float uTintAmount;
uniform sampler2D uSpec, uWave, uHist;
uniform float uHistRow;       // v coordinate of the newest row in uHist
uniform vec4 uNotes[6];       // hue, age (s), velocity, x position

const float PI = 3.14159265;

vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0);
  return mix(mix(uA, uB, smoothstep(0.0, 0.55, t)), uC, smoothstep(0.5, 1.0, t));
}
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 17.3; a *= 0.5; }
  return v;
}

// Silk: ribbons whose shape is the waveform itself.
vec3 silk(vec2 uv) {
  vec3 col = vec3(0.0);
  float lines = 5.0 + floor(uDetail * 8.0);
  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    if (fi >= lines) break;
    float t = fi / (lines - 1.0);
    float w = texture2D(uWave, vec2(uv.x * 0.22 + 0.5 + t * 0.07, 0.5)).r - 0.5;
    float y = sin(uv.x * (1.3 + t * 2.2) + uTime * (0.35 + t * 0.4) + fi * 1.7) * (0.12 + 0.1 * t)
            + (t - 0.5) * 0.9
            + w * (0.35 + uLevel * 1.3);
    float d = abs(uv.y - y);
    col += pal(t) * (0.0035 + 0.01 * uLevel) / (d + 0.006) * 0.45;
  }
  return col;
}

// Bloom: the spectrum wrapped around a circle and mirrored into petals.
vec3 bloom(vec2 uv) {
  float r = length(uv);
  float n = 3.0 + floor(uDetail * 9.0);
  float a = atan(uv.y, uv.x) + uTime * 0.07;
  float seg = PI / n;
  a = abs(mod(a, 2.0 * seg) - seg);
  float s = texture2D(uSpec, vec2(clamp(r * 0.72, 0.0, 1.0), 0.5)).r;
  float petal = 0.5 + 0.5 * cos(a * n * 2.0 + r * 14.0 - uTime * 1.3);
  float rings = 0.5 + 0.5 * sin(r * 34.0 - uTime * 2.0 - s * 6.0);
  vec3 col = pal(fract(r * 0.9 - uTime * 0.04)) * s * s * (0.35 + 1.6 * petal * rings);
  col += uC * uBass * 0.5 * exp(-r * 5.0);
  col += pal(0.5) * 0.05 * petal * exp(-r * 1.4); // a faint flower even in silence
  return col;
}

// Liquid: smoke that the bass stirs.
vec3 liquid(vec2 uv) {
  vec2 p = uv * (1.2 + uDetail * 1.6);
  float t = uTime * 0.12;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + (1.6 + uBass * 3.5) * q + vec2(1.7, 9.2)), fbm(p + 2.0 * q + vec2(8.3, 2.8) + t));
  float v = fbm(p + (2.2 + uMid * 2.5) * r);
  vec3 col = pal(v * 1.25 + uHigh * 0.35 - 0.1) * (0.05 + v * v * (0.55 + uLevel * 2.2));
  col += uC * pow(v, 6.0) * uHigh * 4.0;
  return col;
}

// Strata: every line is the spectrum from a moment ago, receding into the distance.
vec3 strata(vec2 uv) {
  vec3 col = vec3(0.0);
  float rows = 14.0 + floor(uDetail * 16.0);
  float aspect = uRes.x / uRes.y;
  for (int i = 29; i >= 0; i--) {     // far to near, so near ridges hide far ones
    float fi = float(i);
    if (fi >= rows) continue;
    float t = fi / (rows - 1.0);      // 0 = nearest (newest), 1 = farthest
    float scale = mix(1.0, 0.42, t);
    float x = uv.x / aspect / scale;
    float h = texture2D(uHist, vec2(clamp(abs(x) * 1.15, 0.0, 1.0), uHistRow - t * 0.46)).r;
    float y = -0.72 + t * 1.25 + h * 0.42 * scale;
    float inside = step(abs(x), 0.87);
    if (uv.y < y) col *= 1.0 - 0.92 * inside;
    float d = abs(uv.y - y);
    col += pal(1.0 - t) * inside * (0.003 * scale) / (d + 0.0035) * (0.35 + 1.4 * h) * mix(1.0, 0.35, t);
  }
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 col;
  if (uScene < 0.5) col = silk(uv);
  else if (uScene < 1.5) col = bloom(uv);
  else if (uScene < 2.5) col = liquid(uv);
  else col = strata(uv);

  // The synaesthesia part: what is being played tints everything.
  col *= mix(vec3(1.0), uTint * 1.2 + 0.4, uTintAmount);

  // Each new note drops a ring of its own colour.
  float aspect = uRes.x / uRes.y;
  for (int i = 0; i < 6; i++) {
    vec4 note = uNotes[i];
    if (note.z <= 0.0) continue;
    vec2 centre = vec2((note.w - 0.5) * aspect * 1.5, -0.55);
    float d = abs(length(uv - centre) - note.y * 0.75);
    col += hue(note.x) * note.z * exp(-note.y * 1.6) * 0.012 / (d + 0.006);
  }

  col *= (0.45 + uGlow * 1.5) * uFade;
  col = 1.0 - exp(-col * 1.25);                         // soft clip instead of blowing out
  col *= 1.0 - 0.38 * dot(uv * 0.5, uv * 0.5);          // vignette
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.018; // grain hides banding
  col += vec3(0.027, 0.027, 0.043) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface Frame {
  time: number;
  scene: number;
  fade: number;
  glow: number;
  detail: number;
  palette: Float32Array; // 9 values: three RGB colours
  tint: [number, number, number];
  tintAmount: number;
  notes: Float32Array; // 6 x vec4
  audio: Analysis;
}

const HISTORY = 64;

export function createVisuals(canvas: HTMLCanvasElement) {
  // preserveDrawingBuffer keeps the last frame readable, which "Save poster" needs.
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
    }
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed');
  }
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const loc = {
    res: u('uRes'), time: u('uTime'), scene: u('uScene'), fade: u('uFade'),
    bass: u('uBass'), mid: u('uMid'), high: u('uHigh'), level: u('uLevel'),
    glow: u('uGlow'), detail: u('uDetail'),
    a: u('uA'), b: u('uB'), c: u('uC'),
    tint: u('uTint'), tintAmount: u('uTintAmount'),
    histRow: u('uHistRow'), notes: u('uNotes'),
  };

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const texture = (unit: number, name: string, wrapT: number) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    gl.uniform1i(u(name), unit);
  };
  texture(0, 'uSpec', gl.CLAMP_TO_EDGE);
  texture(1, 'uWave', gl.CLAMP_TO_EDGE);
  texture(2, 'uHist', gl.REPEAT); // a ring buffer: rows wrap around

  const history = new Uint8Array(BANDS * HISTORY);
  let row = 0;
  let lastRow = 0;
  let dpr = 1;

  return {
    resize(width: number, height: number) {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    draw(frame: Frame) {
      const { audio } = frame;
      gl.activeTexture(gl.TEXTURE0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, BANDS, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, audio.spectrum);
      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, WAVE, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, audio.waveform);

      // Push a new row of history about 20 times a second, whatever the frame rate.
      if (frame.time - lastRow > 0.05) {
        lastRow = frame.time;
        row = (row + 1) % HISTORY;
        history.set(audio.spectrum, row * BANDS);
        gl.activeTexture(gl.TEXTURE2);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, BANDS, HISTORY, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, history);
      }

      gl.uniform2f(loc.res, canvas.width, canvas.height);
      gl.uniform1f(loc.time, frame.time);
      gl.uniform1f(loc.scene, frame.scene);
      gl.uniform1f(loc.fade, frame.fade);
      gl.uniform1f(loc.bass, audio.bass);
      gl.uniform1f(loc.mid, audio.mid);
      gl.uniform1f(loc.high, audio.high);
      gl.uniform1f(loc.level, audio.level);
      gl.uniform1f(loc.glow, frame.glow);
      gl.uniform1f(loc.detail, frame.detail);
      gl.uniform3fv(loc.a, frame.palette.subarray(0, 3));
      gl.uniform3fv(loc.b, frame.palette.subarray(3, 6));
      gl.uniform3fv(loc.c, frame.palette.subarray(6, 9));
      gl.uniform3f(loc.tint, frame.tint[0], frame.tint[1], frame.tint[2]);
      gl.uniform1f(loc.tintAmount, frame.tintAmount);
      gl.uniform1f(loc.histRow, (row + 0.5) / HISTORY);
      gl.uniform4fv(loc.notes, frame.notes);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

export const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

/** Same hue wheel as the shader, for colouring the on-screen keys. */
export function hueToRgb(h: number): [number, number, number] {
  const channel = (offset: number) => Math.min(1, Math.max(0, Math.abs(((h + offset) % 1) * 6 - 3) - 1));
  return [channel(0), channel(2 / 3), channel(1 / 3)];
}

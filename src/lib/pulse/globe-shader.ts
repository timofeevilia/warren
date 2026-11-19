// The Pulse globe: one fragment shader, two small textures.
//   uLand   — land mask, generated at build time from Natural Earth
//   uAurora — NOAA's aurora probability grid, uploaded as-is each time it updates
// The aurora is drawn as light with height: several transparent shells above the
// surface are sampled along each view ray, green near the ground fading to violet
// higher up, which is what makes the curtains stand off the limb of the planet.

import { GRID_H, GRID_W } from './data';

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 uCenter;
uniform float uRadius;
uniform float uTime;
uniform mat3 uRot;     // view space -> geographic space
uniform vec3 uSun;     // direction to the Sun, geographic space
uniform sampler2D uLand;
uniform sampler2D uAurora;
uniform float uHasAurora;

const float PI = 3.14159265;
const int SHELLS = 10;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// Geographic direction -> (longitude, latitude) in radians.
vec2 lonLat(vec3 g) { return vec2(atan(g.x, g.z), asin(clamp(g.y, -1.0, 1.0))); }

// Light emitted by the aurora at geographic direction g, 0..1.
float auroraAt(vec3 g) {
  vec2 ll = lonLat(g);
  float p = texture2D(uAurora, vec2(ll.x / (2.0 * PI), ll.y / PI + 0.5)).r; // 1.0 = 100 %
  // Fine vertical rays that drift sideways: the "curtain" structure.
  float rays = 0.55 + 0.45 * noise(vec2(ll.x * 60.0 + uTime * 0.25, ll.y * 6.0 - uTime * 0.05));
  float shimmer = 0.8 + 0.2 * noise(vec2(ll.x * 9.0 - uTime * 0.12, uTime * 0.3));
  // Quiet nights peak around 10-20 %; this curve keeps them visible without
  // letting a real storm blow out to white.
  return (1.0 - exp(-p * 7.0)) * rays * shimmer;
}

void main() {
  vec2 p = (gl_FragCoord.xy - uCenter) / uRadius;
  float d = length(p);
  vec3 col = vec3(0.027, 0.027, 0.043);

  // Stars
  vec2 cell = gl_FragCoord.xy / 54.0;
  vec2 id = floor(cell);
  float rnd = hash(id);
  vec2 off = fract(cell) - 0.15 - 0.7 * vec2(rnd, hash(id + 7.0));
  float star = smoothstep(0.035, 0.0, length(off)) * step(0.6, hash(id + 3.0));
  col += star * star * (0.5 + 0.5 * sin(uTime * (0.5 + rnd) + rnd * 40.0)) * 0.7;

  if (d < 1.0) {
    vec3 n = vec3(p, sqrt(1.0 - d * d));
    vec3 g = uRot * n;
    vec2 ll = lonLat(g);
    float land = texture2D(uLand, vec2(ll.x / (2.0 * PI) + 0.5, 0.5 - ll.y / PI)).r;
    land = max(land, step(ll.y, -1.5)); // the mask has a pinhole at the south pole
    float day = smoothstep(-0.12, 0.22, dot(g, uSun));

    vec3 ocean = mix(vec3(0.016, 0.022, 0.042), vec3(0.04, 0.085, 0.17), day);
    vec3 ground = mix(vec3(0.055, 0.065, 0.1), vec3(0.16, 0.2, 0.3), day);
    vec3 surf = mix(ocean, ground, smoothstep(0.35, 0.65, land));
    // Coastline: brightest where the mask is half-way between sea and land.
    surf += vec3(0.25, 0.32, 0.45) * land * (1.0 - land) * 1.6;
    // Graticule every 15 degrees.
    vec2 grid = abs(fract(vec2(ll.x, ll.y) * (12.0 / PI) + 0.5) - 0.5);
    surf += 0.035 * (smoothstep(0.012, 0.0, grid.x) + smoothstep(0.012, 0.0, grid.y));

    col = surf * (0.55 + 0.45 * n.z);
    // Thin blue atmosphere at grazing angles, stronger on the day side.
    col += vec3(0.2, 0.45, 1.0) * pow(1.0 - n.z, 3.5) * (0.25 + 0.5 * day);
    float edge = smoothstep(1.0, 1.0 - 2.5 / uRadius, d);
    col = mix(vec3(0.027, 0.027, 0.043), col, edge);
  } else {
    col += vec3(0.2, 0.45, 1.0) * exp(-(d - 1.0) * 26.0) * 0.22;
  }

  // Aurora shells, 80 to ~500 km up (exaggerated so they read at globe scale).
  if (uHasAurora > 0.5) {
    vec3 glow = vec3(0.0);
    for (int k = 0; k < SHELLS; k++) {
      float t = float(k) / float(SHELLS - 1);
      float r = 1.012 + t * 0.075;
      if (d >= r) continue;
      float z = sqrt(r * r - d * d);
      vec3 tint = mix(vec3(0.2, 1.0, 0.62), vec3(0.62, 0.3, 1.0), smoothstep(0.25, 1.0, t));
      float weight = exp(-t * 2.2) * 0.34;
      // Front of the shell: always in front of the planet.
      vec3 gf = uRot * (vec3(p, z) / r);
      float night = 1.0 - 0.75 * smoothstep(-0.1, 0.25, dot(gf, uSun));
      glow += tint * auroraAt(gf) * weight * night;
      // Back of the shell: only visible beyond the limb.
      if (d > 1.0) {
        vec3 gb = uRot * (vec3(p, -z) / r);
        float nightB = 1.0 - 0.75 * smoothstep(-0.1, 0.25, dot(gb, uSun));
        glow += tint * auroraAt(gb) * weight * nightB;
      }
    }
    col += glow;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface GlobeFrame {
  x: number; // globe centre, px from left
  y: number; // px from top
  radius: number; // px
  time: number; // seconds
  /** Row-major 3x3: columns are east, north and forward of the view, in geographic space. */
  rotation: Float32Array;
  sun: [number, number, number];
}

export function createGlobeRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
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
    center: u('uCenter'),
    radius: u('uRadius'),
    time: u('uTime'),
    rot: u('uRot'),
    sun: u('uSun'),
    hasAurora: u('uHasAurora'),
  };

  const makeTexture = (unit: number, wrapS: number) => {
    const texture = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // Unit 0: land mask. A 1x1 placeholder until the image arrives.
  makeTexture(0, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
  gl.uniform1i(u('uLand'), 0);
  const image = new Image();
  image.onload = () => {
    gl.activeTexture(gl.TEXTURE0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, image);
  };
  image.src = '/pulse/land.png';

  // Unit 1: aurora grid, resampled to a power-of-two size so it can wrap in longitude.
  const AW = 512;
  const AH = 256;
  const pixels = new Uint8Array(AW * AH);
  makeTexture(1, gl.REPEAT);
  gl.uniform1i(u('uAurora'), 1);
  gl.uniform1f(loc.hasAurora, 0);

  let dpr = 1;

  return {
    resize(width: number, height: number) {
      // The shader does up to 20 texture reads per pixel near the limb; a modest
      // pixel ratio keeps it smooth on integrated graphics.
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    /** Upload NOAA's 360x181 grid (bilinear resample, 100 % -> 255). */
    setAurora(grid: Uint8Array) {
      for (let y = 0; y < AH; y++) {
        const fy = (y / (AH - 1)) * (GRID_H - 1);
        const y0 = Math.floor(fy);
        const y1 = Math.min(GRID_H - 1, y0 + 1);
        const ty = fy - y0;
        for (let x = 0; x < AW; x++) {
          const fx = (x / AW) * GRID_W;
          const x0 = Math.floor(fx) % GRID_W;
          const x1 = (x0 + 1) % GRID_W;
          const tx = fx - Math.floor(fx);
          const top = grid[y0 * GRID_W + x0] * (1 - tx) + grid[y0 * GRID_W + x1] * tx;
          const bottom = grid[y1 * GRID_W + x0] * (1 - tx) + grid[y1 * GRID_W + x1] * tx;
          pixels[y * AW + x] = Math.min(255, (top * (1 - ty) + bottom * ty) * 2.55);
        }
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, AW, AH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, pixels);
      gl.uniform1f(loc.hasAurora, 1);
    },

    draw(frame: GlobeFrame) {
      gl.uniform2f(loc.center, frame.x * dpr, canvas.height - frame.y * dpr);
      gl.uniform1f(loc.radius, frame.radius * dpr);
      gl.uniform1f(loc.time, frame.time);
      gl.uniformMatrix3fv(loc.rot, false, frame.rotation);
      gl.uniform3f(loc.sun, frame.sun[0], frame.sun[1], frame.sun[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

/** Unit vector for a point on the globe. +Y is north, +Z is longitude 0. */
export function geoVector(lat: number, lon: number): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  return [Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda)];
}

/**
 * Fills `out` with the view basis for a camera looking at (lat, lon), north up.
 * Column-major for uniformMatrix3fv: columns are east, north, forward.
 */
export function viewBasis(lat: number, lon: number, out: Float32Array) {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  const sl = Math.sin(lambda);
  const cl = Math.cos(lambda);
  out[0] = cl;        out[1] = 0;   out[2] = -sl;       // east
  out[3] = -sp * sl;  out[4] = cp;  out[5] = -sp * cl;  // north
  out[6] = cp * sl;   out[7] = sp;  out[8] = cp * cl;   // forward
  return out;
}

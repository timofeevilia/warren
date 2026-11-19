// Every planet in the journey is the same fragment shader with different uniforms.
// No textures and no 3D engine: a sphere is drawn analytically (for each pixel inside
// the disc we know the surface normal), and the surface is procedural noise.

import { hexToRgb, type Look } from './bodies';

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCenter;   // px, origin bottom-left
uniform float uRadius;  // px
uniform float uKind;    // 0 rocky, 1 gas, 2 star, 3 earth, 4 starfield
uniform vec3 uC1, uC2, uC3;
uniform vec3 uAtm;
uniform float uAtmPow;
uniform float uBands;
uniform float uScale;
uniform float uSpin;
uniform vec3 uAxis;     // rotation axis in view space
uniform vec3 uRing;     // inner radius, outer radius, opacity
uniform vec3 uRingColor;
uniform vec3 uLight;
uniform float uSeed;
uniform float uScroll;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
vec3 spinY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 starfield(vec2 frag) {
  vec3 col = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float cell = 46.0 + fl * 38.0;
    // Nearer layers move more with scroll: cheap parallax.
    vec2 uv = (frag + vec2(0.0, uScroll * (30.0 + fl * 45.0))) / cell;
    vec2 id = floor(uv);
    vec3 rnd = vec3(hash(vec3(id, fl)), hash(vec3(id, fl + 7.0)), hash(vec3(id, fl + 13.0)));
    vec2 d = fract(uv) - 0.15 - 0.7 * rnd.xy;
    float size = (0.02 + 0.03 * rnd.z * rnd.z) / (1.0 + fl * 0.8);
    float twinkle = 0.75 + 0.25 * sin(uTime * (0.6 + rnd.x * 2.0) + rnd.y * 40.0);
    float core = smoothstep(size, 0.0, length(d));
    float star = core * core * step(0.55, rnd.z) * twinkle;
    col += star * mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.78), rnd.x);
  }
  return col;
}

void main() {
  if (uKind > 3.5) {
    vec3 s = starfield(gl_FragCoord.xy);
    gl_FragColor = vec4(s, max(s.r, max(s.g, s.b)));
    return;
  }

  vec2 p = (gl_FragCoord.xy - uCenter) / uRadius;
  float d = length(p);
  bool star = uKind > 1.5 && uKind < 2.5;
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // Halo outside the disc. A star glows all around; a planet only on its lit side.
  if (d > 1.0) {
    float fall = star ? 2.2 : 9.0;
    float side = star ? 1.0 : smoothstep(-0.6, 0.7, dot(normalize(p), normalize(uLight.xy)));
    float halo = exp(-(d - 1.0) * fall) * uAtmPow * (star ? 0.9 : 0.55) * side;
    col = uAtm * halo;
    alpha = halo;
  }

  if (d < 1.0) {
    vec3 n = vec3(p, sqrt(1.0 - d * d));
    // Express the normal in the planet's own frame (axis = "up"), then spin it.
    vec3 u = normalize(cross(uAxis, vec3(0.0, 0.0, 1.0)));
    vec3 v = cross(u, uAxis);
    vec3 q = spinY(vec3(dot(n, u), dot(n, uAxis), dot(n, v)), uTime * uSpin + uSeed);
    float l = dot(n, uLight);
    vec3 surf;

    if (star) {
      float g = fbm(q * uScale + vec3(0.0, uTime * 0.04, 0.0));
      float cells = fbm(q * uScale * 3.0 - vec3(uTime * 0.06));
      surf = mix(uC1, uC2, smoothstep(0.25, 0.75, g));
      surf = mix(surf, uC3, smoothstep(0.55, 0.9, cells) * 0.7);
      // Limb darkening: the edge of a star is dimmer and redder.
      col = surf * (0.45 + 0.75 * pow(n.z, 0.45));
    } else {
      if (uKind < 0.5) {
        float h = fbm(q * uScale);
        surf = mix(uC1, uC2, smoothstep(0.32, 0.62, h));
        surf = mix(surf, uC3, smoothstep(0.55, 0.8, fbm(q * uScale * 2.6 + 3.0)));
        // Cheap relief: darken where fine noise dips.
        surf *= 0.8 + 0.4 * fbm(q * uScale * 6.0 + 9.0);
      } else if (uKind < 1.5) {
        float turb = fbm(q * uScale + uSeed);
        float lat = q.y * uBands;
        float b = fbm(vec3(lat + turb * 0.9, turb * 0.35, uSeed));
        surf = mix(uC1, uC2, smoothstep(0.34, 0.66, b));
        surf = mix(surf, uC3, smoothstep(0.5, 0.82, fbm(vec3(lat * 2.3 + turb * 1.4, 1.7, uSeed + 4.0))));
      } else {
        float h = fbm(q * uScale + 2.0);
        float land = smoothstep(0.5, 0.53, h);
        vec3 ground = mix(uC2, uC3, smoothstep(0.55, 0.72, fbm(q * uScale * 2.0 + 5.0)));
        surf = mix(uC1 * (0.7 + 0.6 * h), ground, land);
        surf = mix(surf, vec3(0.92, 0.95, 1.0), smoothstep(0.78, 0.9, abs(q.y) + 0.12 * h));
        // Sun glint on the oceans only.
        vec3 hv = normalize(uLight + vec3(0.0, 0.0, 1.0));
        surf += (1.0 - land) * pow(max(dot(n, hv), 0.0), 60.0) * 0.6;
        float clouds = smoothstep(0.5, 0.72, fbm(spinY(q, uTime * 0.012) * 3.6 + 7.0));
        surf = mix(surf, vec3(1.0), clouds * 0.85);
      }
      float lit = smoothstep(-0.12, 0.65, l);
      col = surf * (lit * 1.08 + 0.012);
      // Atmosphere: light scattered at grazing angles.
      float rim = pow(1.0 - n.z, 3.0);
      col += uAtm * rim * uAtmPow * smoothstep(-0.25, 0.5, l);
    }
    float edge = smoothstep(1.0, 1.0 - 2.5 / uRadius, d);
    alpha = mix(alpha, 1.0, edge);
  }

  // Rings: intersect the view ray with the equatorial plane.
  if (uRing.z > 0.0) {
    float z = -(p.x * uAxis.x + p.y * uAxis.y) / uAxis.z;
    vec3 P = vec3(p, z);
    float r = length(P);
    bool hidden = d < 1.0 && z < sqrt(max(1.0 - d * d, 0.0));
    if (r > uRing.x && r < uRing.y && !hidden) {
      float t = (r - uRing.x) / (uRing.y - uRing.x);
      float grain = 0.5 + 0.5 * noise(vec3(r * 42.0, 0.0, uSeed));
      float gap = smoothstep(0.0, 0.035, abs(t - 0.62)); // Cassini division
      float ra = uRing.z * grain * gap * smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.93, t);
      // Shadow the planet casts on its rings.
      float bl = dot(P, uLight);
      float shadow = (bl < 0.0 && r * r - bl * bl < 1.0) ? 0.12 : 1.0;
      vec3 rc = uRingColor * (0.75 + 0.35 * grain) * shadow;
      col = col * (1.0 - ra) + rc * ra;
      alpha = alpha + ra * (1.0 - alpha);
    }
  }

  gl_FragColor = vec4(col, alpha);
}
`;

export interface DrawParams {
  look: Look;
  x: number; // px from left
  y: number; // px from top
  radius: number; // px
  seed: number;
}

export function createPlanetRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
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

  // One triangle that covers the whole screen.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const names = [
    'uRes', 'uTime', 'uCenter', 'uRadius', 'uKind', 'uC1', 'uC2', 'uC3', 'uAtm', 'uAtmPow',
    'uBands', 'uScale', 'uSpin', 'uAxis', 'uRing', 'uRingColor', 'uLight', 'uSeed', 'uScroll',
  ] as const;
  const u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)])) as Record<
    (typeof names)[number],
    WebGLUniformLocation | null
  >;

  // Light comes from the upper left, slightly toward the viewer.
  const light = [-0.72, 0.24, 0.65];
  const len = Math.hypot(...light);
  let dpr = 1;
  let time = 0;

  return {
    resize(width: number, height: number) {
      dpr = Math.min(devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    begin(seconds: number, scroll: number) {
      time = seconds;
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, time);
      gl.uniform3f(u.uLight, light[0] / len, light[1] / len, light[2] / len);
      gl.uniform1f(u.uScroll, scroll);
      gl.uniform1f(u.uKind, 4);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    planet({ look, x, y, radius, seed }: DrawParams) {
      const cx = x * dpr;
      const cy = canvas.height - y * dpr;
      const r = radius * dpr;
      // Only shade the pixels this body can touch (disc + halo + rings).
      const reach = r * (look.ring ? look.ring.outer + 0.1 : look.kind === 2 ? 3.2 : 1.6);
      if (cx + reach < 0 || cx - reach > canvas.width || cy + reach < 0 || cy - reach > canvas.height) return;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.floor(cx - reach), Math.floor(cy - reach), Math.ceil(reach * 2), Math.ceil(reach * 2));

      const lean = 0.3; // tip the north pole toward the viewer so rings open up
      gl.uniform2f(u.uCenter, cx, cy);
      gl.uniform1f(u.uRadius, r);
      gl.uniform1f(u.uKind, look.kind);
      gl.uniform3f(u.uC1, ...hexToRgb(look.colors[0]));
      gl.uniform3f(u.uC2, ...hexToRgb(look.colors[1]));
      gl.uniform3f(u.uC3, ...hexToRgb(look.colors[2]));
      gl.uniform3f(u.uAtm, ...hexToRgb(look.atmosphere));
      gl.uniform1f(u.uAtmPow, look.atmospherePower);
      gl.uniform1f(u.uBands, look.bands);
      gl.uniform1f(u.uScale, look.scale);
      gl.uniform1f(u.uSpin, look.spin);
      gl.uniform3f(
        u.uAxis,
        Math.sin(look.tilt) * Math.cos(lean),
        Math.cos(look.tilt) * Math.cos(lean),
        Math.sin(lean),
      );
      gl.uniform1f(u.uSeed, seed);
      if (look.ring) {
        gl.uniform3f(u.uRing, look.ring.inner, look.ring.outer, look.ring.opacity);
        gl.uniform3f(u.uRingColor, ...hexToRgb(look.ring.color));
      } else {
        gl.uniform3f(u.uRing, 0, 0, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

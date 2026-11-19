<script lang="ts">
  // A tiny live preview for each experiment, drawn on a 2D canvas.
  // The loop only runs while the card is on screen.
  import { onMount } from 'svelte';
  import type { ExperimentId } from '../../lib/experiments';

  let { kind, active = false }: { kind: ExperimentId; active?: boolean } = $props();

  let canvas: HTMLCanvasElement;
  // `active` (hover) speeds the animation up; eased so it never jumps.
  let speed = 1;

  type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

  const TAU = Math.PI * 2;

  const painters: Record<ExperimentId, Painter> = {
    orbita(ctx, w, h, t) {
      const cx = w * 0.5;
      const cy = h * 0.54;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.55);
      glow.addColorStop(0, 'rgba(255, 180, 84, 0.55)');
      glow.addColorStop(0.12, 'rgba(255, 180, 84, 0.2)');
      glow.addColorStop(1, 'rgba(255, 180, 84, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff2d0';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, TAU);
      ctx.fill();
      const bodies = [
        [0.11, 4.1, 2.2, '#b8b0a8'],
        [0.17, 1.6, 3.2, '#e8c48a'],
        [0.24, 1.0, 3.4, '#6fa8ff'],
        [0.32, 0.53, 2.8, '#e0704a'],
        [0.47, 0.18, 6.5, '#d9b286'],
      ] as const;
      for (const [r, rate, size, color] of bodies) {
        const rx = w * r;
        const ry = rx * 0.36;
        ctx.strokeStyle = 'rgba(237, 235, 230, 0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
        ctx.stroke();
        const a = t * rate * 0.5 + r * 40;
        // Trail: a short arc behind the body.
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, a - 0.7, a);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, size, 0, TAU);
        ctx.fill();
      }
    },

    pulse(ctx, w, h, t) {
      // A dotted globe seen from above the pole, with a shimmering aurora oval.
      const cx = w * 0.5;
      const cy = h * 0.98;
      const R = h * 0.82; // the globe is larger than the card: we see its top
      const rot = t * 0.12;
      const tilt = 0.6; // camera latitude, radians
      const st = Math.sin(tilt);
      const ct = Math.cos(tilt);
      const project = (lat: number, lon: number) => {
        const x = Math.cos(lat) * Math.sin(lon);
        const y = Math.sin(lat);
        const z = Math.cos(lat) * Math.cos(lon);
        return [x, y * ct - z * st, y * st + z * ct]; // screen x, screen y (up), depth
      };
      for (let latDeg = 0; latDeg <= 84; latDeg += 7) {
        const lat = (latDeg * Math.PI) / 180;
        const count = Math.max(6, Math.round(70 * Math.cos(lat)));
        for (let i = 0; i < count; i++) {
          const [x, y, z] = project(lat, (i / count) * TAU + rot);
          if (z < 0) continue;
          ctx.fillStyle = `rgba(237, 235, 230, ${0.08 + z * 0.34})`;
          ctx.fillRect(cx + x * R, cy - y * R, 1.5, 1.5);
        }
      }
      // The oval: a ring around the pole, drawn as short vertical rays.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 220; i++) {
        const lon = (i / 220) * TAU;
        const lat = ((62 + 3 * Math.sin(lon * 2 + t * 0.3)) * Math.PI) / 180;
        const [x, y, z] = project(lat, lon + rot * 0.4);
        if (z < -0.05) continue;
        const flicker = 0.35 + 0.65 * Math.abs(Math.sin(i * 12.9898 + t * (0.8 + (i % 7) * 0.13)));
        const px = cx + x * R;
        const py = cy - y * R;
        const height = (14 + 30 * flicker) * (0.45 + 0.55 * z);
        const ray = ctx.createLinearGradient(px, py, px, py - height);
        ray.addColorStop(0, `rgba(77, 255, 176, ${0.55 * flicker})`);
        ray.addColorStop(0.6, `rgba(120, 140, 255, ${0.25 * flicker})`);
        ray.addColorStop(1, 'rgba(160, 90, 255, 0)');
        ctx.strokeStyle = ray;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - height);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    synesthesia(ctx, w, h, t) {
      ctx.globalCompositeOperation = 'lighter';
      const layers = [
        ['155, 107, 255', 1.0, 0],
        ['255, 107, 214', 1.35, 1.7],
        ['107, 196, 255', 0.8, 3.1],
      ] as const;
      for (const [color, freq, phase] of layers) {
        for (let line = 0; line < 5; line++) {
          ctx.strokeStyle = `rgba(${color}, ${0.5 - line * 0.09})`;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 6) {
            const u = x / w;
            const envelope = Math.sin(u * Math.PI) ** 2;
            const y =
              h * 0.55 +
              envelope *
                h *
                (0.2 - line * 0.03) *
                Math.sin(u * 9 * freq + t * (1.2 + line * 0.15) + phase) *
                Math.cos(u * 3.3 - t * 0.5 + phase);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    atelier(ctx, w, h, t) {
      const cx = w * 0.5;
      const cy = h * 0.54;
      const R = h * 0.36;
      // The dial is tilted in 3D and sways slowly: squash X by cos(tilt).
      const squash = Math.cos(Math.sin(t * 0.4) * 0.7);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(squash, 1);
      const sheen = ctx.createLinearGradient(-R, -R, R, R);
      sheen.addColorStop(0, 'rgba(216, 200, 168, 0.9)');
      sheen.addColorStop(0.5, 'rgba(216, 200, 168, 0.25)');
      sheen.addColorStop(1, 'rgba(216, 200, 168, 0.8)');
      ctx.strokeStyle = sheen;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.9, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU;
        const major = i % 5 === 0;
        const r0 = R * (major ? 0.76 : 0.83);
        ctx.strokeStyle = `rgba(216, 200, 168, ${major ? 0.9 : 0.35})`;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * R * 0.87, Math.sin(a) * R * 0.87);
        ctx.stroke();
      }
      const hand = (angle: number, length: number, width: number) => {
        ctx.strokeStyle = '#edebe6';
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.sin(angle) * R * length, -Math.cos(angle) * R * length);
        ctx.stroke();
      };
      hand(t * 0.02 + 1, 0.45, 2.5);
      hand(t * 0.24 + 4, 0.68, 1.5);
      ctx.strokeStyle = '#d8c8a8';
      hand(t * 1.05, 0.74, 0.75);
      ctx.restore();
    },
  };

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let visible = false;
    let last = 0;
    let t = kind.length * 3.7; // different start phase per card

    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };

    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((ms - last) / 1000, 0.05);
      last = ms;
      if (!visible) return;
      speed += ((active ? 3 : 1) - speed) * 0.08;
      if (!reduce) t += dt * speed;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      painters[kind](ctx, w, h, t);
    };

    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    const ro = new ResizeObserver(resize);
    io.observe(canvas);
    ro.observe(canvas);
    resize();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>

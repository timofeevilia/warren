<script lang="ts">
  // Hero background: a burrow seen from the entrance. Wobbly rings recede toward a
  // vanishing point that follows the pointer with a spring, so the tunnel "looks" at you.
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const RINGS = 26;
    const SEGMENTS = 72;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    // Vanishing point, in 0..1 of the canvas. Spring toward the pointer target.
    const target = { x: 0.68, y: 0.46 };
    const pos = { x: 0.68, y: 0.46 };
    const vel = { x: 0, y: 0 };

    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };

    const onPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = (e.clientY - r.top) / r.height;
    };

    const draw = (ms: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const t = reduce ? 0 : ms / 1000;

      // Critically-damped-ish spring.
      vel.x += (target.x - pos.x) * 0.02;
      vel.y += (target.y - pos.y) * 0.02;
      vel.x *= 0.86;
      vel.y *= 0.86;
      pos.x += vel.x;
      pos.y += vel.y;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const max = Math.hypot(w, h) * 0.75;
      const flow = (t * 0.06) % (1 / RINGS);

      for (let i = 0; i < RINGS; i++) {
        // depth 0 = far end of the tunnel, 1 = at the viewer.
        const depth = i / RINGS + flow;
        const k = depth * depth; // perspective: rings bunch up far away
        const radius = 12 + k * max;
        // Near rings sit at the screen centre, far rings at the vanishing point.
        const cx = w * (pos.x + (0.5 - pos.x) * k);
        const cy = h * (pos.y + (0.5 - pos.y) * k);
        ctx.beginPath();
        for (let s = 0; s <= SEGMENTS; s++) {
          const a = (s / SEGMENTS) * Math.PI * 2;
          const wobble =
            1 +
            0.045 * Math.sin(a * 3 + depth * 9 + t * 0.5) +
            0.03 * Math.sin(a * 5 - depth * 14 - t * 0.35);
          const x = cx + Math.cos(a) * radius * wobble * 1.12;
          const y = cy + Math.sin(a) * radius * wobble * 0.9;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const fade = Math.sin(Math.min(depth, 1) * Math.PI); // fade both ends
        ctx.strokeStyle = `rgba(237, 235, 230, ${0.03 + fade * 0.13})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(canvas);
    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', onPointer, { passive: true });
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPointer);
    };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    /* Fade the tunnel out toward the bottom so the grid below reads cleanly. */
    mask-image: linear-gradient(to bottom, #000 55%, transparent);
    -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent);
  }
</style>

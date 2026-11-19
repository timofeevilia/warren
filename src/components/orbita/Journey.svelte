<script lang="ts">
  // The scroll journey. Svelte owns the page: copy, reveals, the rail and the odometer.
  // A single fixed WebGL canvas sits behind it and is driven by one number —
  // `progress`, the (fractional) index of the chapter currently in view.
  import { onMount } from 'svelte';
  import { bodies } from '../../lib/orbita/bodies';
  import { createPlanetRenderer } from '../../lib/orbita/planet-shader';

  let canvas: HTMLCanvasElement;
  let chaptersEl: HTMLElement;

  let active = $state(-1); // -1 = intro, bodies.length = outro
  let au = $state(0); // odometer: distance from the Sun at the current scroll position
  let webgl = $state(true);

  const KM_PER_AU = 149_597_870.7;
  const LIGHT_MIN_PER_AU = 8.3167;

  const km = $derived(
    au < 0.001 ? '0' : Math.round((au * KM_PER_AU) / 1e6).toLocaleString('en').replace(/,/g, ' '),
  );
  const light = $derived.by(() => {
    const minutes = au * LIGHT_MIN_PER_AU;
    return minutes < 60
      ? `${minutes.toFixed(1)} min`
      : `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')} m`;
  });
  const accent = $derived(bodies[Math.max(0, Math.min(bodies.length - 1, active))].accent);

  function goTo(index: number) {
    const chapter = chaptersEl.children[index] as HTMLElement;
    chapter.scrollIntoView({ behavior: 'smooth' });
  }

  onMount(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: ReturnType<typeof createPlanetRenderer> = null;
    try {
      renderer = createPlanetRenderer(canvas);
    } catch (error) {
      console.error(error);
    }
    if (!renderer) {
      webgl = false;
    }

    let width = 0;
    let height = 0;
    let raf = 0;
    let smooth = -1; // eased copy of the scroll progress
    const started = performance.now();

    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      renderer?.resize(width, height);
    };

    const target = () => {
      const chapterHeight = chaptersEl.offsetHeight / bodies.length;
      return (scrollY - chaptersEl.offsetTop) / chapterHeight;
    };

    let previous = started;
    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((ms - previous) / 1000, 0.1);
      previous = ms;
      const goal = target();
      // Ease toward the real scroll position: this is what makes planets glide
      // instead of being glued to the scrollbar. Exponential smoothing in real
      // time, so it feels the same at 60 and 144 Hz.
      smooth = reduce ? goal : smooth + (goal - smooth) * (1 - Math.exp(-dt * 5.5));

      const index = Math.round(goal);
      if (index !== active) active = Math.max(-1, Math.min(bodies.length, index));

      // Odometer: interpolate distance between the two neighbouring chapters.
      const clamped = Math.max(0, Math.min(bodies.length - 1, smooth));
      const lo = Math.floor(clamped);
      const hi = Math.min(bodies.length - 1, lo + 1);
      const next = bodies[lo].au + (bodies[hi].au - bodies[lo].au) * (clamped - lo);
      if (Math.abs(next - au) > 0.0005) au = next;

      if (!renderer) return;
      const narrow = width < 860;
      renderer.begin(reduce ? 0 : (ms - started) / 1000, smooth);
      for (let i = 0; i < bodies.length; i++) {
        const offset = i - smooth; // 0 = centred, +1 = one chapter below
        if (Math.abs(offset) > 1.6) continue;
        const look = bodies[i].look;
        const base = look.size * height * (narrow ? 0.55 : 1);
        renderer.planet({
          look,
          // Bodies travel on a shallow arc: they enter from below-right and leave above-right.
          x: narrow ? width * 0.5 : width * (0.69 + (look.shift ?? 0) + 0.09 * offset * offset),
          y: (narrow ? height * 0.25 : height * 0.5) + offset * height * 1.05,
          radius: base * (1 - 0.22 * Math.min(Math.abs(offset), 1)),
          seed: i * 12.9898,
        });
      }
    };

    resize();
    smooth = target();
    addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  });
</script>

<canvas bind:this={canvas} class="sky" aria-hidden="true"></canvas>
<div class="scrim" aria-hidden="true"></div>

<header class="nav">
  <a href="/" class="label-md muted">← Warren</a>
  <span class="label-md">Orbita</span>
  <a href="/orbita/simulator/" class="label-md sim-link" style:color={accent}>Open simulator ◎</a>
</header>

<section class="intro">
  <p class="label-md" style:color={accent}>Warren · Experiment 01</p>
  <h1 class="display-xl">Orbita</h1>
  <p class="body-lg muted">
    Four and a half billion kilometres, from the surface of the Sun to the last planet. Light makes
    the trip in four hours. You have a scroll wheel.
  </p>
  <p class="label-md hint">Scroll to launch ↓</p>
  {#if !webgl}
    <p class="label-sm faint">WebGL is unavailable in this browser — showing the text version.</p>
  {/if}
</section>

<main bind:this={chaptersEl}>
  {#each bodies as body, i (body.id)}
    <section class="chapter" class:active={active === i} style:--accent={body.accent}>
      <div class="copy">
        <p class="label-md kicker">
          {String(i + 1).padStart(2, '0')} / {String(bodies.length).padStart(2, '0')} — {body.kind}
        </p>
        <h2 class="display-xl">{body.name}</h2>
        <p class="body-lg muted blurb">{body.blurb}</p>
        <dl class="stats">
          {#each body.stats as [label, value], s}
            <div style:--i={s}>
              <dt class="label-sm muted">{label}</dt>
              <dd class="data-lg">{value}</dd>
            </div>
          {/each}
        </dl>
      </div>
    </section>
  {/each}
</main>

<section class="outro" class:active={active >= bodies.length}>
  <p class="label-md" style:color={accent}>End of the line</p>
  <h2 class="display-lg">Now take<br />the controls</h2>
  <p class="body-lg muted">
    Eight planets, a comet and five thousand asteroids on their real orbits. Drag to look around,
    then speed time up until the years blur.
  </p>
  <a href="/orbita/simulator/" class="cta label-md">Open the simulator →</a>
</section>

<nav class="rail" aria-label="Planets">
  {#each bodies as body, i (body.id)}
    <button
      class="label-sm"
      class:current={active === i}
      style:--accent={body.accent}
      onclick={() => goTo(i)}
    >
      {body.name}
    </button>
  {/each}
</nav>

<aside class="odometer" class:visible={active >= 0} aria-live="off">
  <div>
    <span class="label-sm muted">From the Sun</span>
    <span class="data-lg">{au.toFixed(2)} <small>AU</small></span>
  </div>
  <div>
    <span class="label-sm muted">Million km</span>
    <span class="data-lg">{km}</span>
  </div>
  <div>
    <span class="label-sm muted">At light speed</span>
    <span class="data-lg">{light}</span>
  </div>
</aside>

<style>
  .sky {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 0;
  }
  /* Keeps the copy readable when a bright body passes behind it. */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 0;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--color-bg-ink) 92%, transparent) 12%,
      transparent 62%
    );
    pointer-events: none;
  }

  .nav {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 3;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-8) var(--gutter);
  }
  .nav a:hover {
    color: var(--color-text-primary);
  }
  .sim-link {
    transition: color 0.6s;
  }

  .intro,
  .chapter,
  .outro {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    padding: 0 var(--gutter);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .intro {
    gap: var(--space-6);
  }
  .intro .body-lg {
    max-width: 480px;
  }
  .intro h1 {
    animation: rise 1.2s var(--ease-out) both;
  }
  .hint {
    margin-top: var(--space-12);
    animation: bob 2.4s ease-in-out infinite;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
  }
  @keyframes bob {
    50% {
      transform: translateY(6px);
    }
  }

  /* A chapter is taller than the screen so there is some "travel" between planets,
     but its copy is centred in the first screenful. */
  .chapter {
    min-height: 130vh;
    justify-content: flex-start;
  }
  .copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-6);
    min-height: 100vh;
    max-width: 640px;
  }
  .kicker {
    color: var(--accent);
  }
  .blurb {
    max-width: 440px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, max-content);
    gap: var(--space-6) var(--space-12);
    margin: var(--space-12) 0 0;
  }
  .stats div {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .stats dd {
    margin: 0;
    white-space: nowrap;
  }

  /* Reveal: everything in a chapter fades up when it becomes the active one. */
  .kicker,
  .chapter h2,
  .blurb,
  .stats div {
    opacity: 0;
    transform: translateY(28px);
    transition:
      opacity 0.5s ease,
      transform 0.5s ease;
  }
  .active .kicker,
  .active h2,
  .active .blurb,
  .active .stats div {
    opacity: 1;
    transform: none;
    transition:
      opacity 0.9s var(--ease-out),
      transform 0.9s var(--ease-out);
  }
  .active h2 {
    transition-delay: 0.08s;
  }
  .active .blurb {
    transition-delay: 0.16s;
  }
  .active .stats div {
    transition-delay: calc(0.24s + var(--i) * 0.07s);
  }

  .outro {
    gap: var(--space-6);
    align-items: flex-start;
  }
  .outro .body-lg {
    max-width: 460px;
  }
  .cta {
    margin-top: var(--space-6);
    padding: var(--space-4) var(--space-8);
    border-radius: 999px;
    background: var(--color-text-primary);
    color: var(--color-bg-ink);
    transition: transform 0.3s var(--ease-out);
  }
  .cta:hover {
    transform: scale(1.04);
  }

  .rail {
    position: fixed;
    right: var(--gutter);
    top: 50%;
    transform: translateY(-50%);
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-3);
  }
  .rail button {
    color: var(--color-text-faint);
    transition: color 0.3s;
  }
  .rail button:hover {
    color: var(--color-text-primary);
  }
  .rail button.current {
    color: var(--accent);
  }
  .rail button.current::before {
    content: '— ';
  }

  .odometer {
    position: fixed;
    right: var(--gutter);
    bottom: var(--space-8);
    z-index: 3;
    display: flex;
    gap: var(--space-12);
    opacity: 0;
    transition: opacity 0.6s;
    pointer-events: none;
  }
  .odometer.visible {
    opacity: 1;
  }
  .odometer div {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 7.5ch;
  }
  .odometer,
  .rail {
    text-shadow: 0 0 12px var(--color-bg-ink), 0 0 2px var(--color-bg-ink);
  }
  .odometer .data-lg {
    font-size: clamp(16px, 1.5vw, 22px);
  }
  .odometer small {
    font-size: 0.6em;
    color: var(--color-text-muted);
  }

  @media (max-width: 860px) {
    .scrim {
      background: linear-gradient(
        to top,
        color-mix(in srgb, var(--color-bg-ink) 92%, transparent) 30%,
        transparent 70%
      );
    }
    .copy {
      justify-content: flex-end;
      gap: var(--space-4);
      padding-bottom: 120px;
    }
    .intro,
    .outro {
      justify-content: flex-end;
      padding-bottom: 96px;
    }
    .stats {
      grid-template-columns: repeat(2, max-content);
      gap: var(--space-3) var(--space-8);
      margin-top: var(--space-2);
    }
    .stats .data-lg {
      font-size: 18px;
    }
    .rail {
      display: none;
    }
    .odometer {
      left: var(--gutter);
      right: var(--gutter);
      bottom: var(--space-6);
      gap: var(--space-6);
      justify-content: space-between;
    }
    .sim-link {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .kicker,
    .chapter h2,
    .blurb,
    .stats div,
    .intro h1,
    .hint {
      transition: opacity 0.3s;
      transform: none;
      animation: none;
    }
  }
</style>

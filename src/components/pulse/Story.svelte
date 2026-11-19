<script lang="ts">
  // The Svelte half of Pulse: the story, the Kp chart and the list of places.
  // It never touches the globe directly. Each chapter just writes "look here"
  // into the shared `view` store, and the Solid island next door does the rest.
  import { onMount } from 'svelte';
  import {
    aurora,
    kp,
    kpLabel,
    places,
    probabilityAt,
    start,
    view,
    wind,
    type Aurora,
    type KpSample,
    type View,
    type WindSample,
  } from '../../lib/pulse/data';

  let chaptersEl: HTMLElement;

  // Mirror the framework-agnostic stores into Svelte state.
  let auroraData = $state<Aurora | null>(null);
  let windData = $state<WindSample[]>([]);
  let kpData = $state<KpSample[]>([]);
  let active = $state(0);
  let selectedPlace = $state<string | null>(null);

  const latest = $derived(windData.at(-1));
  const south = $derived((latest?.bz ?? 0) < 0);
  const observedKp = $derived(kpData.filter((sample) => !sample.predicted));
  const currentKp = $derived(observedKp.at(-1)?.kp);
  const peakForecast = $derived(
    kpData.filter((sample) => sample.predicted).reduce((max, sample) => Math.max(max, sample.kp), 0),
  );
  // Travel time from the L1 monitoring point (1.5 million km upstream) to Earth.
  const minutesToEarth = $derived(latest ? Math.round(1_500_000 / latest.speed / 60) : null);

  const ranked = $derived(
    auroraData
      ? places
          .map((place) => ({ ...place, chance: probabilityAt(auroraData!, place.lat, place.lon) }))
          .sort((a, b) => b.chance - a.chance)
      : [],
  );

  // Kp chart geometry.
  const bars = $derived(
    kpData.map((sample, i) => ({
      ...sample,
      x: (i / Math.max(1, kpData.length)) * 100,
      width: 100 / Math.max(1, kpData.length),
      height: (Math.max(0.15, sample.kp) / 9) * 100,
      level: sample.kp >= 5 ? 'storm' : sample.kp >= 4 ? 'active' : 'quiet',
    })),
  );
  const nowX = $derived((observedKp.length / Math.max(1, kpData.length)) * 100);
  const dayTicks = $derived(
    kpData
      .map((sample, i) => ({ sample, i }))
      .filter(({ sample }) => new Date(sample.time).getUTCHours() === 0)
      .map(({ sample, i }) => ({
        x: (i / kpData.length) * 100,
        label: new Date(sample.time).toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      })),
  );

  // What the globe should show for each chapter.
  const views: View[] = [
    { lat: 58, lon: 'night' },
    { lat: 12, lon: 'day' },
    { lat: 38, lon: 'night' },
    { lat: 84, lon: 'night' },
    { lat: -82, lon: 'night' },
    { lat: 62, lon: 'night' },
  ];

  function lookAt(place: (typeof places)[number]) {
    selectedPlace = place.name;
    view.set({ lat: place.lat * 0.82, lon: place.lon, marker: place });
  }

  $effect(() => {
    // Entering a chapter resets the camera, except in the last one while a place is selected.
    const chapter = active;
    if (chapter !== views.length - 1) selectedPlace = null;
    view.set(views[chapter]);
  });

  onMount(() => {
    start();
    const unsubscribe = [
      aurora.subscribe((value) => (auroraData = value)),
      wind.subscribe((value) => (windData = value)),
      kp.subscribe((value) => (kpData = value)),
    ];

    // The chapter nearest the middle of the screen is the active one.
    const onScroll = () => {
      const middle = innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      [...chaptersEl.children].forEach((element, i) => {
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      if (best !== active) active = best;
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      removeEventListener('scroll', onScroll);
      unsubscribe.forEach((stop) => stop());
    };
  });
</script>

<div class="scrim" aria-hidden="true"></div>

<header class="nav">
  <a href="/" class="label-md muted">← Warren</a>
  <span class="label-md">Pulse</span>
  <a href="/orbita/" class="label-md muted next">Orbita →</a>
</header>

<main bind:this={chaptersEl}>
  <section class="chapter" class:active={active === 0}>
    <p class="label-md kicker">Warren · Experiment 02</p>
    <h1 class="display-xl">Pulse</h1>
    <p class="body-lg muted lead">
      The planet has a magnetic pulse, and you can watch it. This is where the aurora is right now,
      redrawn every five minutes from NOAA's space weather model.
    </p>
    <p class="label-md hint">Scroll ↓ · Drag the globe</p>
  </section>

  <section class="chapter" class:active={active === 1}>
    <p class="label-md kicker">01 — The wind</p>
    <h2 class="display-lg">It starts <br />at the Sun</h2>
    <p class="body-lg muted lead">
      The Sun leaks. A thin stream of charged particles blows outward in every direction, all the
      time. A spacecraft parked 1.5 million km upstream of Earth measures it before it arrives.
    </p>
    <dl class="facts">
      <div>
        <dt class="label-sm muted">Speed right now</dt>
        <dd class="data-lg">{latest ? Math.round(latest.speed) : '—'} km/s</dd>
      </div>
      <div>
        <dt class="label-sm muted">Reaches Earth in</dt>
        <dd class="data-lg">{minutesToEarth ?? '—'} min</dd>
      </div>
    </dl>
  </section>

  <section class="chapter" class:active={active === 2}>
    <p class="label-md kicker">02 — The door</p>
    <h2 class="display-lg">A shield <br />with a latch</h2>
    <p class="body-lg muted lead">
      Earth's magnetic field deflects most of that wind. What decides whether any gets in is one
      number: Bz, the north–south tilt of the magnetic field the wind carries. North, and the
      door stays shut. South, and the two fields connect.
    </p>
    <p class="verdict" class:open={south}>
      <span class="data-lg">{latest ? (latest.bz > 0 ? '+' : '') + latest.bz.toFixed(1) : '—'} nT</span>
      <span class="label-md">
        {#if !latest}waiting for data{:else if south}pointing south · the door is open{:else}pointing north · the door is shut{/if}
      </span>
    </p>
  </section>

  <section class="chapter" class:active={active === 3}>
    <p class="label-md kicker">03 — The oval</p>
    <h2 class="display-lg">A ring <br />of light</h2>
    <p class="body-lg muted lead">
      Particles that get in spiral down the field lines and hit the upper atmosphere in a ring
      around each magnetic pole. Oxygen glows green at 100 km, violet higher up. The stronger the
      storm, the wider the ring, measured by the Kp index from 0 to 9.
    </p>
    <figure class="kp">
      <figcaption>
        <span class="label-sm muted">Kp · last 7 days and 3-day forecast</span>
        <span class="label-sm now-label">
          Now {currentKp?.toFixed(1) ?? '—'} · {currentKp !== undefined ? kpLabel(currentKp) : ''}
        </span>
      </figcaption>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Kp index chart">
        <!-- Kp 5 is where a geomagnetic storm officially begins. -->
        <line class="threshold" x1="0" x2="100" y1={40 - (5 / 9) * 40} y2={40 - (5 / 9) * 40} />
        {#each bars as bar, i (bar.time)}
          <rect
            class="bar {bar.level}"
            class:predicted={bar.predicted}
            x={bar.x + bar.width * 0.15}
            width={bar.width * 0.7}
            y={40 - bar.height * 0.4}
            height={bar.height * 0.4}
            style:--i={i}
          />
        {/each}
        <line class="now" x1={nowX} x2={nowX} y1="0" y2="40" />
      </svg>
      <div class="ticks">
        {#each dayTicks as tick (tick.x)}
          <span class="label-sm faint" style:left="{tick.x}%">{tick.label}</span>
        {/each}
      </div>
      <p class="label-sm muted peak">
        Forecast peak: Kp {peakForecast.toFixed(1)} · {kpLabel(peakForecast)}
      </p>
    </figure>
  </section>

  <section class="chapter" class:active={active === 4}>
    <p class="label-md kicker">04 — The mirror</p>
    <h2 class="display-lg">The other <br />pole</h2>
    <p class="body-lg muted lead">
      The same field lines come down in the south, so every aurora has a twin. The southern
      lights are just as bright; almost nobody lives under them. Most of this ring hangs over
      open ocean and Antarctic ice.
    </p>
  </section>

  <section class="chapter" class:active={active === 5}>
    <p class="label-md kicker">05 — Tonight</p>
    <h2 class="display-lg">Where <br />to look</h2>
    <p class="body-lg muted lead">
      The chance of seeing aurora directly overhead in the next hour, if the sky is dark and
      clear. Pick a place to fly there.
    </p>
    <ul class="places">
      {#each ranked as place, i (place.name)}
        <li style:--i={i}>
          <button class:current={selectedPlace === place.name} onclick={() => lookAt(place)}>
            <span class="body-md name">{place.name}</span>
            <span class="label-sm faint">{place.country}</span>
            <span class="meter"><span style:width="{Math.min(100, place.chance)}%"></span></span>
            <span class="data-lg chance">{place.chance}%</span>
          </button>
        </li>
      {/each}
    </ul>
    <p class="label-sm faint credit">
      Data: NOAA Space Weather Prediction Center · OVATION aurora model · Coastlines: Natural Earth
    </p>
  </section>
</main>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 1;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--color-bg-ink) 88%, transparent) 10%,
      transparent 52%
    );
    pointer-events: none;
  }
  .nav {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 4;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-8) var(--gutter);
    pointer-events: none;
  }
  .nav a {
    pointer-events: auto;
  }
  .nav a:hover {
    color: var(--color-text-primary);
  }

  /* The story sits above the globe but lets the pointer through to it,
     except on the controls themselves. */
  main {
    position: relative;
    z-index: 2;
    pointer-events: none;
    overflow-x: clip;
  }
  .chapter {
    min-height: 115vh;
    padding: 0 var(--gutter);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-6);
    max-width: 660px;
    box-sizing: content-box;
  }
  .chapter:first-child {
    min-height: 100vh;
  }
  .kicker,
  .now-label {
    color: var(--color-accent-pulse);
  }
  .lead {
    max-width: 480px;
  }
  .hint {
    margin-top: var(--space-8);
  }

  .chapter > * {
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 0.5s ease,
      transform 0.5s ease;
  }
  .chapter.active > * {
    opacity: 1;
    transform: none;
    transition:
      opacity 0.9s var(--ease-out),
      transform 0.9s var(--ease-out);
  }
  .chapter.active > :nth-child(2) {
    transition-delay: 0.07s;
  }
  .chapter.active > :nth-child(3) {
    transition-delay: 0.14s;
  }
  .chapter.active > :nth-child(4) {
    transition-delay: 0.21s;
  }
  .chapter.active > :nth-child(5) {
    transition-delay: 0.28s;
  }

  .facts {
    display: flex;
    gap: var(--space-12);
    margin: var(--space-4) 0 0;
  }
  .facts div {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .facts dd {
    margin: 0;
  }

  .verdict {
    display: flex;
    align-items: baseline;
    gap: var(--space-4);
    flex-wrap: wrap;
    color: var(--color-text-muted);
  }
  .verdict.open {
    color: var(--color-accent-pulse);
  }

  .kp {
    margin: 0;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .kp figcaption {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .kp svg {
    width: 100%;
    height: 120px;
    overflow: visible;
  }
  .bar {
    fill: color-mix(in srgb, var(--color-accent-pulse) 55%, var(--color-bg-ink));
    transform-box: fill-box;
    transform-origin: bottom;
    transform: scaleY(0);
    transition: transform 0.7s var(--ease-out);
    transition-delay: calc(0.3s + var(--i) * 8ms);
  }
  .active .bar {
    transform: scaleY(1);
  }
  .bar.active {
    fill: var(--color-accent-orbita);
  }
  .bar.storm {
    fill: #ff4d5e;
  }
  .bar.predicted {
    opacity: 0.4;
  }
  .threshold {
    stroke: var(--color-line);
    stroke-width: 1;
    stroke-dasharray: 2 2;
    vector-effect: non-scaling-stroke;
  }
  .now {
    stroke: var(--color-text-primary);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .ticks {
    position: relative;
    height: 16px;
    overflow: hidden;
  }
  .ticks span {
    position: absolute;
    white-space: nowrap;
  }
  .ticks span:nth-child(even) {
    display: none;
  }

  .places {
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 480px;
    pointer-events: auto;
  }
  .places button {
    width: 100%;
    display: grid;
    grid-template-columns: 7.5em 6em 1fr 3.2em;
    align-items: center;
    gap: var(--space-3);
    padding: 6px 0;
    border-bottom: 1px solid var(--color-line);
    text-align: left;
    transition: color 0.2s;
  }
  .places button:hover .name,
  .places button.current .name {
    color: var(--color-accent-pulse);
  }
  .meter {
    height: 3px;
    border-radius: 2px;
    background: var(--color-line);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--color-accent-pulse);
    transition: width 0.8s var(--ease-out);
  }
  .chance {
    font-size: 18px;
    text-align: right;
  }
  .credit {
    max-width: 480px;
  }

  @media (max-width: 860px) {
    .scrim {
      background: linear-gradient(
        to top,
        color-mix(in srgb, var(--color-bg-ink) 94%, transparent) 52%,
        transparent 80%
      );
    }
    .chapter {
      justify-content: flex-end;
      gap: var(--space-3);
      min-height: 100vh;
      padding-bottom: 104px;
      max-width: none;
      box-sizing: border-box;
    }
    .chapter .display-lg {
      font-size: 40px;
    }
    .chapter .display-lg :global(br) {
      display: none;
    }
    .lead {
      font-size: 14px;
      line-height: 1.45;
    }
    .next {
      display: none;
    }
    .kp svg {
      height: 64px;
    }
    .peak {
      display: none;
    }
    .places button {
      grid-template-columns: 6.5em 1fr 3em;
      padding: 3px 0;
    }
    .places button .faint {
      display: none;
    }
    .places li:nth-child(n + 6) {
      display: none;
    }
    .credit {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chapter > *,
    .bar {
      transition: opacity 0.3s;
      transform: none;
    }
  }
</style>

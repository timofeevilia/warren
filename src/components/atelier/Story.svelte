<script lang="ts">
  // The Svelte half of Atelier: the editorial page around the watch.
  // It reads the shared configuration (the price in the header follows the Solid
  // configurator) and writes to it too: the swatches in "Four metals" re-case the
  // watch from inside a paragraph of text.
  import { onMount } from 'svelte';
  import { config, euros, metals, pick, priceOf, view, type Config, type View } from '../../lib/atelier/catalog';

  let chaptersEl: HTMLElement;
  let cfg = $state<Config>(config.get());
  let active = $state(0);
  let clock = $state('');

  const price = $derived(priceOf(cfg));
  const chosen = $derived(pick(cfg));

  const poses: View[] = ['hero', 'dial', 'movement', 'metal'];
  const headline = ['Time,', 'unhurried.'];

  const specs = [
    ['Calibre', 'L-01, self-winding'],
    ['Frequency', '28 800 vph · 4 Hz'],
    ['Power reserve', '68 hours'],
    ['Jewels', '25'],
  ];

  onMount(() => {
    view.set('hero');
    const stop = config.subscribe((value) => (cfg = value));

    const tick = () => (clock = new Date().toLocaleTimeString('en-GB'));
    tick();
    const timer = setInterval(tick, 1000);

    // The chapter under the middle of the screen poses the watch. Below the last
    // chapter the configurator takes over, so then we leave the pose alone.
    const onScroll = () => {
      const middle = innerHeight / 2;
      [...chaptersEl.children].forEach((element, i) => {
        const rect = element.getBoundingClientRect();
        if (rect.top <= middle && rect.bottom > middle && active !== i) {
          active = i;
          view.set(poses[i]);
        }
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      stop();
      clearInterval(timer);
      removeEventListener('scroll', onScroll);
    };
  });
</script>

<header class="nav">
  <a href="/" class="label-md muted">← Warren</a>
  <span class="brand">Atelier Lièvre</span>
  <a href="#build" class="label-md yours">
    <span class="muted">Your Terrier</span>
    {euros(price)}
  </a>
</header>

<main bind:this={chaptersEl}>
  <section class="chapter hero" class:active={active === 0}>
    <p class="label-md kicker">Warren · Experiment 04</p>
    <h1 class="display-xl">
      {#each headline as word, i}
        <span class="clip"><span class="word" style:--i={i}>{word}</span></span>
      {/each}
    </h1>
    <p class="body-lg muted lead">
      The Terrier 38 is an automatic watch from a workshop that does not exist. It is, however,
      keeping your time right now: <span class="time">{clock}</span>.
    </p>
    <div class="row">
      <a href="#build" class="cta label-md">Build yours</a>
      <span class="label-md muted">From {euros(2400)} · Scroll ↓</span>
    </div>
  </section>

  <section class="chapter" class:active={active === 1}>
    <p class="label-md kicker">01 — The dial</p>
    <h2 class="display-lg">Read at <br />a glance</h2>
    <p class="body-lg muted lead">
      Twelve applied markers, a doubled one at noon so you never have to think about which way is
      up. A sunray finish that turns from near-black to colour as your wrist moves. One red hand,
      because something should be in a hurry.
    </p>
  </section>

  <section class="chapter" class:active={active === 2}>
    <p class="label-md kicker">02 — The movement</p>
    <h2 class="display-lg">Turn it <br />over</h2>
    <p class="body-lg muted lead">
      Behind a sapphire window, the balance wheel swings four times a second. Every swing lets the
      seconds hand take one small step, eight a second. The half-moon rotor winds the spring each
      time you move.
    </p>
    <dl class="specs">
      {#each specs as [label, value], i}
        <div style:--i={i}>
          <dt class="label-sm muted">{label}</dt>
          <dd class="body-md">{value}</dd>
        </div>
      {/each}
    </dl>
  </section>

  <section class="chapter" class:active={active === 3}>
    <p class="label-md kicker">03 — The case</p>
    <h2 class="display-lg">Four <br />metals</h2>
    <p class="body-lg muted lead">
      Brushed on the flanks, polished on the bezel. Try them on:
    </p>
    <div class="metals">
      {#each metals as metal (metal.id)}
        <button
          class:current={cfg.metal === metal.id}
          aria-pressed={cfg.metal === metal.id}
          onclick={() => config.set({ ...config.get(), metal: metal.id })}
        >
          <span
            class="disc"
            style:background="linear-gradient(135deg, {metal.colors[0]}, {metal.colors[1]} 45%, {metal.colors[2]} 75%, {metal.colors[3]})"
          ></span>
          <span class="body-md">{metal.name}</span>
          <span class="label-sm faint">{metal.note}</span>
        </button>
      {/each}
    </div>
    <p class="label-md muted now">
      Now wearing: {chosen.metal.name} · {euros(price)}
    </p>
  </section>
</main>

<style>
  .nav {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 4;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-8) var(--gutter);
    /* The page scrolls underneath: fade it out so the header stays readable. */
    background: linear-gradient(to bottom, var(--color-bg-ink) 55%, transparent);
  }
  .brand {
    font-family: var(--font-display);
    font-size: 22px;
    letter-spacing: 0.04em;
  }
  .yours {
    display: flex;
    gap: var(--space-3);
    font-variant-numeric: tabular-nums;
  }
  .nav a:hover {
    color: var(--color-accent-atelier);
  }

  main {
    position: relative;
    z-index: 2;
    width: 46vw;
    pointer-events: none;
  }
  .chapter {
    min-height: 110vh;
    padding: 0 0 0 var(--gutter);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-6);
  }
  .hero {
    min-height: 100vh;
  }
  .chapter :global(a),
  .chapter button {
    pointer-events: auto;
  }
  .kicker {
    color: var(--color-accent-atelier);
  }
  .lead {
    max-width: 470px;
  }
  .time {
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: 0.85em;
    font-variant-numeric: tabular-nums;
  }

  /* Headline: each word slides up out of its own slot. */
  .clip {
    display: block;
    overflow: hidden;
    padding: 0 0.12em 0.14em 0;
    margin-bottom: -0.14em;
  }
  .word {
    display: block;
    animation: rise 1.2s var(--ease-out) both;
    animation-delay: calc(var(--i) * 140ms + 100ms);
  }
  .clip:last-child .word {
    font-style: italic;
  }
  @keyframes rise {
    from {
      transform: translateY(105%);
    }
  }

  .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-6);
    margin-top: var(--space-4);
  }
  .cta {
    padding: var(--space-4) var(--space-8);
    border-radius: 999px;
    background: var(--color-text-primary);
    color: var(--color-bg-ink);
    transition: transform 0.3s var(--ease-out);
  }
  .cta:hover {
    transform: scale(1.04);
  }

  .chapter:not(.hero) > * {
    opacity: 0;
    transform: translateY(26px);
    transition:
      opacity 0.5s ease,
      transform 0.5s ease;
  }
  .chapter.active:not(.hero) > * {
    opacity: 1;
    transform: none;
    transition:
      opacity 0.9s var(--ease-out),
      transform 0.9s var(--ease-out);
  }
  .chapter.active > :nth-child(2) {
    transition-delay: 0.08s;
  }
  .chapter.active > :nth-child(3) {
    transition-delay: 0.16s;
  }
  .chapter.active > :nth-child(4) {
    transition-delay: 0.24s;
  }
  .chapter.active > :nth-child(5) {
    transition-delay: 0.32s;
  }

  .specs {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    gap: var(--space-4) var(--space-12);
    margin: var(--space-2) 0 0;
  }
  .specs div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-line);
    min-width: 170px;
  }
  .specs dd {
    margin: 0;
  }

  .metals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 220px));
    gap: var(--space-3);
  }
  .metals button {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--space-3);
    align-items: center;
    padding: var(--space-3);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    text-align: left;
    transition:
      border-color 0.2s,
      background 0.2s;
  }
  .metals button:hover {
    border-color: var(--color-text-muted);
  }
  .metals button.current {
    border-color: var(--color-text-primary);
    background: var(--color-bg-surface);
  }
  .disc {
    grid-row: span 2;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.15);
    transition: transform 0.4s var(--ease-out);
  }
  .metals button:hover .disc {
    transform: rotate(40deg);
  }
  .metals .label-sm {
    text-transform: none;
    letter-spacing: 0.01em;
  }

  @media (max-width: 860px) {
    .nav {
      padding: var(--space-4) var(--space-4);
    }
    .yours .muted,
    .brand {
      display: none;
    }
    main {
      width: 100%;
    }
    .chapter {
      min-height: 100vh;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: 48vh var(--space-4) var(--space-8);
    }
    .lead {
      font-size: 15px;
    }
    .chapter :global(.display-lg) {
      font-size: 40px;
    }
    .chapter :global(.display-lg br) {
      display: none;
    }
    .specs {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2) var(--space-4);
    }
    .specs div {
      min-width: 0;
    }
    .metals {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2);
    }
    .metals .label-sm,
    .now {
      display: none;
    }
    .disc {
      width: 28px;
      height: 28px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .word {
      animation: none;
    }
    .chapter:not(.hero) > * {
      transition: opacity 0.3s;
      transform: none;
    }
  }
</style>

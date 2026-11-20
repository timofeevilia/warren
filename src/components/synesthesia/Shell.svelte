<script lang="ts">
  // The Svelte half of Synesthesia: the way in and the preset gallery.
  // Svelte's built-in transitions do the work here — the welcome screen dissolving,
  // the cards arriving one by one, the highlight sliding from preset to preset.
  import { onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { crossfade, fade, fly } from 'svelte/transition';
  import { applyPreset, autoplay, current, enter, leave, presets, setAutoplay, started } from '../../lib/synesthesia/engine';

  let isStarted = $state(false);
  let now = $state(current.get());
  let help = $state(false);
  let isAuto = $state(false);

  // The highlight is one element that "travels" between cards.
  const [send, receive] = crossfade({ duration: 450, easing: cubicOut });

  function begin(withDemo: boolean) {
    // Called straight from a click: browsers only unlock audio inside a user gesture.
    enter();
    if (withDemo) setAutoplay(true);
  }

  function home() {
    help = false;
    leave();
  }

  onMount(() => {
    // The engine is a module, so it outlives this page during client-side navigation.
    // Always begin from the welcome screen, in silence.
    leave();
    const stops = [
      started.subscribe((value) => (isStarted = value)),
      current.subscribe((value) => (now = value)),
      autoplay.subscribe((value) => (isAuto = value)),
    ];
    return () => {
      stops.forEach((stop) => stop());
      leave();
    };
  });
</script>

<header class="nav">
  <a href="/" class="label-md muted">← Warren</a>
  {#if isStarted}
    <button class="label-md title" onclick={home} title="Back to the start screen">Synesthesia</button>
    <button class="label-md auto" class:on={isAuto} onclick={() => setAutoplay(!isAuto)}>
      {isAuto ? '■ Stop' : '▶ Play for me'}
    </button>
  {:else}
    <span class="label-md title">Synesthesia</span>
  {/if}
</header>

{#if !isStarted}
  <section class="welcome" out:fade={{ duration: 700 }}>
    <p class="label-md kicker">Warren · Experiment 03</p>
    <h1 class="display-xl">Synesthesia</h1>
    <p class="body-lg muted lead">
      Some people see colours when they hear music. This is an instrument that does it for
      everyone: every note has a colour, every sound has a shape.
    </p>
    <div class="actions">
      <button class="cta label-md" onclick={() => begin(false)}>Start playing</button>
      <button class="ghost label-md" onclick={() => begin(true)}>Play for me →</button>
    </div>
    <p class="label-sm faint">Sound on. Works best with a keyboard and headphones.</p>
  </section>
{:else}
  <nav class="gallery" aria-label="Presets">
    {#each presets as preset, i (preset.id)}
      <button
        class="card"
        class:current={now.id === preset.id}
        aria-pressed={now.id === preset.id}
        onclick={() => applyPreset(preset.id)}
        in:fly={{ y: -24, duration: 700, delay: 250 + i * 90, easing: cubicOut }}
      >
        {#if now.id === preset.id}
          <span class="ring" in:receive={{ key: 'ring' }} out:send={{ key: 'ring' }}></span>
        {/if}
        <span
          class="swatch"
          style:background="linear-gradient(135deg, {preset.palette[0]}, {preset.palette[1]} 55%, {preset.palette[2]})"
        ></span>
        <span class="text">
          <span class="body-md name">{preset.name}{now.id === preset.id && now.edited ? ' *' : ''}</span>
          <span class="label-sm faint blurb">{preset.blurb}</span>
        </span>
      </button>
    {/each}
    <button class="label-sm help-toggle" onclick={() => (help = !help)} in:fade={{ delay: 700 }}>
      {help ? 'Close' : 'How it works'}
    </button>
  </nav>

  {#if help}
    <aside class="help" transition:fly={{ x: -24, duration: 400, easing: cubicOut }}>
      <p class="body-md">
        <strong>Notes are colours.</strong> Pitches a fifth apart get neighbouring hues, so chords
        that sound close also look close. The line under each key shows its colour.
      </p>
      <p class="body-md">
        <strong>Sound is shape.</strong> The picture is drawn from the live waveform and spectrum
        of what you play — or of your microphone. Nothing is pre-rendered.
      </p>
      <p class="body-md">
        <strong>Presets are starting points.</strong> Turn any knob and the sound and the image
        change together. Save a frame as a poster when you like it.
      </p>
    </aside>
  {/if}
{/if}

<style>
  .nav {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-8) var(--gutter);
    pointer-events: none;
  }
  .nav a,
  .nav button {
    pointer-events: auto;
  }
  .nav a:hover {
    color: var(--color-text-primary);
  }
  .nav button.title:hover {
    color: var(--color-accent-synesthesia);
  }
  .auto {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-bg-surface) 70%, transparent);
    transition:
      color 0.2s,
      background 0.2s,
      border-color 0.2s;
  }
  .auto:hover {
    color: var(--color-text-primary);
  }
  .auto.on {
    background: var(--color-accent-synesthesia);
    border-color: transparent;
    color: var(--color-bg-ink);
  }

  .welcome {
    position: fixed;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-6);
    padding: 0 var(--gutter);
    background: radial-gradient(
      ellipse at 30% 50%,
      color-mix(in srgb, var(--color-bg-ink) 80%, transparent),
      color-mix(in srgb, var(--color-bg-ink) 35%, transparent)
    );
  }
  .kicker {
    color: var(--color-accent-synesthesia);
  }
  .welcome h1 {
    animation: rise 1.1s var(--ease-out) both;
  }
  .lead {
    max-width: 500px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
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
  .ghost:hover {
    color: var(--color-accent-synesthesia);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
  }

  .gallery {
    position: fixed;
    top: 88px;
    left: var(--gutter);
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 260px;
  }
  .card {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2);
    border-radius: var(--radius-md);
    text-align: left;
    background: color-mix(in srgb, var(--color-bg-surface) 80%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .ring {
    position: absolute;
    inset: 0;
    border: 1px solid var(--color-text-primary);
    border-radius: var(--radius-md);
    pointer-events: none;
  }
  .swatch {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    transition: transform 0.4s var(--ease-out);
  }
  .card:hover .swatch {
    transform: scale(1.08) rotate(-4deg);
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .blurb {
    text-transform: none;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .help-toggle {
    align-self: flex-start;
    margin-top: var(--space-2);
    padding: var(--space-2);
    color: var(--color-text-muted);
  }
  .help-toggle:hover {
    color: var(--color-text-primary);
  }

  .help {
    position: fixed;
    top: 88px;
    left: calc(var(--gutter) + 276px);
    z-index: 3;
    width: 340px;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-6);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-bg-surface) 82%, transparent);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    color: var(--color-text-muted);
  }
  .help strong {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  @media (max-width: 760px) {
    .nav {
      gap: var(--space-4);
      padding: var(--space-6) var(--space-3);
    }
    .gallery {
      top: auto;
      bottom: 132px;
      left: 0;
      right: 0;
      width: auto;
      flex-direction: row;
      overflow-x: auto;
      padding: 0 var(--space-3);
      scrollbar-width: none;
    }
    .card {
      flex: none;
    }
    .swatch {
      width: 32px;
      height: 32px;
    }
    .blurb,
    .help-toggle {
      display: none;
    }
    .help {
      left: var(--space-3);
      right: var(--space-3);
      width: auto;
    }
  }
</style>

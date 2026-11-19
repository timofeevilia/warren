<script lang="ts">
  // Implements the "Experiment Card" component from Figma.
  // Adds what a static mockup can't show: pointer-driven 3D tilt and a live preview.
  import CardArt from './CardArt.svelte';
  import type { Experiment } from '../../lib/experiments';

  let { experiment, index }: { experiment: Experiment; index: number } = $props();

  let hovered = $state(false);
  let tiltX = $state(0);
  let tiltY = $state(0);
  let shown = $state(false);

  const live = $derived(experiment.href !== null);

  function onMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tiltY = ((e.clientX - r.left) / r.width - 0.5) * 7;
    tiltX = (0.5 - (e.clientY - r.top) / r.height) * 7;
  }

  function onLeave() {
    hovered = false;
    tiltX = 0;
    tiltY = 0;
  }

  // Reveal once, when the card scrolls into view.
  function reveal(node: HTMLElement) {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          shown = true;
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }
</script>

<svelte:element
  this={live ? 'a' : 'div'}
  href={experiment.href}
  class="card"
  class:shown
  class:live
  style:--accent={experiment.accent}
  style:--delay="{(index % 2) * 90}ms"
  style:--tilt-x="{tiltX}deg"
  style:--tilt-y="{tiltY}deg"
  role={live ? undefined : 'group'}
  aria-label={live ? undefined : `${experiment.title} — in progress`}
  onpointerenter={() => (hovered = true)}
  onpointermove={onMove}
  onpointerleave={onLeave}
  use:reveal
>
  <div class="art">
    <CardArt kind={experiment.id} active={hovered} />
    <span class="status label-sm">{live ? 'Enter →' : 'In progress'}</span>
  </div>
  <div class="body">
    <div class="meta">
      <span class="label-md number">{experiment.number}</span>
      <span class="label-sm faint">{experiment.tags}</span>
    </div>
    <h2 class="display-md">{experiment.title}</h2>
    <p class="body-md muted">{experiment.description}</p>
  </div>
</svelte:element>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    overflow: hidden;
    opacity: 0;
    transform: perspective(1200px) translateY(48px);
    transition:
      opacity 0.9s var(--ease-out) var(--delay),
      transform 0.9s var(--ease-out) var(--delay),
      border-color 0.3s;
  }
  .card.shown {
    opacity: 1;
    transform: perspective(1200px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y));
    /* After the reveal, tilt should track the pointer quickly. */
    transition:
      opacity 0.9s var(--ease-out) var(--delay),
      transform 0.25s ease-out,
      border-color 0.3s;
  }
  .card.live:hover {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--color-line));
  }
  .card:not(.live) {
    cursor: default;
  }

  .art {
    position: relative;
    aspect-ratio: 616 / 340;
    background:
      radial-gradient(
        ellipse 60% 70% at 50% 55%,
        color-mix(in srgb, var(--accent) 16%, transparent),
        transparent
      ),
      var(--color-bg-ink);
  }
  .status {
    position: absolute;
    top: var(--space-6);
    right: var(--space-6);
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    border: 1px solid var(--color-line);
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-bg-ink) 70%, transparent);
    backdrop-filter: blur(8px);
  }
  .live .status {
    color: var(--color-bg-ink);
    background: var(--accent);
    border-color: transparent;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-8);
  }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-4);
  }
  .number {
    color: var(--accent);
  }

  @media (max-width: 640px) {
    .body {
      padding: var(--space-6);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .card,
    .card.shown {
      transition: opacity 0.3s;
      transform: none;
    }
  }
</style>

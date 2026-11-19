# Warren

A burrow of interface experiments built with **Svelte 5** and **Solid**, glued together by **Astro**, designed in **Figma**.

| # | Experiment | Status | What it is |
|---|---|---|---|
| 01 | **Orbita** | live | A scroll journey from the Sun to Neptune plus a real-time orbit simulator |
| 02 | Pulse | planned | Live earthquakes on a globe |
| 03 | Synesthesia | planned | An audio-visual instrument |
| 04 | Atelier | planned | A product page and configurator for a brand that doesn't exist |

## Who does what

- **Astro** builds static HTML and ships each interactive piece as an independent island.
- **Svelte** owns pages that are mostly *presentation*: reveals, scroll-driven motion, transitions.
- **Solid** owns pieces that are mostly *live state*: many values changing every frame.
- **Figma** is the source of design decisions. `src/styles/tokens.css` mirrors the Figma variable
  collection one-to-one (`color/bg/ink` → `--color-bg-ink`), and the CSS text classes carry the
  same names as the Figma text styles.

## Layout

```
src/
  styles/tokens.css          design tokens (from Figma variables)
  layouts/Base.astro         shared <head>, fonts, page transitions
  pages/index.astro          showcase
  pages/orbita/              journey + simulator
  components/showcase/       Svelte: hero tunnel, experiment cards
  components/orbita/         Journey.svelte, Simulator.tsx
  lib/orbita/                planet data, Kepler solver, planet shader
docs/journal/                build log: what was made and how
```

## Develop

```bash
npm install
```

```bash
npm run dev
```

## Build and deploy

```bash
npm run build
```

Deployment is automatic and pull-based. Every push to `main` runs `.github/workflows/deploy.yml`,
which builds the site and force-pushes the contents of `dist/` to the `deploy` branch. The hosting
keeps the subdomain's document root as a checkout of that branch and refreshes it from cron:

```
*/5 * * * * cd /path/to/docroot && git fetch -q --depth 1 origin deploy && git reset -q --hard origin/deploy
```

Nothing connects into the hosting and no hosting credentials are stored in GitHub.

To do it by hand: the result of the build is a fully static site in `dist/`. To publish on shared hosting (cPanel): create a
subdomain, then upload the *contents* of `dist/` into that subdomain's document root. There is no
server-side code and no database.

The site assumes it lives at the root of its (sub)domain. To host it under a sub-path instead, set
`base` in `astro.config.mjs` and prefix the hard-coded links.

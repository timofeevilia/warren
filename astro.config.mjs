import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import solid from '@astrojs/solid-js';

// Static build: the output in dist/ is plain files, ready for any shared hosting (cPanel).
export default defineConfig({
  site: 'https://warren.krolikx.com',
  integrations: [svelte(), solid({ include: ['**/*.tsx'] })],
  build: { assets: 'assets' },
});

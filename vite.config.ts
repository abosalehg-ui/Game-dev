import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` produces one self-contained index.html (fonts and all assets
// inlined) that runs from file:// — the build we hand out for on-device testing.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    svelte(),
    ...(mode === 'single' ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
  ],
  build: {
    target: 'es2020',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
    outDir: mode === 'single' ? 'dist-single' : 'dist',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));

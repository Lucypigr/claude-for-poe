import { defineConfig } from 'vite';

// Each deploy target picks its base via `--mode`, so no file needs hand-editing per deploy.
export const DEPLOY_BASES = {
  // GitHub Pages (`npm run build`, default mode): relative asset paths so the
  // build works under the /<repo>/ sub-path.
  production: './',
  // Cloudflare Pages (`npm run build:cloudflare`): served from the domain root.
  cloudflare: '/',
};

export default defineConfig(({ mode }) => ({
  base: DEPLOY_BASES[mode] ?? DEPLOY_BASES.production,
  server: {
    host: true, // reachable from phones on the same network
  },
  build: {
    // Three.js alone is ~550 kB minified; revisit when real code-splitting matters.
    chunkSizeWarningLimit: 700,
  },
}));

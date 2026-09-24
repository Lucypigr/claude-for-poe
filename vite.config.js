import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative asset paths so the build works under GitHub Pages' /<repo>/ path
  server: {
    host: true, // reachable from phones on the same network
  },
  build: {
    // Three.js alone is ~550 kB minified; revisit when real code-splitting matters.
    chunkSizeWarningLimit: 700,
  },
});

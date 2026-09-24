import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // reachable from phones on the same network
  },
  build: {
    // Three.js alone is ~550 kB minified; revisit when real code-splitting matters.
    chunkSizeWarningLimit: 700,
  },
});

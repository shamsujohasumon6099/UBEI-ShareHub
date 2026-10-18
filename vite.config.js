import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  build: { rollupOptions: { input: {
    index: resolve(import.meta.dirname, 'index.html'),
    admin: resolve(import.meta.dirname, 'admin.html'),
    moderator: resolve(import.meta.dirname, 'moderator.html'),
  } }, sourcemap: false },
  server: { port: 5173, strictPort: true },
});

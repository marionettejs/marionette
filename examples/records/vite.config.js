import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['marionette', '@mnjs/utils', '@mnjs/radio', '@mnjs/data', 'lit-html'],
  },
  server: {
    host: '127.0.0.1',
    port: 5193,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 5193,
    strictPort: true,
  },
});

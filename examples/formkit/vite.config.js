import { defineConfig } from 'vite';
export default defineConfig({
  build: { rollupOptions: { input: { profile: 'index.html', schema: 'schema.html', composition: 'composition.html', composed: 'composed.html', nested: 'nested.html' } } },
  resolve: { dedupe: ['marionette', '@mnjs/formkit', '@mnjs/utils', '@mnjs/radio', '@formkit/core', '@formkit/utils'] }
});

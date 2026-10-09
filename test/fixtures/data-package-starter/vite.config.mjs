import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vite';

// Vite's build does not automatically consume dependencies' external maps.
// Load the maps shipped with this candidate through the public plugin API.
export default defineConfig({
  plugins: [{
    name: 'marionette-source-maps',
    enforce: 'pre',
    async load(id) {
      if (!/\/node_modules\/(?:marionette|@mnjs\/[^/]+)\/dist\/(?!eslint\/).*\.js$/.test(id.replaceAll('\\', '/'))) { return; }
      return { code: await readFile(id, 'utf8'), map: JSON.parse(await readFile(`${id}.map`, 'utf8')) };
    }
  }],
  optimizeDeps: { exclude: ['marionette', '@mnjs/data', '@mnjs/utils', '@mnjs/radio', '@mnjs/adapters'] },
  server: { sourcemapIgnoreList: false },
  build: { sourcemap: true }
});

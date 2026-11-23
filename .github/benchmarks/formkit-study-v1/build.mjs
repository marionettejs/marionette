import { build } from 'vite';
import { fileURLToPath } from 'node:url';
const local = path => fileURLToPath(new URL(path, import.meta.url));
for (const arm of ['baseline', 'candidate', 'vue', 'react']) {
  const marionette = arm === 'baseline' || arm === 'candidate';
  await build({
    configFile: false, root: local('./'), base: './', mode: 'production',
    resolve: {
      alias: { '#binding': local(marionette ? 'marionette.mjs' : arm + '.mjs'), '#pack': local('packs/' + arm + '/package/dist/index.js') },
      dedupe: ['@formkit/core', '@formkit/utils', '@formkit/inputs', 'react', 'react-dom', 'vue']
    },
    build: { outDir: local('dist/' + arm), emptyOutDir: true }
  });
}

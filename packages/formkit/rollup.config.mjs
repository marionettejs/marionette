import { fileURLToPath } from 'node:url';
const packageRoot = new URL('./', import.meta.url);
export default {
  input: Object.fromEntries(['index', 'components'].map(name => [name, fileURLToPath(new URL(`src/${name}.mjs`, packageRoot))])),
  external: id => id === 'marionette' || id.startsWith('@formkit/'),
  output: [
    { dir: fileURLToPath(new URL('dist/', packageRoot)), format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js', sourcemap: true },
    { dir: fileURLToPath(new URL('dist/', packageRoot)), format: 'cjs', entryFileNames: '[name].cjs', chunkFileNames: 'chunks/[name]-[hash].cjs', exports: 'named', sourcemap: true }
  ],
  onwarn(warning, warn) {
    if (warning.code === 'UNRESOLVED_IMPORT') {throw new Error(warning.message);}
    warn(warning);
  }
};

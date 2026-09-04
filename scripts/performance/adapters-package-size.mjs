import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import { rollup } from 'rollup';
import adapterConfigurations from '../../packages/adapters/rollup.config.mjs';

const compress = promisify(brotliCompress);
const root = resolve(import.meta.dirname, '../..');
const packageRoot = resolve(root, 'packages/adapters');
const sourceRoot = resolve(packageRoot, 'src');
const quality = 11;
const artifacts = [
  ['Backbone adapter ES module', 'dist/backbone.js'],
  ['Backbone adapter CommonJS', 'dist/backbone.cjs'],
  ['jQuery DomApi ES module', 'dist/dom/jquery.js'],
  ['jQuery DomApi CommonJS', 'dist/dom/jquery.cjs'],
  ['Redux adapter ES module', 'dist/redux.js'],
  ['Redux adapter CommonJS', 'dist/redux.cjs'],
  ['Zustand adapter ES module', 'dist/zustand.js'],
  ['Zustand adapter CommonJS', 'dist/zustand.cjs'],
  ['XState Store adapter ES module', 'dist/xstate-store.js'],
  ['XState Store adapter CommonJS', 'dist/xstate-store.cjs'],
];
const expectedExternalImports = [
  [],
  ['jquery'],
  [],
  [],
  [],
];

function formatBytes(bytes) {
  return bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(2)} kB`;
}

const measured = [];
for (const [name, path] of artifacts) {
  const bytes = await readFile(resolve(packageRoot, path));
  const compressed = await compress(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: quality },
  });
  measured.push({ name, path: `packages/adapters/${path}`, size: compressed.length });
}

for (const [index, configuration] of adapterConfigurations.entries()) {
  const bundle = await rollup({
    ...configuration,
    input: resolve(packageRoot, configuration.input),
  });
  const generated = await bundle.generate({ format: 'es' });
  const externalImports = [...new Set(generated.output
    .filter(output => output.type === 'chunk')
    .flatMap(output => [...output.imports, ...output.dynamicImports]))].sort();
  const internalModules = bundle.watchFiles.map(path => resolve(path));
  await bundle.close();

  if (JSON.stringify(externalImports) !== JSON.stringify(expectedExternalImports[index])) {
    throw new Error(`@marionette/adapters graph ${index} external imports changed: ${externalImports.join(', ') || 'none'}.`);
  }
  const foreignModules = internalModules.filter(path => {
    const sourcePath = relative(sourceRoot, path);
    return sourcePath.startsWith('..') || isAbsolute(sourcePath);
  });
  if (foreignModules.length) {
    throw new Error(`@marionette/adapters graph ${index} bundled modules outside its source root: ${foreignModules
      .map(path => relative(root, path)).join(', ')}.`);
  }

  console.log(`@marionette/adapters graph ${index}: ${internalModules.length} internal modules, ${externalImports.length} external imports`);
}

for (const artifact of measured) {
  console.log(`${artifact.name}: ${formatBytes(artifact.size)}`);
}
console.log(`Cumulative @marionette/adapters: ${formatBytes(measured
  .reduce((total, artifact) => total + artifact.size, 0))}`);

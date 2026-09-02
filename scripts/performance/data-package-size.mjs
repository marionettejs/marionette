import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import { rollup } from 'rollup';
import dataConfiguration from '../../packages/data/rollup.config.mjs';

const compress = promisify(brotliCompress);
const root = resolve(import.meta.dirname, '../..');
const packageRoot = resolve(root, 'packages/data');
const sourceRoot = resolve(packageRoot, 'src');
const quality = 11;
const artifacts = [
  ['Data ES module', 'dist/index.js'],
  ['Data CommonJS', 'dist/index.cjs'],
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
  measured.push({ name, path: `packages/data/${path}`, size: compressed.length });
}

const bundle = await rollup({
  input: resolve(packageRoot, dataConfiguration.input),
  external: dataConfiguration.external,
  plugins: dataConfiguration.plugins,
});
const generated = await bundle.generate({ format: 'es' });
const externalImports = [...new Set(generated.output
  .filter(output => output.type === 'chunk')
  .flatMap(output => [...output.imports, ...output.dynamicImports]))].sort();
const internalModules = bundle.watchFiles.map(path => resolve(path));
await bundle.close();

if (JSON.stringify(externalImports) !== JSON.stringify(['marionette'])) {
  throw new Error(`@marionette/data external imports changed: ${externalImports.join(', ') || 'none'}.`);
}
const foreignModules = internalModules.filter(path => {
  const sourcePath = relative(sourceRoot, path);
  return sourcePath.startsWith('..') || isAbsolute(sourcePath);
});
if (foreignModules.length) {
  throw new Error(`@marionette/data bundled modules outside its source root: ${foreignModules
    .map(path => relative(root, path)).join(', ')}.`);
}

for (const artifact of measured) {
  console.log(`${artifact.name}: ${formatBytes(artifact.size)}`);
}
console.log(`Cumulative @marionette/data: ${formatBytes(measured
  .reduce((total, artifact) => total + artifact.size, 0))}`);
console.log(`@marionette/data: ${internalModules.length} internal modules, 1 external import`);

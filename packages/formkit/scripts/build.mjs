import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import config from '../rollup.config.mjs';
const root = new URL('../', import.meta.url);
await rm(new URL('dist/', root), { recursive: true, force: true });
const bundle = await rollup(config);
try { for (const output of config.output) {await bundle.write(output);} } finally { await bundle.close(); }
// Separate declaration scopes follow the repository's ESM/CJS package contract.
for (const format of ['esm', 'cjs']) {
  const destination = new URL(`dist/types/${format}/`, root);
  await mkdir(destination, { recursive: true });
  for (const name of await readdir(new URL('types/', root))) {
    if (name.endsWith('.d.ts')) {await cp(new URL(`types/${name}`, root), new URL(name, destination));}
  }
  if (format === 'cjs') {await writeFile(new URL('package.json', destination), '{"type":"commonjs"}\n');}
}
console.log(`Built @mnjs/formkit in ${fileURLToPath(new URL('dist/', root))}`);

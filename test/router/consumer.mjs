import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(root, 'test/tmp/router-consumer');
mkdirSync(directory, { recursive: true });
const npm = (...args) => execFileSync('npm', [...args, '--cache', path.join(directory, 'cache')], { cwd: root, encoding: 'utf8' });
const [packed] = JSON.parse(npm('pack', path.join(root, 'packages/router'), '--ignore-scripts', '--json', '--pack-destination', directory));
assert.ok(packed.files.every(file => file.path.startsWith('dist/') || ['package.json', 'readme.md', 'design.md', 'verification.md', 'license.txt'].includes(file.path)));
writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
npm('install', path.join(directory, packed.filename), '--prefix', directory, '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--package-lock=false', '--cache', path.join(directory, 'cache'));
copyFileSync(new URL('./types.mts', import.meta.url), path.join(directory, 'types.mts'));
writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({
  compilerOptions: { target: 'ES2024', lib: ['ES2024', 'DOM'], module: 'NodeNext', strict: true, noEmit: true, types: [] },
  include: ['types.mts'],
}));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(directory, 'tsconfig.json')], { stdio: 'inherit' });
writeFileSync(path.join(directory, 'runtime.mjs'), `
import assert from 'node:assert/strict';
import { createRouter, createRoutes, createMemoryHistory } from '@mnjs/router';
const seen = [];
const routes = createRoutes({ item: '/item/:id' });
const router = createRouter({ routes, history: createMemoryHistory('https://example.test/item/a'), dispatch: context => seen.push(context.match.params.id) });
await router.start();
assert.equal((await router.navigate({ name: 'item', params: { id: 'b' } })).status, 'handled');
assert.deepEqual(seen, ['a', 'b']);
router.dispose();
`);
execFileSync(process.execPath, [path.join(directory, 'runtime.mjs')], { stdio: 'inherit' });
writeFileSync(path.join(root, 'test/tmp/router-consumer-result.json'), JSON.stringify({
  package: packed.name, version: packed.version, integrity: packed.integrity,
  installedRuntime: 'passed', installedDeclarations: 'passed', files: packed.files.map(file => file.path),
}, null, 2) + '\n');
console.log('Packed ESM runtime and generated declaration consumer passed.');

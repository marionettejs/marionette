import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const npm = process.env.npm_execpath;
if (!npm) { throw new Error('Run through npm run prepare:local.'); }

const root = fileURLToPath(new URL('../../../', import.meta.url));

// Build the linked packages from this checkout without the retired docs pipeline.
// Imports still resolve through public package exports; this is a local consumer,
// not proof that the published tarballs contain the same files.
for (const script of ['build:utils', 'build:radio']) {
  execFileSync(process.execPath, [npm, 'run', script], { cwd: root, stdio: 'inherit' });
}
execFileSync(process.execPath, [
  'node_modules/rollup/dist/bin/rollup', '-c', 'rollup.config.mjs', '--noConflict',
], { cwd: root, stdio: 'inherit' });
for (const script of ['build:types', 'build:data', 'build:adapters']) {
  execFileSync(process.execPath, [npm, 'run', script], { cwd: root, stdio: 'inherit' });
}

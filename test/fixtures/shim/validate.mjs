import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

for (const file of [
  'validate-esm-backbone-first.mjs',
  'validate-esm-shim-first.mjs',
  'validate-cjs-backbone-first.cjs',
  'validate-cjs-shim-first.cjs',
]) {
  execFileSync(process.execPath, [resolve(import.meta.dirname, file)], {
    stdio: 'inherit',
    timeout: 30_000,
  });
}

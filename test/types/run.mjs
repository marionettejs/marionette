import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '../..');
const consumer = mkdtempSync(join(tmpdir(), 'marionette-type-consumer-'));
try {
  mkdirSync(join(consumer, 'node_modules/@marionette'), { recursive: true });
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'marionette-type-consumer', private: true, type: 'module' }));
  for (const [name, directory] of [
    ['marionette', '.'],
    ['@marionette/utils', 'packages/utils'],
    ['@marionette/radio', 'packages/radio'],
    ['@marionette/data', 'packages/data'],
    ['@marionette/adapters', 'packages/adapters']
  ]) {
    symlinkSync(resolve(root, directory), join(consumer, 'node_modules', name), 'junction');
  }
  for (const file of readdirSync(import.meta.dirname)) {
    if (/\.[mc]ts$/.test(file) || file === 'tsconfig.consumer.json') {
      copyFileSync(join(import.meta.dirname, file), join(consumer, file));
    }
  }
  execFileSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '-p', join(consumer, 'tsconfig.consumer.json')
  ], { cwd: root, stdio: 'inherit' });
} finally {
  rmSync(consumer, { recursive: true, force: true });
}

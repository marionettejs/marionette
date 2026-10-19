import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '../..');
const consumer = mkdtempSync(join(tmpdir(), 'marionette-type-consumer-'));
try {
  mkdirSync(join(consumer, 'node_modules/@mnjs'), { recursive: true });
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'marionette-type-consumer', private: true, type: 'module' }));
  for (const [name, directory] of [
    ['marionette', '.'],
    ['@mnjs/utils', 'packages/utils'],
    ['@mnjs/radio', 'packages/radio'],
    ['@mnjs/router', 'packages/router'],
    ['@mnjs/data', 'packages/data'],
    ['@mnjs/adapters', 'packages/adapters']
  ]) {
    const installed = join(consumer, 'node_modules', name);
    mkdirSync(installed, { recursive: true });
    copyFileSync(resolve(root, directory, 'package.json'), join(installed, 'package.json'));
    cpSync(resolve(root, directory, 'dist'), join(installed, 'dist'), { recursive: true });
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

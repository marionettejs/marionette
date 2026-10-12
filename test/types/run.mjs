import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '../..');
const consumer = mkdtempSync(join(tmpdir(), 'marionette-type-consumer-'));
try {
  mkdirSync(join(consumer, 'node_modules/@mnjs'), { recursive: true });
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'marionette-type-consumer', private: true, type: 'module' }));
  const ownedPackages = JSON.parse(readFileSync(join(root, 'config/package-ownership.json'), 'utf8')).packages;
  for (const { name, directory } of ownedPackages) {
    const destination = join(consumer, 'node_modules', name);
    if (name === '@mnjs/formkit') {
      // Resolve its declared Marionette peer from the consumer, not the checkout.
      mkdirSync(destination, { recursive: true });
      copyFileSync(resolve(root, directory, 'package.json'), join(destination, 'package.json'));
      cpSync(resolve(root, directory, 'dist'), join(destination, 'dist'), { recursive: true });
    } else {
      symlinkSync(resolve(root, directory), destination, 'junction');
    }
  }
  symlinkSync(resolve(root, 'node_modules/@formkit'), join(consumer, 'node_modules/@formkit'), 'junction');
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

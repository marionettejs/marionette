import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const reportDir = join(root, 'test/tmp');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const { tarball, integrity } = JSON.parse(await readFile(join(reportDir, 'package-result.json'), 'utf8'));
const frameworkPackages = new Set(['vue', 'react', 'react-dom', '@formkit/vue', '@formkit/react', '@formkit/pro']);
const consumer = await mkdtemp(join(tmpdir(), 'mnjs-formkit-consumer-'));

function run(command, args) {
  return execFileSync(command, args, { cwd: consumer, encoding: 'utf8' }).trim();
}

try {
  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    name: 'mnjs-formkit-clean-consumer',
    private: true,
    type: 'module',
    dependencies: { [manifest.name]: `file:${tarball}`, marionette: manifest.devDependencies.marionette },
    devDependencies: { jsdom: manifest.devDependencies.jsdom, typescript: manifest.devDependencies.typescript },
  }));
  run('npm', ['install', '--engine-strict', '--ignore-scripts', '--no-audit', '--no-fund',
    '--registry=https://registry.npmjs.org/']);
  const { packages } = JSON.parse(await readFile(join(consumer, 'package-lock.json'), 'utf8'));
  const candidate = `node_modules/${manifest.name}`;
  assert.equal(packages[candidate].integrity, integrity);
  for (const [name, pkg] of Object.entries(packages)) {
    if (!name || name === candidate) { continue; }
    assert.ok(!pkg.link && pkg.resolved?.startsWith('https://registry.npmjs.org/'), `Not a registry install: ${name}`);
    if (!pkg.dev) {
      const dependency = name.split('node_modules/').at(-1);
      assert.ok(!frameworkPackages.has(dependency), `Unexpected production dependency: ${name}`);
    }
  }
  const behavior = {};
  for (const file of ['packed-consumer.mjs', 'expanded-packed-contract.mjs']) {
    await copyFile(join(root, 'test/fixtures', file), join(consumer, file));
    behavior[file] = JSON.parse(run(process.execPath, [file]));
  }
  for (const file of ['esm.mts', 'cjs.cts', 'expanded-packed-contract.mts', 'expanded-packed-contract.cts', 'tsconfig.json']) {
    await copyFile(join(root, 'test/types', file), join(consumer, file));
  }
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
  const report = {
    passed: true, node: process.version, npm: run('npm', ['--version']), integrity,
    packages, behavior, types: ['ESM', 'CommonJS'],
  };
  await writeFile(join(reportDir, `clean-consumer-${process.version}.json`), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await rm(consumer, { recursive: true, force: true });
}

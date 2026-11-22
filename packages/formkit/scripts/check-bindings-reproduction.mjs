import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const script = join(root, 'scripts/extract-bindings.mjs');
const require = createRequire(join(root, 'package.json'));
const actual = readFileSync(join(root, 'src/runtime/upstream-bindings.mjs'), 'utf8');
const generated = execFileSync(process.execPath, [script, '--stdout'], { cwd: root, encoding: 'utf8' });
assert.equal(generated, actual);
const temporaryRoot = join(root, 'test/tmp'); mkdirSync(temporaryRoot, { recursive: true });
const temporary = mkdtempSync(join(temporaryRoot, 'binding-repro-'));
const results = [{ name: 'real locked 2.9 reference reproduces current adaptation', passed: true }];
try {
  const paths = ['package.json', 'package-lock.json', 'scripts/extract-bindings.mjs', 'scripts/bindings-adaptation.json', 'src/runtime/upstream-bindings.mjs'];
  for (const path of paths) { mkdirSync(dirname(join(temporary, path)), { recursive: true }); cpSync(join(root, path), join(temporary, path)); }
  const referencePath = require.resolve('@formkit/react/package.json');
  const referenceRoot = join(temporary, 'node_modules/@formkit/react'); mkdirSync(join(referenceRoot, 'dist'), { recursive: true });
  cpSync(referencePath, join(referenceRoot, 'package.json'));
  cpSync(join(dirname(referencePath), 'dist/index.mjs'), join(referenceRoot, 'dist/index.mjs'));
  const execute = () => spawnSync(process.execPath, [join(temporary, 'scripts/extract-bindings.mjs')], { cwd: temporary, encoding: 'utf8' });
  const positive = execute(); assert.equal(positive.status, 0, positive.stderr);
  results.push({ name: 'isolated tooling fixture needs no experiment checkout', passed: true });
  const runtime = join(temporary, 'src/runtime/upstream-bindings.mjs'); writeFileSync(runtime, actual + '\n');
  const wrongRuntime = execute(); assert.notEqual(wrongRuntime.status, 0); assert.match(wrongRuntime.stderr, /Package binding differs/);
  results.push({ name: 'changed target rejected', passed: true }); writeFileSync(runtime, actual);
  const referenceFile = join(referenceRoot, 'dist/index.mjs'); const pristineReference = readFileSync(referenceFile, 'utf8'); writeFileSync(referenceFile, pristineReference + '\n');
  const wrongReference = execute(); assert.notEqual(wrongReference.status, 0); assert.match(wrongReference.stderr, /Published reference bytes differ/);
  results.push({ name: 'changed published source rejected', passed: true }); writeFileSync(referenceFile, pristineReference);
  const manifestFile = join(referenceRoot, 'package.json'); const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')); manifest.version = '2.5.0'; writeFileSync(manifestFile, JSON.stringify(manifest));
  const wrongVersion = execute(); assert.notEqual(wrongVersion.status, 0); assert.match(wrongVersion.stderr, /2\.5\.0/);
  results.push({ name: 'wrong-version fixture rejected without bootstrap', passed: true });
} finally { rmSync(temporary, { recursive: true, force: true }); }
console.log(JSON.stringify({ passed: true, checks: results, referenceScope: 'real installed2.9 plus explicit tampered tooling fixtures; React never executed' }));

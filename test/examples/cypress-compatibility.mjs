import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// Deliberately independent of the Cypress 16 / Vite 8 example project's lock.
// Each row installs the same archive with ordinary peer resolution, never overrides.
const root = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: {
  artifact: { type: 'string' }, sha256: { type: 'string' },
  output: { type: 'string', default: join(root, 'test/tmp/cypress-compatibility') },
  runtime: { type: 'boolean', default: false },
  browser: { type: 'string', default: 'electron' },
  versions: { type: 'string', default: '14.0.0,15.0.0,15.21.1,16.0.0,16.2.0' }
} });
assert(values.artifact && values.sha256, 'Supply --artifact and --sha256 from one built archive.');
assert(process.env.npm_execpath, 'Run through npm run so its CLI can be located.');
const artifact = resolve(values.artifact);
const sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
assert.equal(sha256, values.sha256, 'Archive SHA256 mismatch.');
const output = resolve(values.output);
mkdirSync(output, { recursive: true });
const workspace = mkdtempSync(join(tmpdir(), 'mnjs-cypress-compatibility-'));
for (let ancestor = dirname(workspace); ; ancestor = dirname(ancestor)) {
  assert(!existsSync(join(ancestor, 'node_modules')), `Fixture ancestor has node_modules: ${ancestor}`);
  if (dirname(ancestor) === ancestor) { break; }
}
const env = { ...process.env, CYPRESS_INSTALL_BINARY: '0', NODE_PATH: '',
  MNJS_TEST_CYPRESS_BROWSER: values.browser,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-global-search-paths` };
const report = { artifact, sha256, node: process.version, workspace, runtimeRequested: values.runtime,
  browserRequested: values.browser,
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
  rows: [], passed: false };
function run(row, name, command, args, cwd) {
  const stage = { name, passed: false };
  row.stages.push(stage);
  try {
    const result = execFileSync(command, args, { cwd, env, encoding: 'utf8', timeout: 300000,
      stdio: ['ignore', 'pipe', 'pipe'] });
    writeFileSync(join(output, `${row.name}-${name}.log`), result);
    stage.passed = true;
    return result;
  } catch (error) {
    writeFileSync(join(output, `${row.name}-${name}.log`), `${error.stdout || ''}\n${error.stderr || ''}`);
    stage.error = error.message;
    throw new Error(`${row.name}: ${name} failed; see its log.`, { cause: error });
  }
}
function npm(row, name, args, cwd) {
  return run(row, name, process.execPath, [process.env.npm_execpath, ...args], cwd);
}
function save() { writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
try {
  const combinations = [{ name: 'no-cypress' }, ...values.versions.split(',').flatMap(cypress =>
    ['4.0.0', '5.0.0'].map(mountUtils => ({ name: `cypress-${cypress}-mount-${mountUtils}`, cypress, mountUtils })))];
  for (const combination of combinations) {
    const row = { ...combination, stages: [], passed: false };
    report.rows.push(row);
    const cwd = join(workspace, row.name);
    mkdirSync(cwd);
    const major = Number(row.cypress?.split('.')[0]);
    // Vite 8's Cypress >=16 peer is a harness constraint, not an adapter API.
    const harness = major === 14 ? { '@cypress/vite-dev-server': '6.0.0', vite: '6.0.11' } :
      major === 15 ? { '@cypress/vite-dev-server': '7.0.0', vite: '7.1.2' } :
        { '@cypress/vite-dev-server': '8.0.0', vite: '8.3.5' };
    const dependencies = { '@mnjs/test': `file:${artifact}`, marionette: '5.0.0', typescript: '6.0.3',
      ...(row.cypress ? { cypress: row.cypress, '@cypress/mount-utils': row.mountUtils,
        '@testing-library/dom': '10.4.2', ...harness } : {}) };
    row.harness = row.cypress ? harness : undefined;
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: row.name, private: true, type: 'module', dependencies }, null, 2));
    try {
      npm(row, 'install', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--strict-peer-deps'], cwd);
      const tree = JSON.parse(npm(row, 'dependency-tree', ['ls', '--json'], cwd));
      assert.equal(tree.dependencies['@mnjs/test'].version, '0.1.1');
      const manifest = JSON.parse(readFileSync(join(cwd, 'node_modules/@mnjs/test/package.json'), 'utf8'));
      assert.equal(manifest.peerDependencies.cypress, '>=14');
      assert.equal(manifest.peerDependenciesMeta.cypress.optional, true);
      assert.equal(manifest.peerDependenciesMeta['@cypress/mount-utils'].optional, true);
      mkdirSync(join(output, row.name), { recursive: true });
      cpSync(join(cwd, 'package-lock.json'), join(output, row.name, 'package-lock.json'));
      cpSync(join(cwd, 'package.json'), join(output, row.name, 'package.json'));
      if (row.cypress) {
        assert.equal(tree.dependencies.cypress.version, row.cypress);
        assert.equal(tree.dependencies['@cypress/mount-utils'].version, row.mountUtils);
        cpSync(join(root, 'packages/test/examples/cypress'), join(cwd, 'cypress'), { recursive: true });
        cpSync(join(root, 'packages/test/examples/fixtures.js'), join(cwd, 'fixtures.js'));
        const tsconfig = JSON.parse(readFileSync(join(root, 'packages/test/examples/tsconfig.json'), 'utf8'));
        // Older Cypress bundles pre-symbol WeakMap declarations; ES2022 matches them.
        tsconfig.compilerOptions.target = 'ES2022';
        tsconfig.compilerOptions.lib = ['ES2022', 'DOM'];
        writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
        row.typeHarness = { typescript: '6.0.3', target: 'ES2022', skipLibCheck: false };
        let smoke = readFileSync(join(root, 'test/examples/cypress-smoke.mjs'), 'utf8');
        if (major < 16) {
          // Cypress.expose is new in 16; the shipped adapter never calls it.
          smoke = smoke.replace('expose: { mnjsProbe: scenario.name }', 'env: { mnjsProbe: scenario.name }');
          const probe = join(cwd, 'cypress/probes/failure.cy.js');
          writeFileSync(probe, readFileSync(probe, 'utf8').replace('Cypress.expose(\'mnjsProbe\')', 'Cypress.env(\'mnjsProbe\')'));
        }
        writeFileSync(join(cwd, 'cypress-smoke.mjs'), smoke);
        cpSync(join(root, 'packages/test/examples/cypress.config.js'), join(cwd, 'cypress.config.js'));
        npm(row, 'types', ['exec', '--', 'tsc', '-p', 'cypress/tsconfig.json'], cwd);
        if (values.runtime) {
          try { run(row, 'runtime', process.execPath, ['cypress-smoke.mjs'], cwd); } finally {
            const diagnostics = join(cwd, 'test-results/cypress');
            if (existsSync(diagnostics)) { cpSync(diagnostics, join(output, row.name), { recursive: true }); }
          }
        }
      } else {
        run(row, 'neutral-import', process.execPath, ['--input-type=module', '-e', `
          import assert from 'node:assert/strict';
          import { createRequire } from 'node:module';
          import * as esm from '@mnjs/test';
          const require = createRequire(import.meta.url);
          const cjs = require('@mnjs/test');
          assert.throws(() => require.resolve('cypress'), { code: 'MODULE_NOT_FOUND' });
          assert.throws(() => require.resolve('@cypress/mount-utils'), { code: 'MODULE_NOT_FOUND' });
          assert.equal(typeof globalThis.document, 'undefined');
          assert.equal(typeof globalThis.Cypress, 'undefined');
          assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
          await esm.createTestScope().cleanup(); await cjs.createTestScope().cleanup();
        `], cwd);
        for (const extension of ['mts', 'cts']) {
          writeFileSync(join(cwd, `neutral.${extension}`), 'import { createTestScope } from \'@mnjs/test\';\nvoid createTestScope().cleanup();\n');
        }
        writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
          target: 'ES2024', module: 'NodeNext', strict: true, noEmit: true, types: [], skipLibCheck: false
        }, include: ['neutral.mts', 'neutral.cts'] }));
        npm(row, 'types', ['exec', '--', 'tsc', '-p', 'tsconfig.json'], cwd);
      }
      row.passed = true;
    } catch (error) { row.error = error.message; }
    console.log(`${row.name}: ${row.passed ? 'passed' : row.error}`);
    save();
  }
  report.passed = report.rows.every(row => row.passed);
  if (!report.passed) { process.exitCode = 1; }
} finally {
  // Retain consumers and exact generated locks for inspection and runtime reruns.
  save();
}

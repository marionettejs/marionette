import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  collectRuntimePaths,
  createReport,
  findForbiddenModules,
  measure,
  resolveRollupInput,
  runtimePath,
  validateContract,
  validateCumulativeSize,
  validateToolchain,
} from '../../config/bundle-size.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

function contractFor(paths = ['dist/index.mjs']) {
  return {
    schemaVersion: 1,
    baseline: {
      brotliQuality: 11,
      totalBrotliBytes: paths.length * 10,
      absoluteCeilingBytes: paths.length * 10,
    },
    thresholds: {
      cumulativeGrowthPercent: 0,
    },
    runtimeArtifacts: paths.map(path => ({
      name: path,
      path,
      baselineBrotliBytes: 10,
    })),
    productionGraphs: [{ subpath: '.' }],
    forbiddenProductionModulePrefixes: ['test/'],
    forbiddenProductionModules: ['config/performance.json'],
  };
}

describe('performance contract validation', () => {
  test('recognizes shipped mjs entrypoints', () => {
    assert.equal(runtimePath('./dist/index.mjs'), true);
    assert.deepEqual(
      [...collectRuntimePaths({ import: './dist/index.mjs', types: './dist/index.d.ts' })],
      ['dist/index.mjs']
    );
  });

  test('anchors Rollup inputs to the measured checkout', () => {
    const checkoutRoot = resolve(tmpdir(), 'base-checkout');

    assert.equal(
      resolveRollupInput(checkoutRoot, 'index.js'),
      resolve(checkoutRoot, 'index.js')
    );
    assert.deepEqual(
      resolveRollupInput(checkoutRoot, { main: 'index.js' }),
      { main: resolve(checkoutRoot, 'index.js') }
    );
  });

  test('reports missing and untracked artifacts including mjs', () => {
    const contract = contractFor();
    const packageJson = {
      exports: { '.': { import: './dist/index.mjs' } },
    };
    const violations = validateContract(contract, packageJson, ['untracked.mjs']);

    assert.ok(violations.includes('Configured runtime artifacts are missing: dist/index.mjs'));
    assert.ok(violations.includes('Shipped runtime artifacts are untracked: dist/untracked.mjs'));
  });

  test('measures malformed artifact and subpath changes without an uncaught error', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-contract-'));
    const contract = contractFor();
    const packageJson = {
      type: 'module',
      exports: {
        '.': { import: './dist/index.mjs' },
        './feature': { import: './dist/untracked.mjs' },
      },
    };

    try {
      await mkdir(join(fixtureRoot, 'dist'));
      await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(fixtureRoot, 'performance.json'), JSON.stringify(contract));
      await writeFile(join(fixtureRoot, 'rollup.config.mjs'), 'export default [];\n');
      await writeFile(join(fixtureRoot, 'dist/untracked.mjs'), 'export default true;\n');

      const result = await measure({
        root: fixtureRoot,
        configPath: join(fixtureRoot, 'performance.json'),
        checkToolchain: false,
      });

      assert.equal(result.artifacts.find(artifact => artifact.path === 'dist/index.mjs').status, 'missing');
      assert.equal(result.artifacts.find(artifact => artifact.path === 'dist/untracked.mjs').status, 'untracked');
      assert.equal(result.graphs.find(graph => graph.subpath === '.').status, 'measurement-error');
      assert.equal(result.graphs.find(graph => graph.subpath === './feature').status, 'unconfigured');
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('reports an absent dist directory as missing artifacts', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-contract-'));
    const contract = contractFor();
    const packageJson = {
      type: 'module',
      exports: { '.': { import: './dist/index.mjs' } },
    };

    try {
      await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(fixtureRoot, 'performance.json'), JSON.stringify(contract));
      await writeFile(join(fixtureRoot, 'rollup.config.mjs'), 'export default [];\n');

      const result = await measure({
        root: fixtureRoot,
        configPath: join(fixtureRoot, 'performance.json'),
        checkToolchain: false,
      });

      assert.equal(result.artifacts[0].status, 'missing');
      assert.ok(result.violations.includes('Configured runtime artifacts are missing: dist/index.mjs'));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('reports no graph change for an identical checkout measured from another cwd', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-graph-'));
    const contract = contractFor();
    contract.productionGraphs = [{
      subpath: '.',
      input: 'index.js',
      output: 'dist/index.mjs',
      baselineModules: ['index.js'],
      baselineExternalImports: [],
    }];
    const packageJson = {
      type: 'module',
      exports: { '.': { import: './dist/index.mjs' } },
    };

    try {
      await mkdir(join(fixtureRoot, 'dist'));
      await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(fixtureRoot, 'performance.json'), JSON.stringify(contract));
      await writeFile(join(fixtureRoot, 'index.js'), 'export const value = 1;\n');
      await writeFile(join(fixtureRoot, 'dist/index.mjs'), 'export const value = 1;\n');
      await writeFile(
        join(fixtureRoot, 'rollup.config.mjs'),
        'export default [{ input: \'index.js\', output: { file: \'dist/index.mjs\', format: \'es\' } }];\n'
      );

      const result = await measure({
        root: fixtureRoot,
        configPath: join(fixtureRoot, 'performance.json'),
        checkToolchain: false,
      });
      assert.equal(result.graphs[0].status, 'measured');
      assert.deepEqual(result.graphs[0].modules, ['index.js']);

      const baseReport = join(fixtureRoot, 'base.json');
      const currentReport = join(fixtureRoot, 'current.json');
      await Promise.all([
        writeFile(baseReport, JSON.stringify(result)),
        writeFile(currentReport, JSON.stringify(result)),
      ]);
      assert.match(await createReport(baseReport, currentReport), /\| `\.` \| 1 \| None \| No change \|/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('reports exported subpaths missing from the production graph contract', () => {
    const contract = contractFor(['dist/index.mjs', 'dist/feature.mjs']);
    const packageJson = {
      exports: {
        '.': { import: './dist/index.mjs' },
        './feature': { import: './dist/feature.mjs' },
      },
    };
    const violations = validateContract(contract, packageJson, ['feature.mjs', 'index.mjs']);

    assert.ok(violations.includes('Production graph subpaths mismatch exports; missing: ./feature; extra: none'));
  });

  test('rejects cumulative size above the authority ceiling', () => {
    const contract = contractFor();

    assert.deepEqual(validateCumulativeSize(contract, 10), []);
    assert.deepEqual(validateCumulativeSize(contract, 11), [
      'Cumulative Brotli-11 size 11 exceeds the absolute ceiling 10'
    ]);
  });

  test('rejects exact and prefix-matched forbidden production modules', () => {
    const contract = contractFor();

    assert.deepEqual(
      findForbiddenModules(['index.js', 'test/helper.js', 'config/performance.json'], contract),
      ['test/helper.js', 'config/performance.json']
    );
  });

  test('pins the checked-in release profile and dependency versions', async() => {
    const contract = JSON.parse(await readFile(new URL('../../config/performance.json', import.meta.url)));

    assert.deepEqual(await validateToolchain(contract, root), []);
    assert.ok(
      contract.forbiddenProductionModules.includes('config/performance-resources.mjs')
    );
    assert.deepEqual(
      findForbiddenModules(['index.js', 'config/performance-resources.mjs'], contract),
      ['config/performance-resources.mjs']
    );
  });
});

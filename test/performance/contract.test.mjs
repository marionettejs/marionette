import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  collectRuntimePaths,
  createReport,
  findForbiddenExternalImports,
  findForbiddenModules,
  listRuntimeFiles,
  measure,
  resolveRollupInput,
  runtimePath,
  validateContract,
  validateToolchain,
} from '../../scripts/performance/bundle-size.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

function contractFor(paths = ['dist/index.mjs']) {
  return {
    schemaVersion: 1,
    baseline: {
      brotliQuality: 11,
      totalBrotliBytes: paths.length * 10,
    },
    runtimeArtifacts: paths.map(path => ({
      name: path,
      path,
      baselineBrotliBytes: 10,
    })),
    productionGraphs: [{ subpath: '.', output: paths[0] }],
    forbiddenProductionModulePrefixes: ['test/'],
    forbiddenProductionModules: ['config/performance.json'],
  };
}

function bundleReport(size) {
  return {
    brotliQuality: 11,
    artifacts: [{ name: 'Main', path: 'dist/main.js', size }],
    cumulative: {
      size,
      baselineSize: 100,
    },
    graphs: [],
    resourcesRequired: false,
    resources: null,
    violations: [],
  };
}

function newSubpathReport(includeFeature = false) {
  const report = bundleReport(100);
  report.graphs = [{
    subpath: '.',
    status: 'measured',
    modules: ['index.js'],
    externalImports: [],
  }];
  if (includeFeature) {
    report.artifacts.push({
      name: 'Feature',
      path: 'dist/feature.js',
      status: 'measured',
      size: 4,
    });
    report.cumulative.size = 104;
    report.graphs.push({
      subpath: './feature',
      status: 'measured',
      modules: ['feature.js'],
      externalImports: [],
      forbiddenModules: [],
    });
  }
  return report;
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

  test('checks historical baseline arithmetic without imposing a ceiling', () => {
    const contract = contractFor();
    const manifest = { exports: { '.': { import: './dist/index.mjs' } } };
    contract.baseline.totalBrotliBytes = 11;
    assert.deepEqual(validateContract(contract, manifest, ['index.mjs']), [
      'Artifact baselines total 10; expected 11',
    ]);
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

  test('tracks runtime artifacts and public graphs across separately published packages', () => {
    const contract = contractFor([
      'dist/index.mjs',
      'packages/adapters/dist/backbone.js',
    ]);
    contract.productionGraphs.push({
      subpath: '@marionette/adapters/backbone',
      output: 'packages/adapters/dist/backbone.js',
    });
    const packageJson = {
      name: 'marionette',
      exports: { '.': { import: './dist/index.mjs' } },
    };
    const adaptersPackageJson = {
      name: '@marionette/adapters',
      exports: { './backbone': { import: './dist/backbone.js' } },
    };

    assert.deepEqual(validateContract(
      contract,
      packageJson,
      ['dist/index.mjs', 'packages/adapters/dist/backbone.js'],
      [
        { directory: '', packageJson },
        { directory: 'packages/adapters', packageJson: adaptersPackageJson },
      ],
    ), []);
  });

  test('rejects a scoped package-root graph without a matching package export', () => {
    const paths = ['packages/adapters/dist/backbone.js'];
    const contract = contractFor(paths);
    contract.productionGraphs[0].subpath = '@marionette/adapters';
    const packageJson = {
      name: '@marionette/adapters',
      exports: { './backbone': { import: './dist/backbone.js' } },
    };
    const violations = validateContract(contract, {}, paths, [
      { directory: 'packages/adapters', packageJson },
    ]);

    assert.ok(violations.includes(
      'Production graph @marionette/adapters output packages/adapters/dist/backbone.js is not exported by that subpath'));
  });

  test('keeps forbidden external imports optional and validates canonical candidate lists', () => {
    const packageJson = {
      exports: { '.': { import: './dist/index.mjs' } },
    };
    const absent = contractFor();

    assert.deepEqual(validateContract(absent, packageJson, ['index.mjs']), []);

    const canonical = contractFor();
    canonical.forbiddenExternalImports = ['jquery', 'underscore'];
    assert.deepEqual(validateContract(canonical, packageJson, ['index.mjs']), []);
    const large = contractFor();
    large.forbiddenExternalImports = Array.from(
      { length: 51 },
      (_, index) => `package-${String(index).padStart(2, '0')}`
    );
    assert.deepEqual(validateContract(large, packageJson, ['index.mjs']), []);
    assert.deepEqual(
      findForbiddenExternalImports([
        'backbone',
        'jquery',
        'underscore',
        'underscore/modules/each.js',
        'underscore-plus',
      ], canonical),
      ['jquery', 'underscore', 'underscore/modules/each.js']
    );

    for (const malformed of [
      'underscore',
      [],
      [''],
      ['underscore', 'jquery'],
      ['underscore', 'underscore'],
    ]) {
      const contract = contractFor();
      contract.forbiddenExternalImports = malformed;
      assert.ok(validateContract(contract, packageJson, ['index.mjs']).includes(
        'forbiddenExternalImports must be a sorted, unique array of non-empty strings'
      ));
    }
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
      assert.deepEqual(
        result.graphs.find(graph => graph.subpath === '.').forbiddenExternalImports,
        []
      );
      assert.deepEqual(
        result.graphs.find(graph => graph.subpath === './feature').forbiddenExternalImports,
        []
      );
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('requires every shipped package in the measurement inventory', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-data-measurement-'));
    const contract = contractFor(['dist/index.mjs']);
    contract.runtimeArtifacts[0].baselineBrotliBytes = 100;
    contract.baseline.totalBrotliBytes = 100;
    contract.productionGraphs[0] = {
      subpath: '.', input: 'index.js', output: 'dist/index.mjs',
      baselineModules: ['index.js'], baselineExternalImports: [],
    };
    const options = {
      root: fixtureRoot, configPath: join(fixtureRoot, 'performance.json'),
      checkToolchain: false,
    };
    try {
      await Promise.all(['dist', 'packages/data/dist', 'packages/data/src'].map(directory =>
        mkdir(join(fixtureRoot, directory), { recursive: true })));
      await Promise.all([
        writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({
          name: 'marionette', type: 'module', exports: { '.': './dist/index.mjs' },
        })),
        writeFile(join(fixtureRoot, 'packages/data/package.json'),
          await readFile(join(root, 'packages/data/package.json'))),
        writeFile(join(fixtureRoot, 'performance.json'), JSON.stringify(contract)),
        writeFile(join(fixtureRoot, 'index.js'), 'export const root = true;\n'),
        writeFile(join(fixtureRoot, 'dist/index.mjs'), 'export const root = true;\n'),
        writeFile(join(fixtureRoot, 'packages/data/src/index.js'),
          'export { Events } from \'marionette\';\n'),
        writeFile(join(fixtureRoot, 'packages/data/dist/index.js'),
          'export { Events } from \'marionette\';\n'),
        writeFile(join(fixtureRoot, 'packages/data/dist/index.cjs'),
          'exports.Events = require(\'marionette\').Events;\n'),
        writeFile(join(fixtureRoot, 'rollup.config.mjs'),
          'export default [{ input: \'index.js\', output: { file: \'dist/index.mjs\', format: \'es\' } }];\n'),
        writeFile(join(fixtureRoot, 'packages/data/rollup.config.mjs'),
          'export default { input: \'src/index.js\', external: [\'marionette\'], output: [' +
          '{ file: \'dist/index.js\', format: \'es\' }, { file: \'dist/index.cjs\', format: \'cjs\' }] };\n'),
      ]);
      const unenrolled = await measure(options);
      assert.match(unenrolled.violations.join('\n'), /Declared runtime artifacts missing from the contract: packages\/data/);
      assert.match(unenrolled.violations.join('\n'), /Production graph subpaths mismatch exports; missing: @marionette\/data/);
      assert.deepEqual(unenrolled.artifacts.map(({ path }) => path).sort(), [
        'dist/index.mjs', 'packages/data/dist/index.cjs', 'packages/data/dist/index.js',
      ]);
      assert.ok(unenrolled.graphs.some(graph => graph.subpath === '@marionette/data'));

      contract.runtimeArtifacts.push(...['js', 'cjs'].map(extension => ({
        name: `Data ${extension}`, path: `packages/data/dist/index.${extension}`,
        baselineBrotliBytes: 0,
      })));
      contract.productionGraphs.push({
        subpath: '@marionette/data', input: 'packages/data/src/index.js',
        output: 'packages/data/dist/index.js', baselineModules: [], baselineExternalImports: [],
      });
      await writeFile(options.configPath, JSON.stringify(contract));
      const enrolled = await measure(options);
      assert.equal(enrolled.violations.length, 1);
      assert.match(enrolled.violations[0], /^Unable to measure consumer bundles: ENOENT:/);
      assert.deepEqual(enrolled.artifacts.map(({ path }) => path), [
        'dist/index.mjs', 'packages/data/dist/index.js', 'packages/data/dist/index.cjs',
      ]);
      assert.ok(enrolled.artifacts.every(({ status }) => status === 'measured'));
      const graph = enrolled.graphs.find(({ subpath }) => subpath === '@marionette/data');
      assert.equal(graph.status, 'measured');
      assert.deepEqual(graph.modules, ['packages/data/src/index.js']);
      assert.deepEqual(graph.externalImports, ['marionette']);
      assert.equal(enrolled.cumulative.coreSize, unenrolled.cumulative.coreSize);
      assert.equal(enrolled.cumulative.coreBaselineSize, unenrolled.cumulative.coreBaselineSize);

      await writeFile(join(fixtureRoot, 'packages/data/dist/untracked.js'), 'export const extra = true;\n');
      const untracked = await measure(options);
      assert.ok(untracked.violations.includes(
        'Shipped runtime artifacts are untracked: packages/data/dist/untracked.js'));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('discovers and measures a separately published adapters package', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-adapters-measurement-'));
    const contract = contractFor([
      'dist/index.mjs',
      'packages/adapters/dist/feature.js',
    ]);
    contract.runtimeArtifacts[0].baselineBrotliBytes = 100;
    contract.runtimeArtifacts[1].baselineBrotliBytes = 0;
    contract.baseline.totalBrotliBytes = 100;
    contract.productionGraphs = [
      {
        subpath: '.',
        input: 'index.js',
        output: 'dist/index.mjs',
        baselineModules: ['index.js'],
        baselineExternalImports: [],
      },
      {
        subpath: '@marionette/adapters/feature',
        input: 'packages/adapters/src/feature.js',
        output: 'packages/adapters/dist/feature.js',
        baselineModules: ['packages/adapters/src/feature.js'],
        baselineExternalImports: [],
      },
    ];

    try {
      await Promise.all([
        mkdir(join(fixtureRoot, 'dist'), { recursive: true }),
        mkdir(join(fixtureRoot, 'packages/adapters/dist'), { recursive: true }),
        mkdir(join(fixtureRoot, 'packages/adapters/src'), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({
          name: 'marionette',
          type: 'module',
          exports: { '.': { import: './dist/index.mjs' } },
        })),
        writeFile(join(fixtureRoot, 'packages/adapters/package.json'), JSON.stringify({
          name: '@marionette/adapters',
          type: 'module',
          exports: { './feature': { import: './dist/feature.js' } },
        })),
        writeFile(join(fixtureRoot, 'performance.json'), JSON.stringify(contract)),
        writeFile(join(fixtureRoot, 'index.js'), 'export const root = true;\n'),
        writeFile(join(fixtureRoot, 'dist/index.mjs'), 'export const root = true;\n'),
        writeFile(
          join(fixtureRoot, 'packages/adapters/src/feature.js'),
          `export const feature = '${Array.from({ length: 256 }, (_, index) =>
            index.toString(36).padStart(2, '0')).join('-')}';\n`,
        ),
        writeFile(
          join(fixtureRoot, 'packages/adapters/dist/feature.js'),
          `export const feature = '${Array.from({ length: 256 }, (_, index) =>
            index.toString(36).padStart(2, '0')).join('-')}';\n`,
        ),
        writeFile(
          join(fixtureRoot, 'rollup.config.mjs'),
          'export default [{ input: \'index.js\', output: { file: \'dist/index.mjs\', format: \'es\' } }];\n',
        ),
        writeFile(
          join(fixtureRoot, 'packages/adapters/rollup.config.mjs'),
          'export default [{ input: \'src/feature.js\', output: { file: \'dist/feature.js\', format: \'es\' } }];\n',
        ),
      ]);

      const result = await measure({
        root: fixtureRoot,
        configPath: join(fixtureRoot, 'performance.json'),
        checkToolchain: false,
      });
      const repeated = await measure({
        root: fixtureRoot,
        configPath: join(fixtureRoot, 'performance.json'),
        checkToolchain: false,
      });
      const adapterGraph = result.graphs.find(({ subpath }) =>
        subpath === '@marionette/adapters/feature');
      const repeatedAdapterGraph = repeated.graphs.find(({ subpath }) =>
        subpath === '@marionette/adapters/feature');

      assert.equal(adapterGraph.status, 'measured');
      assert.equal(repeatedAdapterGraph.status, 'measured');
      assert.deepEqual(adapterGraph.modules, ['packages/adapters/src/feature.js']);
      assert.equal(
        result.artifacts.find(({ path }) =>
          path === 'packages/adapters/dist/feature.js').status,
        'measured',
      );
      assert.ok(result.cumulative.size > result.cumulative.coreSize);
      assert.equal(result.cumulative.coreBaselineSize, 100);
      assert.equal(result.violations.some(violation => violation.includes('size')), false);
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
      assert.deepEqual(result.graphs[0].forbiddenExternalImports, []);

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

  test('reports growth, new adapters, removals, and renames without approval', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-size-report-'));
    const basePath = join(fixtureRoot, 'base.json');
    const currentPath = join(fixtureRoot, 'current.json');
    const base = newSubpathReport();
    base.artifacts.push({ name: 'Old adapter', path: 'dist/old.js', size: 12 });
    const current = newSubpathReport(true);
    current.artifacts[0].size = 1000000;
    current.artifacts.push({ name: 'Moved adapter', path: 'packages/adapters/dist/dom/new.js', size: 12 });
    try {
      await writeFile(basePath, JSON.stringify(base));
      await writeFile(currentPath, JSON.stringify(current));
      const result = spawnSync(process.execPath, [
        join(root, 'scripts/performance/bundle-size.mjs'), '--report', basePath, currentPath,
      ], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /1000.00 kB/);
      assert.match(result.stdout, /New artifact/);
      assert.match(result.stdout, /Removed artifact/);
      assert.match(result.stdout, /New production subpath/);
      assert.doesNotMatch(result.stdout, /Approval.*Required|ceiling|Blocked pending/);

      current.violations.push('Configured runtime artifacts are missing: dist/main.js');
      await writeFile(currentPath, JSON.stringify(current));
      const invalid = spawnSync(process.execPath, [
        join(root, 'scripts/performance/bundle-size.mjs'), '--report', basePath, currentPath,
      ], { encoding: 'utf8' });
      assert.equal(invalid.status, 1, invalid.stderr);
      assert.match(invalid.stdout, /Configured runtime artifacts are missing/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('rejects forbidden modules from the measured production graph', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-forbidden-'));
    const contract = contractFor();
    contract.productionGraphs = [{
      subpath: '.',
      input: 'index.js',
      output: 'dist/index.mjs',
      baselineModules: ['index.js'],
      baselineExternalImports: [],
    }];
    contract.forbiddenProductionModules = ['forbidden.js'];
    const packageJson = {
      type: 'module',
      exports: { '.': { import: './dist/index.mjs' } },
    };

    try {
      await mkdir(join(fixtureRoot, 'dist'));
      await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(fixtureRoot, 'performance.json'), JSON.stringify(contract));
      await writeFile(
        join(fixtureRoot, 'index.js'),
        'import { forbidden } from \'./forbidden.js\';\nexport const value = forbidden;\n'
      );
      await writeFile(join(fixtureRoot, 'forbidden.js'), 'export const forbidden = true;\n');
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

      assert.deepEqual(result.graphs[0].forbiddenModules, ['forbidden.js']);
      assert.ok(result.violations.includes('. includes forbidden production modules: forbidden.js'));

      const enforced = spawnSync(
        process.execPath,
        [
          join(root, 'scripts/performance/bundle-size.mjs'),
          '--root', fixtureRoot,
          '--config', join(fixtureRoot, 'performance.json'),
          '--artifact-graph-only',
          '--json',
        ],
        { encoding: 'utf8' }
      );
      assert.equal(enforced.status, 1);
      assert.match(enforced.stderr, /includes forbidden production modules: forbidden\.js/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('rejects forbidden dynamic imports without matching prefixed packages', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-external-'));
    const contract = contractFor();
    contract.productionGraphs = [{
      subpath: '.',
      input: 'index.js',
      output: 'dist/index.mjs',
      baselineModules: ['index.js'],
      baselineExternalImports: [],
    }];
    contract.forbiddenExternalImports = ['underscore'];
    const packageJson = {
      type: 'module',
      exports: { '.': { import: './dist/index.mjs' } },
    };

    try {
      await mkdir(join(fixtureRoot, 'dist'));
      await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify(packageJson));
      await writeFile(join(fixtureRoot, 'performance.json'), JSON.stringify(contract));
      await writeFile(
        join(fixtureRoot, 'index.js'),
        'export const forbidden = import(\'underscore/modules/each.js\');\n' +
          'export const allowed = import(\'underscore-plus\');\n'
      );
      await writeFile(join(fixtureRoot, 'dist/index.mjs'), 'export const value = 1;\n');
      await writeFile(
        join(fixtureRoot, 'rollup.config.mjs'),
        'export default [{ input: \'index.js\', external: [\'underscore/modules/each.js\', \'underscore-plus\'], output: { file: \'dist/index.mjs\', format: \'es\' } }];\n'
      );

      const result = await measure({
        root: fixtureRoot,
        configPath: join(fixtureRoot, 'performance.json'),
        checkToolchain: false,
      });

      assert.deepEqual(result.graphs[0].externalImports, []);
      assert.deepEqual(result.graphs[0].phase0AddedExternalImports, []);
      assert.deepEqual(result.graphs[0].forbiddenExternalImports, ['underscore/modules/each.js']);
      assert.ok(result.violations.includes(
        '. includes forbidden external imports: underscore/modules/each.js'
      ));

      const enforced = spawnSync(
        process.execPath,
        [
          join(root, 'scripts/performance/bundle-size.mjs'),
          '--root', fixtureRoot,
          '--config', join(fixtureRoot, 'performance.json'),
          '--artifact-graph-only',
          '--json',
        ],
        { encoding: 'utf8' }
      );
      assert.equal(enforced.status, 1);
      assert.match(
        enforced.stderr,
        /includes forbidden external imports: underscore\/modules\/each\.js/
      );
      assert.deepEqual(
        JSON.parse(enforced.stdout).graphs[0].forbiddenExternalImports,
        ['underscore/modules/each.js']
      );
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

  test('rejects production graph outputs not exported by their subpath', () => {
    const contract = contractFor(['dist/index.mjs', 'dist/feature.mjs']);
    contract.productionGraphs = [
      {
        subpath: '.',
        input: 'index.js',
        output: 'dist/index.mjs',
        baselineModules: [],
        baselineExternalImports: [],
      },
      {
        subpath: './feature',
        input: 'index.js',
        output: 'dist/index.mjs',
        baselineModules: [],
        baselineExternalImports: [],
      },
    ];
    const packageJson = {
      exports: {
        '.': { import: './dist/index.mjs' },
        './feature': { import: './dist/feature.mjs' },
      },
    };

    const violations = validateContract(contract, packageJson, ['feature.mjs', 'index.mjs']);

    assert.ok(violations.includes(
      'Production graph ./feature output dist/index.mjs is not exported by that subpath'
    ));
  });

  for (const outputAlias of [
    'dist/nested/../index.mjs',
    'absolute',
  ]) {
    test(`rejects an ambiguous ${outputAlias === 'absolute' ? 'absolute' : 'relative'} Rollup output alias`, async() => {
      const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-output-'));
      const contract = contractFor();
      contract.productionGraphs = [{
        subpath: '.',
        input: 'index.js',
        output: 'dist/index.mjs',
        baselineModules: [],
        baselineExternalImports: [],
      }];
      const packageJson = {
        type: 'module',
        exports: { '.': { import: './dist/index.mjs' } },
      };
      const duplicateOutput = outputAlias === 'absolute' ?
        join(fixtureRoot, 'dist/index.mjs') : outputAlias;

      try {
        await mkdir(join(fixtureRoot, 'dist'));
        await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify(packageJson));
        await writeFile(join(fixtureRoot, 'performance.json'), JSON.stringify(contract));
        await writeFile(join(fixtureRoot, 'index.js'), 'export const value = 1;\n');
        await writeFile(join(fixtureRoot, 'other.js'), 'export const other = 1;\n');
        await writeFile(join(fixtureRoot, 'dist/index.mjs'), 'export const value = 1;\n');
        await writeFile(
          join(fixtureRoot, 'rollup.config.mjs'),
          'export default [' +
            '{ input: \'index.js\', output: { file: \'dist/index.mjs\', format: \'es\' } },' +
            `{ input: 'other.js', output: { file: ${JSON.stringify(duplicateOutput)}, format: 'es' } }` +
          '];\n'
        );

        const result = await measure({
          root: fixtureRoot,
          configPath: join(fixtureRoot, 'performance.json'),
          checkToolchain: false,
        });

        assert.equal(result.graphs[0].status, 'measurement-error');
        assert.match(result.graphs[0].error, /Multiple Rollup configurations write dist\/index\.mjs/);
      } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
      }
    });
  }

  test('measures a moved graph input through the unchanged output producer', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-source-move-'));
    const contract = contractFor();
    contract.productionGraphs = [{
      subpath: '.',
      input: 'index.js',
      output: 'dist/index.mjs',
      baselineModules: ['index.js'],
      baselineExternalImports: [],
    }];
    const configPath = join(fixtureRoot, 'performance.json');
    const rollupPath = join(fixtureRoot, 'rollup.config.mjs');
    const rollupConfig = input => `export default [{ input: '${input}', ` +
      'output: { file: \'dist/index.mjs\', format: \'es\' } }];\n';
    const measureFixture = () => {
      const moduleUrl = new URL('../../scripts/performance/bundle-size.mjs', import.meta.url);
      const options = { root: fixtureRoot, configPath, checkToolchain: false };
      const result = spawnSync(process.execPath, ['--input-type=module', '-e',
        `import { measure } from ${JSON.stringify(moduleUrl.href)}; ` +
        `console.log(JSON.stringify(await measure(${JSON.stringify(options)})));`,
      ], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };


    try {
      await mkdir(join(fixtureRoot, 'dist'));
      await mkdir(join(fixtureRoot, 'src'));
      await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({
        type: 'module', exports: { '.': { import: './dist/index.mjs' } },
      }));
      await writeFile(configPath, JSON.stringify(contract));
      await writeFile(join(fixtureRoot, 'index.js'), 'export const value = 1;\n');
      await writeFile(join(fixtureRoot, 'dist/index.mjs'), 'export const value = 1;\n');
      await writeFile(rollupPath, rollupConfig('index.js'));
      const before = measureFixture();
      assert.deepEqual(before.graphs[0].modules, ['index.js']);

      await rename(join(fixtureRoot, 'index.js'), join(fixtureRoot, 'src/index.js'));
      contract.productionGraphs[0].input = 'src/index.js';
      await writeFile(configPath, JSON.stringify(contract));
      const mismatched = measureFixture();
      assert.equal(mismatched.graphs[0].status, 'measurement-error');
      assert.match(mismatched.graphs[0].error, /does not use input src\/index\.js/);

      await writeFile(rollupPath, rollupConfig('src/index.js'));
      const after = measureFixture();
      assert.equal(after.graphs[0].status, 'measured');
      assert.deepEqual(after.graphs[0].modules, ['src/index.js']);
      assert.deepEqual(after.graphs[0].phase0AddedModules, ['src/index.js']);
      assert.deepEqual(after.graphs[0].phase0RemovedModules, ['index.js']);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('accepts an equivalent Rollup input alias', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-input-'));
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
        'export default [{ input: \'./index.js\', output: { file: \'dist/index.mjs\', format: \'es\' } }];\n'
      );

      const result = await measure({
        root: fixtureRoot,
        configPath: join(fixtureRoot, 'performance.json'),
        checkToolchain: false,
      });

      assert.equal(result.graphs[0].status, 'measured');
      assert.deepEqual(result.graphs[0].modules, ['index.js']);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  for (const input of [
    '[\'index.js\']',
    '{ main: \'index.js\' }',
  ]) {
    test(`rejects an ${input.startsWith('[') ? 'array' : 'object'} Rollup input for a single graph output`, async() => {
      const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-input-'));
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
          `export default [{ input: ${input}, output: { file: 'dist/index.mjs', format: 'es' } }];\n`
        );

        const result = await measure({
          root: fixtureRoot,
          configPath: join(fixtureRoot, 'performance.json'),
          checkToolchain: false,
        });

        assert.equal(result.graphs[0].status, 'measurement-error');
        assert.match(result.graphs[0].error, /must use one string input index\.js/);
      } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
      }
    });
  }

  test('rejects a unique Rollup producer with the wrong input', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-input-'));
    const contract = contractFor();
    contract.productionGraphs = [{
      subpath: '.',
      input: 'index.js',
      output: 'dist/index.mjs',
      baselineModules: [],
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
      await writeFile(join(fixtureRoot, 'other.js'), 'export const other = 1;\n');
      await writeFile(join(fixtureRoot, 'dist/index.mjs'), 'export const value = 1;\n');
      await writeFile(
        join(fixtureRoot, 'rollup.config.mjs'),
        'export default [{ input: \'other.js\', output: { file: \'dist/index.mjs\', format: \'es\' } }];\n'
      );

      const result = await measure({
        root: fixtureRoot,
        configPath: join(fixtureRoot, 'performance.json'),
        checkToolchain: false,
      });

      assert.equal(result.graphs[0].status, 'measurement-error');
      assert.match(result.graphs[0].error, /Rollup output dist\/index\.mjs does not use input index\.js/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
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

    const mismatchedProfile = structuredClone(contract);
    mismatchedProfile.toolchain.releaseProfile.sha256 = '0'.repeat(64);
    assert.match(
      (await validateToolchain(mismatchedProfile, root)).join('\n'),
      /Release profile SHA-256 [a-f\d]{64} does not match 0{64}/
    );

    assert.ok(contract.forbiddenProductionModulePrefixes.includes('scripts/'));
    const scriptModules = await listRuntimeFiles(join(root, 'scripts'), root);
    assert.ok(scriptModules.length > 0);
    assert.deepEqual(findForbiddenModules(scriptModules, contract), scriptModules);
  });
});

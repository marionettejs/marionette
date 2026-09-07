import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  compareConsumerBundleReports,
  measureConsumerBundles,
  validateConsumerBundleContract,
} from '../../scripts/performance/bundle-size.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtureUrl = new URL('../../benchmarks/consumer-bundles/v1/manifest.json', import.meta.url);
const contractUrl = new URL('../../benchmarks/consumer-bundles/contract.json', import.meta.url);
const performanceUrl = new URL('../../config/performance.json', import.meta.url);
const packageUrl = new URL('../../package.json', import.meta.url);
const adaptersPackageUrl = new URL('../../packages/adapters/package.json', import.meta.url);

async function canonicalInputs() {
  const [contract, performance, fixtureText, packageJson, adaptersPackageJson] = await Promise.all([
    readFile(contractUrl, 'utf8').then(JSON.parse),
    readFile(performanceUrl, 'utf8').then(JSON.parse),
    readFile(fixtureUrl, 'utf8'),
    readFile(packageUrl, 'utf8').then(JSON.parse),
    readFile(adaptersPackageUrl, 'utf8').then(JSON.parse),
  ]);
  return {
    brotliQuality: performance.baseline.brotliQuality,
    contract,
    fixture: JSON.parse(fixtureText),
    fixtureRevision: createHash('sha256').update(fixtureText).digest('hex'),
    packageJson,
    packageJsons: [packageJson, adaptersPackageJson],
  };
}

function consumerReport({ contract, fixture }, sizeOffset = 0) {
  return {
    schemaVersion: 1,
    status: 'reporting',
    fixtureVersion: fixture.fixtureVersion,
    fixtureRevision: contract.fixture.sha256,
    compression: fixture.compression,
    toolchain: contract.toolchain,
    peerExternalImports: contract.peerExternalImports,
    artifacts: fixture.expectedArtifacts.map((id, index) => {
      const [scenario, format] = id.split(':');
      return {
        id,
        scenario,
        format,
        status: 'measured',
        size: 100 + index + sizeOffset,
      };
    }),
    violations: [],
  };
}

function measurementOptions({ brotliQuality, contract }) {
  return { brotliQuality, contract };
}

describe('consumer bundle measurements', () => {
  test('measures the complete versioned ESM, CommonJS, and UMD inventory', async() => {
    const result = await measureConsumerBundles({
      root,
      ...measurementOptions(await canonicalInputs()),
    });

    assert.equal(result.status, 'reporting');
    assert.equal(result.fixtureVersion, 'v1');
    assert.deepEqual(result.compression, { algorithm: 'brotli', quality: 11 });
    assert.equal(result.artifacts.length, 18);
    assert.deepEqual(
      [...new Set(result.artifacts.map(({ format }) => format))],
      ['esm', 'cjs', 'umd']
    );
    assert.ok(result.artifacts.every(({ size }) => Number.isSafeInteger(size) && size > 0));
    assert.deepEqual(result.violations, []);
  });

  test('fails closed when scenario or format inventory is incomplete', async() => {
    const { brotliQuality, contract, fixture, fixtureRevision, packageJson, packageJsons } = await canonicalInputs();
    fixture.scenarios.pop();
    fixture.formats.pop();

    assert.match(
      validateConsumerBundleContract(
        contract,
        fixture,
        packageJson,
        brotliQuality,
        fixtureRevision,
        packageJsons,
      ).join('\n'),
      /scenario inventory.*root-plus-backbone-jquery.*format inventory.*umd/s
    );
  });

  test('fails closed on fixture metadata or pinned toolchain drift', async() => {
    const { brotliQuality, contract, fixture, fixtureRevision, packageJson, packageJsons } = await canonicalInputs();
    const changed = structuredClone(contract);
    changed.fixture.sha256 = '0'.repeat(64);
    changed.toolchain.terser = '0.0.0';

    assert.match(
      validateConsumerBundleContract(
        changed,
        fixture,
        packageJson,
        brotliQuality,
        fixtureRevision,
        packageJsons,
      ).join('\n'),
      /Locked terser version/
    );

    const measured = await measureConsumerBundles({
      root,
      contract: changed,
      brotliQuality,
    });
    assert.match(measured.violations.join('\n'), /fixture SHA-256.*does not match/);
    assert.match(measured.violations.join('\n'), /Locked terser version/);
  });

  test('tracks runtime peers and keeps the root scenario isolated', async() => {
    const result = await measureConsumerBundles({
      root,
      ...measurementOptions(await canonicalInputs()),
    });
    const rootArtifacts = result.artifacts.filter(({ scenario }) => scenario === 'root-only');
    const backboneArtifacts = result.artifacts.filter(({ scenario }) => scenario === 'backbone-only');
    const jqueryArtifacts = result.artifacts.filter(({ scenario }) => scenario === 'jquery-dom-api-only');
    const combinedArtifacts = result.artifacts.filter(
      ({ scenario }) => scenario === 'root-plus-backbone-jquery'
    );

    assert.equal(rootArtifacts.length, 3);
    assert.equal(backboneArtifacts.length, 3);
    assert.equal(jqueryArtifacts.length, 3);
    assert.equal(combinedArtifacts.length, 3);
    assert.ok(rootArtifacts.every(({ externalImports }) => externalImports.length === 0));
    assert.ok(rootArtifacts.every(({ modules }) =>
      modules.includes('dist/marionette.js') &&
      !modules.includes('packages/adapters/dist/backbone.js') &&
      !modules.includes('packages/adapters/dist/dom/jquery.js')));
    for (const { externalImports } of backboneArtifacts) {
      assert.deepEqual(externalImports, []);
    }
    for (const { externalImports } of jqueryArtifacts) {
      assert.deepEqual(externalImports, ['jquery']);
    }
    for (const { externalImports, modules } of combinedArtifacts) {
      assert.deepEqual(externalImports, ['jquery']);
      assert.ok(modules.includes('packages/adapters/dist/backbone.js'));
      assert.ok(modules.includes('packages/adapters/dist/dom/jquery.js'));
      assert.ok(modules.includes('dist/marionette.js'));
    }
  });

  test('keeps canonical peers declared and rejects required peers outside v1', async() => {
    const { brotliQuality, contract, fixture, fixtureRevision, packageJson, packageJsons } = await canonicalInputs();
    const adapters = packageJsons[1];
    delete adapters.peerDependencies.backbone;
    assert.match(validateConsumerBundleContract(
      contract, fixture, packageJson, brotliQuality, fixtureRevision, packageJsons,
    ).join('\n'), /not declared runtime peers: backbone/);

    adapters.peerDependencies.backbone = '^1.4.0';
    adapters.peerDependencies.morphdom = '^2.7.8';
    delete adapters.peerDependenciesMeta.morphdom;
    assert.match(validateConsumerBundleContract(
      contract, fixture, packageJson, brotliQuality, fixtureRevision, packageJsons,
    ).join('\n'), /outside consumer bundle v1 must be optional: morphdom/);

    adapters.peerDependenciesMeta.morphdom = { optional: true };
    packageJson.peerDependencies = { ...packageJson.peerDependencies, morphdom: '^2.7.8' };
    assert.match(validateConsumerBundleContract(
      contract, fixture, packageJson, brotliQuality, fixtureRevision, packageJsons,
    ).join('\n'), /outside consumer bundle v1 must be optional: morphdom/);
  });

  test('rejects expanding frozen peer authority even for a declared optional peer', async() => {
    const { brotliQuality, contract, fixture, fixtureRevision, packageJson, packageJsons } = await canonicalInputs();
    packageJsons[1].peerDependencies.morphdom = '^2.7.8';
    packageJsons[1].peerDependenciesMeta.morphdom = { optional: true };
    contract.peerExternalImports.push('morphdom');

    assert.match(validateConsumerBundleContract(
      contract, fixture, packageJson, brotliQuality, fixtureRevision, packageJsons,
    ).join('\n'), /peer externals must be backbone, jquery/);
  });

  test('allows unrelated optional peers only while frozen scenarios do not import them', async() => {
    const inputs = await canonicalInputs();
    inputs.packageJsons[1].peerDependencies.morphdom = '^2.7.8';
    inputs.packageJsons[1].peerDependenciesMeta.morphdom = { optional: true };
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-consumer-peer-'));
    try {
      await Promise.all([
        mkdir(join(fixtureRoot, 'benchmarks/consumer-bundles'), { recursive: true }),
        mkdir(join(fixtureRoot, 'packages/adapters'), { recursive: true }),
        cp(join(root, 'dist'), join(fixtureRoot, 'dist'), { recursive: true }),
        writeFile(join(fixtureRoot, 'package.json'), JSON.stringify(inputs.packageJson)),
      ]);
      await Promise.all([
        cp(join(root, 'packages/adapters/dist'), join(fixtureRoot, 'packages/adapters/dist'), { recursive: true }),
        cp(join(root, 'benchmarks/consumer-bundles/v1'), join(fixtureRoot, 'benchmarks/consumer-bundles/v1'), { recursive: true }),
        writeFile(join(fixtureRoot, 'packages/adapters/package.json'), JSON.stringify(inputs.packageJsons[1])),
      ]);

      const options = { root: fixtureRoot, ...measurementOptions(inputs) };
      const unusedPeer = await measureConsumerBundles(options);
      assert.equal(unusedPeer.artifacts.length, 18);
      assert.deepEqual(unusedPeer.peerExternalImports, ['backbone', 'jquery']);
      assert.deepEqual(unusedPeer.violations, []);

      const jqueryPath = join(fixtureRoot, 'packages/adapters/dist/dom/jquery.js');
      await writeFile(jqueryPath, `import 'morphdom';\n${await readFile(jqueryPath, 'utf8')}`);
      const importedPeer = await measureConsumerBundles(options);
      assert.ok(importedPeer.artifacts.some(({ externalImports }) => externalImports.includes('morphdom')));
      assert.match(importedPeer.violations.join('\n'), /external imports differ from fixture metadata/);
      assert.match(importedPeer.violations.join('\n'), /non-peer external imports: morphdom/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('reports deterministic exact-base deltas without enforcing a ceiling', async() => {
    const inputs = await canonicalInputs();
    const base = consumerReport(inputs);
    const current = consumerReport(inputs, 4);
    const comparison = compareConsumerBundleReports(base, current);

    assert.equal(comparison.bootstrap, false);
    assert.equal(comparison.rows.length, 18);
    assert.deepEqual(comparison.rows[0], {
      id: 'root-only:esm',
      scenario: 'root-only',
      format: 'esm',
      baseSize: 100,
      currentSize: 104,
      deltaBytes: 4,
    });
    assert.deepEqual(comparison.violations, []);
  });

  test('rejects malformed reporting authority metadata', async() => {
    const inputs = await canonicalInputs();
    const { brotliQuality, contract, fixture, fixtureRevision, packageJson, packageJsons } = inputs;
    const malformed = [
      { ...contract, unknownAuthority: true },
      { ...contract, schemaVersion: 2 },
      {
        ...contract,
        fixture: { ...contract.fixture, sha256: contract.fixture.sha256.toUpperCase() },
      },
      {
        ...contract,
        fixture: { ...contract.fixture, unknownFixtureAuthority: true },
      },
      {
        ...contract,
        toolchain: { ...contract.toolchain, unknownTool: '1.0.0' },
      },
    ];
    for (const candidate of malformed) {
      assert.ok(validateConsumerBundleContract(
        candidate,
        fixture,
        packageJson,
        brotliQuality,
        fixtureRevision,
        packageJsons,
      ).length > 0);
    }

    const bootstrap = compareConsumerBundleReports(null, consumerReport(inputs));
    assert.equal(bootstrap.bootstrap, true);
    assert.deepEqual(bootstrap.violations, []);
  });

  test('rejects truncated, duplicate, and noncanonical current reports', async() => {
    const inputs = await canonicalInputs();
    const complete = consumerReport(inputs);
    const truncated = structuredClone(complete);
    truncated.artifacts.pop();
    const duplicate = structuredClone(complete);
    duplicate.artifacts[14] = structuredClone(duplicate.artifacts[0]);
    const metadataDrifts = [
      report => { report.compression.quality = 10; },
      report => { report.toolchain.terser = '0.0.0'; },
      report => { report.peerExternalImports.pop(); },
    ];

    assert.match(
      compareConsumerBundleReports(null, truncated).violations.join('\n'),
      /artifact inventory/
    );
    assert.match(
      compareConsumerBundleReports(null, duplicate).violations.join('\n'),
      /artifact inventory/
    );
    for (const mutate of metadataDrifts) {
      const metadataDrift = structuredClone(complete);
      mutate(metadataDrift);
      assert.match(
        compareConsumerBundleReports(complete, metadataDrift).violations.join('\n'),
        /metadata is not canonical/
      );
    }
    assert.match(
      compareConsumerBundleReports(complete, null).violations.join('\n'),
      /measurement is missing/
    );
  });

  test('reports changed fixtures and older base tooling as non-comparable', async() => {
    const inputs = await canonicalInputs();
    const current = consumerReport(inputs);
    for (const change of [
      base => { base.toolchain.terser = '0.0.0'; },
      base => { base.fixtureRevision = '0'.repeat(64); },
    ]) {
      const base = structuredClone(current);
      change(base);
      const result = compareConsumerBundleReports(base, current);
      assert.deepEqual(result.violations, []);
      assert.match(result.reason, /not comparable/);
      assert.equal(result.rows.length, 18);
      assert.ok(result.rows.every(row => row.baseSize === null && row.deltaBytes === null));
    }
  });

  test('rejects an incomplete base inventory even when its toolchain changed', async() => {
    const inputs = await canonicalInputs();
    const current = consumerReport(inputs);
    const base = structuredClone(current);
    base.toolchain.terser = '0.0.0';
    base.artifacts.pop();
    const result = compareConsumerBundleReports(base, current);
    assert.match(result.violations.join('\n'), /Exact base consumer bundle artifact inventory/);
  });

  test('fails closed when a versioned entry source digest drifts', async() => {
    const inputs = await canonicalInputs();
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-consumer-entry-'));
    try {
      await Promise.all([
        mkdir(join(fixtureRoot, 'benchmarks/consumer-bundles'), { recursive: true }),
        cp(join(root, 'dist'), join(fixtureRoot, 'dist'), { recursive: true }),
        writeFile(join(fixtureRoot, 'package.json'), JSON.stringify(inputs.packageJson)),
      ]);
      await mkdir(join(fixtureRoot, 'packages/adapters'), { recursive: true });
      await Promise.all([
        cp(
          join(root, 'packages/adapters/dist'),
          join(fixtureRoot, 'packages/adapters/dist'),
          { recursive: true },
        ),
        writeFile(
          join(fixtureRoot, 'packages/adapters/package.json'),
          JSON.stringify(inputs.packageJsons[1]),
        ),
      ]);
      await cp(
        join(root, 'benchmarks/consumer-bundles/v1'),
        join(fixtureRoot, 'benchmarks/consumer-bundles/v1'),
        { recursive: true }
      );
      await writeFile(
        join(fixtureRoot, 'benchmarks/consumer-bundles/v1/root-only.js'),
        'export const drifted = true;\n'
      );

      const result = await measureConsumerBundles({
        root: fixtureRoot,
        contract: inputs.contract,
        brotliQuality: inputs.brotliQuality,
      });
      assert.match(result.violations.join('\n'), /root-only entry SHA-256 .* does not match/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});

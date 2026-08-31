import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  compareConsumerBundleReports,
  measureConsumerBundles,
  validateCandidateConsumerBundleContract,
  validateConsumerBundleContract,
} from '../../scripts/performance/bundle-size.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const fixtureUrl = new URL('../../benchmarks/consumer-bundles/v1/manifest.json', import.meta.url);
const contractUrl = new URL('../../config/performance.json', import.meta.url);
const packageUrl = new URL('../../package.json', import.meta.url);

async function canonicalInputs() {
  const [performance, fixture, packageJson] = await Promise.all([
    readFile(contractUrl, 'utf8').then(JSON.parse),
    readFile(fixtureUrl, 'utf8').then(JSON.parse),
    readFile(packageUrl, 'utf8').then(JSON.parse),
  ]);
  return {
    brotliQuality: performance.baseline.brotliQuality,
    contract: performance.consumerBundles,
    fixture,
    packageJson,
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
    assert.equal(result.artifacts.length, 15);
    assert.deepEqual(
      [...new Set(result.artifacts.map(({ format }) => format))],
      ['esm', 'cjs', 'umd']
    );
    assert.ok(result.artifacts.every(({ size }) => Number.isSafeInteger(size) && size > 0));
    assert.deepEqual(result.violations, []);
  });

  test('fails closed when scenario or format inventory is incomplete', async() => {
    const { brotliQuality, contract, fixture, packageJson } = await canonicalInputs();
    fixture.scenarios.pop();
    fixture.formats.pop();

    assert.match(
      validateConsumerBundleContract(contract, fixture, packageJson, brotliQuality).join('\n'),
      /scenario inventory.*root-plus-jquery.*format inventory.*umd/s
    );
  });

  test('fails closed on fixture metadata or pinned toolchain drift', async() => {
    const { brotliQuality, contract, fixture, packageJson } = await canonicalInputs();
    const changed = structuredClone(contract);
    changed.fixture.sha256 = '0'.repeat(64);
    changed.toolchain.terser = '0.0.0';

    assert.match(
      validateConsumerBundleContract(changed, fixture, packageJson, brotliQuality).join('\n'),
      /fixture SHA-256.*does not match.*Locked terser version/s
    );
  });

  test('externalizes runtime peers and keeps the root scenario isolated', async() => {
    const result = await measureConsumerBundles({
      root,
      ...measurementOptions(await canonicalInputs()),
    });
    const rootArtifacts = result.artifacts.filter(({ scenario }) => scenario === 'root-only');
    const backboneArtifacts = result.artifacts.filter(({ scenario }) => scenario === 'backbone-only');
    const jqueryArtifacts = result.artifacts.filter(({ scenario }) => scenario === 'jquery-dom-api-only');

    assert.ok(rootArtifacts.every(({ externalImports }) => externalImports.length === 0));
    assert.ok(rootArtifacts.every(({ modules }) =>
      modules.includes('dist/marionette.js') &&
      !modules.includes('dist/backbone.js') &&
      !modules.includes('dist/jquery-dom-api.js')));
    assert.ok(backboneArtifacts.every(({ externalImports }) =>
      assert.deepEqual(externalImports, ['backbone']) === undefined));
    assert.ok(jqueryArtifacts.every(({ externalImports }) =>
      assert.deepEqual(externalImports, ['jquery']) === undefined));
  });

  test('reports deterministic exact-base deltas without enforcing a ceiling', async() => {
    const inputs = await canonicalInputs();
    const base = consumerReport(inputs);
    const current = consumerReport(inputs, 4);
    const comparison = compareConsumerBundleReports(base, current);

    assert.equal(comparison.bootstrap, false);
    assert.equal(comparison.rows.length, 15);
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

  test('permits only the reporting bootstrap transition and then fails closed', async() => {
    const inputs = await canonicalInputs();
    const { contract } = inputs;

    assert.deepEqual(validateCandidateConsumerBundleContract({}, { consumerBundles: contract }), []);
    assert.match(
      validateCandidateConsumerBundleContract(
        {},
        { consumerBundles: { status: 'reporting' } }
      ).join('\n'),
      /bootstrap contract is malformed/
    );
    assert.match(
      validateCandidateConsumerBundleContract(
        {},
        { consumerBundles: { ...contract, unknownAuthority: true } }
      ).join('\n'),
      /bootstrap contract is malformed/
    );
    assert.match(
      validateCandidateConsumerBundleContract(
        {},
        { consumerBundles: { ...contract, schemaVersion: 2 } }
      ).join('\n'),
      /bootstrap contract is malformed/
    );
    assert.match(
      validateCandidateConsumerBundleContract(
        {},
        {
          consumerBundles: {
            ...contract,
            fixture: {
              ...contract.fixture,
              sha256: contract.fixture.sha256.toUpperCase(),
            },
          },
        }
      ).join('\n'),
      /bootstrap contract is malformed/
    );
    assert.match(
      validateCandidateConsumerBundleContract(
        {},
        {
          consumerBundles: {
            ...contract,
            fixture: { ...contract.fixture, unknownFixtureAuthority: true },
          },
        }
      ).join('\n'),
      /bootstrap contract is malformed/
    );
    assert.match(
      validateCandidateConsumerBundleContract(
        { consumerBundles: contract },
        {}
      ).join('\n'),
      /Candidate performance contract is missing consumerBundles/
    );

    const changed = structuredClone(contract);
    changed.status = 'enforcing';
    assert.match(
      validateCandidateConsumerBundleContract(
        { consumerBundles: contract },
        { consumerBundles: changed }
      ).join('\n'),
      /consumerBundles differs from exact-base reporting contract/
    );

    const bootstrap = compareConsumerBundleReports(null, consumerReport(inputs));
    assert.equal(bootstrap.bootstrap, true);
    assert.deepEqual(bootstrap.violations, []);
  });

  test('rejects truncated, duplicate, and metadata-drifted reports', async() => {
    const inputs = await canonicalInputs();
    const complete = consumerReport(inputs);
    const truncated = structuredClone(complete);
    truncated.artifacts.pop();
    const duplicate = structuredClone(complete);
    duplicate.artifacts[14] = structuredClone(duplicate.artifacts[0]);
    const metadataDrift = structuredClone(complete);
    metadataDrift.compression.quality = 10;

    assert.match(
      compareConsumerBundleReports(null, truncated).violations.join('\n'),
      /artifact inventory/
    );
    assert.match(
      compareConsumerBundleReports(null, duplicate).violations.join('\n'),
      /artifact inventory/
    );
    assert.match(
      compareConsumerBundleReports(complete, metadataDrift).violations.join('\n'),
      /metadata differs from the exact base/
    );
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

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  compareResources,
  measureResources,
  resourceReportRows,
  validateCandidateResourceContract,
} from '../../scripts/performance/resources.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

function report() {
  return {
    schemaVersion: 1,
    workload: {
      attachDetachCycles: 100,
      mountDestroyCycles: 1000,
    },
    allocations: {
      View: {
        ownProperties: ['cid'],
        ownReferences: ['_behaviors'],
        uniqueOwnReferences: 1,
        arrays: ['_behaviors'],
        arrayEntries: 0,
        plainObjects: [],
        plainObjectEntries: 0,
        childViewContainers: [],
        childViewContainerEntries: 0,
        regions: [],
        regionsWithViews: 0,
        marionetteEventRegistrations: 6,
        listeningContainers: 0,
      },
    },
    retention: {
      externalRegistrationsAfterDestroy: 0,
      destroyedHostRetainsBehaviorCount: 1,
    },
  };
}

function bundleReport(resources, resourcesRequired = resources != null) {
  return {
    brotliQuality: 11,
    thresholds: { pullRequestApprovalPercent: 1 },
    artifacts: [],
    cumulative: {
      size: 0,
      baselineSize: 0,
      absoluteCeiling: 0,
    },
    graphs: [],
    resourcesRequired,
    resources,
    violations: [],
  };
}

describe('deterministic resource comparison', () => {
  test('rejects added eager storage and increased retention despite head claims', () => {
    const base = report();
    const current = structuredClone(base);
    current.claimedBaseline = {
      allocations: current.allocations,
      retention: current.retention,
    };
    current.allocations.View.arrays.push('_domEvents');
    current.allocations.View.uniqueOwnReferences = 2;
    current.retention.destroyedHostRetainsBehaviorCount = 2;

    const comparison = compareResources(base, current);

    assert.deepEqual(comparison.violations, [
      'resources.allocations.View.arrays added _domEvents',
      'resources.allocations.View.uniqueOwnReferences increased from 1 to 2',
      'resources.retention.destroyedHostRetainsBehaviorCount increased from 1 to 2',
    ]);
    assert.match(resourceReportRows(comparison).join('\n'), /Regression/);
  });

  test('allows and reports removed allocations and lower retention', () => {
    const base = report();
    const current = structuredClone(base);
    current.allocations.View.arrays = [];
    current.allocations.View.ownReferences = [];
    current.allocations.View.uniqueOwnReferences = 0;
    current.allocations.View.marionetteEventRegistrations = 5;
    current.retention.destroyedHostRetainsBehaviorCount = 0;

    const comparison = compareResources(base, current);

    assert.deepEqual(comparison.violations, []);
    assert.equal(comparison.changes.length, 5);
    assert.ok(comparison.changes.every(change => change.status === 'improvement'));
    assert.match(resourceReportRows(comparison).join('\n'), /Improvement/);
  });

  test('fails closed for missing, unknown, or incompatible measurements', () => {
    const base = report();
    const current = structuredClone(base);
    delete current.allocations.View.plainObjects;
    current.allocations.View.unknownLedger = 0;
    current.workload.mountDestroyCycles = 2000;

    const comparison = compareResources(base, current);

    assert.ok(comparison.violations.includes('Resource measurement workload does not match the exact base'));
    assert.ok(comparison.violations.includes('resources.allocations.View is missing metrics: plainObjects'));
    assert.ok(comparison.violations.includes('resources.allocations.View has unknown metrics: unknownLedger'));
  });

  test('rejects missing measurement schema and workloads on both sides', () => {
    const base = report();
    const current = report();
    delete base.schemaVersion;
    delete current.schemaVersion;
    delete base.workload;
    delete current.workload;

    const comparison = compareResources(base, current);

    assert.ok(comparison.violations.includes('Exact-base resource schemaVersion must be 1; received undefined'));
    assert.ok(comparison.violations.includes('Pull request resource schemaVersion must be 1; received undefined'));
    assert.ok(comparison.violations.includes('Exact-base resource workload is missing'));
    assert.ok(comparison.violations.includes('Pull request resource workload is missing'));
    assert.deepEqual(resourceReportRows(comparison), [
      '| Contract validation | Not comparable | Not comparable | Review required |',
    ]);

    const incompatible = report();
    incompatible.schemaVersion = 2;
    assert.ok(
      compareResources(report(), incompatible).violations.includes(
        'Pull request resource schemaVersion must be 1; received 2'
      )
    );
  });

  test('rejects candidate contracts that reduce or remove authority workloads', () => {
    const authority = {
      deterministicResources: report().workload,
    };
    const reduced = structuredClone(authority);
    reduced.deterministicResources.mountDestroyCycles = 1;

    assert.deepEqual(validateCandidateResourceContract(authority, reduced), [
      'Candidate mountDestroyCycles 1 is below the exact-base authority 1000',
    ]);
    assert.deepEqual(validateCandidateResourceContract(authority, {}), [
      'Candidate performance contract is missing deterministicResources',
    ]);
    assert.deepEqual(validateCandidateResourceContract({}, authority), [
      'Exact-base performance contract is missing deterministicResources',
    ]);
    const malformedAuthority = structuredClone(authority);
    delete malformedAuthority.deterministicResources.mountDestroyCycles;
    assert.deepEqual(validateCandidateResourceContract(malformedAuthority, authority), [
      'Exact-base authority mountDestroyCycles must be a positive integer; received undefined',
    ]);
  });

  test('enforces the resource contract and report CLI exit paths', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-resource-cli-'));
    const authorityContract = join(fixtureRoot, 'authority-contract.json');
    const missingAuthorityContract = join(fixtureRoot, 'missing-authority-contract.json');
    const candidateContract = join(fixtureRoot, 'candidate-contract.json');
    const baseReport = join(fixtureRoot, 'base-report.json');
    const currentReport = join(fixtureRoot, 'current-report.json');
    const missingReport = join(fixtureRoot, 'missing-report.json');
    const requiredMissingReport = join(fixtureRoot, 'required-missing-report.json');
    const cli = join(root, 'scripts/performance/bundle-size.mjs');
    const authority = { deterministicResources: report().workload };
    const candidate = structuredClone(authority);
    const baseResources = report();
    const currentResources = structuredClone(baseResources);
    candidate.deterministicResources.mountDestroyCycles = 1;
    currentResources.retention.destroyedHostRetainsBehaviorCount = 2;

    try {
      await Promise.all([
        writeFile(authorityContract, JSON.stringify(authority)),
        writeFile(missingAuthorityContract, '{}'),
        writeFile(candidateContract, JSON.stringify(candidate)),
        writeFile(baseReport, JSON.stringify(bundleReport(baseResources))),
        writeFile(currentReport, JSON.stringify(bundleReport(currentResources))),
        writeFile(missingReport, JSON.stringify(bundleReport(null))),
        writeFile(requiredMissingReport, JSON.stringify(bundleReport(null, true))),
      ]);

      const contractResult = spawnSync(process.execPath, [
        cli,
        '--validate-resource-contract',
        authorityContract,
        candidateContract,
      ], { encoding: 'utf8' });
      assert.equal(contractResult.status, 1);
      assert.match(contractResult.stderr, /mountDestroyCycles 1 is below/);

      const missingAuthorityResult = spawnSync(process.execPath, [
        cli,
        '--validate-resource-contract',
        missingAuthorityContract,
        authorityContract,
      ], { encoding: 'utf8' });
      assert.equal(missingAuthorityResult.status, 1);
      assert.match(missingAuthorityResult.stderr, /Exact-base performance contract is missing/);

      const missingPathResult = spawnSync(process.execPath, [
        cli,
        '--validate-resource-contract',
        authorityContract,
        '--report',
      ], { encoding: 'utf8' });
      assert.equal(missingPathResult.status, 1);
      assert.match(missingPathResult.stderr, /Missing paths for --validate-resource-contract/);

      const reportResult = spawnSync(process.execPath, [
        cli,
        '--report',
        baseReport,
        currentReport,
      ], { encoding: 'utf8' });
      assert.equal(reportResult.status, 1);
      assert.match(reportResult.stdout, /Resource regressions: .* increased from 1 to 2/);

      const cleanReportResult = spawnSync(process.execPath, [
        cli,
        '--report',
        baseReport,
        baseReport,
      ], { encoding: 'utf8' });
      assert.equal(cleanReportResult.status, 0);
      assert.match(cleanReportResult.stdout, /No eager allocation or retained-resource proxy increased/);

      const missingReportPathResult = spawnSync(process.execPath, [
        cli,
        '--report',
        baseReport,
      ], { encoding: 'utf8' });
      assert.equal(missingReportPathResult.status, 1);
      assert.match(missingReportPathResult.stderr, /Missing paths for --report/);

      const asymmetricResult = spawnSync(process.execPath, [
        cli,
        '--report',
        baseReport,
        missingReport,
      ], { encoding: 'utf8' });
      assert.equal(asymmetricResult.status, 1);
      assert.match(asymmetricResult.stdout, /Pull request resource measurement is missing/);

      const requiredMissingResult = spawnSync(process.execPath, [
        cli,
        '--report',
        requiredMissingReport,
        requiredMissingReport,
      ], { encoding: 'utf8' });
      assert.equal(requiredMissingResult.status, 1);
      assert.match(requiredMissingResult.stdout, /Required resource measurements are missing/);

      const unavailableResult = spawnSync(process.execPath, [
        cli,
        '--report',
        missingReport,
        missingReport,
      ], { encoding: 'utf8' });
      assert.equal(unavailableResult.status, 0);
      assert.doesNotMatch(unavailableResult.stdout, /Deterministic allocation and retention/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('measures the built runtime and restores DOM globals', async() => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    await assert.rejects(
      measureResources({ root: '/missing', attachDetachCycles: 1, mountDestroyCycles: 1 })
    );
    const lockedDocumentDescriptor = {
      configurable: true,
      enumerable: true,
      value: {},
      writable: false,
    };
    Object.defineProperty(globalThis, 'document', lockedDocumentDescriptor);
    try {
      await assert.rejects(
        measureResources({ root, attachDetachCycles: 1, mountDestroyCycles: 1 }),
        /Cannot assign to read only property 'document'/
      );
      assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'window'), windowDescriptor);
      assert.deepEqual(
        Object.getOwnPropertyDescriptor(globalThis, 'document'),
        lockedDocumentDescriptor
      );
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, 'document', documentDescriptor);
      } else {
        delete globalThis.document;
      }
    }
    const measurement = await measureResources({
      root,
      attachDetachCycles: 1,
      mountDestroyCycles: 1,
    });

    assert.deepEqual(measurement.allocations.View.arrays, ['_behaviors', '_domEvents']);
    assert.deepEqual(
      measurement.allocations.CollectionView.childViewContainers,
      ['_children', 'children']
    );
    assert.equal(measurement.retention.externalRegistrationsAfterDestroy, 0);
    assert.equal(measurement.retention.regionParentReferencesAfterDestroy, 0);
    assert.equal(measurement.retention.destroyedBehaviorRetainsHostReference, true);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'window'), windowDescriptor);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'document'), documentDescriptor);
    await assert.rejects(
      measureResources({ root, attachDetachCycles: 1, mountDestroyCycles: 1 }),
      /one built runtime per process/
    );
  });

  test('rejects invalid lifecycle workloads before loading the runtime', async() => {
    await assert.rejects(
      measureResources({ root: '/missing', attachDetachCycles: 0 }),
      /attachDetachCycles must be a positive integer.*mountDestroyCycles must be a positive integer/
    );
  });
});

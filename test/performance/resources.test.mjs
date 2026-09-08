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
} from '../../scripts/performance/resources.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

function report() {
  return {
    schemaVersion: 2,
    workload: { attachDetachCycles: 100, mountDestroyCycles: 1000 },
    created: { viewInstances: 4, behaviorInstances: 1 },
    retention: { externalSubscriptionsAfterDestroy: 0, liveInstancesAfterDestroy: 1 }
  };
}

function bundleReport(resources, resourcesRequired = resources != null) {
  return {
    brotliQuality: 11,
    artifacts: [],
    cumulative: {
      size: 0,
      baselineSize: 0,
    },
    graphs: [],
    resourcesRequired,
    resources,
    violations: [],
  };
}

describe('deterministic resource comparison', () => {
  test('reports additional consumer-observed creation and increased retention', () => {
    const base = report();
    const current = structuredClone(base);
    current.claimedBaseline = {
      created: current.created,
      retention: current.retention,
    };
    current.created.viewInstances = 5;
    current.created.behaviorInstances = 2;
    current.retention.liveInstancesAfterDestroy = 2;

    const comparison = compareResources(base, current);

    assert.deepEqual(comparison.violations, []);
    assert.equal(comparison.changes.length, 3);
    assert.match(resourceReportRows(comparison).join('\n'), /Increase/);
  });

  test('reports fewer created instances and lower retention', () => {
    const base = report();
    const current = structuredClone(base);
    current.created.viewInstances = 3;
    current.created.behaviorInstances = 0;
    current.retention.liveInstancesAfterDestroy = 0;

    const comparison = compareResources(base, current);

    assert.deepEqual(comparison.violations, []);
    assert.equal(comparison.changes.length, 3);
    assert.ok(comparison.changes.every(change => change.status === 'decrease'));
    assert.match(resourceReportRows(comparison).join('\n'), /Decrease/);
  });

  test('fails closed for missing, unknown, or incompatible measurements', () => {
    const base = report();
    const current = structuredClone(base);
    delete current.created.viewInstances;
    current.created.unknownInstances = 0;
    current.workload.mountDestroyCycles = 2000;

    const comparison = compareResources(base, current);

    assert.ok(comparison.violations.includes('Resource measurement workload does not match the exact base'));
    assert.ok(comparison.violations.includes('resources.created is missing metrics: viewInstances'));
    assert.ok(comparison.violations.includes('resources.created has unknown metrics: unknownInstances'));
  });

  test('rejects changed numeric metric types', () => {
    const base = report();
    const current = report();
    current.created.viewInstances = '4';
    assert.ok(compareResources(base, current).violations.includes(
      'resources.created.viewInstances changed measurement type'
    ));
  });

  test('rejects missing measurement schema and workloads on both sides', () => {
    const base = report();
    const current = report();
    delete base.schemaVersion;
    delete current.schemaVersion;
    delete base.workload;
    delete current.workload;

    const comparison = compareResources(base, current);

    assert.ok(comparison.violations.includes('Exact-base resource schemaVersion must be 2; received undefined'));
    assert.ok(comparison.violations.includes('Pull request resource schemaVersion must be 2; received undefined'));
    assert.ok(comparison.violations.includes('Exact-base resource workload is missing'));
    assert.ok(comparison.violations.includes('Pull request resource workload is missing'));
    assert.deepEqual(resourceReportRows(comparison), [
      '| Contract validation | Not comparable | Not comparable | Review required |',
    ]);

    const incompatible = report();
    incompatible.schemaVersion = 1;
    assert.ok(
      compareResources(report(), incompatible).violations.includes(
        'Pull request resource schemaVersion must be 2; received 1'
      )
    );
  });

  test('reports creation growth but rejects incomplete measurements through the CLI', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-resource-cli-'));
    const baseReport = join(fixtureRoot, 'base-report.json');
    const currentReport = join(fixtureRoot, 'current-report.json');
    const missingReport = join(fixtureRoot, 'missing-report.json');
    const requiredMissingReport = join(fixtureRoot, 'required-missing-report.json');
    const cli = join(root, 'scripts/performance/bundle-size.mjs');
    const baseResources = report();
    const currentResources = structuredClone(baseResources);
    currentResources.retention.liveInstancesAfterDestroy = 2;

    try {
      await Promise.all([
        writeFile(baseReport, JSON.stringify(bundleReport(baseResources))),
        writeFile(currentReport, JSON.stringify(bundleReport(currentResources))),
        writeFile(missingReport, JSON.stringify(bundleReport(null))),
        writeFile(requiredMissingReport, JSON.stringify(bundleReport(null, true))),
      ]);

      const reportResult = spawnSync(process.execPath, [
        cli,
        '--report',
        baseReport,
        currentReport,
      ], { encoding: 'utf8' });
      assert.equal(reportResult.status, 0);
      assert.match(reportResult.stdout, /liveInstancesAfterDestroy` \| 1 \| 2 \| Increase/);

      const cleanReportResult = spawnSync(process.execPath, [
        cli,
        '--report',
        baseReport,
        baseReport,
      ], { encoding: 'utf8' });
      assert.equal(cleanReportResult.status, 0);
      assert.match(cleanReportResult.stdout, /Consumer-observed creation and retention counts are observations/);

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
      assert.doesNotMatch(unavailableResult.stdout, /Observable creation and retention/);
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

    assert.equal(measurement.schemaVersion, 2);
    assert.ok(measurement.created.viewInstances > 0);
    assert.ok(measurement.created.regionInstances > 0);
    assert.equal(measurement.created.collectionViewInstances, 1);
    assert.equal(measurement.created.behaviorInstances, 1);
    assert.equal(measurement.retention.collectionSubscriptionsWhileMounted, 1);
    assert.equal(measurement.retention.modelSubscriptionsWhileMounted, 1);
    assert.ok(measurement.retention.domListenersWhileMounted > 0);
    for (const metric of ['externalSubscriptionsAfterDestroy', 'domListenersAfterDestroy',
      'callbacksAfterDestroy', 'childViewsAfterDestroy', 'regionViewsAfterEmpty',
      'regionsAfterHostDestroy', 'managedDomChildrenAfterEmpty',
      'managedRootsConnectedAfterDestroy', 'liveInstancesAfterDestroy']) {
      assert.equal(measurement.retention[metric], 0, metric);
    }
    assert.equal(measurement.retention.detachedViewDestroyedWithFormerRegion, false);
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

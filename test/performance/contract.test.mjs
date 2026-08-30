import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    pullRequestGrowthApproval: {
      schemaVersion: 1,
      repository: 'marionettejs/marionette',
      trackingIssueUrl: 'https://github.com/marionettejs/marionette/issues/127',
      allowedLogins: ['paulfalgout'],
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
    thresholds: { pullRequestApprovalPercent: 1 },
    artifacts: [{ name: 'Main', path: 'dist/main.js', size }],
    cumulative: {
      size,
      baselineSize: 100,
      absoluteCeiling: 105,
    },
    graphs: [],
    resourcesRequired: false,
    resources: null,
    violations: [],
  };
}

function growthApproval(status = 'approved') {
  return {
    schemaVersion: 1,
    status,
    headSha: '1234567890abcdef1234567890abcdef12345678',
    thresholdPercent: 1,
    required: [{
      baseBytes: 100,
      currentBytes: 102,
      deltaBytes: 2,
      growthBasisPoints: 200,
      name: 'Main',
      path: 'dist/main.js',
    }],
    approval: status === 'approved' ? {
      authorLogin: 'paulfalgout',
      commentUrl: 'https://github.com/marionettejs/marionette/pull/1#issuecomment-1',
    } : null,
    diagnostics: status === 'approved' ? [] : [{ message: 'Approval is required' }],
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

function newSubpathApproval(status = 'approved') {
  return {
    schemaVersion: 1,
    status,
    headSha: '1234567890abcdef1234567890abcdef12345678',
    thresholdPercent: 1,
    required: [],
    newProductionEnforced: true,
    newSubpaths: ['./feature'],
    newArtifacts: [{ path: 'dist/feature.js', size: 4 }],
    approval: status === 'approved' ? {
      approvedNewSubpaths: ['./feature'],
      approvedNewArtifacts: [{ path: 'dist/feature.js', size: 4 }],
      authorLogin: 'paulfalgout',
      commentUrl: 'https://github.com/marionettejs/marionette/pull/1#issuecomment-1',
    } : null,
    diagnostics: status === 'approved' ? [] : [{ message: 'Approval is required' }],
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

  test('surfaces malformed growth approval policy through contract validation', () => {
    const contract = contractFor();
    contract.pullRequestGrowthApproval.allowedLogins = ['zed', 'alpha'];
    const packageJson = {
      exports: { '.': { import: './dist/index.mjs' } },
    };

    const violations = validateContract(contract, packageJson, ['index.mjs']);

    assert.ok(violations.includes(
      'Growth approval policy allowedLogins must contain sorted, unique lowercase GitHub logins'
    ));
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

  test('resolves an amended active ceiling from the append-only ledger', () => {
    const contract = contractFor();
    contract.baseline.absoluteCeilingBytes = 12;
    const packageJson = {
      exports: { '.': { import: './dist/index.mjs' } },
    };
    const authorization = {
      kind: 'authorization',
      id: 'BA0001',
      target: 'aggregate-shipped-package',
      previousCeilingBytes: 10,
      proposedCeilingBytes: 12,
      prototypeBaseCommit: 'abcdef1234567890abcdef1234567890abcdef12',
      prototypeCommit: '1234567890abcdef1234567890abcdef12345678',
      implementationIssueUrl: 'https://github.com/marionettejs/marionette/issues/205',
      authorizedArtifactPaths: ['dist/index.mjs'],
      authorizedNewSubpaths: [],
      reports: [
        {
          path: 'evidence/performance-budget-amendments/BA0001/base.json',
          role: 'base',
          sha256: '0'.repeat(64),
        },
        {
          path: 'evidence/performance-budget-amendments/BA0001/prototype.json',
          role: 'prototype',
          sha256: '1'.repeat(64),
        },
      ],
      prototypeContract: {
        path: 'evidence/performance-budget-amendments/BA0001/prototype-contract.json',
        sha256: '2'.repeat(64),
      },
      approvalUrls: [
        'https://github.com/marionettejs/marionette/pull/205#issuecomment-100',
      ],
      evidenceUrls: [
        'https://github.com/marionettejs/marionette/issues/127#issuecomment-101',
      ],
      rationale: 'Measured prototype evidence justifies a bounded ceiling increase.',
      rollbackCondition: 'Revoke the pending authorization if implementation stops.',
    };

    const accepted = validateContract(
      contract,
      packageJson,
      ['index.mjs'],
      { schemaVersion: 1, entries: [authorization] }
    );
    assert.deepEqual(accepted, []);

    const rejected = validateContract(
      contract,
      packageJson,
      ['index.mjs'],
      { schemaVersion: 1, entries: [] }
    );
    assert.equal(rejected.some(violation => violation.includes('active ceiling')), true);
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

  test('renders artifact-specific growth approval results before enforcement', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-approval-report-'));
    const baseReport = join(fixtureRoot, 'base.json');
    const currentReport = join(fixtureRoot, 'current.json');
    const approvalReport = join(fixtureRoot, 'approval.json');

    try {
      await Promise.all([
        writeFile(baseReport, JSON.stringify(bundleReport(100))),
        writeFile(currentReport, JSON.stringify(bundleReport(102))),
        writeFile(approvalReport, JSON.stringify(growthApproval())),
      ]);

      const approved = await createReport(baseReport, currentReport, approvalReport);
      assert.match(approved, /\| Main \| 100 B \| 102 B \| \+2 B \(\+2\.00%\) 🔺 \| Approved \|/);
      assert.match(approved, /## Artifact growth approval\n\nStatus: \*\*Approved\*\*\./);
      assert.match(approved, /Approved by \[@paulfalgout\]/);

      for (const field of ['newArtifacts', 'newSubpaths']) {
        const malformedApproval = growthApproval();
        malformedApproval[field] = null;
        await writeFile(approvalReport, JSON.stringify(malformedApproval));
        const malformed = await createReport(baseReport, currentReport, approvalReport);
        assert.match(malformed, /New-production approval requirements do not match/);
      }

      const missing = await createReport(baseReport, currentReport);
      assert.match(missing, /\| Main .* \| Required \|/);
      assert.match(missing, /Status: \*\*Required\*\*\./);
      assert.match(missing, /has no structured approval result/);

      const identical = await createReport(baseReport, baseReport);
      assert.match(identical, /\| Main .* \| Not required \|/);
      assert.match(identical, /Status: \*\*Not required\*\*\./);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('accepts exact artifact growth approval while consuming an authorized budget', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-budget-consumption-report-'));
    const baseReport = join(fixtureRoot, 'base.json');
    const currentReport = join(fixtureRoot, 'current.json');
    const approvalReport = join(fixtureRoot, 'approval.json');
    const approval = growthApproval();
    approval.budgetAmendment = { mode: 'consume', status: 'accepted' };
    approval.required[0] = {
      ...approval.required[0],
      currentBytes: 101,
      deltaBytes: 1,
      growthBasisPoints: 100,
    };

    try {
      await Promise.all([
        writeFile(baseReport, JSON.stringify(bundleReport(100))),
        writeFile(currentReport, JSON.stringify(bundleReport(101))),
        writeFile(approvalReport, JSON.stringify(approval)),
      ]);

      const approved = await createReport(baseReport, currentReport, approvalReport);
      assert.match(approved, /\| Runtime artifact \| Base \| PR \| Change \| >0% approval \|/);
      assert.match(approved, /\| Main \| 100 B \| 101 B \| \+1 B \(\+1\.00%\) 🔺 \| Approved \|/);
      assert.match(approved, /## Artifact growth approval\n\nStatus: \*\*Approved\*\*\./);
      assert.match(approved, /Threshold: greater than 0% during accepted budget consumption/);

      delete approval.budgetAmendment;
      await writeFile(approvalReport, JSON.stringify(approval));
      const ordinary = await createReport(baseReport, currentReport, approvalReport);
      assert.match(ordinary, /Growth approval requirements do not match the exact report comparison/);
      assert.match(ordinary, /must be not-required when no approval condition is present/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('reports exact new subpath and full-size approval without accepting malformed results', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-new-subpath-report-'));
    const baseReport = join(fixtureRoot, 'base.json');
    const currentReport = join(fixtureRoot, 'current.json');
    const approvalReport = join(fixtureRoot, 'approval.json');

    try {
      await Promise.all([
        writeFile(baseReport, JSON.stringify(newSubpathReport())),
        writeFile(currentReport, JSON.stringify(newSubpathReport(true))),
        writeFile(approvalReport, JSON.stringify(newSubpathApproval())),
      ]);

      const approved = await createReport(baseReport, currentReport, approvalReport);
      assert.match(approved, /\| Feature \| New \| 4 B \| New artifact \| Approved \|/);
      assert.match(approved, /\| `\.\/feature` \| 1 \| None \| New production subpath \| Approved \|/);
      assert.match(approved, /New subpaths: `\.\/feature`\./);
      assert.match(approved, /New artifacts at full Brotli size: `dist\/feature\.js` \(4 B\)\./);

      const missing = await createReport(baseReport, currentReport);
      assert.match(missing, /\| Feature \| New \| 4 B \| New artifact \| Blocked pending activation \|/);
      assert.match(missing, /\| `\.\/feature` .* \| Blocked pending activation \|/);
      assert.match(missing, /New-subpath approval enforcement: \*\*Blocked pending activation\*\*/);
      assert.match(missing, /New-production approval enforcement is not active/);

      const malformedApproval = newSubpathApproval();
      malformedApproval.newArtifacts[0].size = 3;
      await writeFile(approvalReport, JSON.stringify(malformedApproval));
      const malformed = await createReport(baseReport, currentReport, approvalReport);
      assert.match(malformed, /New-production approval requirements do not match/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('reports approval for a zero-byte new subpath aliasing an existing artifact', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-new-subpath-alias-'));
    const baseReport = join(fixtureRoot, 'base.json');
    const currentReport = join(fixtureRoot, 'current.json');
    const approvalReport = join(fixtureRoot, 'approval.json');
    const base = newSubpathReport();
    const current = structuredClone(base);
    current.graphs.push({
      subpath: './feature',
      status: 'measured',
      modules: ['feature.js'],
      externalImports: [],
      forbiddenModules: [],
    });
    const approval = newSubpathApproval();
    approval.newArtifacts = [];
    approval.approval.approvedNewArtifacts = [];

    try {
      await Promise.all([
        writeFile(baseReport, JSON.stringify(base)),
        writeFile(currentReport, JSON.stringify(current)),
        writeFile(approvalReport, JSON.stringify(approval)),
      ]);

      const report = await createReport(baseReport, currentReport, approvalReport);
      assert.match(report, /\| `\.\/feature` \| 1 \| None \| New production subpath \| Approved \|/);
      assert.match(report, /New artifacts: none; the approved subpath aliases an existing runtime artifact\./);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('accepts canonically ordered mixed-case new artifacts in the report', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-new-subpath-order-'));
    const baseReport = join(fixtureRoot, 'base.json');
    const currentReport = join(fixtureRoot, 'current.json');
    const approvalReport = join(fixtureRoot, 'approval.json');
    const base = newSubpathReport();
    const current = structuredClone(base);
    current.artifacts.push(
      { name: 'View', path: 'dist/View.mjs', status: 'measured', size: 2 },
      { name: 'All', path: 'dist/all.mjs', status: 'measured', size: 2 });
    current.cumulative.size = 104;
    current.graphs.push({
      subpath: './feature',
      status: 'measured',
      modules: ['feature.js'],
      externalImports: [],
      forbiddenModules: [],
    });
    const approval = newSubpathApproval();
    approval.newArtifacts = [
      { path: 'dist/View.mjs', size: 2 },
      { path: 'dist/all.mjs', size: 2 },
    ];
    approval.approval.approvedNewArtifacts = approval.newArtifacts;

    try {
      await Promise.all([
        writeFile(baseReport, JSON.stringify(base)),
        writeFile(currentReport, JSON.stringify(current)),
        writeFile(approvalReport, JSON.stringify(approval)),
      ]);

      const report = await createReport(baseReport, currentReport, approvalReport);
      assert.match(report, /\| View \| New \| 2 B \| New artifact \| Approved \|/);
      assert.match(report, /\| All \| New \| 2 B \| New artifact \| Approved \|/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('enforces growth approval status through the report CLI', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-approval-cli-'));
    const baseReport = join(fixtureRoot, 'base.json');
    const currentReport = join(fixtureRoot, 'current.json');
    const approvedReport = join(fixtureRoot, 'approved.json');
    const requiredReport = join(fixtureRoot, 'required.json');
    const cli = join(root, 'config/bundle-size.mjs');

    try {
      await Promise.all([
        writeFile(baseReport, JSON.stringify(bundleReport(100))),
        writeFile(currentReport, JSON.stringify(bundleReport(102))),
        writeFile(approvedReport, JSON.stringify(growthApproval())),
        writeFile(requiredReport, JSON.stringify(growthApproval('required'))),
      ]);

      const missing = spawnSync(process.execPath, [
        cli, '--report', baseReport, currentReport,
      ], { encoding: 'utf8' });
      assert.equal(missing.status, 0);
      assert.match(missing.stdout, /Status: \*\*Required\*\*\./);

      const approved = spawnSync(process.execPath, [
        cli, '--report', baseReport, currentReport, '--growth-approval', approvedReport,
      ], { encoding: 'utf8' });
      assert.equal(approved.status, 0);
      assert.match(approved.stdout, /Status: \*\*Approved\*\*\./);

      const required = spawnSync(process.execPath, [
        cli, '--report', baseReport, currentReport, '--growth-approval', requiredReport,
      ], { encoding: 'utf8' });
      assert.equal(required.status, 1);
      assert.match(required.stdout, /Status: \*\*Required\*\*\./);

      const identical = spawnSync(process.execPath, [
        cli, '--report', baseReport, baseReport,
      ], { encoding: 'utf8' });
      assert.equal(identical.status, 0);
      assert.match(identical.stdout, /Status: \*\*Not required\*\*\./);

      const missingPath = spawnSync(process.execPath, [
        cli, '--report', baseReport, currentReport, '--growth-approval',
      ], { encoding: 'utf8' });
      assert.equal(missingPath.status, 1);
      assert.match(missingPath.stderr, /Missing value for --growth-approval/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('wires candidate measurement and validation through exact-base CI code', async() => {
    const workflow = await readFile(join(root, '.github/workflows/ci.yml'), 'utf8');
    const authorityStep = workflow.match(
      /- name:\s+Enforce exact base performance contract\r?\n([\s\S]*?)(?=\n\s+- name: )/
    )?.[1];
    assert.ok(authorityStep);

    const commands = authorityStep
      .replace(/\\\r?\n\s*/g, ' ')
      .split(/\r?\n/)
      .map(line => line.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    const measurementIndex = commands.findIndex(command =>
      command.startsWith('node "${authority_script}"') &&
      command.includes('> "${PERFORMANCE_DIR}/bundle-size-authority.json"')
    );
    const resourceValidationIndex = commands.findIndex(command =>
      command.includes('--validate-resource-contract')
    );
    const approvalIndex = commands.findIndex(command =>
      command.startsWith('node "${approval_script}"')
    );

    assert.ok(commands.includes('authority_script=\'bundle-size-base/config/bundle-size.mjs\''));
    assert.ok(commands.includes(
      'approval_script=\'bundle-size-base/config/performance-growth-approval.mjs\''
    ));
    assert.notEqual(measurementIndex, -1);
    assert.notEqual(resourceValidationIndex, -1);
    assert.notEqual(approvalIndex, -1);
    assert.match(
      commands[measurementIndex],
      /^node "\$\{authority_script\}" --config config\/performance\.json --json > "\$\{PERFORMANCE_DIR\}\/bundle-size-authority\.json" \|\| authority_status=\$\?$/
    );
    assert.match(
      commands[resourceValidationIndex],
      /^node "\$\{authority_script\}" --validate-resource-contract "\$\{base_contract\}" config\/performance\.json \|\| candidate_status=\$\?$/
    );
    assert.ok(commands[approvalIndex].includes('--candidate-contract config/performance.json'));
    assert.ok(measurementIndex < approvalIndex);
    assert.ok(resourceValidationIndex < approvalIndex);
  });

  test('refreshes checks when budget-amendment approvals or evidence change', async() => {
    const workflow = await readFile(
      join(root, '.github/workflows/performance-approval-refresh.yml'),
      'utf8'
    );
    assert.match(workflow, /marionette-performance-budget-amendment:v1/);
    assert.match(workflow, /growth-approval\|budget-amendment/);
    assert.match(workflow, /actions\/runs\?event=pull_request&head_sha=\$\{head_sha\}/);
    assert.doesNotMatch(workflow, /actions\/workflows\/ci\.yml\/runs/);
    assert.match(workflow, /gh api --paginate --slurp/);
    assert.match(workflow, /\[\.\[\]\.workflow_runs\[\]\]/);
    assert.match(workflow, /\(\.path \/\/ ""\) \| split\("@"\)\[0\]/);
    assert.match(workflow, /\$workflow_path == "\.github\/workflows\/ci\.yml"/);
    assert.match(workflow, /\$repository \+ "\/\.github\/workflows\/ci\.yml"/);
    assert.match(workflow, /actions\/required_workflows\//);
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
          join(root, 'config/bundle-size.mjs'),
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
          join(root, 'config/bundle-size.mjs'),
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

    const mismatchedProfile = structuredClone(contract);
    mismatchedProfile.toolchain.releaseProfile.sha256 = '0'.repeat(64);
    assert.match(
      (await validateToolchain(mismatchedProfile, root)).join('\n'),
      /Release profile SHA-256 [a-f\d]{64} does not match 0{64}/
    );

    assert.ok(
      contract.forbiddenProductionModules.includes('config/performance-resources.mjs')
    );
    assert.deepEqual(
      findForbiddenModules(['index.js', 'config/performance-resources.mjs'], contract),
      ['config/performance-resources.mjs']
    );
  });
});

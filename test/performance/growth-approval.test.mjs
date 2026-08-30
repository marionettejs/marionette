import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  formatGrowthApprovalComment,
  parseGrowthApprovalComment,
  requiredArtifactGrowth,
  requiredNewProductionApproval,
  validateCandidateGrowthContract,
  validateGrowthApproval,
  validateGrowthApprovalPolicy,
} from '../../scripts/performance/growth-approval.mjs';

const headSha = '1234567890abcdef1234567890abcdef12345678';
const pullRequestNumber = 1;
const root = fileURLToPath(new URL('../..', import.meta.url));
const evidenceUrl =
  'https://github.com/marionettejs/marionette/issues/127#issuecomment-123';
const policy = {
  schemaVersion: 1,
  repository: 'marionettejs/marionette',
  trackingIssueUrl: 'https://github.com/marionettejs/marionette/issues/127',
  allowedLogins: ['paulfalgout'],
};

function report(artifacts, graphs = []) {
  return { artifacts, graphs };
}

function approvalRecord(approvedPaths = ['dist/over.js'], newProduction) {
  const record = {
    schemaVersion: 1,
    headSha,
    issueUrl: policy.trackingIssueUrl,
    approvedPaths,
    evidenceUrls: [evidenceUrl],
  };

  if (newProduction) {
    record.approvedNewSubpaths = newProduction.subpaths;
    record.approvedNewArtifacts = newProduction.artifacts;
  }

  return record;
}

function growthContract() {
  return {
    schemaVersion: 1,
    baseline: {
      sourceCommit: 'abcdef1234567890abcdef1234567890abcdef12',
      brotliQuality: 11,
      totalBrotliBytes: 100,
      absoluteCeilingBytes: 105,
    },
    toolchain: {
      releaseProfile: {
        path: 'config/release-profile.json',
        sha256: 'a'.repeat(64),
        node: '24.19.0',
        npm: '11.17.0',
        lockfileVersion: 3,
        canonicalHost: {
          id: 'linux-x64',
          runner: 'ubuntu-24.04',
          platform: 'linux',
          architecture: 'x64',
        },
      },
      lockedDependencies: {
        backbone: '1.4.0',
        rollup: '4.63.0',
      },
      commands: {
        deterministic: ['npm run size'],
        hostedTiming: ['npm run performance:timing'],
      },
    },
    thresholds: {
      cumulativeGrowthPercent: 5,
      pullRequestApprovalPercent: 1,
    },
    pullRequestGrowthApproval: policy,
    forbiddenProductionModulePrefixes: ['test/'],
    forbiddenProductionModules: ['config/performance.json'],
    runtimeArtifacts: [{
      name: 'Main',
      path: 'dist/main.js',
      baselineBrotliBytes: 100,
    }],
    productionGraphs: [{
      subpath: '.',
      input: 'index.js',
      output: 'dist/main.js',
      baselineModules: ['index.js'],
      baselineExternalImports: [],
    }],
  };
}

function candidateGrowthContract() {
  const contract = structuredClone(growthContract());
  contract.runtimeArtifacts.push({
    name: 'Feature',
    path: 'dist/feature.js',
    baselineBrotliBytes: 0,
  });
  contract.productionGraphs.push({
    subpath: './feature',
    input: 'feature.js',
    output: 'dist/feature.js',
    baselineModules: [],
    baselineExternalImports: [],
  });
  return contract;
}

function toolingRelocationContract() {
  const contract = growthContract();
  contract.forbiddenProductionModulePrefixes = [
    'scripts/',
    'test/',
    'config/diagnostics/',
    'config/docs/',
    'config/release/',
  ];
  contract.forbiddenProductionModules = [
    'config/bundle-size.mjs',
    'config/performance-growth-approval.mjs',
    'config/performance-resources.mjs',
    'config/performance.json',
    'config/release-profile.json',
    'config/release-promotion.json',
  ];
  return contract;
}

function candidateAliasContract() {
  const contract = structuredClone(growthContract());
  contract.productionGraphs.push({
    subpath: './feature',
    input: 'index.js',
    output: 'dist/main.js',
    baselineModules: [],
    baselineExternalImports: [],
  });
  return contract;
}

function productionReport({ aliasFeature = false, includeFeature = false, featureStatus = 'measured' } = {}) {
  const artifacts = [{ name: 'Main', path: 'dist/main.js', status: 'measured', size: 100 }];
  const graphs = [{
    subpath: '.',
    input: 'index.js',
    output: 'dist/main.js',
    status: 'measured',
    modules: ['index.js'],
    externalImports: [],
    forbiddenModules: [],
  }];
  if (includeFeature) {
    artifacts.push({ name: 'Feature', path: 'dist/feature.js', status: 'measured', size: 4 });
  }
  if (includeFeature || aliasFeature) {
    graphs.push({
      subpath: './feature',
      input: aliasFeature ? 'index.js' : 'feature.js',
      output: aliasFeature ? 'dist/main.js' : 'dist/feature.js',
      status: featureStatus,
      modules: [aliasFeature ? 'index.js' : 'feature.js'],
      externalImports: [],
      forbiddenModules: [],
    });
  }

  return {
    schemaVersion: 1,
    baselineSourceCommit: 'abcdef1234567890abcdef1234567890abcdef12',
    brotliQuality: 11,
    thresholds: {
      cumulativeGrowthPercent: 5,
      pullRequestApprovalPercent: 1,
    },
    artifacts,
    cumulative: {
      size: includeFeature ? 104 : 100,
      baselineSize: 100,
      absoluteCeiling: 105,
    },
    graphs,
    violations: [],
  };
}

function grownProductionReport() {
  const current = productionReport();
  current.artifacts[0].size = 102;
  current.cumulative.size = 102;
  return current;
}

function comment(record, {
  association = 'MEMBER',
  id = 1,
  login = 'paulfalgout',
  pullRequest = pullRequestNumber,
  type = 'User',
} = {}) {
  return {
    id,
    'author_association': association,
    body: formatGrowthApprovalComment(record),
    'html_url': `https://github.com/marionettejs/marionette/pull/${pullRequest}#issuecomment-${id}`,
    user: { login, type },
  };
}

function snapshot(comments, status = 'ok') {
  return {
    schemaVersion: 1,
    status,
    repository: policy.repository,
    pullRequestNumber,
    comments,
  };
}

function evidenceComment({ association = 'MEMBER', login = 'evidence-author', type = 'User' } = {}) {
  return {
    id: 123,
    'author_association': association,
    'html_url': evidenceUrl,
    user: { login, type },
  };
}

function evidenceSnapshot(comments = [evidenceComment()], status = 'ok') {
  return {
    schemaVersion: 1,
    status,
    repository: policy.repository,
    issueNumber: 127,
    comments,
  };
}

function validation({
  base = [{ name: 'Over', path: 'dist/over.js', size: 100 }],
  comments = [comment(approvalRecord())],
  current = [{ name: 'Over', path: 'dist/over.js', size: 102 }],
  currentHead = headSha,
  currentPolicy = policy,
  evidence = [evidenceComment()],
} = {}) {
  return validateGrowthApproval({
    baseReport: report(base),
    comments: snapshot(comments),
    currentReport: report(current),
    evidenceComments: evidenceSnapshot(evidence),
    headSha: currentHead,
    policy: currentPolicy,
    pullRequestNumber,
    thresholdPercent: 1,
  });
}

describe('exact-head performance growth approval contract', () => {
  test('requires only existing artifacts growing strictly above one percent', () => {
    const base = report([
      { name: 'Exact', path: 'dist/exact.js', size: 100 },
      { name: 'Fractional', path: 'dist/fractional.js', size: 199 },
      { name: 'Over', path: 'dist/over.js', size: 100 },
      { name: 'Shrink', path: 'dist/shrink.js', size: 100 },
      { name: 'Zero', path: 'dist/zero.js', size: 0 },
    ]);
    const current = report([
      { name: 'Exact', path: 'dist/exact.js', size: 101 },
      { name: 'Fractional', path: 'dist/fractional.js', size: 201 },
      { name: 'Over', path: 'dist/over.js', size: 102 },
      { name: 'Shrink', path: 'dist/shrink.js', size: 99 },
      { name: 'Zero', path: 'dist/zero.js', size: 1 },
      { name: 'New', path: 'dist/new.js', size: 10 },
    ]);

    assert.deepEqual(requiredArtifactGrowth(base, current, 1), [
      {
        baseBytes: 199,
        currentBytes: 201,
        deltaBytes: 2,
        growthBasisPoints: 101,
        name: 'Fractional',
        path: 'dist/fractional.js',
      },
      {
        baseBytes: 100,
        currentBytes: 102,
        deltaBytes: 2,
        growthBasisPoints: 200,
        name: 'Over',
        path: 'dist/over.js',
      },
      {
        baseBytes: 0,
        currentBytes: 1,
        deltaBytes: 1,
        growthBasisPoints: null,
        name: 'Zero',
        path: 'dist/zero.js',
      },
    ]);
  });

  test('rejects a renamed artifact instead of treating its replacement as new', () => {
    assert.throws(
      () => requiredArtifactGrowth(
        report([{ name: 'Old', path: 'dist/old.js', size: 100 }]),
        report([{ name: 'Replacement', path: 'dist/replacement.js', size: 1000 }]),
        1
      ),
      /missing exact-base artifacts: dist\/old\.js/
    );
  });

  test('derives exact new subpaths and full artifact sizes from additive candidate evidence', () => {
    assert.deepEqual(requiredNewProductionApproval({
      authorityContract: growthContract(),
      baseReport: productionReport(),
      candidateContract: candidateGrowthContract(),
      currentReport: productionReport({ includeFeature: true }),
    }), {
      artifacts: [{ path: 'dist/feature.js', size: 4 }],
      enforced: true,
      subpaths: ['./feature'],
    });
  });

  test('requires approval when a new public subpath aliases an existing artifact at zero bytes', () => {
    const currentReport = productionReport({ aliasFeature: true });
    const required = requiredNewProductionApproval({
      authorityContract: growthContract(),
      baseReport: productionReport(),
      candidateContract: candidateAliasContract(),
      currentReport,
    });
    assert.deepEqual(required, {
      artifacts: [],
      enforced: true,
      subpaths: ['./feature'],
    });

    const record = approvalRecord([], required);
    assert.deepEqual(parseGrowthApprovalComment(formatGrowthApprovalComment(record), policy), {
      matched: true,
      approval: record,
    });
    const result = validateGrowthApproval({
      authorityContract: growthContract(),
      baseReport: productionReport(),
      candidateContract: candidateAliasContract(),
      comments: snapshot([comment(record)]),
      currentReport,
      evidenceComments: evidenceSnapshot(),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });
    assert.equal(result.status, 'approved');
    assert.deepEqual(result.newArtifacts, []);
    assert.deepEqual(result.newSubpaths, ['./feature']);
  });

  test('blocks new production additions until candidate-contract activation', () => {
    const currentReport = productionReport({ includeFeature: true });
    currentReport.violations = [
      'Declared runtime artifacts missing from the contract: dist/feature.js',
      'Shipped runtime artifacts are untracked: dist/feature.js',
      'Production graph subpaths mismatch exports; missing: ./feature; extra: none',
    ];
    currentReport.graphs[1] = {
      subpath: './feature',
      status: 'unconfigured',
      modules: [],
      externalImports: [],
      forbiddenModules: [],
      error: 'New exported runtime subpath is not defined by the authority contract',
    };

    const result = validateGrowthApproval({
      authorityContract: growthContract(),
      baseReport: productionReport(),
      comments: snapshot([]),
      currentReport,
      evidenceComments: evidenceSnapshot(),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });

    assert.equal(result.status, 'blocked');
    assert.equal(result.newProductionEnforced, false);
    assert.deepEqual(result.newArtifacts, []);
    assert.deepEqual(result.newSubpaths, []);
    assert.equal(result.diagnostics[0].code, 'GROWTH_APPROVAL_REPORT');
    assert.match(result.diagnostics[0].message, /report has contract violations/);
  });

  test('uses canonical code-unit order for new artifact approvals', () => {
    const candidateContract = candidateGrowthContract();
    candidateContract.runtimeArtifacts.splice(1, 1,
      { name: 'View', path: 'dist/View.mjs', baselineBrotliBytes: 0 },
      { name: 'All', path: 'dist/all.mjs', baselineBrotliBytes: 0 });
    candidateContract.productionGraphs[1].output = 'dist/View.mjs';
    const currentReport = productionReport();
    currentReport.artifacts.push(
      { name: 'View', path: 'dist/View.mjs', status: 'measured', size: 2 },
      { name: 'All', path: 'dist/all.mjs', status: 'measured', size: 2 });
    currentReport.cumulative.size = 104;
    currentReport.graphs.push({
      subpath: './feature',
      input: 'feature.js',
      output: 'dist/View.mjs',
      status: 'measured',
      modules: ['feature.js'],
      externalImports: [],
      forbiddenModules: [],
    });

    const required = requiredNewProductionApproval({
      authorityContract: growthContract(),
      baseReport: productionReport(),
      candidateContract,
      currentReport,
    });
    assert.deepEqual(required.artifacts, [
      { path: 'dist/View.mjs', size: 2 },
      { path: 'dist/all.mjs', size: 2 },
    ]);

    const result = validateGrowthApproval({
      authorityContract: growthContract(),
      baseReport: productionReport(),
      candidateContract,
      comments: snapshot([comment(approvalRecord([], required))]),
      currentReport,
      evidenceComments: evidenceSnapshot(),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });
    assert.equal(result.status, 'approved');
  });

  test('permits only zero-Phase-0-cost artifact and graph additions to the candidate contract', () => {
    assert.deepEqual(
      validateCandidateGrowthContract(growthContract(), candidateGrowthContract()),
      []
    );

    const changedPolicy = candidateGrowthContract();
    changedPolicy.pullRequestGrowthApproval.allowedLogins = ['attacker'];
    assert.match(
      validateCandidateGrowthContract(growthContract(), changedPolicy)[0],
      /pullRequestGrowthApproval/
    );

    const changedCeiling = candidateGrowthContract();
    changedCeiling.baseline.absoluteCeilingBytes = 1000;
    assert.match(
      validateCandidateGrowthContract(growthContract(), changedCeiling)[0],
      /baseline/
    );

    const resetPhase0 = candidateGrowthContract();
    resetPhase0.runtimeArtifacts[1].baselineBrotliBytes = 4;
    assert.match(
      validateCandidateGrowthContract(growthContract(), resetPhase0)[0],
      /baselineBrotliBytes must be 0/
    );
  });

  test('permits only tightening forbidden external imports', () => {
    const authorityContract = growthContract();
    const introduced = growthContract();
    introduced.forbiddenExternalImports = ['underscore'];
    assert.deepEqual(
      validateCandidateGrowthContract(authorityContract, introduced),
      []
    );

    const largeAuthority = growthContract();
    largeAuthority.forbiddenExternalImports = Array.from(
      { length: 51 },
      (_, index) => `package-${String(index).padStart(2, '0')}`
    );
    assert.deepEqual(
      validateCandidateGrowthContract(largeAuthority, structuredClone(largeAuthority)),
      []
    );

    const largeExtension = structuredClone(largeAuthority);
    largeExtension.forbiddenExternalImports.push('package-51');
    assert.deepEqual(
      validateCandidateGrowthContract(largeAuthority, largeExtension),
      []
    );

    authorityContract.forbiddenExternalImports = ['jquery'];
    const extended = structuredClone(authorityContract);
    extended.forbiddenExternalImports = ['jquery', 'underscore'];
    assert.deepEqual(
      validateCandidateGrowthContract(authorityContract, extended),
      []
    );

    const removed = structuredClone(authorityContract);
    delete removed.forbiddenExternalImports;
    assert.match(
      validateCandidateGrowthContract(authorityContract, removed).join('\n'),
      /forbiddenExternalImports must be a sorted, unique, non-empty string superset/
    );

    const replaced = structuredClone(authorityContract);
    replaced.forbiddenExternalImports = ['underscore'];
    assert.match(
      validateCandidateGrowthContract(authorityContract, replaced).join('\n'),
      /forbiddenExternalImports must be a sorted, unique, non-empty string superset/
    );

    for (const forbiddenExternalImports of [
      ['underscore', 'underscore'],
      ['underscore', 'jquery'],
      [''],
      [1],
    ]) {
      const malformed = growthContract();
      malformed.forbiddenExternalImports = forbiddenExternalImports;
      assert.match(
        validateCandidateGrowthContract(growthContract(), malformed).join('\n'),
        /forbiddenExternalImports must be a sorted, unique, non-empty string superset/
      );
    }

    const unrelated = growthContract();
    unrelated.arbitraryPolicy = true;
    assert.match(
      validateCandidateGrowthContract(growthContract(), unrelated).join('\n'),
      /top-level fields differ/
    );
  });

  test('permits only the staged issue 237 stale tooling-path cleanup', () => {
    const authority = toolingRelocationContract();
    const cleanup = structuredClone(authority);
    cleanup.forbiddenProductionModules = [
      'config/performance.json',
      'config/release-profile.json',
      'config/release-promotion.json',
    ];
    cleanup.forbiddenProductionModulePrefixes = [
      'scripts/',
      'test/',
      'config/diagnostics/',
      'config/release/',
    ];

    assert.deepEqual(validateCandidateGrowthContract(authority, cleanup), []);
    assert.deepEqual(
      validateCandidateGrowthContract(authority, structuredClone(authority)),
      []
    );

    const moduleOnly = structuredClone(authority);
    moduleOnly.forbiddenProductionModules = cleanup.forbiddenProductionModules;
    const prefixOnly = structuredClone(authority);
    prefixOnly.forbiddenProductionModulePrefixes = cleanup.forbiddenProductionModulePrefixes;
    const partialModules = structuredClone(cleanup);
    partialModules.forbiddenProductionModules = [
      'config/performance-resources.mjs',
      'config/performance.json',
      'config/release-profile.json',
      'config/release-promotion.json',
    ];
    const unrelatedRemoval = structuredClone(authority);
    unrelatedRemoval.forbiddenProductionModules = [
      'config/bundle-size.mjs',
      'config/performance-growth-approval.mjs',
      'config/performance-resources.mjs',
      'config/release-profile.json',
      'config/release-promotion.json',
    ];
    const replacement = structuredClone(authority);
    replacement.forbiddenProductionModules = [
      'config/performance.json',
      'config/release-profile.json',
      'config/release-promotion.json',
      'scripts/performance/bundle-size.mjs',
    ];
    const addition = structuredClone(authority);
    addition.forbiddenProductionModules.push('scripts/unrelated.mjs');
    const prefixAddition = structuredClone(cleanup);
    prefixAddition.forbiddenProductionModulePrefixes.push('tools/');
    const prefixReordering = structuredClone(cleanup);
    prefixReordering.forbiddenProductionModulePrefixes.reverse();
    const moduleReordering = structuredClone(cleanup);
    moduleReordering.forbiddenProductionModules.reverse();
    const weakenedPrefix = structuredClone(cleanup);
    weakenedPrefix.forbiddenProductionModulePrefixes = ['scripts/', 'test/'];

    for (const candidate of [
      moduleOnly,
      prefixOnly,
      partialModules,
      unrelatedRemoval,
      replacement,
      addition,
      prefixAddition,
      prefixReordering,
      moduleReordering,
      weakenedPrefix,
    ]) {
      assert.match(
        validateCandidateGrowthContract(authority, candidate).join('\n'),
        /may only atomically remove the three stale issue #237 config tool modules/
      );
    }

    for (const forbiddenProductionModules of [
      [],
      ['config/performance.json', 'config/performance.json'],
      ['config/performance.json', 1],
    ]) {
      const malformed = structuredClone(authority);
      malformed.forbiddenProductionModules = forbiddenProductionModules;
      assert.match(
        validateCandidateGrowthContract(authority, malformed).join('\n'),
        /may only atomically remove the three stale issue #237 config tool modules/
      );
    }

    for (const forbiddenProductionModulePrefixes of [
      [],
      ['scripts/', 'scripts/'],
      ['scripts/', 1],
    ]) {
      const malformed = structuredClone(authority);
      malformed.forbiddenProductionModulePrefixes = forbiddenProductionModulePrefixes;
      assert.match(
        validateCandidateGrowthContract(authority, malformed).join('\n'),
        /may only atomically remove the three stale issue #237 config tool modules/
      );
    }

    assert.deepEqual(validateCandidateGrowthContract(cleanup, structuredClone(cleanup)), []);
    const afterCleanupChange = structuredClone(cleanup);
    afterCleanupChange.forbiddenProductionModules = [];
    assert.match(
      validateCandidateGrowthContract(cleanup, afterCleanupChange).join('\n'),
      /may only atomically remove the three stale issue #237 config tool modules/
    );
  });

  test('permits only a valid release-profile SHA-256 transition in the toolchain', () => {
    const authorityContract = growthContract();
    const candidateContract = growthContract();
    candidateContract.toolchain.releaseProfile.sha256 = 'b'.repeat(64);

    assert.deepEqual(
      validateCandidateGrowthContract(authorityContract, candidateContract),
      []
    );

    const mutations = [
      ['an invalid digest', contract => {
        contract.toolchain.releaseProfile.sha256 = 'B'.repeat(64);
      }],
      ['a missing digest', contract => {
        delete contract.toolchain.releaseProfile.sha256;
      }],
      ['a short digest', contract => {
        contract.toolchain.releaseProfile.sha256 = 'b'.repeat(63);
      }],
      ['a non-string digest', contract => {
        contract.toolchain.releaseProfile.sha256 = 1;
      }],
      ['another release-profile field', contract => {
        contract.toolchain.releaseProfile.node = '26.0.0';
      }],
      ['a locked dependency', contract => {
        contract.toolchain.lockedDependencies.rollup = '5.0.0';
      }],
      ['a command', contract => {
        contract.toolchain.commands.deterministic.push('npm run unsafe');
      }],
      ['a new toolchain field', contract => {
        contract.toolchain.untrusted = true;
      }],
      ['a removed release-profile field', contract => {
        delete contract.toolchain.releaseProfile.path;
      }],
    ];

    for (const [label, mutate] of mutations) {
      const changedContract = growthContract();
      mutate(changedContract);
      assert.match(
        validateCandidateGrowthContract(authorityContract, changedContract).join('\n'),
        /changes exact-base toolchain/,
        label
      );
    }
  });

  test('requires the candidate report to prove the release-profile digest', () => {
    const candidateContract = growthContract();
    candidateContract.toolchain.releaseProfile.sha256 = 'b'.repeat(64);

    assert.deepEqual(requiredNewProductionApproval({
      authorityContract: growthContract(),
      baseReport: productionReport(),
      candidateContract,
      currentReport: productionReport(),
    }), {
      artifacts: [],
      enforced: true,
      subpaths: [],
    });

    const mismatchedReport = productionReport();
    mismatchedReport.violations = [
      `Release profile SHA-256 ${'a'.repeat(64)} does not match ${'b'.repeat(64)}`,
    ];
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: productionReport(),
        candidateContract,
        currentReport: mismatchedReport,
      }),
      /Pull request report has contract violations: Release profile SHA-256/
    );
  });

  test('requires an independent exact-head approval when consuming a base-owned budget', () => {
    const candidateContract = growthContract();
    candidateContract.baseline.absoluteCeilingBytes = 110;
    candidateContract.toolchain.releaseProfile.sha256 = 'b'.repeat(64);
    const currentReport = productionReport();
    currentReport.artifacts[0].size = 106;
    currentReport.cumulative.size = 106;
    currentReport.cumulative.absoluteCeiling = 110;
    const budgetAmendment = {
      activeCeilingBytes: 110,
      amendment: {
        id: 'BA0001',
        authorizedArtifactPaths: ['dist/main.js'],
        authorizedNewSubpaths: [],
        proposedCeilingBytes: 110,
      },
      diagnostics: [],
      mode: 'consume',
      requiresExactHeadGrowthApproval: true,
      schemaVersion: 1,
      status: 'accepted',
    };
    const options = {
      authorityContract: growthContract(),
      baseReport: productionReport(),
      budgetAmendment,
      candidateContract,
      currentReport,
      evidenceComments: evidenceSnapshot(),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    };

    const missing = validateGrowthApproval({ ...options, comments: snapshot([]) });
    assert.equal(missing.status, 'required');
    assert.equal(missing.diagnostics[0].code, 'GROWTH_APPROVAL_MISSING');

    const approved = validateGrowthApproval({
      ...options,
      comments: snapshot([comment(approvalRecord(['dist/main.js']))]),
    });
    assert.equal(approved.status, 'approved');
    assert.deepEqual(approved.required.map(({ path }) => path), ['dist/main.js']);

    const staleCeilingReport = structuredClone(currentReport);
    staleCeilingReport.cumulative.absoluteCeiling = 105;
    const staleCeiling = validateGrowthApproval({
      ...options,
      comments: snapshot([]),
      currentReport: staleCeilingReport,
    });
    assert.match(
      staleCeiling.diagnostics.map(({ message }) => message).join('\n'),
      /Pull request report does not use the active performance authority/
    );

    const wrongProposedCeiling = structuredClone(budgetAmendment);
    wrongProposedCeiling.amendment.proposedCeilingBytes = 109;
    assert.match(
      validateCandidateGrowthContract(growthContract(), candidateContract, {
        budgetAmendment: wrongProposedCeiling,
      }).join('\n'),
      /changes exact-base baseline beyond the authorized ceiling/
    );
  });

  test('fails closed for removed base entries and invalid new production evidence', () => {
    const removedArtifact = candidateGrowthContract();
    removedArtifact.runtimeArtifacts.shift();
    assert.match(
      validateCandidateGrowthContract(growthContract(), removedArtifact)[0],
      /removes or changes exact-base runtime artifact dist\/main\.js/
    );

    const unmeasured = productionReport({ includeFeature: true, featureStatus: 'unconfigured' });
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: productionReport(),
        candidateContract: candidateGrowthContract(),
        currentReport: unmeasured,
      }),
      /Pull request production graph \.\/feature is not completely measured/
    );

    const forbidden = productionReport({ includeFeature: true });
    forbidden.graphs[1].forbiddenModules = ['test/helper.js'];
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: productionReport(),
        candidateContract: candidateGrowthContract(),
        currentReport: forbidden,
      }),
      /includes forbidden modules/
    );

    const overCeiling = productionReport({ includeFeature: true });
    overCeiling.artifacts[1].size = 6;
    overCeiling.cumulative.size = 106;
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: productionReport(),
        candidateContract: candidateGrowthContract(),
        currentReport: overCeiling,
      }),
      /exceeds the exact-base cumulative ceiling/
    );

    for (const size of [null, '4', -1]) {
      const malformedSize = productionReport({ includeFeature: true });
      malformedSize.artifacts[1].size = size;
      assert.throws(
        () => requiredNewProductionApproval({
          authorityContract: growthContract(),
          baseReport: productionReport(),
          candidateContract: candidateGrowthContract(),
          currentReport: malformedSize,
        }),
        /not measured at a non-negative integer size/
      );
    }

    const orphanArtifact = productionReport({ includeFeature: true });
    orphanArtifact.graphs.pop();
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: productionReport(),
        candidateContract: candidateGrowthContract(),
        currentReport: orphanArtifact,
      }),
      /Pull request report graph set mismatch; missing: \.\/feature/
    );
  });

  test('binds complete base and candidate report sets before discovering approval deltas', () => {
    const omittedBase = productionReport();
    omittedBase.artifacts = [];
    omittedBase.graphs = [];
    omittedBase.cumulative.size = 0;
    const omittedCurrent = structuredClone(omittedBase);
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: omittedBase,
        currentReport: omittedCurrent,
      }),
      /Exact-base report artifact set mismatch.*dist\/main\.js.*graph set mismatch.*\./
    );
    const omittedResult = validateGrowthApproval({
      authorityContract: growthContract(),
      baseReport: omittedBase,
      comments: snapshot([], 'unavailable'),
      currentReport: omittedCurrent,
      evidenceComments: evidenceSnapshot([], 'unavailable'),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });
    assert.equal(omittedResult.status, 'blocked');
    assert.equal(omittedResult.diagnostics[0].code, 'GROWTH_APPROVAL_REPORT');

    const preseededBase = productionReport({ includeFeature: true });
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: preseededBase,
        candidateContract: candidateGrowthContract(),
        currentReport: productionReport({ includeFeature: true }),
      }),
      /Exact-base report artifact set mismatch.*dist\/feature\.js.*graph set mismatch.*\.\/feature/
    );

    const extraCurrent = productionReport({ includeFeature: true });
    extraCurrent.artifacts.push({
      name: 'Extra',
      path: 'dist/extra.js',
      status: 'measured',
      size: 1,
    });
    extraCurrent.cumulative.size += 1;
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: productionReport(),
        candidateContract: candidateGrowthContract(),
        currentReport: extraCurrent,
      }),
      /Pull request report artifact set mismatch.*dist\/extra\.js/
    );

    const malformedBase = productionReport();
    malformedBase.artifacts[0].status = 'missing';
    malformedBase.graphs[0].status = 'measurement-error';
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: malformedBase,
        currentReport: productionReport(),
      }),
      /runtime artifact dist\/main\.js is not measured.*production graph \. is not completely measured/
    );

    const incompleteTotal = productionReport();
    incompleteTotal.cumulative.size = 99;
    assert.throws(
      () => requiredNewProductionApproval({
        authorityContract: growthContract(),
        baseReport: productionReport(),
        currentReport: incompleteTotal,
      }),
      /Pull request cumulative size does not equal the complete measured artifact set/
    );
  });

  test('rejects duplicate report paths and malformed thresholds', () => {
    assert.throws(
      () => requiredArtifactGrowth(
        report([{ path: 'dist/a.js', size: 1 }, { path: 'dist/a.js', size: 1 }]),
        report([]),
        1
      ),
      /duplicate artifact path/
    );
    assert.throws(
      () => requiredArtifactGrowth(report([]), report([]), -1),
      /non-negative number/
    );
    assert.throws(
      () => requiredArtifactGrowth(
        report([{ path: 'dist/a.js', size: 100 }]),
        report([{ path: 'dist/a.js', size: null }]),
        1
      ),
      /non-comparable sizes/
    );
    for (const size of [undefined, -1, Number.NaN]) {
      assert.throws(
        () => requiredArtifactGrowth(
          report([{ path: 'dist/a.js', size: 100 }]),
          report([{ path: 'dist/a.js', size }]),
          1
        ),
        /non-comparable sizes/
      );
    }
    assert.throws(
      () => requiredArtifactGrowth(
        report([{ path: 'dist/a.js', size: 100 }]),
        report([]),
        1
      ),
      /missing exact-base artifacts/
    );
  });

  test('formats and parses one canonical approval record', () => {
    const record = approvalRecord();
    const body = formatGrowthApprovalComment(record);

    assert.deepEqual(parseGrowthApprovalComment(body, policy), {
      matched: true,
      approval: record,
    });
    assert.deepEqual(parseGrowthApprovalComment('ordinary comment', policy), { matched: false });
    assert.equal(body.split('\n')[0], '<!-- marionette-performance-growth-approval:v1 -->');
  });

  test('formats and parses exact new-subpath approval fields without changing existing records', () => {
    const newProduction = {
      artifacts: [{ path: 'dist/feature.js', size: 4 }],
      subpaths: ['./feature'],
    };
    const record = approvalRecord([], newProduction);

    assert.deepEqual(parseGrowthApprovalComment(formatGrowthApprovalComment(record), policy), {
      matched: true,
      approval: record,
    });
    assert.equal(Object.hasOwn(approvalRecord(), 'approvedNewSubpaths'), false);
    assert.equal(Object.hasOwn(approvalRecord(), 'approvedNewArtifacts'), false);
  });

  test('rejects ambiguous formatting, fields, paths, and evidence', () => {
    const record = approvalRecord();
    const noncanonical = `${formatGrowthApprovalComment(record)}\nextra`;
    assert.equal(
      parseGrowthApprovalComment(noncanonical, policy).diagnostics[0].code,
      'GROWTH_APPROVAL_FORMAT'
    );

    const invalid = {
      ...record,
      approvedPaths: ['../escape.js'],
      evidenceUrls: ['https://example.com/evidence'],
    };
    const parsed = parseGrowthApprovalComment(formatGrowthApprovalComment(invalid), policy);
    assert.deepEqual(parsed.diagnostics.map(({ code }) => code), [
      'GROWTH_APPROVAL_PATHS',
      'GROWTH_APPROVAL_EVIDENCE',
    ]);

    const unknownField = formatGrowthApprovalComment(record).replace(
      '  "schemaVersion": 1,',
      '  "schemaVersion": 1,\n  "unexpected": true,'
    );
    assert.equal(
      parseGrowthApprovalComment(unknownField, policy).diagnostics[0].code,
      'GROWTH_APPROVAL_FIELDS'
    );

    const duplicateKey = formatGrowthApprovalComment(record).replace(
      '  "schemaVersion": 1,',
      '  "schemaVersion": 1,\n  "schemaVersion": 1,'
    );
    assert.equal(
      parseGrowthApprovalComment(duplicateKey, policy).diagnostics[0].code,
      'GROWTH_APPROVAL_CANONICAL'
    );
  });

  test('validates the base-owned repository, issue, and approver policy', () => {
    const diagnostics = validateGrowthApprovalPolicy({
      schemaVersion: 2,
      repository: 'invalid',
      trackingIssueUrl: 'https://example.com/127',
      allowedLogins: ['Uppercase', 'Uppercase'],
    });

    assert.deepEqual(diagnostics.map(({ code }) => code), [
      'GROWTH_APPROVAL_POLICY_SCHEMA',
      'GROWTH_APPROVAL_POLICY_REPOSITORY',
      'GROWTH_APPROVAL_POLICY_ISSUE',
      'GROWTH_APPROVAL_POLICY_LOGINS',
    ]);
    assert.equal(
      parseGrowthApprovalComment(formatGrowthApprovalComment(approvalRecord()), {})
        .diagnostics[0].code,
      'GROWTH_APPROVAL_POLICY_SCHEMA'
    );
    assert.deepEqual(
      validateGrowthApprovalPolicy({ ...policy, allowedLogins: ['zed', 'alpha'] })
        .map(({ code }) => code),
      ['GROWTH_APPROVAL_POLICY_LOGINS']
    );
  });

  test('returns a blocked result for malformed reports instead of throwing', () => {
    const result = validateGrowthApproval({
      baseReport: {},
      comments: snapshot([]),
      currentReport: report([]),
      evidenceComments: evidenceSnapshot(),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });

    assert.equal(result.status, 'blocked');
    assert.equal(result.diagnostics[0].code, 'GROWTH_APPROVAL_REPORT');
  });

  test('accepts one allowed maintainer record for the exact head and path set', () => {
    const result = validation();

    assert.equal(result.status, 'approved');
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.approval.authorLogin, 'paulfalgout');
    assert.deepEqual(result.approval.approvedPaths, ['dist/over.js']);
  });

  test('accepts one exact-head approval for the exact new subpath and full artifact size', () => {
    const newProduction = {
      artifacts: [{ path: 'dist/feature.js', size: 4 }],
      subpaths: ['./feature'],
    };
    const result = validateGrowthApproval({
      authorityContract: growthContract(),
      baseReport: productionReport(),
      candidateContract: candidateGrowthContract(),
      comments: snapshot([comment(approvalRecord([], newProduction))]),
      currentReport: productionReport({ includeFeature: true }),
      evidenceComments: evidenceSnapshot(),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });

    assert.equal(result.status, 'approved');
    assert.deepEqual(result.newSubpaths, ['./feature']);
    assert.deepEqual(result.newArtifacts, [{ path: 'dist/feature.js', size: 4 }]);
    assert.deepEqual(result.approval.approvedNewSubpaths, ['./feature']);
  });

  test('rejects missing, extra, or stale new-production approval details', () => {
    const newProduction = {
      artifacts: [{ path: 'dist/feature.js', size: 4 }],
      subpaths: ['./feature'],
    };
    const options = {
      authorityContract: growthContract(),
      baseReport: productionReport(),
      candidateContract: candidateGrowthContract(),
      currentReport: productionReport({ includeFeature: true }),
      evidenceComments: evidenceSnapshot(),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    };

    const missing = validateGrowthApproval({
      ...options,
      comments: snapshot([comment(approvalRecord([]))]),
    });
    assert.equal(missing.diagnostics[0].code, 'GROWTH_APPROVAL_MISSING');

    const extraSubpath = structuredClone(newProduction);
    extraSubpath.subpaths.push('./other');
    const extra = validateGrowthApproval({
      ...options,
      comments: snapshot([comment(approvalRecord([], extraSubpath))]),
    });
    assert.equal(extra.diagnostics[0].code, 'GROWTH_APPROVAL_NEW_SUBPATH_SET_MISMATCH');

    const wrongSize = structuredClone(newProduction);
    wrongSize.artifacts[0].size = 3;
    const mismatched = validateGrowthApproval({
      ...options,
      comments: snapshot([comment(approvalRecord([], wrongSize))]),
    });
    assert.equal(mismatched.diagnostics[0].code, 'GROWTH_APPROVAL_NEW_ARTIFACT_SET_MISMATCH');

    const stale = approvalRecord([], newProduction);
    stale.headSha = 'abcdef1234567890abcdef1234567890abcdef12';
    const staleResult = validateGrowthApproval({
      ...options,
      comments: snapshot([comment(stale)]),
    });
    assert.equal(staleResult.diagnostics[0].code, 'GROWTH_APPROVAL_MISSING');
  });

  test('fails closed for absent, stale, unauthorized, or unavailable approval comments', () => {
    assert.equal(validation({ comments: [] }).diagnostics[0].code, 'GROWTH_APPROVAL_MISSING');

    const stale = approvalRecord();
    stale.headSha = 'abcdef1234567890abcdef1234567890abcdef12';
    assert.equal(
      validation({ comments: [comment(stale)] }).diagnostics[0].code,
      'GROWTH_APPROVAL_MISSING'
    );
    assert.equal(
      validation({ comments: [comment(approvalRecord(), { login: 'attacker' })] })
        .diagnostics[0].code,
      'GROWTH_APPROVAL_MISSING'
    );
    assert.equal(
      validation({ comments: [comment(approvalRecord(), { login: null })] })
        .diagnostics[0].code,
      'GROWTH_APPROVAL_MISSING'
    );
    assert.equal(
      validation({ comments: [comment(approvalRecord(), { association: 'NONE' })] })
        .diagnostics[0].code,
      'GROWTH_APPROVAL_MISSING'
    );

    const unavailable = validateGrowthApproval({
      baseReport: report([{ path: 'dist/over.js', size: 100 }]),
      comments: snapshot([], 'unavailable'),
      currentReport: report([{ path: 'dist/over.js', size: 102 }]),
      evidenceComments: evidenceSnapshot(),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });
    assert.equal(unavailable.status, 'blocked');
    assert.equal(unavailable.diagnostics[0].code, 'GROWTH_APPROVAL_COMMENTS_UNAVAILABLE');
  });

  test('ignores malformed and stale records when one exact-head approval is valid', () => {
    const malformed = comment(approvalRecord());
    malformed.body = malformed.body.replace('```json', '```');
    const stale = approvalRecord();
    stale.headSha = 'abcdef1234567890abcdef1234567890abcdef12';
    const result = validation({
      comments: [malformed, comment(stale, { id: 2 }), comment(approvalRecord(), { id: 3 })],
    });

    assert.equal(result.status, 'approved');
    assert.deepEqual(result.ignored.map(({ reason }) => reason), [
      'malformed-record',
      'stale-head',
    ]);
  });

  test('ignores forged approvals when one trusted exact-head approval is valid', () => {
    const result = validation({
      comments: [
        comment(approvalRecord(), { association: 'NONE', id: 1 }),
        comment(approvalRecord(), { id: 2 }),
      ],
    });

    assert.equal(result.status, 'approved');
    assert.deepEqual(result.ignored.map(({ reason }) => reason), ['unauthorized-author']);
  });

  test('rejects duplicate exact-head approvals and path mismatches', () => {

    assert.equal(
      validation({ comments: [comment(approvalRecord(), { id: 1 }), comment(approvalRecord(), { id: 2 })] })
        .diagnostics[0].code,
      'GROWTH_APPROVAL_AMBIGUOUS'
    );

    const extra = approvalRecord(['dist/over.js', 'dist/unknown.js']);
    assert.equal(
      validation({ comments: [comment(extra)] }).diagnostics[0].code,
      'GROWTH_APPROVAL_PATH_SET_MISMATCH'
    );

    const missing = validation({
      base: [
        { name: 'Over', path: 'dist/over.js', size: 100 },
        { name: 'Second', path: 'dist/second.js', size: 100 },
      ],
      comments: [comment(approvalRecord(['dist/over.js']))],
      current: [
        { name: 'Over', path: 'dist/over.js', size: 102 },
        { name: 'Second', path: 'dist/second.js', size: 102 },
      ],
    });
    assert.equal(missing.diagnostics[0].code, 'GROWTH_APPROVAL_PATH_SET_MISMATCH');
    assert.match(missing.diagnostics[0].message, /missing: dist\/second\.js; extra: none/);
  });

  test('allows collaborator evidence but rejects foreign comments and unresolved evidence', () => {
    const foreign = comment(approvalRecord(), { pullRequest: 2 });
    assert.equal(
      validation({ comments: [foreign] }).diagnostics[0].code,
      'GROWTH_APPROVAL_COMMENT_IDENTITY'
    );

    const unresolved = validateGrowthApproval({
      baseReport: report([{ path: 'dist/over.js', size: 100 }]),
      comments: snapshot([comment(approvalRecord())]),
      currentReport: report([{ path: 'dist/over.js', size: 102 }]),
      evidenceComments: evidenceSnapshot([]),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });
    assert.equal(unresolved.status, 'invalid');
    assert.equal(unresolved.diagnostics[0].code, 'GROWTH_APPROVAL_EVIDENCE_MISSING');

    const collaboratorEvidence = validation({
      evidence: [evidenceComment({ association: 'COLLABORATOR' })],
    });
    assert.equal(collaboratorEvidence.status, 'approved');

    const untrustedEvidence = validateGrowthApproval({
      baseReport: report([{ path: 'dist/over.js', size: 100 }]),
      comments: snapshot([comment(approvalRecord())]),
      currentReport: report([{ path: 'dist/over.js', size: 102 }]),
      evidenceComments: evidenceSnapshot([evidenceComment({ association: 'NONE' })]),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });
    assert.equal(untrustedEvidence.status, 'invalid');
    assert.equal(
      untrustedEvidence.diagnostics[0].code,
      'GROWTH_APPROVAL_EVIDENCE_MISSING'
    );

    const missingEvidenceAssociation = validateGrowthApproval({
      baseReport: report([{ path: 'dist/over.js', size: 100 }]),
      comments: snapshot([comment(approvalRecord())]),
      currentReport: report([{ path: 'dist/over.js', size: 102 }]),
      evidenceComments: evidenceSnapshot([evidenceComment({ association: null })]),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });
    assert.equal(missingEvidenceAssociation.status, 'invalid');
    assert.equal(
      missingEvidenceAssociation.diagnostics[0].code,
      'GROWTH_APPROVAL_EVIDENCE_MISSING'
    );
  });

  test('rejects abbreviated pull request and approval head SHAs', () => {
    const prefix = headSha.slice(0, 12);
    assert.equal(
      validation({ currentHead: prefix }).diagnostics[0].code,
      'GROWTH_APPROVAL_PULL_REQUEST_HEAD'
    );

    const abbreviated = approvalRecord();
    abbreviated.headSha = prefix;
    assert.equal(
      validation({ comments: [comment(abbreviated)] }).diagnostics[0].code,
      'GROWTH_APPROVAL_MISSING'
    );
  });

  test('does not need comment access when no existing artifact crosses the threshold', () => {
    const result = validateGrowthApproval({
      baseReport: report([{ path: 'dist/over.js', size: 100 }]),
      comments: snapshot([], 'unavailable'),
      currentReport: report([{ path: 'dist/over.js', size: 101 }]),
      evidenceComments: evidenceSnapshot([], 'unavailable'),
      headSha,
      policy,
      pullRequestNumber,
      thresholdPercent: 1,
    });

    assert.equal(result.status, 'not-required');
    assert.deepEqual(result.diagnostics, []);
  });

  test('emits structured JSON and exit status from the offline CLI', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-growth-approval-'));
    const paths = {
      base: join(fixtureRoot, 'base.json'),
      candidate: join(fixtureRoot, 'candidate.json'),
      comments: join(fixtureRoot, 'comments.json'),
      contract: join(fixtureRoot, 'contract.json'),
      current: join(fixtureRoot, 'current.json'),
      evidence: join(fixtureRoot, 'evidence.json'),
    };
    const cli = join(root, 'scripts/performance/growth-approval.mjs');
    const offlineEnv = { ...process.env };
    delete offlineEnv.GITHUB_ACTIONS;
    delete offlineEnv.GITHUB_EVENT_PATH;
    const runCli = cliArgs => spawnSync(process.execPath, cliArgs, {
      encoding: 'utf8',
      env: offlineEnv,
    });
    const checkoutHead = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout.trim();
    const cliApproval = approvalRecord(['dist/main.js']);
    cliApproval.headSha = checkoutHead;
    const args = [
      cli,
      '--contract', paths.contract,
      '--base-report', paths.base,
      '--current-report', paths.current,
      '--comments', paths.comments,
      '--evidence-comments', paths.evidence,
      '--head-sha', checkoutHead,
      '--pull-request', String(pullRequestNumber),
    ];

    try {
      await Promise.all([
        writeFile(paths.contract, JSON.stringify(growthContract())),
        writeFile(paths.base, JSON.stringify(productionReport())),
        writeFile(paths.current, JSON.stringify(grownProductionReport())),
        writeFile(paths.comments, JSON.stringify(snapshot([comment(cliApproval)]))),
        writeFile(paths.evidence, JSON.stringify(evidenceSnapshot())),
      ]);

      const approved = runCli(args);
      assert.equal(approved.status, 0);
      assert.equal(JSON.parse(approved.stdout).status, 'approved');

      const newProduction = {
        artifacts: [{ path: 'dist/feature.js', size: 4 }],
        subpaths: ['./feature'],
      };
      const cliNewApproval = approvalRecord([], newProduction);
      cliNewApproval.headSha = checkoutHead;
      await Promise.all([
        writeFile(paths.contract, JSON.stringify(growthContract())),
        writeFile(paths.candidate, JSON.stringify(candidateGrowthContract())),
        writeFile(paths.base, JSON.stringify(productionReport())),
        writeFile(paths.current, JSON.stringify(productionReport({ includeFeature: true }))),
        writeFile(paths.comments, JSON.stringify(snapshot([comment(cliNewApproval)]))),
      ]);
      const beforeActivation = runCli(args);
      assert.equal(beforeActivation.status, 1);
      assert.equal(JSON.parse(beforeActivation.stdout).status, 'blocked');
      assert.equal(JSON.parse(beforeActivation.stdout).newProductionEnforced, false);

      const newSubpath = runCli([
        ...args,
        '--candidate-contract', paths.candidate,
      ]);
      assert.equal(newSubpath.status, 0);
      assert.deepEqual(JSON.parse(newSubpath.stdout).newSubpaths, ['./feature']);

      await Promise.all([
        writeFile(paths.contract, JSON.stringify(growthContract())),
        writeFile(paths.base, JSON.stringify(productionReport())),
        writeFile(paths.current, JSON.stringify(grownProductionReport())),
        writeFile(paths.comments, JSON.stringify(snapshot([comment(cliApproval)]))),
      ]);

      const mismatchedArgs = [...args];
      mismatchedArgs[mismatchedArgs.indexOf('--head-sha') + 1] = headSha;
      const mismatchedHead = runCli(mismatchedArgs);
      assert.equal(mismatchedHead.status, 1);
      assert.match(
        JSON.parse(mismatchedHead.stdout).diagnostics[0].message,
        /does not match checkout/
      );

      await writeFile(paths.comments, JSON.stringify(snapshot([])));
      const missing = runCli(args);
      assert.equal(missing.status, 1);
      assert.equal(JSON.parse(missing.stdout).diagnostics[0].code, 'GROWTH_APPROVAL_MISSING');

      const invalidInput = runCli([cli]);
      assert.equal(invalidInput.status, 1);
      assert.equal(
        JSON.parse(invalidInput.stdout).diagnostics[0].code,
        'GROWTH_APPROVAL_INPUT'
      );
      assert.match(
        JSON.parse(invalidInput.stdout).diagnostics[0].message,
        /Missing value for --head-sha/
      );

      const invalidPullRequest = runCli([
        ...args.slice(0, -1), '1e2',
      ]);
      assert.equal(invalidPullRequest.status, 1);
      assert.match(
        JSON.parse(invalidPullRequest.stdout).diagnostics[0].message,
        /positive integer/
      );
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});

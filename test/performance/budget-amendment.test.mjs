import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  bootstrapBudgetAmendmentLedger,
  committedCheckoutChanges,
  evaluateBudgetAmendmentFromCheckouts,
  formatBudgetAmendmentLedger,
  formatBudgetAmendmentApproval,
  parseBudgetAmendmentLedger,
  readCommittedBudgetFile,
  validateBudgetAmendmentTransition,
} from '../../config/release/performance-budget-amendments.mjs';

const initialCeiling = 51975;
const proposedCeiling = 53000;
const baseReportPath = 'evidence/performance-budget-amendments/BA0001/base.json';
const prototypeContractPath =
  'evidence/performance-budget-amendments/BA0001/prototype-contract.json';
const reportPath = 'evidence/performance-budget-amendments/BA0001/prototype.json';
const baseReportHash = '0'.repeat(64);
const prototypeContractHash = '2'.repeat(64);
const reportHash = '1'.repeat(64);
const headSha = '9999999990abcdef1234567890abcdef12345678';
const root = fileURLToPath(new URL('../..', import.meta.url));

function contract(ceiling = initialCeiling) {
  return {
    schemaVersion: 1,
    baseline: {
      sourceCommit: '31151c9cb5cb1e11d30da4332f58ca8b56cf2fe4',
      brotliQuality: 11,
      totalBrotliBytes: 49500,
      absoluteCeilingBytes: ceiling,
    },
    thresholds: {
      cumulativeGrowthPercent: 5,
    },
    pullRequestGrowthApproval: {
      repository: 'marionettejs/marionette',
      trackingIssueUrl: 'https://github.com/marionettejs/marionette/issues/127',
      allowedLogins: ['paulfalgout'],
    },
    runtimeArtifacts: [{
      name: 'Main',
      path: 'dist/marionette.js',
      baselineBrotliBytes: 49500,
    }],
    productionGraphs: [{
      subpath: '.',
      input: 'index.js',
      output: 'dist/marionette.js',
      baselineModules: ['index.js'],
      baselineExternalImports: [],
    }],
    forbiddenProductionModulePrefixes: ['test/'],
    forbiddenProductionModules: ['config/performance.json'],
  };
}

function amendment(overrides = {}) {
  return {
    kind: 'authorization',
    id: 'BA0001',
    target: 'aggregate-shipped-package',
    previousCeilingBytes: initialCeiling,
    proposedCeilingBytes: proposedCeiling,
    prototypeBaseCommit: 'abcdef1234567890abcdef1234567890abcdef12',
    prototypeCommit: '1234567890abcdef1234567890abcdef12345678',
    implementationIssueUrl: 'https://github.com/marionettejs/marionette/issues/205',
    authorizedArtifactPaths: ['dist/marionette.js'],
    authorizedNewSubpaths: [],
    reports: [
      { path: baseReportPath, role: 'base', sha256: baseReportHash },
      { path: reportPath, role: 'prototype', sha256: reportHash },
    ],
    prototypeContract: {
      path: prototypeContractPath,
      sha256: prototypeContractHash,
    },
    approvalUrls: [
      'https://github.com/marionettejs/marionette/pull/1#issuecomment-100',
    ],
    evidenceUrls: [
      'https://github.com/marionettejs/marionette/issues/127#issuecomment-101',
    ],
    rationale: 'The measured prototype needs a bounded aggregate package increase.',
    rollbackCondition: 'Remove the unconsumed authorization if the implementation is abandoned.',
    ...overrides,
  };
}

function ledger(entries = []) {
  return { schemaVersion: 1, entries };
}

function revocation() {
  return {
    kind: 'revocation',
    id: 'BR0001',
    amendmentId: 'BA0001',
    approvalUrls: [
      'https://github.com/marionettejs/marionette/pull/1#issuecomment-300',
    ],
    evidenceUrls: [
      'https://github.com/marionettejs/marionette/issues/127#issuecomment-301',
    ],
    rationale: 'The implementation was abandoned before consuming the authorization.',
  };
}

function measuredReport(size, { ceiling = initialCeiling, subpaths = ['.'] } = {}) {
  return {
    schemaVersion: 1,
    baselineSourceCommit: '31151c9cb5cb1e11d30da4332f58ca8b56cf2fe4',
    brotliQuality: 11,
    thresholds: { cumulativeGrowthPercent: 5 },
    artifacts: [{ name: 'Main', path: 'dist/marionette.js', status: 'measured', size }],
    cumulative: { size, baselineSize: 49500, absoluteCeiling: ceiling },
    graphs: subpaths.map(subpath => ({
      subpath,
      input: subpath === '.' ? 'index.js' : 'feature.js',
      output: 'dist/marionette.js',
      status: 'measured',
      modules: ['index.js'],
      externalImports: [],
      forbiddenModules: [],
    })),
    violations: size > ceiling ? [
      `Cumulative Brotli-11 size ${size} exceeds the absolute ceiling ${ceiling}`,
    ] : [],
  };
}

function evidenceReports() {
  return {
    [baseReportPath]: {
      schemaVersion: 1,
      revision: 'abcdef1234567890abcdef1234567890abcdef12',
      report: measuredReport(51000),
    },
    [reportPath]: {
      schemaVersion: 1,
      revision: '1234567890abcdef1234567890abcdef12345678',
      report: measuredReport(52000),
    },
    [prototypeContractPath]: contract(),
  };
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeRepositoryFiles(repository, files) {
  for (const [path, contents] of Object.entries(files)) {
    const target = join(repository, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
}

function git(repository, args) {
  const result = spawnSync('git', args, { cwd: repository, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function commitRepository(repository, files) {
  await mkdir(repository, { recursive: true });
  git(repository, ['init']);
  git(repository, ['config', 'user.email', 'test@example.com']);
  git(repository, ['config', 'user.name', 'Test']);
  await writeRepositoryFiles(repository, files);
  git(repository, ['add', '.']);
  git(repository, ['commit', '-m', 'test: performance budget fixture']);
  return git(repository, ['rev-parse', 'HEAD']);
}

function governanceComments(record, approvalHead) {
  const comments = trustedComments();
  comments.approval.comments = [{
    ...comments.approval.comments[0],
    body: formatBudgetAmendmentApproval(record, approvalHead),
  }];
  return comments;
}

async function removeFixture(path) {
  await rm(path, {
    force: true,
    maxRetries: 5,
    recursive: true,
    retryDelay: 50,
  });
}

function evidenceHashes() {
  return {
    [baseReportPath]: baseReportHash,
    [prototypeContractPath]: prototypeContractHash,
    [reportPath]: reportHash,
  };
}

function trustedComments({ approvalLogin = 'paulfalgout', evidenceAssociation = 'MEMBER' } = {}) {
  const authorization = amendment();
  const revoked = revocation();
  return {
    approval: {
      schemaVersion: 1,
      status: 'ok',
      repository: 'marionettejs/marionette',
      pullRequestNumber: 1,
      comments: [
        {
          id: 100,
          'author_association': 'OWNER',
          'html_url': 'https://github.com/marionettejs/marionette/pull/1#issuecomment-100',
          body: formatBudgetAmendmentApproval(authorization, headSha),
          user: { login: approvalLogin, type: 'User' },
        },
        {
          id: 300,
          'author_association': 'OWNER',
          'html_url': 'https://github.com/marionettejs/marionette/pull/1#issuecomment-300',
          body: formatBudgetAmendmentApproval(revoked, headSha),
          user: { login: approvalLogin, type: 'User' },
        },
      ],
    },
    evidence: {
      schemaVersion: 1,
      status: 'ok',
      repository: 'marionettejs/marionette',
      issueNumber: 127,
      comments: [
        {
          id: 101,
          'author_association': evidenceAssociation,
          'html_url': 'https://github.com/marionettejs/marionette/issues/127#issuecomment-101',
          user: { login: 'evidence-author', type: 'User' },
        },
        {
          id: 301,
          'author_association': evidenceAssociation,
          'html_url': 'https://github.com/marionettejs/marionette/issues/127#issuecomment-301',
          user: { login: 'evidence-author', type: 'User' },
        },
      ],
    },
  };
}

function transition({
  authorityContract = contract(),
  authorityLedger = ledger(),
  candidateContract = contract(),
  candidateLedger = ledger(),
  changedFiles = [],
  changedFileEntries,
  currentReport,
  baseReport,
  evidence = evidenceReports(),
  comments = trustedComments(),
  reportHashes = evidenceHashes(),
  currentHead = headSha,
} = {}) {
  return validateBudgetAmendmentTransition({
    authorityContract,
    authorityLedger,
    candidateContract,
    candidateLedger,
    changedFileEntries,
    changedFiles,
    currentReport,
    baseReport,
    approvalComments: comments.approval,
    evidenceComments: comments.evidence,
    evidenceReports: evidence,
    headSha: currentHead,
    pullRequestNumber: 1,
    reportHashes,
  });
}

describe('two-stage performance budget amendments', () => {
  test('parses only the canonical versioned ledger', () => {
    const value = ledger([amendment()]);
    const text = formatBudgetAmendmentLedger(value);

    assert.deepEqual(parseBudgetAmendmentLedger(text), value);
    assert.throws(() => parseBudgetAmendmentLedger(text.trim()), /canonical JSON/);
    assert.throws(
      () => parseBudgetAmendmentLedger(text.replace('"schemaVersion": 1,',
        '"schemaVersion": 1,\n  "schemaVersion": 1,')),
      /canonical JSON/
    );
  });

  test('binds committed change discovery to the exact candidate HEAD', async() => {
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout.trim();
    assert.deepEqual(await committedCheckoutChanges(root, root, head), {
      entries: {},
      paths: [],
    });
    await assert.rejects(
      committedCheckoutChanges(root, root, '0'.repeat(40)),
      /does not match checkout/
    );
    await assert.rejects(
      committedCheckoutChanges(root, root, head, '0'.repeat(40)),
      /does not match authority checkout/
    );
  });

  test('pins the one-time missing-ledger bootstrap to the reviewed base', () => {
    assert.deepEqual(
      bootstrapBudgetAmendmentLedger('154a8bb43f81a1836fcd70c014f4301e750bcb77'),
      ledger()
    );
    assert.throws(
      () => bootstrapBudgetAmendmentLedger('0'.repeat(40)),
      /Missing exact-base budget-amendment ledger/
    );
  });

  test('reads authority inputs from the verified committed blob, not dirty worktree data', async() => {
    const fixture = await mkdtemp(join(tmpdir(), 'marionette-budget-git-'));
    try {
      for (const args of [
        ['init'],
        ['config', 'user.email', 'test@example.com'],
        ['config', 'user.name', 'Test'],
      ]) {
        assert.equal(spawnSync('git', args, { cwd: fixture }).status, 0);
      }
      await writeFile(join(fixture, 'ledger.json'), 'committed\n');
      assert.equal(spawnSync('git', ['add', 'ledger.json'], { cwd: fixture }).status, 0);
      assert.equal(spawnSync('git', ['commit', '-m', 'test: fixture'], {
        cwd: fixture,
      }).status, 0);
      const head = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: fixture,
        encoding: 'utf8',
      }).stdout.trim();
      await writeFile(join(fixture, 'ledger.json'), 'dirty\n');

      assert.equal(
        (await readCommittedBudgetFile(fixture, 'ledger.json', head)).toString('utf8'),
        'committed\n'
      );
    } finally {
      await removeFixture(fixture);
    }
  });

  test('accepts an authorization append without changing the active ceiling', () => {
    const record = amendment();
    const result = transition({
      candidateLedger: ledger([record]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        'docs/performance-baselines.md',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    });

    assert.equal(result.status, 'accepted', result.diagnostics.join('\n'));
    assert.equal(result.mode, 'authorize');
    assert.equal(result.amendment.id, 'BA0001');
    assert.equal(result.activeCeilingBytes, initialCeiling);
    assert.equal(result.requiresExactHeadGrowthApproval, false);
  });

  test('accepts later consumption only from a merged pending authority record', () => {
    const record = amendment();
    const result = transition({
      authorityLedger: ledger([record]),
      candidateContract: contract(proposedCeiling),
      candidateLedger: ledger([record]),
      baseReport: measuredReport(51000),
      currentReport: measuredReport(52000, { ceiling: proposedCeiling }),
      changedFiles: ['config/performance.json', 'modules/feature.js'],
    });

    assert.equal(result.status, 'accepted');
    assert.equal(result.mode, 'consume');
    assert.equal(result.amendment.id, 'BA0001');
    assert.equal(result.activeCeilingBytes, proposedCeiling);
    assert.equal(result.requiresExactHeadGrowthApproval, true);
  });

  test('evaluates committed authorization then exact consumption across Git repositories', async() => {
    const fixture = await mkdtemp(join(tmpdir(), 'marionette-budget-integration-'));
    const baseRoot = join(fixture, 'base');
    const authorizationRoot = join(fixture, 'authorization');
    const consumptionRoot = join(fixture, 'consumption');
    const baseFiles = {
      'config/performance.json': jsonText(contract()),
      'config/release/performance-budget-amendments.json':
        formatBudgetAmendmentLedger(ledger()),
      'docs/performance-baselines.md': 'Performance baseline fixture.\n',
    };

    try {
      const baseHead = await commitRepository(baseRoot, baseFiles);
      const prototypeCommit = '1'.repeat(40);
      const baseEvidence = jsonText({
        schemaVersion: 1,
        revision: baseHead,
        report: measuredReport(51000),
      });
      const prototypeEvidence = jsonText({
        schemaVersion: 1,
        revision: prototypeCommit,
        report: measuredReport(52000),
      });
      const prototypeContract = jsonText(contract());
      const record = amendment({
        prototypeBaseCommit: baseHead,
        prototypeCommit,
        reports: [
          { path: baseReportPath, role: 'base', sha256: sha256(baseEvidence) },
          { path: reportPath, role: 'prototype', sha256: sha256(prototypeEvidence) },
        ],
        prototypeContract: {
          path: prototypeContractPath,
          sha256: sha256(prototypeContract),
        },
      });
      const evidenceFiles = {
        [baseReportPath]: baseEvidence,
        [prototypeContractPath]: prototypeContract,
        [reportPath]: prototypeEvidence,
      };
      const authorizationHead = await commitRepository(authorizationRoot, {
        ...baseFiles,
        'config/release/performance-budget-amendments.json':
          formatBudgetAmendmentLedger(ledger([record])),
        ...evidenceFiles,
      });
      const comments = governanceComments(record, authorizationHead);
      const authorization = await evaluateBudgetAmendmentFromCheckouts({
        approvalComments: comments.approval,
        authorityContract: contract(),
        authorityContractPath: join(baseRoot, 'config/performance.json'),
        baseReport: measuredReport(51000),
        candidateContract: contract(),
        candidateRoot: authorizationRoot,
        currentReport: measuredReport(51000),
        evidenceComments: comments.evidence,
        expectedBaseHead: baseHead,
        headSha: authorizationHead,
        pullRequestNumber: 1,
      });
      assert.equal(authorization.status, 'accepted', authorization.diagnostics.join('\n'));
      assert.equal(authorization.mode, 'authorize');

      const consumptionHead = await commitRepository(consumptionRoot, {
        ...baseFiles,
        'config/performance.json': jsonText(contract(proposedCeiling)),
        'config/release/performance-budget-amendments.json':
          formatBudgetAmendmentLedger(ledger([record])),
        'modules/feature.js': 'export const feature = true;\n',
        ...evidenceFiles,
      });
      await writeFile(
        join(consumptionRoot, 'config/release/performance-budget-amendments.json'),
        'dirty worktree data\n'
      );
      await writeFile(join(consumptionRoot, reportPath), 'dirty worktree data\n');
      const consumption = await evaluateBudgetAmendmentFromCheckouts({
        approvalComments: comments.approval,
        authorityContract: contract(),
        authorityContractPath: join(authorizationRoot, 'config/performance.json'),
        baseReport: measuredReport(51000),
        candidateContract: contract(proposedCeiling),
        candidateRoot: consumptionRoot,
        currentReport: measuredReport(52000, { ceiling: proposedCeiling }),
        evidenceComments: comments.evidence,
        expectedBaseHead: authorizationHead,
        headSha: consumptionHead,
        pullRequestNumber: 1,
      });
      assert.equal(consumption.status, 'accepted', consumption.diagnostics.join('\n'));
      assert.equal(consumption.mode, 'consume');
    } finally {
      await removeFixture(fixture);
    }
  });

  test('rejects adding and consuming an authorization in one pull request', () => {
    const record = amendment();
    const result = transition({
      candidateContract: contract(proposedCeiling),
      candidateLedger: ledger([record]),
      changedFiles: ['config/release/performance-budget-amendments.json', 'config/performance.json'],
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    });

    assert.equal(result.status, 'rejected');
    assert.match(result.diagnostics.join('\n'), /cannot add and consume/i);
  });

  test('rejects record edits, deletion, reordering, and identifier reuse', () => {
    const first = amendment();
    const second = amendment({
      id: 'BA0002',
      previousCeilingBytes: proposedCeiling,
      proposedCeilingBytes: 54000,
      prototypeCommit: 'abcdef1234567890abcdef1234567890abcdef12',
      prototypeBaseCommit: '1234567890abcdef1234567890abcdef12345678',
      implementationIssueUrl: 'https://github.com/marionettejs/marionette/issues/206',
      reports: [
        {
          path: 'evidence/performance-budget-amendments/BA0002/base.json',
          role: 'base',
          sha256: '2'.repeat(64),
        },
        {
          path: 'evidence/performance-budget-amendments/BA0002/prototype.json',
          role: 'prototype',
          sha256: '3'.repeat(64),
        },
      ],
      prototypeContract: {
        path: 'evidence/performance-budget-amendments/BA0002/prototype-contract.json',
        sha256: '4'.repeat(64),
      },
      approvalUrls: [
        'https://github.com/marionettejs/marionette/pull/1#issuecomment-200',
      ],
      evidenceUrls: [
        'https://github.com/marionettejs/marionette/issues/127#issuecomment-201',
      ],
    });
    const authorityLedger = ledger([first, second]);

    for (const candidateLedger of [
      ledger([amendment({ rationale: 'Rewritten.' }), second]),
      ledger([first]),
      ledger([second, first]),
      ledger([first, { ...second, id: 'BA0001' }]),
    ]) {
      const result = transition({ authorityLedger, candidateLedger });
      assert.equal(result.status, 'rejected');
    }
  });

  test('rejects multiple pending records and a broken ceiling chain', () => {
    const second = amendment({
      id: 'BA0002',
      previousCeilingBytes: proposedCeiling,
      proposedCeilingBytes: 54000,
      prototypeCommit: 'abcdef1234567890abcdef1234567890abcdef12',
      prototypeBaseCommit: '1234567890abcdef1234567890abcdef12345678',
      implementationIssueUrl: 'https://github.com/marionettejs/marionette/issues/206',
      reports: [
        {
          path: 'evidence/performance-budget-amendments/BA0002/base.json',
          role: 'base',
          sha256: '2'.repeat(64),
        },
        {
          path: 'evidence/performance-budget-amendments/BA0002/prototype.json',
          role: 'prototype',
          sha256: '3'.repeat(64),
        },
      ],
      prototypeContract: {
        path: 'evidence/performance-budget-amendments/BA0002/prototype-contract.json',
        sha256: '4'.repeat(64),
      },
      approvalUrls: [
        'https://github.com/marionettejs/marionette/pull/1#issuecomment-200',
      ],
      evidenceUrls: [
        'https://github.com/marionettejs/marionette/issues/127#issuecomment-201',
      ],
    });

    assert.equal(transition({
      authorityLedger: ledger([amendment(), second]),
      candidateLedger: ledger([amendment(), second]),
    }).status, 'rejected');

    assert.match(transition({
      authorityLedger: ledger([amendment({ previousCeilingBytes: 50000 })]),
      candidateLedger: ledger([amendment({ previousCeilingBytes: 50000 })]),
    }).diagnostics.join('\n'), /previous ceiling/i);
  });

  test('rejects unauthorized ceiling changes and immutable baseline rewrites', () => {
    assert.match(transition({
      candidateContract: contract(53000),
    }).diagnostics.join('\n'), /pending exact-base amendment/i);

    const rewritten = contract();
    rewritten.baseline.totalBrotliBytes = 49000;
    assert.match(transition({
      candidateContract: rewritten,
    }).diagnostics.join('\n'), /immutable Phase 0 baseline/i);
  });

  test('rejects report hash mismatches and authorization pull request scope escapes', () => {
    const record = amendment();
    const options = {
      candidateLedger: ledger([record]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: 'f'.repeat(64),
      },
    };

    assert.match(transition(options).diagnostics.join('\n'), /SHA-256/i);
    assert.match(transition({
      ...options,
      changedFiles: [...options.changedFiles, 'modules/view.js'],
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    }).diagnostics.join('\n'), /authorization pull request may change only/i);

    assert.match(transition({
      ...options,
      changedFileEntries: {
        'config/release/performance-budget-amendments.json': {
          candidateMode: '100644', status: 'modified',
        },
        [baseReportPath]: { candidateMode: '120000', status: 'added' },
        [prototypeContractPath]: { candidateMode: '100644', status: 'added' },
        [reportPath]: { candidateMode: '100644', status: 'added' },
      },
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    }).diagnostics.join('\n'), /regular committed/);
  });

  test('revalidates immutable evidence hashes after authorization is merged', () => {
    const record = amendment();
    const ordinary = transition({
      authorityLedger: ledger([record]),
      candidateLedger: ledger([record]),
      changedFiles: [reportPath],
      reportHashes: {
        ...evidenceHashes(),
        [reportPath]: 'f'.repeat(64),
      },
    });
    assert.match(ordinary.diagnostics.join('\n'), /SHA-256/i);

    const consumption = transition({
      authorityLedger: ledger([record]),
      candidateContract: contract(proposedCeiling),
      candidateLedger: ledger([record]),
      baseReport: measuredReport(51000),
      currentReport: measuredReport(52000, { ceiling: proposedCeiling }),
      reportHashes: {
        ...evidenceHashes(),
        [prototypeContractPath]: 'f'.repeat(64),
      },
    });
    assert.match(consumption.diagnostics.join('\n'), /SHA-256/i);
  });

  test('derives the complete authorization scope and ceiling from prototype evidence', () => {
    const wrongScope = amendment({ authorizedArtifactPaths: ['dist/other.js'] });
    assert.match(transition({
      candidateLedger: ledger([wrongScope]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    }).diagnostics.join('\n'), /prototype artifact scope/i);

    const belowOldCeiling = evidenceReports();
    belowOldCeiling[reportPath].report = measuredReport(51900);
    assert.match(transition({
      candidateLedger: ledger([amendment()]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      evidence: belowOldCeiling,
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    }).diagnostics.join('\n'), /must exceed the previous ceiling/i);

    const artifactWithoutSubpath = evidenceReports();
    artifactWithoutSubpath[prototypeContractPath].runtimeArtifacts.push({
      name: 'Feature',
      path: 'dist/feature.js',
      baselineBrotliBytes: 0,
    });
    artifactWithoutSubpath[reportPath].report.artifacts.push({
      name: 'Feature',
      path: 'dist/feature.js',
      status: 'measured',
      size: 4,
    });
    artifactWithoutSubpath[reportPath].report.cumulative.size = 52004;
    artifactWithoutSubpath[reportPath].report.violations = [
      `Cumulative Brotli-11 size 52004 exceeds the absolute ceiling ${initialCeiling}`,
    ];
    assert.match(transition({
      candidateLedger: ledger([amendment({
        authorizedArtifactPaths: ['dist/feature.js', 'dist/marionette.js'],
      })]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      evidence: artifactWithoutSubpath,
    }).diagnostics.join('\n'), /new runtime artifact without a new production subpath/i);
  });

  test('requires approval and evidence URLs to resolve to trusted issue comments', () => {
    const options = {
      candidateLedger: ledger([amendment()]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    };
    const padded = trustedComments();
    padded.approval.comments[0].body += '\n\n \t';
    assert.equal(transition({
      ...options,
      changedFiles: [
        ...options.changedFiles,
        'docs/performance-baselines.md',
      ],
      comments: padded,
    }).status, 'accepted');
    assert.match(transition({
      ...options,
      comments: trustedComments({ approvalLogin: 'attacker' }),
    }).diagnostics.join('\n'), /approval URL.*exact-head maintainer/i);
    assert.match(transition({
      ...options,
      comments: trustedComments({ evidenceAssociation: 'NONE' }),
    }).diagnostics.join('\n'), /evidence URL.*trusted comment/i);

    const arbitrary = trustedComments();
    arbitrary.approval.comments[0].body = 'unrelated maintainer comment';
    assert.match(transition({
      ...options,
      comments: arbitrary,
    }).diagnostics.join('\n'), /canonical exact-head maintainer approval/i);

    const ambiguous = trustedComments();
    ambiguous.approval.comments.push({
      ...ambiguous.approval.comments[0],
      id: 102,
      'html_url': 'https://github.com/marionettejs/marionette/pull/1#issuecomment-102',
    });
    assert.match(transition({
      ...options,
      comments: ambiguous,
    }).diagnostics.join('\n'), /exactly one canonical/i);
  });

  test('rejects unsafe ceilings and structurally incomplete prototype reports', () => {
    assert.match(transition({
      candidateLedger: ledger([amendment({ proposedCeilingBytes: Number.MAX_VALUE })]),
    }).diagnostics.join('\n'), /non-negative integer previous ceiling/i);

    const missingGraph = evidenceReports();
    missingGraph[reportPath].report.graphs = [];
    assert.match(transition({
      candidateLedger: ledger([amendment()]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      evidence: missingGraph,
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    }).diagnostics.join('\n'), /graph set mismatch/i);
  });

  test('rejects unsafe prototype contract and source paths', () => {
    const unsafeContractPath = amendment({
      prototypeContract: {
        path: 'evidence/performance-budget-amendments/BA0001/bad\\name.json',
        sha256: prototypeContractHash,
      },
    });
    assert.match(transition({
      candidateLedger: ledger([unsafeContractPath]),
    }).diagnostics.join('\n'), /prototypeContract must use a safe immutable JSON path/i);

    const unsafeSource = evidenceReports();
    unsafeSource[prototypeContractPath].productionGraphs.push({
      subpath: './unsafe',
      input: 'modules/../unsafe.js',
      output: 'dist/marionette.js',
      baselineModules: [],
      baselineExternalImports: [],
    });
    unsafeSource[reportPath].report.graphs.push({
      subpath: './unsafe',
      input: 'modules/../unsafe.js',
      output: 'dist/marionette.js',
      status: 'measured',
      modules: ['unsafe.js'],
      externalImports: [],
      forbiddenModules: [],
    });
    assert.match(transition({
      candidateLedger: ledger([amendment({ authorizedNewSubpaths: ['./unsafe'] })]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      evidence: unsafeSource,
    }).diagnostics.join('\n'), /new graph .* invalid additive contract/i);
  });

  test('requires a consuming implementation to use the authorized measured scope', () => {
    const record = amendment();
    const accepted = transition({
      authorityLedger: ledger([record]),
      candidateContract: contract(proposedCeiling),
      candidateLedger: ledger([record]),
      baseReport: measuredReport(51000),
      currentReport: measuredReport(52000, { ceiling: proposedCeiling }),
    });
    assert.equal(accepted.status, 'accepted');

    const noGrowth = transition({
      authorityLedger: ledger([record]),
      candidateContract: contract(proposedCeiling),
      candidateLedger: ledger([record]),
      baseReport: measuredReport(51000),
      currentReport: measuredReport(51000, { ceiling: proposedCeiling }),
    });
    assert.match(noGrowth.diagnostics.join('\n'), /must exceed the previous ceiling/i);

    const wrongSubpath = transition({
      authorityLedger: ledger([record]),
      candidateContract: contract(proposedCeiling),
      candidateLedger: ledger([record]),
      baseReport: measuredReport(51000),
      currentReport: measuredReport(52000, {
        ceiling: proposedCeiling,
        subpaths: ['.', './feature'],
      }),
    });
    assert.match(wrongSubpath.diagnostics.join('\n'), /graph set mismatch/i);
  });

  test('rejects malformed fields and unsupported consumer-scenario targets', () => {
    const malformed = amendment({
      target: 'consumer-scenario',
      authorizedArtifactPaths: ['../escape.js'],
      authorizedNewSubpaths: ['./bad/../path'],
      unexpected: true,
    });
    const result = transition({
      candidateLedger: ledger([malformed]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        baseReportPath,
        prototypeContractPath,
        reportPath,
      ],
      reportHashes: {
        [baseReportPath]: baseReportHash,
        [prototypeContractPath]: prototypeContractHash,
        [reportPath]: reportHash,
      },
    });

    assert.equal(result.status, 'rejected');
    assert.match(result.diagnostics.join('\n'), /aggregate-shipped-package/);
    assert.match(result.diagnostics.join('\n'), /fields/);
  });

  test('allows an append-only governance revocation to clear an abandoned pending record', () => {
    const record = amendment();
    const revoked = revocation();
    const result = transition({
      authorityLedger: ledger([record]),
      candidateLedger: ledger([record, revoked]),
      changedFiles: [
        'config/release/performance-budget-amendments.json',
        'docs/performance-baselines.md',
      ],
    });

    assert.equal(result.status, 'accepted', result.diagnostics.join('\n'));
    assert.equal(result.mode, 'revoke');
    assert.equal(result.amendment.id, 'BA0001');
    assert.equal(result.requiresExactHeadGrowthApproval, false);
  });
});

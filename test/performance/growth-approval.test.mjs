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
  validateGrowthApproval,
  validateGrowthApprovalPolicy,
} from '../../config/performance-growth-approval.mjs';

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

function report(artifacts) {
  return { artifacts };
}

function approvalRecord(approvedPaths = ['dist/over.js']) {
  return {
    schemaVersion: 1,
    headSha,
    issueUrl: policy.trackingIssueUrl,
    approvedPaths,
    evidenceUrls: [evidenceUrl],
  };
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

function evidenceSnapshot(comments = [{ id: 123, 'html_url': evidenceUrl }], status = 'ok') {
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
} = {}) {
  return validateGrowthApproval({
    baseReport: report(base),
    comments: snapshot(comments),
    currentReport: report(current),
    evidenceComments: evidenceSnapshot(),
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
      { name: 'Over', path: 'dist/over.js', size: 100 },
      { name: 'Shrink', path: 'dist/shrink.js', size: 100 },
      { name: 'Zero', path: 'dist/zero.js', size: 0 },
    ]);
    const current = report([
      { name: 'Exact', path: 'dist/exact.js', size: 101 },
      { name: 'Over', path: 'dist/over.js', size: 102 },
      { name: 'Shrink', path: 'dist/shrink.js', size: 99 },
      { name: 'Zero', path: 'dist/zero.js', size: 1 },
      { name: 'New', path: 'dist/new.js', size: 10 },
    ]);

    assert.deepEqual(requiredArtifactGrowth(base, current, 1), [
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
  });

  test('rejects foreign pull request comments and unresolved evidence URLs', () => {
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
      comments: join(fixtureRoot, 'comments.json'),
      contract: join(fixtureRoot, 'contract.json'),
      current: join(fixtureRoot, 'current.json'),
      evidence: join(fixtureRoot, 'evidence.json'),
    };
    const cli = join(root, 'config/performance-growth-approval.mjs');
    const args = [
      cli,
      '--contract', paths.contract,
      '--base-report', paths.base,
      '--current-report', paths.current,
      '--comments', paths.comments,
      '--evidence-comments', paths.evidence,
      '--head-sha', headSha,
      '--pull-request', String(pullRequestNumber),
    ];

    try {
      await Promise.all([
        writeFile(paths.contract, JSON.stringify({
          thresholds: { pullRequestApprovalPercent: 1 },
          pullRequestGrowthApproval: policy,
        })),
        writeFile(paths.base, JSON.stringify(report([
          { name: 'Over', path: 'dist/over.js', size: 100 },
        ]))),
        writeFile(paths.current, JSON.stringify(report([
          { name: 'Over', path: 'dist/over.js', size: 102 },
        ]))),
        writeFile(paths.comments, JSON.stringify(snapshot([comment(approvalRecord())]))),
        writeFile(paths.evidence, JSON.stringify(evidenceSnapshot())),
      ]);

      const approved = spawnSync(process.execPath, args, { encoding: 'utf8' });
      assert.equal(approved.status, 0);
      assert.equal(JSON.parse(approved.stdout).status, 'approved');

      await writeFile(paths.comments, JSON.stringify(snapshot([])));
      const missing = spawnSync(process.execPath, args, { encoding: 'utf8' });
      assert.equal(missing.status, 1);
      assert.equal(JSON.parse(missing.stdout).diagnostics[0].code, 'GROWTH_APPROVAL_MISSING');

      const invalidInput = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
      assert.equal(invalidInput.status, 1);
      assert.equal(
        JSON.parse(invalidInput.stdout).diagnostics[0].code,
        'GROWTH_APPROVAL_INPUT'
      );

      const invalidPullRequest = spawnSync(process.execPath, [
        ...args.slice(0, -1), '1e2',
      ], { encoding: 'utf8' });
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

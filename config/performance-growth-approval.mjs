import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const marker = '<!-- marionette-performance-growth-approval:v1 -->';
const recordFields = ['approvedPaths', 'evidenceUrls', 'headSha', 'issueUrl', 'schemaVersion'];
const allowedAuthorAssociations = new Set(['COLLABORATOR', 'MEMBER', 'OWNER']);
const bodyLimit = 16 * 1024;
const pathLimit = 50;
const evidenceLimit = 20;

function diagnostic(code, message, commentUrl) {
  return commentUrl ? { code, commentUrl, message } : { code, message };
}

function uniqueSortedStrings(values, limit) {
  return Array.isArray(values) && values.length > 0 && values.length <= limit &&
    values.every(value => typeof value === 'string' && value.length > 0) &&
    new Set(values).size === values.length &&
    values.every((value, index) => index === 0 || values[index - 1] < value);
}

function validArtifactPath(path) {
  return /^dist\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:c|m)?js$/.test(path) &&
    !path.includes('//') && !path.split('/').includes('..');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function issueUrl(repository, value) {
  return new RegExp(`^https://github\\.com/${escapeRegExp(repository)}/issues/[1-9]\\d*$`)
    .test(value);
}

function evidenceUrl(repository, value) {
  return new RegExp(
    `^https://github\\.com/${escapeRegExp(repository)}/issues/[1-9]\\d*#issuecomment-[1-9]\\d*$`
  ).test(value);
}

function trackingIssueNumber(policy) {
  return Number(policy.trackingIssueUrl.split('/').at(-1));
}

function pullRequestCommentUrl(repository, pullRequestNumber, comment) {
  return Number.isInteger(comment?.id) && comment.id > 0 &&
    comment.html_url ===
      `https://github.com/${repository}/pull/${pullRequestNumber}#issuecomment-${comment.id}`;
}

function evidenceCommentUrl(repository, issueNumber, comment) {
  return Number.isInteger(comment?.id) && comment.id > 0 &&
    comment.html_url ===
      `https://github.com/${repository}/issues/${issueNumber}#issuecomment-${comment.id}`;
}

function canonicalRecord(record) {
  return {
    schemaVersion: record.schemaVersion,
    headSha: record.headSha,
    issueUrl: record.issueUrl,
    approvedPaths: record.approvedPaths,
    evidenceUrls: record.evidenceUrls,
  };
}

export function formatGrowthApprovalComment(record) {
  return `${marker}\n\`\`\`json\n${JSON.stringify(canonicalRecord(record), null, 2)}\n\`\`\``;
}

export function validateGrowthApprovalPolicy(policy) {
  const diagnostics = [];
  if (policy?.schemaVersion !== 1) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_POLICY_SCHEMA',
      `Growth approval policy schemaVersion must be 1; received ${policy?.schemaVersion}`
    ));
  }
  if (typeof policy?.repository !== 'string' ||
      !/^[A-Za-z\d_.-]+\/[A-Za-z\d_.-]+$/.test(policy.repository)) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_POLICY_REPOSITORY',
      'Growth approval policy repository must be an owner/name slug'
    ));
  }
  if (typeof policy?.trackingIssueUrl !== 'string' ||
      (typeof policy?.repository === 'string' &&
        !issueUrl(policy.repository, policy.trackingIssueUrl))) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_POLICY_ISSUE',
      'Growth approval policy trackingIssueUrl must be a repository issue URL'
    ));
  }
  if (!uniqueSortedStrings(policy?.allowedLogins, 50) ||
      !policy.allowedLogins.every(login =>
        /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/.test(login))) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_POLICY_LOGINS',
      'Growth approval policy allowedLogins must contain sorted, unique lowercase GitHub logins'
    ));
  }

  return diagnostics;
}

function validateRecord(record, policy) {
  const diagnostics = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return [diagnostic('GROWTH_APPROVAL_RECORD', 'Approval record must be a JSON object')];
  }
  const unknownFields = Object.keys(record)
    .filter(field => !recordFields.includes(field))
    .sort();
  const missingFields = recordFields
    .filter(field => !Object.hasOwn(record, field))
    .sort();
  if (unknownFields.length || missingFields.length) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_FIELDS',
      `Approval fields mismatch; missing: ${missingFields.join(', ') || 'none'}; unknown: ${unknownFields.join(', ') || 'none'}`
    ));
  }
  if (record.schemaVersion !== 1) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_SCHEMA',
      `Approval schemaVersion must be 1; received ${record.schemaVersion}`
    ));
  }
  if (typeof record.headSha !== 'string' || !/^[a-f\d]{40}$/.test(record.headSha)) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_HEAD',
      'Approval headSha must be a lowercase full 40-character commit SHA'
    ));
  }
  if (record.issueUrl !== policy.trackingIssueUrl) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_ISSUE',
      `Approval issueUrl must be ${policy.trackingIssueUrl}`
    ));
  }
  if (!uniqueSortedStrings(record.approvedPaths, pathLimit) ||
      !record.approvedPaths.every(validArtifactPath)) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_PATHS',
      'Approval approvedPaths must contain sorted, unique safe runtime artifact paths'
    ));
  }
  if (!uniqueSortedStrings(record.evidenceUrls, evidenceLimit) ||
      !record.evidenceUrls.every(value => evidenceUrl(policy.repository, value))) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_EVIDENCE',
      'Approval evidenceUrls must contain sorted, unique repository issue-comment permalinks'
    ));
  }

  return diagnostics;
}

export function parseGrowthApprovalComment(body, policy) {
  if (typeof body !== 'string' || !body.includes(marker)) {
    return { matched: false };
  }
  const policyDiagnostics = validateGrowthApprovalPolicy(policy);
  if (policyDiagnostics.length) {
    return { matched: true, diagnostics: policyDiagnostics };
  }
  if (body.length > bodyLimit || body.startsWith('\uFEFF')) {
    return {
      matched: true,
      diagnostics: [diagnostic(
        'GROWTH_APPROVAL_FORMAT',
        'Approval comment is oversized or begins with a byte-order mark'
      )],
    };
  }
  const normalized = body.replaceAll('\r\n', '\n').replace(/\n$/, '');
  const match = normalized.match(
    /^<!-- marionette-performance-growth-approval:v1 -->\n```json\n([\s\S]+)\n```$/
  );
  if (!match) {
    return {
      matched: true,
      diagnostics: [diagnostic(
        'GROWTH_APPROVAL_FORMAT',
        'Approval comment must contain only the canonical marker and JSON fence'
      )],
    };
  }

  let approval;
  try {
    approval = JSON.parse(match[1]);
  } catch {
    return {
      matched: true,
      diagnostics: [diagnostic('GROWTH_APPROVAL_JSON', 'Approval JSON could not be parsed')],
    };
  }
  const diagnostics = validateRecord(approval, policy);
  if (!diagnostics.length && normalized !== formatGrowthApprovalComment(approval)) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_CANONICAL',
      'Approval comment does not use the canonical JSON field order and formatting'
    ));
  }

  return diagnostics.length ? { matched: true, diagnostics } : { matched: true, approval };
}

function artifactMap(report, label) {
  if (!Array.isArray(report?.artifacts)) {
    throw new Error(`${label} report artifacts must be an array`);
  }
  const artifacts = new Map();
  for (const artifact of report.artifacts) {
    if (typeof artifact?.path !== 'string' || artifacts.has(artifact.path)) {
      throw new Error(`${label} report has an invalid or duplicate artifact path ${artifact?.path}`);
    }
    artifacts.set(artifact.path, artifact);
  }
  return artifacts;
}

export function requiredArtifactGrowth(baseReport, currentReport, thresholdPercent) {
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0) {
    throw new Error(`Growth approval threshold must be a non-negative number; received ${thresholdPercent}`);
  }
  const baseArtifacts = artifactMap(baseReport, 'Exact-base');
  const currentArtifacts = artifactMap(currentReport, 'Pull request');
  const missingPaths = [...baseArtifacts.keys()]
    .filter(path => !currentArtifacts.has(path))
    .sort();
  if (missingPaths.length) {
    throw new Error(`Pull request report is missing exact-base artifacts: ${missingPaths.join(', ')}`);
  }
  const required = [];
  for (const [path, current] of currentArtifacts) {
    const base = baseArtifacts.get(path);
    if (!base) {
      continue;
    }
    if (!Number.isInteger(base.size) || base.size < 0 ||
        !Number.isInteger(current.size) || current.size < 0) {
      throw new Error(`Existing artifact ${path} has non-comparable sizes ${base.size} and ${current.size}`);
    }
    const deltaBytes = current.size - base.size;
    if (deltaBytes <= 0 || (base.size > 0 && deltaBytes * 100 <= base.size * thresholdPercent)) {
      continue;
    }
    required.push({
      baseBytes: base.size,
      currentBytes: current.size,
      deltaBytes,
      growthBasisPoints: base.size === 0 ? null : Math.round(deltaBytes * 10000 / base.size),
      name: current.name,
      path,
    });
  }

  return required.sort((left, right) => left.path.localeCompare(right.path));
}

export function validateGrowthApproval({
  baseReport,
  comments,
  currentReport,
  evidenceComments,
  headSha,
  policy,
  pullRequestNumber,
  thresholdPercent,
}) {
  let required = [];
  const diagnostics = validateGrowthApprovalPolicy(policy);
  try {
    required = requiredArtifactGrowth(baseReport, currentReport, thresholdPercent);
  } catch (error) {
    diagnostics.push(diagnostic('GROWTH_APPROVAL_REPORT', error.message));
  }
  const result = {
    approval: null,
    diagnostics,
    headSha,
    ignored: [],
    required,
    schemaVersion: 1,
    status: 'required',
    thresholdPercent,
  };
  if (!/^[a-f\d]{40}$/.test(headSha || '')) {
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_PULL_REQUEST_HEAD',
      'Pull request head must be a lowercase full 40-character commit SHA'
    ));
  }
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_PULL_REQUEST_NUMBER',
      'Pull request number must be a positive integer'
    ));
  }
  if (result.diagnostics.length) {
    result.status = 'blocked';
    return result;
  }
  if (!required.length) {
    result.status = 'not-required';
    return result;
  }
  if (comments?.schemaVersion !== 1 || !Array.isArray(comments.comments) ||
      comments.repository !== policy.repository ||
      comments.pullRequestNumber !== pullRequestNumber) {
    result.status = 'blocked';
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_COMMENTS',
      'Approval comment snapshot is missing or malformed'
    ));
    return result;
  }
  if (comments.status !== 'ok') {
    result.status = 'blocked';
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_COMMENTS_UNAVAILABLE',
      'Approval comments were unavailable when the exact head was evaluated'
    ));
    return result;
  }
  const issueNumber = trackingIssueNumber(policy);
  if (evidenceComments?.schemaVersion !== 1 || !Array.isArray(evidenceComments.comments) ||
      evidenceComments.repository !== policy.repository ||
      evidenceComments.issueNumber !== issueNumber) {
    result.status = 'blocked';
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_EVIDENCE_COMMENTS',
      'Growth evidence comment snapshot is missing or malformed'
    ));
    return result;
  }
  if (evidenceComments.status !== 'ok') {
    result.status = 'blocked';
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_EVIDENCE_UNAVAILABLE',
      'Growth evidence comments were unavailable when the exact head was evaluated'
    ));
    return result;
  }

  const allowedLogins = new Set(policy.allowedLogins);
  const matching = [];
  for (const comment of comments.comments) {
    const parsed = parseGrowthApprovalComment(comment?.body, policy);
    if (!parsed.matched) {
      continue;
    }
    const rawAuthorLogin = comment?.user?.login;
    const authorLogin = typeof rawAuthorLogin === 'string' ? rawAuthorLogin.toLowerCase() : null;
    const commentUrl = comment?.html_url;
    if (!pullRequestCommentUrl(policy.repository, pullRequestNumber, comment)) {
      result.diagnostics.push(diagnostic(
        'GROWTH_APPROVAL_COMMENT_IDENTITY',
        'Marked approval comment is not bound to the expected repository and pull request',
        commentUrl
      ));
      continue;
    }
    if (comment?.user?.type !== 'User' ||
        !allowedAuthorAssociations.has(comment?.author_association) ||
        !allowedLogins.has(authorLogin)) {
      result.ignored.push({ authorLogin, commentUrl, reason: 'unauthorized-author' });
      continue;
    }
    if (parsed.diagnostics) {
      result.ignored.push({
        authorLogin,
        commentUrl,
        diagnostics: parsed.diagnostics,
        reason: 'malformed-record',
      });
      continue;
    }
    if (parsed.approval.headSha !== headSha) {
      result.ignored.push({ authorLogin, commentUrl, reason: 'stale-head' });
      continue;
    }
    matching.push({
      approvedPaths: parsed.approval.approvedPaths,
      authorLogin,
      commentId: comment.id,
      commentUrl,
      evidenceUrls: parsed.approval.evidenceUrls,
      issueUrl: parsed.approval.issueUrl,
    });
  }

  if (result.diagnostics.length) {
    result.status = 'invalid';
    return result;
  }
  if (!matching.length) {
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_MISSING',
      `No allowed maintainer approval targets exact head ${headSha}`
    ));
    return result;
  }
  if (matching.length > 1) {
    result.status = 'invalid';
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_AMBIGUOUS',
      `Multiple allowed maintainer approvals target exact head ${headSha}`
    ));
    return result;
  }

  result.approval = matching[0];
  const requiredPaths = required.map(({ path }) => path);
  const missing = requiredPaths.filter(path => !result.approval.approvedPaths.includes(path));
  const extra = result.approval.approvedPaths.filter(path => !requiredPaths.includes(path));
  if (missing.length || extra.length) {
    result.status = 'invalid';
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_PATH_SET_MISMATCH',
      `Approval paths mismatch; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`,
      result.approval.commentUrl
    ));
    return result;
  }

  const availableEvidence = new Set(evidenceComments.comments
    .filter(comment => evidenceCommentUrl(policy.repository, issueNumber, comment))
    .map(comment => comment.html_url));
  const unresolvedEvidence = result.approval.evidenceUrls
    .filter(url => !availableEvidence.has(url));
  if (unresolvedEvidence.length) {
    result.status = 'invalid';
    result.diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_EVIDENCE_MISSING',
      `Approval evidence does not resolve to tracking-issue comments: ${unresolvedEvidence.join(', ')}`,
      result.approval.commentUrl
    ));
    return result;
  }

  result.status = 'approved';
  return result;
}

function getArgument(args, name) {
  const index = args.indexOf(name);
  const value = index === -1 ? null : args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

function parsePullRequestNumber(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('Pull request number must be a positive integer');
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error('Pull request number exceeds the safe integer range');
  }

  return number;
}

function blockedResult(error, headSha = null) {
  return {
    approval: null,
    diagnostics: [diagnostic('GROWTH_APPROVAL_INPUT', error.message)],
    headSha,
    ignored: [],
    required: [],
    schemaVersion: 1,
    status: 'blocked',
    thresholdPercent: null,
  };
}

export async function main(args = process.argv.slice(2)) {
  let result;
  let headSha;
  try {
    headSha = getArgument(args, '--head-sha');
    const pullRequestNumber = parsePullRequestNumber(getArgument(args, '--pull-request'));
    const [contract, baseReport, currentReport, comments, evidenceComments] =
      await Promise.all([
        readJson(getArgument(args, '--contract')),
        readJson(getArgument(args, '--base-report')),
        readJson(getArgument(args, '--current-report')),
        readJson(getArgument(args, '--comments')),
        readJson(getArgument(args, '--evidence-comments')),
      ]);
    result = validateGrowthApproval({
      baseReport,
      comments,
      currentReport,
      evidenceComments,
      headSha,
      policy: contract.pullRequestGrowthApproval,
      pullRequestNumber,
      thresholdPercent: contract.thresholds?.pullRequestApprovalPercent,
    });
  } catch (error) {
    result = blockedResult(error, headSha);
  }

  console.log(JSON.stringify(result, null, 2));
  if (!['approved', 'not-required'].includes(result.status)) {
    process.exitCode = 1;
  }
  return result;
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryUrl === import.meta.url) {
  main();
}

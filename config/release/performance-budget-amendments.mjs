import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual, promisify } from 'node:util';

const ledgerFields = ['entries', 'schemaVersion'];
const amendmentFields = [
  'approvalUrls',
  'authorizedArtifactPaths',
  'authorizedNewSubpaths',
  'evidenceUrls',
  'id',
  'implementationIssueUrl',
  'kind',
  'previousCeilingBytes',
  'proposedCeilingBytes',
  'prototypeBaseCommit',
  'prototypeCommit',
  'prototypeContract',
  'rationale',
  'reports',
  'rollbackCondition',
  'target',
];
const revocationFields = [
  'amendmentId',
  'approvalUrls',
  'evidenceUrls',
  'id',
  'kind',
  'rationale',
];
const reportFields = ['path', 'role', 'sha256'];
const prototypeContractFields = ['path', 'sha256'];
const ledgerPath = 'config/release/performance-budget-amendments.json';
const documentationPath = 'docs/performance-baselines.md';
const maximumRecords = 100;
const maximumScopeEntries = 100;
const maximumUrls = 20;
const execFileAsync = promisify(execFile);
const allowedAuthorAssociations = new Set(['COLLABORATOR', 'MEMBER', 'OWNER']);
const approvalMarker = '<!-- marionette-performance-budget-amendment:v1 -->';

function exactFields(value, fields) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), [...fields].sort());
}

function uniqueSortedStrings(values, maximum, allowEmpty = false) {
  return Array.isArray(values) && values.length <= maximum &&
    (allowEmpty || values.length > 0) &&
    values.every(value => typeof value === 'string' && value.length > 0) &&
    values.every((value, index) => index === 0 || values[index - 1] < value);
}

function validArtifactPath(path) {
  return typeof path === 'string' &&
    /^dist\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:c|m)?js$/.test(path) &&
    !path.includes('//') && !path.split('/').includes('..');
}

function validSourcePath(path) {
  return typeof path === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*\.js$/.test(path) &&
    !path.includes('//') && !path.split('/').includes('..');
}

function validSubpath(subpath) {
  return typeof subpath === 'string' &&
    /^\.\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(subpath) &&
    !subpath.includes('//') && !subpath.split('/').includes('..');
}

function repositoryUrl(repository, suffix) {
  const escaped = repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^https://github\\.com/${escaped}/${suffix}$`);
}

function issueUrl(repository, value) {
  return typeof value === 'string' &&
    repositoryUrl(repository, 'issues/[1-9]\\d*').test(value);
}

function issueCommentUrl(repository, value) {
  return typeof value === 'string' &&
    repositoryUrl(repository, 'issues/[1-9]\\d*#issuecomment-[1-9]\\d*').test(value);
}

function pullRequestCommentUrl(repository, value) {
  return typeof value === 'string' &&
    repositoryUrl(repository, 'pull/[1-9]\\d*#issuecomment-[1-9]\\d*').test(value);
}

function trackingIssueCommentUrl(contract, value) {
  return typeof contract?.pullRequestGrowthApproval?.trackingIssueUrl === 'string' &&
    new RegExp(`^${contract.pullRequestGrowthApproval.trackingIssueUrl.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}#issuecomment-[1-9]\\d*$`).test(value);
}

function phase0Ceiling(contract) {
  const total = contract?.baseline?.totalBrotliBytes;
  const percent = contract?.thresholds?.cumulativeGrowthPercent;
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isFinite(percent) || percent < 0) {
    return null;
  }
  const ceiling = Math.floor(total * (1 + percent / 100));
  return Number.isSafeInteger(ceiling) ? ceiling : null;
}

function immutableBaseline(contract) {
  return {
    sourceCommit: contract?.baseline?.sourceCommit,
    brotliQuality: contract?.baseline?.brotliQuality,
    totalBrotliBytes: contract?.baseline?.totalBrotliBytes,
  };
}

function validateAuthorization(record, identifier, contract) {
  const violations = [];
  const repository = contract?.pullRequestGrowthApproval?.repository || 'invalid/invalid';
  const expectedId = `BA${String(identifier).padStart(4, '0')}`;
  if (!exactFields(record, amendmentFields)) {
    violations.push(`${expectedId} fields do not match the budget-amendment contract`);
  }
  if (record.kind !== 'authorization') {
    violations.push(`${expectedId} kind must be authorization`);
  }
  if (record.id !== expectedId) {
    violations.push(`Budget amendment identifier ${record.id} must be ${expectedId}`);
  }
  if (record.target !== 'aggregate-shipped-package') {
    violations.push(`${record.id} target must be aggregate-shipped-package`);
  }
  if (!Number.isSafeInteger(record.previousCeilingBytes) || record.previousCeilingBytes < 0 ||
      !Number.isSafeInteger(record.proposedCeilingBytes) ||
      record.proposedCeilingBytes <= record.previousCeilingBytes) {
    violations.push(`${record.id} must raise a non-negative integer previous ceiling`);
  }
  if (typeof record.prototypeCommit !== 'string' ||
      !/^[a-f\d]{40}$/.test(record.prototypeCommit)) {
    violations.push(`${record.id} prototypeCommit must be a lowercase full commit SHA`);
  }
  if (typeof record.prototypeBaseCommit !== 'string' ||
      !/^[a-f\d]{40}$/.test(record.prototypeBaseCommit) ||
      record.prototypeBaseCommit === record.prototypeCommit) {
    violations.push(`${record.id} prototypeBaseCommit must be a distinct lowercase full commit SHA`);
  }
  if (!issueUrl(repository, record.implementationIssueUrl)) {
    violations.push(`${record.id} implementationIssueUrl must be a repository issue URL`);
  }
  if (!uniqueSortedStrings(record.authorizedArtifactPaths, maximumScopeEntries, true) ||
      !record.authorizedArtifactPaths.every(validArtifactPath)) {
    violations.push(`${record.id} authorizedArtifactPaths must be sorted safe runtime paths`);
  }
  if (!uniqueSortedStrings(record.authorizedNewSubpaths, maximumScopeEntries, true) ||
      !record.authorizedNewSubpaths.every(validSubpath)) {
    violations.push(`${record.id} authorizedNewSubpaths must be sorted safe package subpaths`);
  }
  if (Array.isArray(record.authorizedArtifactPaths) &&
      Array.isArray(record.authorizedNewSubpaths) &&
      !record.authorizedArtifactPaths.length && !record.authorizedNewSubpaths.length) {
    violations.push(`${record.id} must authorize at least one artifact path or new subpath`);
  }
  if (!Array.isArray(record.reports) || !record.reports.length ||
      record.reports.length > maximumUrls) {
    violations.push(`${record.id} reports must contain measured report hashes`);
  } else {
    const expectedPrefix = `evidence/performance-budget-amendments/${record.id}/`;
    let previousPath = null;
    const roles = [];
    for (const report of record.reports) {
      if (!exactFields(report, reportFields) || typeof report.path !== 'string' ||
          !report.path.startsWith(expectedPrefix) ||
          !/^[A-Za-z0-9][A-Za-z0-9._/-]*\.json$/.test(report.path.slice(expectedPrefix.length)) ||
          report.path.includes('//') || report.path.split('/').includes('..') ||
          !['base', 'prototype'].includes(report.role) ||
          typeof report.sha256 !== 'string' || !/^[a-f\d]{64}$/.test(report.sha256)) {
        violations.push(`${record.id} reports must use safe immutable JSON paths and SHA-256 hashes`);
        continue;
      }
      if (previousPath !== null && previousPath >= report.path) {
        violations.push(`${record.id} reports must be sorted with unique paths`);
      }
      previousPath = report.path;
      roles.push(report.role);
    }
    if (!isDeepStrictEqual([...roles].sort(), ['base', 'prototype'])) {
      violations.push(`${record.id} reports must contain exactly one base and one prototype report`);
    }
  }
  const expectedContractPrefix = `evidence/performance-budget-amendments/${record.id}/`;
  if (!exactFields(record.prototypeContract, prototypeContractFields) ||
      typeof record.prototypeContract?.path !== 'string' ||
      !record.prototypeContract.path.startsWith(expectedContractPrefix) ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*\.json$/.test(
        record.prototypeContract.path.slice(expectedContractPrefix.length)
      ) ||
      record.prototypeContract.path.includes('//') ||
      record.prototypeContract.path.split('/').includes('..') ||
      !/^[a-f\d]{64}$/.test(record.prototypeContract?.sha256 || '')) {
    violations.push(`${record.id} prototypeContract must use a safe immutable JSON path and SHA-256`);
  }
  if (!uniqueSortedStrings(record.approvalUrls, 1) ||
      !record.approvalUrls.every(value => pullRequestCommentUrl(repository, value))) {
    violations.push(`${record.id} approvalUrls must contain one pull-request comment URL`);
  }
  if (!uniqueSortedStrings(record.evidenceUrls, maximumUrls) ||
      !record.evidenceUrls.every(value => issueCommentUrl(repository, value) &&
        trackingIssueCommentUrl(contract, value))) {
    violations.push(`${record.id} evidenceUrls must contain sorted tracking-issue comment URLs`);
  }
  for (const field of ['rationale', 'rollbackCondition']) {
    if (typeof record[field] !== 'string' || !record[field].trim() || record[field].length > 1000) {
      violations.push(`${record.id} ${field} must be a non-empty string of at most 1000 characters`);
    }
  }
  return violations;
}

function validateGovernanceUrls(record, contract, identifier) {
  const repository = contract?.pullRequestGrowthApproval?.repository || 'invalid/invalid';
  const violations = [];
  if (!uniqueSortedStrings(record?.approvalUrls, 1) ||
      !record.approvalUrls.every(value => pullRequestCommentUrl(repository, value))) {
    violations.push(`${identifier} approvalUrls must contain one pull-request comment URL`);
  }
  if (!uniqueSortedStrings(record?.evidenceUrls, maximumUrls) ||
      !record.evidenceUrls.every(value => issueCommentUrl(repository, value) &&
        trackingIssueCommentUrl(contract, value))) {
    violations.push(`${identifier} evidenceUrls must contain sorted tracking-issue comment URLs`);
  }
  return violations;
}

function validateRevocation(record, identifier, contract) {
  const expectedId = `BR${String(identifier).padStart(4, '0')}`;
  const violations = [];
  if (!exactFields(record, revocationFields)) {
    violations.push(`${expectedId} fields do not match the budget-revocation contract`);
  }
  if (record?.kind !== 'revocation') {
    violations.push(`${expectedId} kind must be revocation`);
  }
  if (record?.id !== expectedId) {
    violations.push(`Budget revocation identifier ${record?.id} must be ${expectedId}`);
  }
  if (typeof record?.amendmentId !== 'string' || !/^BA\d{4}$/.test(record.amendmentId)) {
    violations.push(`${expectedId} amendmentId must reference a budget authorization`);
  }
  violations.push(...validateGovernanceUrls(record, contract, expectedId));
  if (typeof record?.rationale !== 'string' || !record.rationale.trim() ||
      record.rationale.length > 1000) {
    violations.push(`${expectedId} rationale must be a non-empty string of at most 1000 characters`);
  }
  return violations;
}

function validateLedger(ledger, contract, label) {
  const violations = [];
  if (!exactFields(ledger, ledgerFields) || ledger.schemaVersion !== 1 ||
      !Array.isArray(ledger.entries) || ledger.entries.length > maximumRecords) {
    return {
      pending: null,
      violations: [`${label} budget-amendment ledger is malformed`],
    };
  }
  const repository = contract?.pullRequestGrowthApproval?.repository;
  if (typeof repository !== 'string' ||
      !/^[A-Za-z\d_.-]+\/[A-Za-z\d_.-]+$/.test(repository)) {
    violations.push(`${label} performance contract repository is malformed`);
  }
  const initialCeiling = phase0Ceiling(contract);
  if (initialCeiling === null) {
    violations.push(`${label} Phase 0 aggregate ceiling cannot be derived`);
  }
  let chainCeiling = initialCeiling;
  let pending = null;
  const activeCeiling = contract?.baseline?.absoluteCeilingBytes;
  let authorizationCount = 0;
  let revocationCount = 0;
  for (const [index, entry] of ledger.entries.entries()) {
    if (entry?.kind === 'authorization') {
      authorizationCount += 1;
      violations.push(...validateAuthorization(entry, authorizationCount, contract));
      if (pending) {
        if (entry.previousCeilingBytes === pending.proposedCeilingBytes) {
          chainCeiling = pending.proposedCeilingBytes;
        } else {
          violations.push(`${entry.id} follows unresolved pending amendment ${pending.id}`);
        }
      }
      if (entry.previousCeilingBytes !== chainCeiling) {
        violations.push(`${entry.id} previous ceiling does not continue the immutable amendment chain`);
      }
      pending = entry;
    } else if (entry?.kind === 'revocation') {
      revocationCount += 1;
      violations.push(...validateRevocation(entry, revocationCount, contract));
      if (!pending || entry.amendmentId !== pending.id) {
        violations.push(`${entry.id || `Record ${index + 1}`} must revoke the currently pending amendment`);
      } else {
        pending = null;
      }
    } else {
      violations.push(`${label} ledger entry ${index + 1} has an unsupported kind`);
    }
  }
  if (pending && activeCeiling === pending.proposedCeilingBytes) {
    chainCeiling = pending.proposedCeilingBytes;
    pending = null;
  }
  if (activeCeiling !== (pending ? pending.previousCeilingBytes : chainCeiling)) {
    violations.push(`${label} active ceiling does not derive pending or consumed state from the ledger`);
  }
  return { pending, violations };
}

function changedFilesForAuthorization(record) {
  const evidencePaths = [
    record?.prototypeContract?.path,
    ...(Array.isArray(record?.reports) ? record.reports.map(report => report?.path) : []),
  ].filter(path => typeof path === 'string');
  return new Set([
    ledgerPath,
    documentationPath,
    ...evidencePaths,
  ]);
}

function changedFilesForRevocation() {
  return new Set([ledgerPath, documentationPath]);
}

function mapBy(items, key, label) {
  const map = new Map();
  const violations = [];
  if (!Array.isArray(items)) {
    return { map, violations: [`${label} must be an array`] };
  }
  for (const item of items) {
    const value = item?.[key];
    if (typeof value !== 'string' || map.has(value)) {
      violations.push(`${label} has an invalid or duplicate ${key} ${value}`);
    } else {
      map.set(value, item);
    }
  }
  return { map, violations };
}

function validatePrototypeContract(authority, prototype) {
  const violations = [];
  if (!authority || typeof authority !== 'object' ||
      !prototype || typeof prototype !== 'object') {
    return ['Prototype performance contract must be an object'];
  }
  if (!isDeepStrictEqual(Object.keys(authority).sort(), Object.keys(prototype).sort())) {
    violations.push('Prototype performance contract top-level fields differ from authority');
  }
  for (const key of Object.keys(authority)) {
    if (!['runtimeArtifacts', 'productionGraphs'].includes(key) &&
        !isDeepStrictEqual(authority[key], prototype[key])) {
      violations.push(`Prototype performance contract changes authority ${key}`);
    }
  }
  const authorityArtifacts = mapBy(authority.runtimeArtifacts, 'path', 'Authority artifacts');
  const prototypeArtifacts = mapBy(prototype.runtimeArtifacts, 'path', 'Prototype artifacts');
  const authorityGraphs = mapBy(authority.productionGraphs, 'subpath', 'Authority graphs');
  const prototypeGraphs = mapBy(prototype.productionGraphs, 'subpath', 'Prototype graphs');
  violations.push(
    ...authorityArtifacts.violations,
    ...prototypeArtifacts.violations,
    ...authorityGraphs.violations,
    ...prototypeGraphs.violations
  );
  for (const [path, artifact] of authorityArtifacts.map) {
    if (!isDeepStrictEqual(prototypeArtifacts.map.get(path), artifact)) {
      violations.push(`Prototype changes or removes authority artifact ${path}`);
    }
  }
  for (const [path, artifact] of prototypeArtifacts.map) {
    if (!authorityArtifacts.map.has(path) &&
        (!exactFields(artifact, ['baselineBrotliBytes', 'name', 'path']) ||
          !validArtifactPath(path) || typeof artifact.name !== 'string' || !artifact.name ||
          artifact.baselineBrotliBytes !== 0)) {
      violations.push(`Prototype new artifact ${path} must have a safe zero-baseline contract`);
    }
  }
  for (const [subpath, graph] of authorityGraphs.map) {
    if (!isDeepStrictEqual(prototypeGraphs.map.get(subpath), graph)) {
      violations.push(`Prototype changes or removes authority graph ${subpath}`);
    }
  }
  for (const [subpath, graph] of prototypeGraphs.map) {
    if (authorityGraphs.map.has(subpath)) {
      continue;
    }
    if (!exactFields(graph, [
      'baselineExternalImports',
      'baselineModules',
      'input',
      'output',
      'subpath',
    ]) || !validSubpath(subpath) || !validSourcePath(graph.input) ||
        !validArtifactPath(graph.output) || !Array.isArray(graph.baselineModules) ||
        graph.baselineModules.length || !Array.isArray(graph.baselineExternalImports) ||
        graph.baselineExternalImports.length || !prototypeArtifacts.map.has(graph.output)) {
      violations.push(`Prototype new graph ${subpath} has an invalid additive contract`);
    }
  }
  return violations;
}

function measuredReport(report, contract, label, expectedCeiling) {
  const violations = [];
  if (report?.schemaVersion !== 1 ||
      report?.baselineSourceCommit !== contract?.baseline?.sourceCommit ||
      report?.brotliQuality !== contract?.baseline?.brotliQuality ||
      !isDeepStrictEqual(report?.thresholds, contract?.thresholds) ||
      report?.cumulative?.baselineSize !== contract?.baseline?.totalBrotliBytes ||
      report?.cumulative?.absoluteCeiling !== expectedCeiling ||
      !Array.isArray(report?.artifacts) || !Array.isArray(report?.graphs)) {
    return { violations: [`${label} is not a compatible bundle-size report`] };
  }
  const artifacts = new Map();
  const expectedArtifacts = mapBy(contract.runtimeArtifacts, 'path', `${label} expected artifacts`);
  const expectedGraphs = mapBy(contract.productionGraphs, 'subpath', `${label} expected graphs`);
  violations.push(...expectedArtifacts.violations, ...expectedGraphs.violations);
  let total = 0;
  for (const artifact of report.artifacts) {
    if (typeof artifact?.path !== 'string' || artifacts.has(artifact.path) ||
        artifact.status !== 'measured' || !Number.isSafeInteger(artifact.size) || artifact.size < 0) {
      violations.push(`${label} has a malformed or duplicate measured artifact ${artifact?.path}`);
      continue;
    }
    artifacts.set(artifact.path, artifact.size);
    if (!Number.isSafeInteger(total + artifact.size)) {
      violations.push(`${label} measured artifact total exceeds the safe integer range`);
    } else {
      total += artifact.size;
    }
    if (expectedArtifacts.map.get(artifact.path)?.name !== artifact.name) {
      violations.push(`${label} artifact ${artifact.path} does not match its contract name`);
    }
  }
  const missingArtifacts = [...expectedArtifacts.map.keys()]
    .filter(path => !artifacts.has(path)).sort();
  const extraArtifacts = [...artifacts.keys()]
    .filter(path => !expectedArtifacts.map.has(path)).sort();
  if (missingArtifacts.length || extraArtifacts.length) {
    violations.push(`${label} artifact set mismatch; missing: ${missingArtifacts.join(', ') || 'none'}; extra: ${extraArtifacts.join(', ') || 'none'}`);
  }
  if (report?.cumulative?.size !== total) {
    violations.push(`${label} cumulative size does not equal all measured artifacts`);
  }
  const expectedViolations = total > expectedCeiling ? [
    `Cumulative Brotli-${contract.baseline.brotliQuality} size ${total} exceeds the absolute ceiling ${expectedCeiling}`,
  ] : [];
  if (!isDeepStrictEqual(report?.violations, expectedViolations)) {
    violations.push(`${label} violations do not match its measured cumulative result`);
  }
  const subpaths = new Set();
  for (const graph of report.graphs) {
    if (typeof graph?.subpath !== 'string' || subpaths.has(graph.subpath) ||
        graph.status !== 'measured' || !Array.isArray(graph.forbiddenModules) ||
        graph.forbiddenModules.length) {
      violations.push(`${label} has a malformed, duplicate, or forbidden production graph ${graph?.subpath}`);
      continue;
    }
    subpaths.add(graph.subpath);
    const expected = expectedGraphs.map.get(graph.subpath);
    if (expected && (graph.input !== expected.input || graph.output !== expected.output) ||
        !Array.isArray(graph.modules) || !Array.isArray(graph.externalImports)) {
      violations.push(`${label} graph ${graph.subpath} does not match its measured contract`);
    }
  }
  const missingGraphs = [...expectedGraphs.map.keys()]
    .filter(subpath => !subpaths.has(subpath)).sort();
  const extraGraphs = [...subpaths]
    .filter(subpath => !expectedGraphs.map.has(subpath)).sort();
  if (missingGraphs.length || extraGraphs.length) {
    violations.push(`${label} graph set mismatch; missing: ${missingGraphs.join(', ') || 'none'}; extra: ${extraGraphs.join(', ') || 'none'}`);
  }
  return { artifacts, subpaths, total, violations };
}

function measuredDelta(
  baseReport,
  currentReport,
  contract,
  label,
  { baseCeiling, baseContract = contract, currentCeiling, currentContract = contract } = {}
) {
  const base = measuredReport(
    baseReport,
    baseContract,
    `${label} base report`,
    baseCeiling ?? contract.baseline.absoluteCeilingBytes
  );
  const current = measuredReport(
    currentReport,
    currentContract,
    `${label} current report`,
    currentCeiling ?? contract.baseline.absoluteCeilingBytes
  );
  const violations = [...base.violations, ...current.violations];
  if (violations.length) {
    return { artifactPaths: [], newSubpaths: [], total: null, violations };
  }
  const missingArtifacts = [...base.artifacts.keys()]
    .filter(path => !current.artifacts.has(path)).sort();
  const missingSubpaths = [...base.subpaths]
    .filter(subpath => !current.subpaths.has(subpath)).sort();
  if (missingArtifacts.length) {
    violations.push(`${label} removes measured artifacts: ${missingArtifacts.join(', ')}`);
  }
  if (missingSubpaths.length) {
    violations.push(`${label} removes measured production subpaths: ${missingSubpaths.join(', ')}`);
  }
  const artifactPaths = [...current.artifacts]
    .filter(([path, size]) => size > (base.artifacts.get(path) ?? 0))
    .map(([path]) => path).sort();
  const newSubpaths = [...current.subpaths]
    .filter(subpath => !base.subpaths.has(subpath)).sort();
  return { artifactPaths, newSubpaths, total: current.total, violations };
}

function validateMeasuredScope(amendment, delta, label) {
  const violations = [...delta.violations];
  if (!isDeepStrictEqual(delta.artifactPaths, amendment.authorizedArtifactPaths)) {
    violations.push(`${label} prototype artifact scope does not match ${amendment.id}`);
  }
  if (!isDeepStrictEqual(delta.newSubpaths, amendment.authorizedNewSubpaths)) {
    violations.push(`${label} new subpath scope does not match ${amendment.id}`);
  }
  if (delta.total !== null && delta.total <= amendment.previousCeilingBytes) {
    violations.push(`${label} measured total must exceed the previous ceiling ${amendment.previousCeilingBytes}`);
  }
  if (delta.total !== null && delta.total > amendment.proposedCeilingBytes) {
    violations.push(`${label} measured total exceeds proposed ceiling ${amendment.proposedCeilingBytes}`);
  }
  return violations;
}

function validatePrototypeEvidence(amendment, evidenceReports, contract) {
  if (!Array.isArray(amendment?.reports) || !amendment?.prototypeContract?.path) {
    return [`${amendment?.id || 'Budget amendment'} prototype evidence is malformed`];
  }
  const reports = new Map(amendment.reports.map(report => [report?.role, report]));
  const base = evidenceReports?.[reports.get('base')?.path];
  const prototype = evidenceReports?.[reports.get('prototype')?.path];
  const prototypeContract = evidenceReports?.[amendment.prototypeContract.path];
  const violations = [];
  if (base?.schemaVersion !== 1 || base?.revision !== amendment.prototypeBaseCommit ||
      prototype?.schemaVersion !== 1 || prototype?.revision !== amendment.prototypeCommit) {
    violations.push(`${amendment.id} evidence reports do not bind the declared prototype revisions`);
    return violations;
  }
  violations.push(...validatePrototypeContract(contract, prototypeContract));
  if (violations.length) {
    return violations;
  }
  const delta = measuredDelta(
    base.report,
    prototype.report,
    contract,
    `${amendment.id} evidence`,
    {
      baseCeiling: amendment.previousCeilingBytes,
      baseContract: contract,
      currentCeiling: amendment.previousCeilingBytes,
      currentContract: prototypeContract,
    }
  );
  const authorityArtifacts = new Set(contract.runtimeArtifacts.map(({ path }) => path));
  const newArtifacts = prototypeContract.runtimeArtifacts
    .filter(({ path }) => !authorityArtifacts.has(path));
  if (newArtifacts.length && !delta.newSubpaths.length) {
    violations.push(`${amendment.id} cannot authorize a new runtime artifact without a new production subpath`);
  }
  violations.push(...validateMeasuredScope(amendment, delta, `${amendment.id} evidence`));
  return violations;
}

function commentIdentity(contract, comment) {
  const issueNumber = Number(contract.pullRequestGrowthApproval.trackingIssueUrl.split('/').at(-1));
  return Number.isSafeInteger(comment?.id) && comment.id > 0 &&
    comment?.html_url ===
      `https://github.com/${contract.pullRequestGrowthApproval.repository}/issues/${issueNumber}#issuecomment-${comment.id}`;
}

function normalizedLogin(value) {
  return typeof value === 'string' ? value.toLowerCase() : null;
}

function validateGovernanceEvidence({
  amendment,
  approvalComments,
  contract,
  evidenceComments,
  headSha,
  pullRequestAuthorLogin,
  pullRequestNumber,
}) {
  const repository = contract?.pullRequestGrowthApproval?.repository;
  if (approvalComments?.schemaVersion !== 1 || approvalComments.status !== 'ok' ||
      approvalComments.repository !== repository ||
      approvalComments.pullRequestNumber !== pullRequestNumber ||
      !Array.isArray(approvalComments.comments) ||
      evidenceComments?.schemaVersion !== 1 || evidenceComments.status !== 'ok' ||
      evidenceComments.repository !== repository || evidenceComments.issueNumber !==
        Number(contract?.pullRequestGrowthApproval?.trackingIssueUrl?.split('/').at(-1)) ||
      !Array.isArray(evidenceComments.comments)) {
    return ['Budget-amendment approval or evidence comment snapshot is missing or malformed'];
  }
  const evidence = new Map(evidenceComments.comments
    .filter(comment => commentIdentity(contract, comment))
    .map(comment => [comment.html_url, comment]));
  const allowedLogins = new Set(
    Array.isArray(contract.pullRequestGrowthApproval.allowedLogins) ?
      contract.pullRequestGrowthApproval.allowedLogins : []
  );
  const violations = [];
  const authorLogin = normalizedLogin(pullRequestAuthorLogin);
  if (!authorLogin) {
    violations.push('Pull request author login is missing or malformed');
  }
  const trustedMarked = approvalComments.comments.filter(comment => {
    const login = normalizedLogin(comment?.user?.login);
    return comment?.user?.type === 'User' &&
      allowedAuthorAssociations.has(comment?.author_association) &&
      allowedLogins.has(login) && login !== authorLogin &&
      budgetApprovalTargetsEntry(comment?.body, amendment);
  });
  const canonical = trustedMarked.filter(comment =>
    parseBudgetAmendmentApproval(comment.body, amendment, headSha));
  if (canonical.length !== 1 || trustedMarked.length !== canonical.length) {
    violations.push(`${amendment.id} must have exactly one canonical exact-head maintainer approval`);
  }
  for (const url of Array.isArray(amendment.approvalUrls) ? amendment.approvalUrls : []) {
    const comment = approvalComments.comments.find(value => value?.html_url === url &&
      Number.isSafeInteger(value?.id) && value.id > 0 &&
      url === `https://github.com/${repository}/pull/${pullRequestNumber}#issuecomment-${value.id}`);
    const login = normalizedLogin(comment?.user?.login);
    if (comment?.user?.type !== 'User' ||
        !allowedAuthorAssociations.has(comment?.author_association) ||
        !allowedLogins.has(login) ||
        login === authorLogin ||
        !parseBudgetAmendmentApproval(comment?.body, amendment, headSha)) {
      violations.push(`${amendment.id} approval URL does not resolve to one canonical exact-head maintainer approval: ${url}`);
    }
  }
  for (const url of Array.isArray(amendment.evidenceUrls) ? amendment.evidenceUrls : []) {
    const comment = evidence.get(url);
    if (comment?.user?.type !== 'User' ||
        !allowedAuthorAssociations.has(comment?.author_association)) {
      violations.push(`${amendment.id} evidence URL does not resolve to a trusted comment: ${url}`);
    }
  }
  return violations;
}

export function formatBudgetAmendmentLedger(ledger) {
  return `${JSON.stringify(ledger, null, 2)}\n`;
}

function entryDigest(entry) {
  return createHash('sha256').update(`${JSON.stringify(entry, null, 2)}\n`).digest('hex');
}

export function formatBudgetAmendmentApproval(entry, headSha) {
  const record = {
    schemaVersion: 1,
    action: entry.kind === 'revocation' ? 'revoke' : 'authorize',
    headSha,
    entryId: entry.id,
    entrySha256: entryDigest(entry),
    evidenceUrls: entry.evidenceUrls,
  };
  return `${approvalMarker}\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\``;
}

function parseBudgetAmendmentApproval(body, entry, headSha) {
  if (typeof body !== 'string' || !body.includes(approvalMarker)) {
    return false;
  }
  const normalized = body.replaceAll('\r\n', '\n').replace(/\s+$/, '');
  const match = normalized.match(
    /^<!-- marionette-performance-budget-amendment:v1 -->\n```json\n([\s\S]+)\n```$/
  );
  if (!match) {
    return false;
  }
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return false;
  }
  return normalized === formatBudgetAmendmentApproval(entry, headSha) &&
    parsed.headSha === headSha && parsed.entryId === entry.id;
}

function budgetApprovalTargetsEntry(body, entry) {
  if (typeof body !== 'string' || !body.includes(approvalMarker)) {
    return false;
  }
  const match = body.replaceAll('\r\n', '\n').replace(/\s+$/, '').match(
    /^<!-- marionette-performance-budget-amendment:v1 -->\n```json\n([\s\S]+)\n```$/
  );
  if (!match) {
    return true;
  }
  try {
    return JSON.parse(match[1]).entryId === entry.id;
  } catch {
    return true;
  }
}

export function parseBudgetAmendmentLedger(text) {
  let ledger;
  try {
    ledger = JSON.parse(text);
  } catch {
    throw new Error('Budget-amendment ledger is not valid JSON');
  }
  if (text !== formatBudgetAmendmentLedger(ledger)) {
    throw new Error('Budget-amendment ledger must use canonical JSON formatting');
  }
  return ledger;
}

export function validateBudgetAmendmentLedger(ledger, contract) {
  return validateLedger(ledger, contract, 'Active').violations;
}

export function bootstrapBudgetAmendmentLedger(baseHead) {
  if (baseHead !== '154a8bb43f81a1836fcd70c014f4301e750bcb77') {
    throw new Error(`Missing exact-base budget-amendment ledger at ${baseHead}`);
  }
  return { schemaVersion: 1, entries: [] };
}

export function validateBudgetAmendmentTransition({
  authorityContract,
  authorityLedger,
  candidateContract,
  candidateLedger,
  changedFiles = [],
  changedFileEntries,
  currentReport,
  baseReport,
  approvalComments,
  evidenceComments,
  evidenceReports = {},
  reportHashes = {},
  headSha,
  pullRequestAuthorLogin,
  pullRequestNumber,
}) {
  const diagnostics = [];
  const authority = validateLedger(authorityLedger, authorityContract, 'Exact-base');
  const candidate = validateLedger(candidateLedger, candidateContract, 'Candidate');
  diagnostics.push(...authority.violations, ...candidate.violations);

  if (!isDeepStrictEqual(immutableBaseline(authorityContract), immutableBaseline(candidateContract)) ||
      !isDeepStrictEqual(authorityContract?.thresholds, candidateContract?.thresholds)) {
    diagnostics.push('Candidate changes the immutable Phase 0 baseline or thresholds');
  }

  const authorityRecords = Array.isArray(authorityLedger?.entries) ? authorityLedger.entries : [];
  const candidateRecords = Array.isArray(candidateLedger?.entries) ? candidateLedger.entries : [];
  if (candidateRecords.length < authorityRecords.length) {
    diagnostics.push('Candidate deletes budget-amendment history from the exact base');
  }
  for (const [index, record] of authorityRecords.entries()) {
    if (!isDeepStrictEqual(candidateRecords[index], record)) {
      diagnostics.push(`Candidate changes or reorders exact-base budget amendment ${record?.id || index + 1}`);
    }
  }
  if (candidateRecords.length > authorityRecords.length + 1) {
    diagnostics.push('Candidate may append only one budget amendment at a time');
  }
  for (const record of candidateRecords.filter(entry => entry?.kind === 'authorization')) {
    const evidenceRecords = [
      record?.prototypeContract,
      ...(Array.isArray(record?.reports) ? record.reports : []),
    ].filter(value => typeof value?.path === 'string');
    for (const evidenceRecord of evidenceRecords) {
      if (reportHashes[evidenceRecord.path] !== evidenceRecord.sha256) {
        diagnostics.push(`${record.id} evidence ${evidenceRecord.path} SHA-256 does not match its ledger record`);
      }
    }
  }

  const appended = candidateRecords.length === authorityRecords.length + 1 ?
    candidateRecords.at(-1) : null;
  const authorityCeiling = authorityContract?.baseline?.absoluteCeilingBytes;
  const candidateCeiling = candidateContract?.baseline?.absoluteCeilingBytes;
  const ceilingChanged = authorityCeiling !== candidateCeiling;
  let amendment = null;
  let mode = 'none';

  if (appended?.kind === 'authorization') {
    mode = 'authorize';
    amendment = appended;
    if (ceilingChanged) {
      diagnostics.push('A pull request cannot add and consume its own budget amendment');
    }
    if (authority.pending) {
      diagnostics.push(`Cannot append ${appended.id} while ${authority.pending.id} is pending`);
    }
    const allowed = changedFilesForAuthorization(appended);
    const unauthorized = changedFiles.filter(path => !allowed.has(path)).sort();
    const evidenceRecords = [
      appended?.prototypeContract,
      ...(Array.isArray(appended?.reports) ? appended.reports : []),
    ].filter(value => typeof value?.path === 'string');
    const missing = [ledgerPath, ...evidenceRecords.map(record => record.path)]
      .filter(path => !changedFiles.includes(path));
    if (unauthorized.length || missing.length) {
      diagnostics.push(
        `An authorization pull request may change only its ledger, immutable evidence, and performance documentation; unauthorized: ${unauthorized.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`
      );
    }
    if (changedFileEntries) {
      for (const path of changedFiles) {
        const change = changedFileEntries[path];
        if (change?.candidateMode !== '100644' || change.status === 'deleted') {
          diagnostics.push(`Authorization file ${path} must be a regular committed file`);
        }
      }
      for (const path of [ledgerPath, ...evidenceRecords.map(record => record.path)]) {
        const change = changedFileEntries[path];
        if (!change || change.candidateMode !== '100644' ||
            (path !== ledgerPath && change.status !== 'added')) {
          diagnostics.push(`Authorization file ${path} must be a regular committed ${path === ledgerPath ? 'ledger' : 'new evidence'} file`);
        }
      }
    }
    diagnostics.push(...validatePrototypeEvidence(appended, evidenceReports, authorityContract));
    diagnostics.push(...validateGovernanceEvidence({
      amendment: appended,
      approvalComments,
      contract: authorityContract,
      evidenceComments,
      headSha,
      pullRequestAuthorLogin,
      pullRequestNumber,
    }));
  } else if (appended?.kind === 'revocation') {
    mode = 'revoke';
    amendment = authority.pending;
    if (ceilingChanged) {
      diagnostics.push('A revocation pull request cannot change the active ceiling');
    }
    if (!authority.pending || appended.amendmentId !== authority.pending.id) {
      diagnostics.push(`${appended.id} does not revoke the pending exact-base amendment`);
    }
    const allowed = changedFilesForRevocation();
    const unauthorized = changedFiles.filter(path => !allowed.has(path)).sort();
    if (!changedFiles.includes(ledgerPath) || unauthorized.length) {
      diagnostics.push(
        `A revocation pull request may change only its ledger and performance documentation; unauthorized: ${unauthorized.join(', ') || 'none'}`
      );
    }
    if (changedFileEntries && changedFileEntries[ledgerPath]?.candidateMode !== '100644') {
      diagnostics.push('Revocation ledger must be a regular committed file');
    }
    if (changedFileEntries) {
      for (const path of changedFiles) {
        const change = changedFileEntries[path];
        if (change?.candidateMode !== '100644' || change.status === 'deleted') {
          diagnostics.push(`Revocation file ${path} must be a regular committed file`);
        }
      }
    }
    diagnostics.push(...validateGovernanceEvidence({
      amendment: appended,
      approvalComments,
      contract: authorityContract,
      evidenceComments,
      headSha,
      pullRequestAuthorLogin,
      pullRequestNumber,
    }));
  } else if (ceilingChanged) {
    mode = 'consume';
    amendment = authority.pending;
    if (!amendment) {
      diagnostics.push('Candidate changes the ceiling without a pending exact-base amendment');
    } else if (candidateCeiling !== amendment.proposedCeilingBytes) {
      diagnostics.push(`Candidate ceiling must consume ${amendment.id} proposed ceiling ${amendment.proposedCeilingBytes}`);
    } else if (!baseReport || !currentReport) {
      diagnostics.push('Consuming a budget amendment requires exact-base and current measured reports');
    } else {
      const delta = measuredDelta(
        baseReport,
        currentReport,
        authorityContract,
        `${amendment.id} consumption`,
        {
          baseCeiling: amendment.previousCeilingBytes,
          baseContract: authorityContract,
          currentCeiling: amendment.proposedCeilingBytes,
          currentContract: candidateContract,
        }
      );
      diagnostics.push(...validateMeasuredScope(amendment, delta, `${amendment.id} consumption`));
    }
  }

  return {
    activeCeilingBytes: candidateCeiling,
    amendment,
    diagnostics,
    mode,
    requiresExactHeadGrowthApproval: mode === 'consume',
    schemaVersion: 1,
    status: diagnostics.length ? 'rejected' : 'accepted',
  };
}

function parseTree(output) {
  const files = new Map();
  for (const entry of output.split('\0')) {
    if (!entry) {
      continue;
    }
    const match = entry.match(/^(\d+) (\w+) ([a-f\d]+)\t(.+)$/s);
    if (!match) {
      throw new Error('Unable to parse committed Git tree');
    }
    files.set(match[4], { mode: match[1], object: match[3], type: match[2] });
  }
  return files;
}

async function committedTree(root) {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', root, 'ls-tree', '-r', '-z', '--full-tree', 'HEAD'],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  return parseTree(stdout);
}

async function checkoutHead(root) {
  const { stdout } = await execFileAsync('git', ['-C', root, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  });
  return stdout.trim();
}

async function committedCheckoutState(
  baseRoot,
  candidateRoot,
  expectedHead,
  expectedBaseHead
) {
  const [baseTree, candidateTree, baseHead, candidateHead] = await Promise.all([
    committedTree(baseRoot),
    committedTree(candidateRoot),
    checkoutHead(baseRoot),
    checkoutHead(candidateRoot),
  ]);
  if (candidateHead !== expectedHead) {
    throw new Error(`Requested head SHA ${expectedHead} does not match checkout ${candidateHead}`);
  }
  if (expectedBaseHead && baseHead !== expectedBaseHead) {
    throw new Error(`Requested base SHA ${expectedBaseHead} does not match authority checkout ${baseHead}`);
  }
  const paths = [...new Set([...baseTree.keys(), ...candidateTree.keys()])].sort();
  const entries = {};
  for (const path of paths) {
    const base = baseTree.get(path);
    const candidate = candidateTree.get(path);
    if (base?.mode === candidate?.mode && base?.type === candidate?.type &&
        base?.object === candidate?.object) {
      continue;
    }
    entries[path] = {
      baseMode: base?.mode || null,
      candidateMode: candidate?.mode || null,
      status: !base ? 'added' : !candidate ? 'deleted' : 'modified',
    };
  }
  return { baseHead, baseTree, candidateHead, candidateTree, entries, paths: Object.keys(entries) };
}

export async function committedCheckoutChanges(
  baseRoot,
  candidateRoot,
  expectedHead,
  expectedBaseHead
) {
  const state = await committedCheckoutState(
    baseRoot,
    candidateRoot,
    expectedHead,
    expectedBaseHead
  );
  return { entries: state.entries, paths: state.paths };
}

async function committedBlob(root, tree, path) {
  const entry = tree.get(path);
  if (!entry || entry.mode !== '100644' || entry.type !== 'blob') {
    const error = new Error(`Committed file ${path} is missing or is not a regular blob`);
    error.code = 'COMMITTED_FILE_INVALID';
    throw error;
  }
  const { stdout } = await execFileAsync('git', ['-C', root, 'cat-file', 'blob', entry.object], {
    encoding: null,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export async function readCommittedBudgetFile(root, path, expectedHead) {
  const [tree, head] = await Promise.all([committedTree(root), checkoutHead(root)]);
  if (head !== expectedHead) {
    throw new Error(`Requested head SHA ${expectedHead} does not match checkout ${head}`);
  }
  return committedBlob(root, tree, path);
}

async function committedLedger(root, tree) {
  const contents = await committedBlob(root, tree, ledgerPath);
  return parseBudgetAmendmentLedger(contents.toString('utf8'));
}

async function evidenceFiles(candidateRoot, candidateTree, candidateLedger) {
  const reports = candidateLedger.entries
    .filter(entry => entry.kind === 'authorization')
    .flatMap(entry => [
      entry?.prototypeContract,
      ...(Array.isArray(entry?.reports) ? entry.reports : []),
    ]);
  const hashes = {};
  const values = {};
  for (const report of reports) {
    if (typeof report?.path !== 'string' ||
        !report.path.startsWith('evidence/performance-budget-amendments/') ||
        report.path.includes('//') || report.path.split('/').includes('..')) {
      continue;
    }
    const contents = await committedBlob(candidateRoot, candidateTree, report.path);
    hashes[report.path] = createHash('sha256').update(contents).digest('hex');
    try {
      values[report.path] = JSON.parse(contents);
    } catch {
      values[report.path] = null;
    }
  }
  return { hashes, values };
}

export async function evaluateBudgetAmendmentFromCheckouts({
  approvalComments,
  authorityContract,
  authorityContractPath,
  baseReport,
  candidateContract,
  candidateRoot = '.',
  currentReport,
  evidenceComments,
  expectedBaseHead,
  headSha,
  pullRequestAuthorLogin,
  pullRequestNumber,
}) {
  if (typeof expectedBaseHead !== 'string' || !/^[a-f\d]{40}$/.test(expectedBaseHead)) {
    throw new Error('Budget-amendment evaluation requires an independently verified base SHA');
  }
  const authorityRoot = resolve(dirname(authorityContractPath), '..');
  const resolvedCandidateRoot = resolve(candidateRoot);
  const state = await committedCheckoutState(
    authorityRoot,
    resolvedCandidateRoot,
    headSha,
    expectedBaseHead
  );
  let authorityLedger;
  let bootstrap = false;
  try {
    authorityLedger = await committedLedger(authorityRoot, state.baseTree);
  } catch (error) {
    if (error.code !== 'COMMITTED_FILE_INVALID') {
      throw error;
    }
    authorityLedger = bootstrapBudgetAmendmentLedger(state.baseHead);
    bootstrap = true;
  }
  const candidateLedger = await committedLedger(resolvedCandidateRoot, state.candidateTree);
  if (bootstrap && candidateLedger.entries.length) {
    throw new Error('The pinned empty-ledger bootstrap cannot add an authorization');
  }
  const [committedAuthorityContract, committedCandidateContract] = await Promise.all([
    committedBlob(authorityRoot, state.baseTree, 'config/performance.json')
      .then(contents => JSON.parse(contents.toString('utf8'))),
    committedBlob(resolvedCandidateRoot, state.candidateTree, 'config/performance.json')
      .then(contents => JSON.parse(contents.toString('utf8'))),
  ]);
  if (!isDeepStrictEqual(authorityContract, committedAuthorityContract) ||
      !isDeepStrictEqual(candidateContract, committedCandidateContract)) {
    throw new Error('Performance contracts differ from their verified committed Git blobs');
  }
  const evidence = await evidenceFiles(
    resolvedCandidateRoot,
    state.candidateTree,
    candidateLedger
  );
  return validateBudgetAmendmentTransition({
    approvalComments,
    authorityContract,
    authorityLedger,
    baseReport,
    candidateContract,
    candidateLedger,
    changedFileEntries: state.entries,
    changedFiles: state.paths,
    currentReport,
    evidenceComments,
    evidenceReports: evidence.values,
    headSha,
    pullRequestAuthorLogin,
    pullRequestNumber,
    reportHashes: evidence.hashes,
  });
}

export function validateBudgetAmendmentScope(amendment, artifactPaths, newSubpaths) {
  const unauthorizedArtifacts = artifactPaths
    .filter(path => !amendment.authorizedArtifactPaths.includes(path)).sort();
  const unauthorizedSubpaths = newSubpaths
    .filter(path => !amendment.authorizedNewSubpaths.includes(path)).sort();
  const violations = [];
  if (unauthorizedArtifacts.length) {
    violations.push(`Budget amendment ${amendment.id} does not authorize artifacts: ${unauthorizedArtifacts.join(', ')}`);
  }
  if (unauthorizedSubpaths.length) {
    violations.push(`Budget amendment ${amendment.id} does not authorize new subpaths: ${unauthorizedSubpaths.join(', ')}`);
  }
  return violations;
}

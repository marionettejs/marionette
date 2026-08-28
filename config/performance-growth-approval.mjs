import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';

const marker = '<!-- marionette-performance-growth-approval:v1 -->';
const requiredRecordFields = ['approvedPaths', 'evidenceUrls', 'headSha', 'issueUrl', 'schemaVersion'];
const optionalRecordFields = ['approvedNewArtifacts', 'approvedNewSubpaths'];
const recordFields = [...requiredRecordFields, ...optionalRecordFields];
const allowedAuthorAssociations = new Set(['COLLABORATOR', 'MEMBER', 'OWNER']);
const bodyLimit = 16 * 1024;
const execFileAsync = promisify(execFile);
const pathLimit = 50;
const evidenceLimit = 20;

function diagnostic(code, message, commentUrl) {
  return commentUrl ? { code, commentUrl, message } : { code, message };
}

function uniqueSortedStrings(values, limit, allowEmpty = false) {
  return Array.isArray(values) && (allowEmpty || values.length > 0) && values.length <= limit &&
    values.every(value => typeof value === 'string' && value.length > 0) &&
    new Set(values).size === values.length &&
    values.every((value, index) => index === 0 || values[index - 1] < value);
}

function validSubpath(subpath) {
  return /^\.\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(subpath) &&
    !subpath.includes('//') && !subpath.split('/').includes('..');
}

function validSourcePath(path) {
  return typeof path === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*\.js$/.test(path) &&
    !path.includes('//') && !path.split('/').includes('..');
}

function validNewArtifacts(artifacts) {
  return Array.isArray(artifacts) && artifacts.length <= pathLimit &&
    artifacts.every((artifact, index) => {
      return artifact && typeof artifact === 'object' && !Array.isArray(artifact) &&
        isDeepStrictEqual(Object.keys(artifact).sort(), ['path', 'size']) &&
        validArtifactPath(artifact.path) && Number.isInteger(artifact.size) && artifact.size >= 0 &&
        (index === 0 || artifacts[index - 1].path < artifact.path);
    });
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
  const canonical = {
    schemaVersion: record.schemaVersion,
    headSha: record.headSha,
    issueUrl: record.issueUrl,
    approvedPaths: record.approvedPaths,
  };
  if (Object.hasOwn(record, 'approvedNewSubpaths')) {
    canonical.approvedNewSubpaths = record.approvedNewSubpaths;
  }
  if (Object.hasOwn(record, 'approvedNewArtifacts')) {
    canonical.approvedNewArtifacts = record.approvedNewArtifacts;
  }
  canonical.evidenceUrls = record.evidenceUrls;
  return canonical;
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
  const missingFields = requiredRecordFields
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
  const hasNewSubpaths = Object.hasOwn(record, 'approvedNewSubpaths');
  const hasNewArtifacts = Object.hasOwn(record, 'approvedNewArtifacts');
  if (!uniqueSortedStrings(record.approvedPaths, pathLimit, hasNewSubpaths && hasNewArtifacts) ||
      !record.approvedPaths.every(validArtifactPath)) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_PATHS',
      'Approval approvedPaths must contain sorted, unique safe runtime artifact paths'
    ));
  }
  if (hasNewSubpaths !== hasNewArtifacts || (hasNewSubpaths &&
      (!uniqueSortedStrings(record.approvedNewSubpaths, pathLimit) ||
        !record.approvedNewSubpaths.every(validSubpath)))) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_NEW_SUBPATHS',
      'Approval new-subpath fields must be paired and approvedNewSubpaths must contain sorted, unique safe package subpaths'
    ));
  }
  if (hasNewArtifacts && !validNewArtifacts(record.approvedNewArtifacts)) {
    diagnostics.push(diagnostic(
      'GROWTH_APPROVAL_NEW_ARTIFACTS',
      'Approval approvedNewArtifacts must contain sorted, unique safe paths with full non-negative integer Brotli sizes'
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

function graphMap(report, label) {
  if (!Array.isArray(report?.graphs)) {
    throw new Error(`${label} report graphs must be an array`);
  }
  const graphs = new Map();
  for (const graph of report.graphs) {
    if (typeof graph?.subpath !== 'string' || graphs.has(graph.subpath)) {
      throw new Error(`${label} report has an invalid or duplicate graph subpath ${graph?.subpath}`);
    }
    graphs.set(graph.subpath, graph);
  }
  return graphs;
}

function mapBy(items, key, label) {
  if (!Array.isArray(items)) {
    return { map: new Map(), violations: [`${label} must be an array`] };
  }
  const map = new Map();
  const violations = [];
  for (const item of items) {
    const value = item?.[key];
    if (typeof value !== 'string' || map.has(value)) {
      violations.push(`${label} has an invalid or duplicate ${key} ${value}`);
      continue;
    }
    map.set(value, item);
  }
  return { map, violations };
}

function exactObjectFields(value, fields) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), [...fields].sort());
}

export function validateCandidateGrowthContract(authority, candidate) {
  const violations = [];
  if (!authority || typeof authority !== 'object' || !candidate || typeof candidate !== 'object') {
    return ['Authority and candidate performance contracts must be objects'];
  }
  const authorityKeys = Object.keys(authority).sort();
  const candidateKeys = Object.keys(candidate).sort();
  if (!isDeepStrictEqual(authorityKeys, candidateKeys)) {
    violations.push('Candidate performance contract top-level fields differ from the exact-base contract');
  }
  for (const key of authorityKeys) {
    if (key === 'runtimeArtifacts' || key === 'productionGraphs') {
      continue;
    }
    if (!isDeepStrictEqual(authority[key], candidate[key])) {
      violations.push(`Candidate performance contract changes exact-base ${key}`);
    }
  }

  const authorityArtifacts = mapBy(authority.runtimeArtifacts, 'path', 'Exact-base runtimeArtifacts');
  const candidateArtifacts = mapBy(candidate.runtimeArtifacts, 'path', 'Candidate runtimeArtifacts');
  violations.push(...authorityArtifacts.violations, ...candidateArtifacts.violations);
  for (const [path, artifact] of authorityArtifacts.map) {
    if (!isDeepStrictEqual(candidateArtifacts.map.get(path), artifact)) {
      violations.push(`Candidate performance contract removes or changes exact-base runtime artifact ${path}`);
    }
  }
  for (const [path, artifact] of candidateArtifacts.map) {
    if (authorityArtifacts.map.has(path)) {
      continue;
    }
    if (!exactObjectFields(artifact, ['baselineBrotliBytes', 'name', 'path']) ||
        typeof artifact.name !== 'string' || !artifact.name || !validArtifactPath(path)) {
      violations.push(`New runtime artifact ${path} must contain only name, path, and baselineBrotliBytes`);
    }
    if (artifact.baselineBrotliBytes !== 0) {
      violations.push(`New runtime artifact ${path} baselineBrotliBytes must be 0`);
    }
  }

  const authorityGraphs = mapBy(authority.productionGraphs, 'subpath', 'Exact-base productionGraphs');
  const candidateGraphs = mapBy(candidate.productionGraphs, 'subpath', 'Candidate productionGraphs');
  violations.push(...authorityGraphs.violations, ...candidateGraphs.violations);
  for (const [subpath, graph] of authorityGraphs.map) {
    if (!isDeepStrictEqual(candidateGraphs.map.get(subpath), graph)) {
      violations.push(`Candidate performance contract removes or changes exact-base production graph ${subpath}`);
    }
  }
  for (const [subpath, graph] of candidateGraphs.map) {
    if (authorityGraphs.map.has(subpath)) {
      continue;
    }
    if (!exactObjectFields(graph, [
      'baselineExternalImports',
      'baselineModules',
      'input',
      'output',
      'subpath',
    ]) || !validSubpath(subpath) || !validSourcePath(graph.input) ||
        !validArtifactPath(graph.output)) {
      violations.push(`New production graph ${subpath} has an invalid additive contract shape`);
    }
    if (!Array.isArray(graph.baselineModules) || graph.baselineModules.length ||
        !Array.isArray(graph.baselineExternalImports) || graph.baselineExternalImports.length) {
      violations.push(`New production graph ${subpath} Phase 0 module baselines must be empty`);
    }
    if (!candidateArtifacts.map.has(graph.output)) {
      violations.push(`New production graph ${subpath} output must be a tracked runtime artifact`);
    }
  }

  return violations;
}

function reportContractViolations(
  report,
  expectedContract,
  authority,
  label,
  { allowAdditions = false } = {}
) {
  const violations = [];
  if (report?.schemaVersion !== 1) {
    violations.push(`${label} report schemaVersion must be 1`);
  }
  if (report?.baselineSourceCommit !== authority?.baseline?.sourceCommit ||
      report?.brotliQuality !== authority?.baseline?.brotliQuality ||
      !isDeepStrictEqual(report?.thresholds, authority?.thresholds) ||
      report?.cumulative?.baselineSize !== authority?.baseline?.totalBrotliBytes ||
      report?.cumulative?.absoluteCeiling !== authority?.baseline?.absoluteCeilingBytes) {
    violations.push(`${label} report does not use the exact-base performance authority`);
  }
  if (!Array.isArray(report?.violations)) {
    violations.push(`${label} report violations must be an array`);
  } else if (report.violations.length) {
    violations.push(`${label} report has contract violations: ${report.violations.join('; ')}`);
  }

  let reportArtifacts;
  let reportGraphs;
  try {
    reportArtifacts = artifactMap(report, label);
    reportGraphs = graphMap(report, label);
  } catch (error) {
    violations.push(error.message);
    return violations;
  }
  const expectedArtifacts = mapBy(
    expectedContract?.runtimeArtifacts,
    'path',
    `${label} expected runtimeArtifacts`
  );
  const expectedGraphs = mapBy(
    expectedContract?.productionGraphs,
    'subpath',
    `${label} expected productionGraphs`
  );
  violations.push(...expectedArtifacts.violations, ...expectedGraphs.violations);
  const missingArtifacts = [...expectedArtifacts.map.keys()]
    .filter(path => !reportArtifacts.has(path)).sort();
  const extraArtifacts = [...reportArtifacts.keys()]
    .filter(path => !expectedArtifacts.map.has(path)).sort();
  if (missingArtifacts.length || (!allowAdditions && extraArtifacts.length)) {
    violations.push(`${label} report artifact set mismatch; missing: ${missingArtifacts.join(', ') || 'none'}; extra: ${extraArtifacts.join(', ') || 'none'}`);
  }
  let artifactTotal = 0;
  for (const [path, artifact] of reportArtifacts) {
    const expected = expectedArtifacts.map.get(path);
    if (artifact.status !== 'measured' || !Number.isInteger(artifact.size) || artifact.size < 0) {
      violations.push(`${label} runtime artifact ${path} is not measured at a non-negative integer size`);
      continue;
    }
    artifactTotal += artifact.size;
    if (expected && artifact.name !== expected.name) {
      violations.push(`${label} runtime artifact ${path} name does not match its contract`);
    }
  }
  if (!Number.isInteger(report?.cumulative?.size) || report.cumulative.size !== artifactTotal) {
    violations.push(`${label} cumulative size does not equal the complete measured artifact set`);
  }
  if (artifactTotal > authority?.baseline?.absoluteCeilingBytes) {
    violations.push(`${label} cumulative size ${artifactTotal} exceeds the exact-base cumulative ceiling ${authority?.baseline?.absoluteCeilingBytes}`);
  }

  const missingGraphs = [...expectedGraphs.map.keys()]
    .filter(subpath => !reportGraphs.has(subpath)).sort();
  const extraGraphs = [...reportGraphs.keys()]
    .filter(subpath => !expectedGraphs.map.has(subpath)).sort();
  if (missingGraphs.length || (!allowAdditions && extraGraphs.length)) {
    violations.push(`${label} report graph set mismatch; missing: ${missingGraphs.join(', ') || 'none'}; extra: ${extraGraphs.join(', ') || 'none'}`);
  }
  for (const [subpath, graph] of reportGraphs) {
    const expected = expectedGraphs.map.get(subpath);
    if (graph.status !== 'measured' || !Array.isArray(graph.modules) ||
        !Array.isArray(graph.externalImports) || !Array.isArray(graph.forbiddenModules)) {
      violations.push(`${label} production graph ${subpath} is not completely measured`);
      continue;
    }
    if (graph.forbiddenModules.length) {
      violations.push(`${label} production graph ${subpath} includes forbidden modules`);
    }
    if (expected && (graph.input !== expected.input || graph.output !== expected.output)) {
      violations.push(`${label} production graph ${subpath} input or output does not match its contract`);
    }
  }
  return violations;
}

export function newProductionReportDelta(baseReport, currentReport) {
  const baseArtifacts = artifactMap(baseReport, 'Exact-base');
  const currentArtifacts = artifactMap(currentReport, 'Pull request');
  const baseGraphs = graphMap(baseReport, 'Exact-base');
  const currentGraphs = graphMap(currentReport, 'Pull request');
  const missingPaths = [...baseArtifacts.keys()].filter(path => !currentArtifacts.has(path)).sort();
  if (missingPaths.length) {
    throw new Error(`Pull request report is missing exact-base artifacts: ${missingPaths.join(', ')}`);
  }
  const missingSubpaths = [...baseGraphs.keys()].filter(subpath => !currentGraphs.has(subpath)).sort();
  if (missingSubpaths.length) {
    throw new Error(`Pull request report is missing exact-base production graphs: ${missingSubpaths.join(', ')}`);
  }
  const artifacts = [...currentArtifacts]
    .filter(([path]) => !baseArtifacts.has(path))
    .map(([path, artifact]) => {
      if (artifact.status !== 'measured' || !Number.isInteger(artifact.size) || artifact.size < 0) {
        throw new Error(`New runtime artifact ${path} is not measured at a non-negative integer size`);
      }
      return { path, size: artifact.size };
    })
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const subpaths = [...currentGraphs]
    .filter(([subpath]) => !baseGraphs.has(subpath))
    .map(([subpath, graph]) => {
      if (graph.status !== 'measured') {
        throw new Error(`New production graph ${subpath} is not measured`);
      }
      if (!Array.isArray(graph.forbiddenModules) || graph.forbiddenModules.length) {
        throw new Error(`New production graph ${subpath} includes forbidden modules`);
      }
      return subpath;
    })
    .sort();
  return { artifacts, subpaths };
}

export function requiredNewProductionApproval({
  authorityContract,
  baseReport,
  candidateContract,
  currentReport,
}) {
  const baseViolations = reportContractViolations(
    baseReport,
    authorityContract,
    authorityContract,
    'Exact-base'
  );
  if (baseViolations.length) {
    throw new Error(baseViolations.join('; '));
  }
  const delta = newProductionReportDelta(baseReport, currentReport);
  if (delta.artifacts.length && !delta.subpaths.length) {
    throw new Error('A new runtime artifact cannot be adopted without a new production subpath');
  }
  const effectiveContract = candidateContract || authorityContract;
  const contractViolations = validateCandidateGrowthContract(authorityContract, effectiveContract);
  if (contractViolations.length) {
    throw new Error(contractViolations.join('; '));
  }
  const currentViolations = reportContractViolations(
    currentReport,
    effectiveContract,
    authorityContract,
    'Pull request',
    { allowAdditions: !candidateContract }
  );
  if (currentViolations.length) {
    throw new Error(currentViolations.join('; '));
  }
  if (!delta.artifacts.length && !delta.subpaths.length || !candidateContract) {
    return { ...delta, enforced: !!candidateContract };
  }

  const authorityArtifacts = new Set(authorityContract.runtimeArtifacts.map(({ path }) => path));
  const candidateArtifacts = candidateContract.runtimeArtifacts
    .filter(({ path }) => !authorityArtifacts.has(path))
    .map(({ path }) => path)
    .sort();
  const authoritySubpaths = new Set(authorityContract.productionGraphs.map(({ subpath }) => subpath));
  const candidateSubpaths = candidateContract.productionGraphs
    .filter(({ subpath }) => !authoritySubpaths.has(subpath))
    .map(({ subpath }) => subpath)
    .sort();
  if (!isDeepStrictEqual(candidateArtifacts, delta.artifacts.map(({ path }) => path))) {
    throw new Error('Candidate contract new runtime artifacts do not match the measured report');
  }
  if (!isDeepStrictEqual(candidateSubpaths, delta.subpaths)) {
    throw new Error('Candidate contract new production graphs do not match the measured report');
  }
  const candidateGraphsBySubpath = new Map(candidateContract.productionGraphs
    .map(graph => [graph.subpath, graph]));
  const currentGraphsBySubpath = graphMap(currentReport, 'Pull request');
  for (const subpath of delta.subpaths) {
    const candidateGraph = candidateGraphsBySubpath.get(subpath);
    const currentGraph = currentGraphsBySubpath.get(subpath);
    if (currentGraph.input !== candidateGraph.input || currentGraph.output !== candidateGraph.output) {
      throw new Error(`Measured new production graph ${subpath} does not match its candidate contract input and output`);
    }
  }

  return { ...delta, enforced: true };
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
  authorityContract,
  baseReport,
  candidateContract,
  comments,
  currentReport,
  evidenceComments,
  headSha,
  policy,
  pullRequestNumber,
  thresholdPercent,
}) {
  let required = [];
  let newArtifacts = [];
  let newProductionEnforced = false;
  let newSubpaths = [];
  const diagnostics = validateGrowthApprovalPolicy(policy);
  try {
    required = requiredArtifactGrowth(baseReport, currentReport, thresholdPercent);
    if (authorityContract) {
      const validated = requiredNewProductionApproval({
        authorityContract,
        baseReport,
        candidateContract,
        currentReport,
      });
      newArtifacts = validated.artifacts;
      newProductionEnforced = validated.enforced;
      newSubpaths = validated.subpaths;
    } else {
      const newProduction = newProductionReportDelta(baseReport, currentReport);
      newArtifacts = newProduction.artifacts;
      newSubpaths = newProduction.subpaths;
    }
  } catch (error) {
    diagnostics.push(diagnostic('GROWTH_APPROVAL_REPORT', error.message));
  }
  const result = {
    approval: null,
    diagnostics,
    headSha,
    ignored: [],
    newArtifacts,
    newProductionEnforced,
    newSubpaths,
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
  if (!required.length && (!newProductionEnforced ||
      !newArtifacts.length && !newSubpaths.length)) {
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
      approvedNewArtifacts: parsed.approval.approvedNewArtifacts,
      approvedNewSubpaths: parsed.approval.approvedNewSubpaths,
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

  if (newProductionEnforced) {
    const approvedNewSubpaths = result.approval.approvedNewSubpaths || [];
    const missingSubpaths = newSubpaths.filter(subpath => !approvedNewSubpaths.includes(subpath));
    const extraSubpaths = approvedNewSubpaths.filter(subpath => !newSubpaths.includes(subpath));
    if (missingSubpaths.length || extraSubpaths.length) {
      result.status = 'invalid';
      result.diagnostics.push(diagnostic(
        'GROWTH_APPROVAL_NEW_SUBPATH_SET_MISMATCH',
        `Approval new subpaths mismatch; missing: ${missingSubpaths.join(', ') || 'none'}; extra: ${extraSubpaths.join(', ') || 'none'}`,
        result.approval.commentUrl
      ));
      return result;
    }

    const approvedNewArtifacts = result.approval.approvedNewArtifacts || [];
    if (!isDeepStrictEqual(approvedNewArtifacts, newArtifacts)) {
      result.status = 'invalid';
      result.diagnostics.push(diagnostic(
        'GROWTH_APPROVAL_NEW_ARTIFACT_SET_MISMATCH',
        'Approval new artifact paths and full Brotli sizes do not match the measured report',
        result.approval.commentUrl
      ));
      return result;
    }
  }

  const availableEvidence = new Set(evidenceComments.comments
    .filter(comment => comment?.user?.type === 'User' &&
      allowedAuthorAssociations.has(comment?.author_association) &&
      evidenceCommentUrl(policy.repository, issueNumber, comment))
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

async function currentCheckoutHead() {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return stdout.trim();
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
    newArtifacts: [],
    newProductionEnforced: false,
    newSubpaths: [],
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
    const checkoutHeadSha = await currentCheckoutHead();
    if (headSha !== checkoutHeadSha) {
      throw new Error(`Requested head SHA ${headSha} does not match checkout ${checkoutHeadSha}`);
    }
    const pullRequestNumber = parsePullRequestNumber(getArgument(args, '--pull-request'));
    const candidateContractPath = args.includes('--candidate-contract') ?
      getArgument(args, '--candidate-contract') : null;
    const [contract, candidateContract, baseReport, currentReport, comments, evidenceComments] =
      await Promise.all([
        readJson(getArgument(args, '--contract')),
        candidateContractPath ? readJson(candidateContractPath) : null,
        readJson(getArgument(args, '--base-report')),
        readJson(getArgument(args, '--current-report')),
        readJson(getArgument(args, '--comments')),
        readJson(getArgument(args, '--evidence-comments')),
      ]);
    result = validateGrowthApproval({
      authorityContract: contract,
      baseReport,
      candidateContract,
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

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const candidateChecks = Object.freeze([
  ['profile', 'check:release-profile'],
  ['browser-profile', 'check:browser-profile'],
  ['diagnostics', 'check:diagnostics'],
  ['public-tests', 'check:public-tests'],
  ['workflows', 'check:workflows'],
  ['source-types', 'check:types'],
  ['consumer-types', 'test:types'],
  ['lint', 'lint:ci'],
  ['tooling', 'coverage:tooling'],
  ['source', 'test:source'],
  ['coverage', 'coverage'],
  ['documentation', 'docs:check'],
  ['distribution', 'test:dist'],
  ['browser', 'test:browser'],
  ['fixtures', 'test:fixtures'],
].map(([id, script]) => Object.freeze({ id, script })));

export function containedArtifactPath(directory, file) {
  if (typeof file !== 'string' || !file || file === '.' || file === '..' || /[/\\:]/.test(file)) {
    throw new Error(`Release artifact must use a contained file name: ${file}`);
  }
  return resolve(directory, file);
}

export function digest(bytes) {
  return createHash('sha512').update(bytes).digest('hex');
}

export async function verifyCandidateValidation(directory, evidenceBytes) {
  const bytes = await readFile(resolve(directory, 'candidate-validation.json'));
  const checksum = (await readFile(resolve(directory, 'candidate-validation.sha512'), 'utf8')).trim();
  if (checksum !== `${digest(bytes)}  candidate-validation.json`) {
    throw new Error('Candidate validation checksum mismatch.');
  }
  const report = JSON.parse(bytes);
  const evidence = JSON.parse(evidenceBytes);
  if (report.schemaVersion !== 1 || report.evidenceSha512 !== digest(evidenceBytes) ||
      report.sourceCommit !== evidence.source.commit || report.status !== 'passed') {
    throw new Error('Candidate validation does not certify this release evidence.');
  }
  if (!Array.isArray(report.checks) || report.checks.length !== candidateChecks.length ||
      report.checks.some((check, index) => check.id !== candidateChecks[index].id ||
        check.script !== candidateChecks[index].script || check.status !== 'passed' || check.exitCode !== 0)) {
    throw new Error('Candidate validation is missing a successful required check.');
  }
  const attachmentNames = ['browser-candidate.json', 'browser-results.json', 'fixtures-report.json'];
  if (!Array.isArray(report.attachments) ||
      JSON.stringify(report.attachments.map(asset => asset.file).sort()) !== JSON.stringify(attachmentNames)) {
    throw new Error('Candidate validation is missing required browser or fixture evidence.');
  }
  const assets = [
    { file: 'candidate-validation.json', sha512: digest(bytes) },
    { file: 'candidate-validation.sha512', sha512: digest(Buffer.from(`${checksum}\n`)) },
    ...report.checks.map(check => check.log),
    ...report.attachments,
  ];
  const names = new Set();
  for (const asset of assets) {
    if (names.has(asset.file)) { throw new Error(`Duplicate validation asset: ${asset.file}`); }
    names.add(asset.file);
    const assetBytes = await readFile(containedArtifactPath(directory, asset.file));
    if (digest(assetBytes) !== asset.sha512) {
      throw new Error(`Candidate validation asset checksum mismatch: ${asset.file}`);
    }
  }
  const browserCandidate = JSON.parse(await readFile(resolve(directory, 'browser-candidate.json'), 'utf8'));
  if (browserCandidate.source?.commit !== evidence.source.commit ||
      browserCandidate.packages?.length !== evidence.packages.length ||
      evidence.packages.some(entry => !browserCandidate.packages.some(candidate =>
        candidate.id === entry.id && candidate.name === entry.name && candidate.version === entry.version &&
        candidate.tarball.sha512 === entry.tarball.sha512))) {
    throw new Error('Browser validation used different candidate artifacts.');
  }
  const browser = JSON.parse(await readFile(resolve(directory, 'browser-results.json'), 'utf8'));
  const profile = JSON.parse(await readFile(resolve(import.meta.dirname, '../../config/release-profile.json'), 'utf8'));
  const inventory = JSON.parse(await readFile(resolve(import.meta.dirname, '../../config/release-validation.json'), 'utf8'));
  const engineNames = profile.browsers.playwright.browserBuilds.map(engine => engine.name).sort();
  const expectedBrowserTests = inventory.browserTests.flatMap(({ file, title }) =>
    engineNames.map(projectName => JSON.stringify([file, title, projectName]))).sort();
  const browserTests = [];
  function visit(suites) {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests) { browserTests.push({ ...test, file: spec.file, title: spec.title }); }
      }
      visit(suite.suites);
    }
  }
  visit(browser.suites);
  if (!browserTests.length || !Array.isArray(browser.errors) || browser.errors.length !== 0 || browser.stats?.unexpected !== 0 ||
      browser.stats?.skipped !== 0 || browser.stats?.flaky !== 0 || browser.stats?.expected !== browserTests.length ||
      JSON.stringify(browserTests.map(({ file, title, projectName }) => JSON.stringify([file, title, projectName])).sort()) !==
        JSON.stringify(expectedBrowserTests) ||
      browserTests.some(test => test.status !== 'expected' || test.expectedStatus !== 'passed' ||
        test.results.length !== 1 || test.results[0].status !== 'passed')) {
    throw new Error('Browser validation did not pass every case in every required engine.');
  }
  const fixtures = JSON.parse(await readFile(resolve(directory, 'fixtures-report.json'), 'utf8'));
  const fixturesRoot = resolve(import.meta.dirname, '../../test/fixtures');
  const expectedFixtures = inventory.fixtures.toSorted();
  if (fixtures.status !== 'passed' || fixtures.schemaVersion !== 1 ||
      fixtures.artifacts?.length !== evidence.packages.length ||
      evidence.packages.some(entry => !fixtures.artifacts.some(artifact => artifact.name === entry.name &&
        artifact.version === entry.version && artifact.sha256 === entry.tarball.sha256)) ||
      JSON.stringify(fixtures.fixtures?.map(entry => entry.name).sort()) !== JSON.stringify(expectedFixtures) ||
      fixtures.fixtures.some(entry => entry.status !== 'passed' || entry.stage !== 'validate' ||
        !entry.lockSha256 || !entry.candidateLockSha256 || !entry.installedGraph)) {
    throw new Error('Fixture validation did not pass every locked consumer using the candidate artifacts.');
  }
  for (const entry of fixtures.fixtures) {
    const lockBytes = await readFile(resolve(fixturesRoot, entry.name, 'package-lock.json'));
    if (createHash('sha256').update(lockBytes).digest('hex') !== entry.lockSha256) {
      throw new Error(`Fixture lock changed after validation: ${entry.name}`);
    }
  }
  return assets;
}

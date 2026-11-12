import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const readJson = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const workflows = Object.fromEntries(await Promise.all(['ci', 'html', 'release'].map(async name =>
  [name, parse(await readFile(resolve(root, `.github/workflows/${name}.yml`), 'utf8'))])));
const browserJobs = [
  ['ci', 'browsers'], ['ci', 'agent-reference'], ['ci', 'performance-timing'],
  ['release', 'build'], ['html', 'verify'],
];

test('browser CI images match their independently maintained Playwright scope', async() => {
  const profile = await readJson('config/release-profile.json');
  const rootImages = [];
  for (const [file, name] of browserJobs) {
    const prefix = file === 'html' ? 'packages/html/' : '';
    const manifest = await readJson(`${prefix}package.json`);
    const lock = await readJson(`${prefix}package-lock.json`);
    const version = manifest.devDependencies['@playwright/test'];
    if (file !== 'html') { assert.equal(version, profile.browsers.playwright.version); }
    assert.equal(lock.packages['node_modules/playwright-core'].version, version);
    const image = workflows[file].jobs[name].container.image;
    const imagePrefix = `mcr.microsoft.com/playwright:v${version}-noble@sha256:`;
    assert.ok(image.startsWith(imagePrefix), 'Container version must match the package being tested');
    assert.match(image.slice(imagePrefix.length), /^[a-f0-9]{64}$/, 'Pin the verified registry digest');
    if (file !== 'html') { rootImages.push(image); }
  }
  assert.equal(new Set(rootImages).size, 1, 'Root browser jobs must use the same reviewed image');
});

test('browser containers retain non-root isolation, exact source tools and executable checks', () => {
  for (const [file, name] of browserJobs) {
    const job = workflows[file].jobs[name];
    assert.equal(job['runs-on'], 'ubuntu-24.04');
    assert.equal(job.container.options, '--user 1001:1001 --shm-size=1g');
    assert.equal(job.defaults.run.shell, 'bash');
    assert.equal(job.env.PLAYWRIGHT_BROWSERS_PATH, '/ms-playwright');
    const setup = job.steps.find(step => step.uses?.startsWith('actions/setup-node@'));
    assert.equal(setup.with['node-version-file'], '.nvmrc');
    assert.ok(job.steps.some(step => step.run?.includes('check:release-profile -- --host linux-x64 --runner ubuntu-24.04')));
    const provisionCommand = 'node scripts/checks/provisioned-browsers.mjs' + (file === 'html' ? ' --package-dir packages/html' : '');
    const provision = job.steps.find(step => step.run === provisionCommand);
    assert.equal(provision['timeout-minutes'], 2);
    assert.ok(!job.steps.some(step => /--with-deps|\bapt(?:-get)?\b/.test(step.run || '')),
      `${file}/${name} must not reinstall OS packages from the runner mirror`);
  }
});

test('timing installs and runs the exact base browser outside the candidate image cache', () => {
  const timing = workflows.ci.jobs['performance-timing'];
  const installation = timing.steps.find(step => step.name === 'Install exact base Chromium');
  assert.equal(installation['working-directory'], 'test/tmp/performance-base');
  assert.equal(installation.env.PLAYWRIGHT_BROWSERS_PATH, '${{ runner.temp }}/playwright-base');
  assert.equal(installation.run, 'npx --no-install playwright install chromium');
  assert.equal(installation['timeout-minutes'], 10);
  const measurement = timing.steps.find(step => step.name === 'Measure browser timing on exact base and candidate');
  assert.match(measurement.run, /cd test\/tmp\/performance-base && PLAYWRIGHT_BROWSERS_PATH="\$\{RUNNER_TEMP\}\/playwright-base" node scripts\/performance\/browser\.mjs/);
  assert.match(measurement.run, /\nnode scripts\/performance\/browser\.mjs --profile baseline/);
});

test('the container repair preserves browser suites, exact-artifact validation and the required aggregate', () => {
  const includesRun = (job, command) => job.steps.some(step => step.run === command);
  assert.ok(includesRun(workflows.ci.jobs.browsers, 'npm run test:browser'));
  const trace = workflows.ci.jobs.browsers.steps.find(step => step.name === 'Trace native Router contract failures separately');
  assert.equal(trace.run, 'npm run test:browser -- --config playwright.router-diagnostics.config.mjs');
  assert.equal(trace.if, '${{ !cancelled() && steps.browser_suite.outcome != \'skipped\' }}');
  assert.equal(workflows.ci.jobs.browsers.steps.find(step => step.run === 'npm run test:browser').id, 'browser_suite');
  assert.ok(includesRun(workflows.ci.jobs.browsers, 'npm run test:browser-performance'));
  assert.ok(includesRun(workflows.ci.jobs['agent-reference'], 'npm run test:agent-app'));
  assert.ok(includesRun(workflows.html.jobs.verify, 'npm --prefix packages/html run test:packed:browser'));
  assert.ok(includesRun(workflows.release.jobs.build, 'npm run release:validate -- --artifact-dir release'));
  assert.deepEqual(workflows.ci.jobs.test.needs, ['core', 'tooling', 'browsers', 'router-browsers', 'agent-reference', 'linux-package-smoke']);
  assert.equal(workflows.ci.jobs.test.name, 'Node 24');
  assert.equal(workflows.ci.jobs.test.if, 'always()');
  for (const workflow of Object.values(workflows)) {
    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (!browserJobs.some(([file, id]) => workflows[file] === workflow && id === name)) {
        assert.equal(job.container, undefined, `${name} must retain its existing host environment`);
      }
    }
  }
});

test('Router archive keeps independent engine evidence without relaxing the required gate', () => {
  const producer = workflows.ci.jobs['router-browser-candidate'];
  assert.equal(producer['runs-on'], 'ubuntu-24.04');
  assert.equal(producer.outputs.source_sha, '${{ steps.candidate.outputs.source_sha }}');
  assert.equal(producer.outputs.archive_sha256, '${{ steps.candidate.outputs.archive_sha256 }}');
  assert.ok(producer.steps.find(step => step.id === 'candidate').run.includes('npm run router:prepare'));
  const transfer = producer.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(transfer.with.name, 'router-browser-candidate');
  assert.equal(transfer.with['if-no-files-found'], 'error');
  const job = workflows.ci.jobs['router-browsers'];
  assert.equal(job['runs-on'], 'macos-15');
  assert.equal(job.needs, 'router-browser-candidate');
  assert.equal(job.container, undefined);
  const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ needs.router-browser-candidate.outputs.source_sha }}');
  assert.ok(job.steps.some(step => step.run?.includes('--host macos-arm64 --runner macos-15')));
  const receive = job.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
  assert.equal(receive.with.name, transfer.with.name);
  const install = job.steps.find(step => step.name === 'Install pinned browser binaries');
  assert.equal(install.run, 'npx --no-install playwright install chromium firefox webkit');
  const probe = job.steps.find(step => step.run === 'node test/router/browser-probes.mjs');
  assert.equal(probe.run, 'node test/router/browser-probes.mjs');
  assert.equal(probe['continue-on-error'], true);
  const archive = job.steps.find(step => step.name === 'Test exact installed Router archive on all engines');
  assert.ok(archive.run.includes('\'--artifact\', archive'));
  assert.ok(archive.run.includes('\'--sha256\', process.env.ROUTER_ARCHIVE_SHA256, \'--registry-peers\', \'--browser\''));
  for (const assertion of ['readFileSync(join(directory, \'router-candidate.json\'))',
    'assert.equal(prepared.sourceCommit, source)', 'assert.equal(prepared.sourceDirty, false)',
    'assert.equal(verified.archiveSourceCommit, source)', 'assert.equal(verified.verificationCommit, source)',
    'assert.equal(verified.verificationDirty, false)', 'assert.equal(run.status, 0)',
    'assert.equal(verified.host.platform, \'darwin\')', 'assert.equal(verified.host.architecture, \'arm64\')']) {
    assert.ok(archive.run.includes(assertion), assertion);
  }
  assert.equal(archive.run.match(/git\(\['status', '--porcelain', '--untracked-files=all'\]\)/g).length, 2);
  assert.equal(archive.if, undefined);
  assert.equal(archive['continue-on-error'], undefined);
  assert.equal(archive.env.MARIONETTE_ROUTER_BROWSER_PROBES, 'test/tmp/router-browser-probes.json');
  assert.ok(!job.steps.some(step => /chrome-sandbox|chmod|sysctl|apparmor|seccomp|--no-sandbox|--privileged|--cap-add/.test(step.run ?? '')));
});

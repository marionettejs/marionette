import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { fixture, successfulValidation } from './fixture.mjs';

async function promotion(t, options = {}) {
  const candidate = await fixture(t, { publicationEnabled: true, ...options });
  await successfulValidation(candidate);
  const statePath = join(candidate.directory, 'external-state.json');
  const log = join(candidate.directory, 'external-log.jsonl');
  const output = join(candidate.directory, 'github-output');
  const externalScript = resolve(import.meta.dirname, 'fake-external.mjs');
  await writeFile(candidate.npmCli, `process.env.RELEASE_TEST_TOOL = 'npm'; import(${JSON.stringify(externalScript)});\n`);
  await writeFile(log, '');
  await writeFile(output, '');
  const initial = { packages: candidate.evidence.packages, commit: candidate.commit,
    tag: candidate.evidence.release.tag, artifacts: candidate.artifacts, remote: join(candidate.directory, 'remote') };
  await writeFile(statePath, JSON.stringify(initial));
  const preload = pathToFileURL(resolve(import.meta.dirname, 'fake-processes.mjs')).href;
  const env = { RELEASE_TEST_STATE: statePath, RELEASE_TEST_LOG: log, GITHUB_OUTPUT: output,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${preload}`].filter(Boolean).join(' ') };
  const state = async() => JSON.parse(await readFile(statePath));
  const update = async changes => writeFile(statePath, JSON.stringify({ ...await state(), ...changes }));
  const calls = async() => (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  return { ...candidate, state, update, calls, output,
    exec: (script, mode) => candidate.run(script, ['--artifact-dir', candidate.artifacts, '--mode', mode], env) };
}

test('partial npm publication retries only absent versions and verifies every exact integrity', async t => {
  const candidate = await promotion(t);
  await candidate.update({ npm: { '@marionette/utils': 'available', '@marionette/adapters': 'available' } });
  const result = candidate.exec('check-targets', 'npm-decision');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.packages.map(entry => entry.npm), ['available', 'exact', 'exact', 'exact', 'available']);
  const outputs = await readFile(candidate.output, 'utf8');
  for (const [id, action] of [['utils', 'publish'], ['radio', 'skip'], ['core', 'skip'], ['data', 'skip'], ['adapters', 'publish']]) {
    assert.match(outputs, new RegExp(`${id}_npm_action=${action}`));
  }
  await candidate.update({ npm: {}, remoteTag: candidate.commit });
  const verify = candidate.exec('check-targets', 'verify-npm');
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).tag, 'exact');
  const calls = await candidate.calls();
  assert.equal(calls.filter(call => call.tool === 'npm').length, 10);
  assert.ok(calls.filter(call => call.tool === 'npm').every(call => call.args[0] === 'view'));
});

for (const [name, changes, mode, error] of [
  ['immutable npm conflict', { npm: { '@marionette/adapters': 'conflict' } }, 'npm-decision', /different integrity/],
  ['npm conflict at preflight', { npm: { marionette: 'conflict' } }, 'publish', /Publication targets conflict/],
  ['npm conflict after publish', { npm: { marionette: 'conflict' } }, 'verify-npm', /integrity is not exact/],
  ['tag conflict', { remoteTag: 'a'.repeat(40) }, 'publish', /Git tag: conflict/],
  ['registry outage', { npm: { '@marionette/utils': 'unavailable' } }, 'npm-decision', /npm view exited/],
  ['remote outage', { gitError: true }, 'publish', /git ls-remote exited/],
  ['GitHub outage', { ghError: true }, 'publish', /gh api exited/],
]) {
  test(`target CLI rejects ${name} without publishing anything`, async t => {
    const candidate = await promotion(t);
    await candidate.update(changes);
    const result = candidate.exec('check-targets', mode);
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
    assert.ok(!(await readFile(candidate.output, 'utf8')).includes('_npm_action='));
    assert.ok(!(await candidate.calls()).some(call => call.args.includes('edit') || call.args.includes('create') || call.args.includes('POST')));
  });
}

test('draft stage downloads and verifies exact assets on retry before promotion', async t => {
  const candidate = await promotion(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    const stage = candidate.exec('publish-github', 'stage');
    assert.equal(stage.status, 0, stage.stderr);
    assert.equal((await candidate.state()).release.isDraft, true);
  }
  const publish = candidate.exec('publish-github', 'publish');
  assert.equal(publish.status, 0, publish.stderr);
  const state = await candidate.state();
  assert.equal(state.release.isDraft, false);
  assert.deepEqual(state.tagObject, ['commit', candidate.commit]);
  const retry = candidate.exec('publish-github', 'publish');
  assert.equal(retry.status, 0, retry.stderr);
  const calls = await candidate.calls();
  assert.equal(calls.filter(call => call.args[1] === 'create').length, 1);
  assert.equal(calls.filter(call => call.args[1] === 'edit').length, 1);
  assert.equal(calls.filter(call => call.args[1] === 'download').length, 3);
  assert.ok(calls.findIndex(call => call.args.includes('POST')) < calls.findIndex(call => call.args[1] === 'edit'));
  assert.ok(state.release.assets.some(asset => asset.name === 'candidate-validation.json'));
});

for (const [name, changes, error] of [
  ['conflicting tag', { tagObject: ['commit', 'a'.repeat(40)] }, /does not resolve/],
  ['tag lookup failure', { tagInspectFailure: true }, /Unable to inspect tag/],
  ['tag creation failure', { tagCreateFailure: true }, /gh exited/],
  ['download failure', { downloadFailure: true }, /gh exited/],
  ['downloaded corruption', { corruptDownload: 'utils.tgz' }, /asset differs/],
  ['downloaded manifest change', { extraDownload: true }, /Downloaded release assets/],
  ['local mutation during download', { mutateLocalDuringDownload: true }, /Local release asset differs/],
  ['annotated tag cycle', { tagObject: ['tag', 'cycle'], annotatedTags: { cycle: ['tag', 'cycle'] } }, /contains a cycle/],
]) {
  test(`promotion leaves the draft private after ${name}`, async t => {
    const candidate = await promotion(t);
    assert.equal(candidate.exec('publish-github', 'stage').status, 0);
    await candidate.update(changes);
    const result = candidate.exec('publish-github', 'publish');
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
    assert.equal((await candidate.state()).release.isDraft, true);
    assert.ok(!(await candidate.calls()).some(call => call.args[1] === 'edit'));
  });
}

test('failed public edit preserves the verified tag and retry completes exactly once', async t => {
  const candidate = await promotion(t);
  assert.equal(candidate.exec('publish-github', 'stage').status, 0);
  await candidate.update({ editFailure: true });
  const failed = candidate.exec('publish-github', 'publish');
  assert.equal(failed.status, 1);
  assert.deepEqual((await candidate.state()).tagObject, ['commit', candidate.commit]);
  assert.equal((await candidate.state()).release.isDraft, true);
  await candidate.update({ editFailure: false });
  const retry = candidate.exec('publish-github', 'publish');
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal((await candidate.state()).release.isDraft, false);
  assert.equal((await candidate.calls()).filter(call => call.args.includes('POST')).length, 1);
});

test('annotated tags are peeled to the source commit before a release becomes public', async t => {
  const candidate = await promotion(t);
  assert.equal(candidate.exec('publish-github', 'stage').status, 0);
  await candidate.update({ tagObject: ['tag', 'outer'], annotatedTags: { outer: ['tag', 'inner'], inner: ['commit', candidate.commit] } });
  const result = candidate.exec('publish-github', 'publish');
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await candidate.state()).release.isDraft, false);
});

test('publication policy rejects stage and publish before contacting external services', async t => {
  const candidate = await promotion(t, { publicationEnabled: false });
  for (const mode of ['stage', 'publish']) {
    const result = candidate.exec('publish-github', mode);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /publication is disabled/);
  }
  assert.deepEqual((await candidate.calls()).filter(call => call.tool === 'gh'), []);
});

test('failed draft staging can retry without creating a tag or publishing', async t => {
  const candidate = await promotion(t);
  await candidate.update({ createFailure: true });
  const failed = candidate.exec('publish-github', 'stage');
  assert.equal(failed.status, 1);
  assert.equal((await candidate.state()).release, undefined);
  await candidate.update({ createFailure: false });
  const retry = candidate.exec('publish-github', 'stage');
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal((await candidate.state()).release.isDraft, true);
  assert.ok(!(await candidate.calls()).some(call => call.args.includes('POST') || call.args[1] === 'edit'));
});

for (const conflict of ['source', 'manifest']) {
  test(`staging refuses to overwrite an existing release with a different ${conflict}`, async t => {
    const candidate = await promotion(t);
    assert.equal(candidate.exec('publish-github', 'stage').status, 0);
    const { release } = await candidate.state();
    if (conflict === 'source') { release.targetCommitish = 'a'.repeat(40); } else { release.assets.pop(); }
    await candidate.update({ release });
    const retry = candidate.exec('publish-github', 'stage');
    assert.equal(retry.status, 1);
    assert.match(retry.stderr, conflict === 'source' ? /different source commit/ : /different asset manifest/);
    assert.equal((await candidate.calls()).filter(call => call.args[1] === 'create').length, 1);
    assert.equal((await candidate.state()).release.isDraft, true);
  });
}

test('enabled publication requires a manual workflow on the trusted branch', async t => {
  const candidate = await fixture(t, { publicationEnabled: true });
  for (const [args, error] of [
    [['--event', 'push', '--ref', 'refs/heads/master'], /only from workflow_dispatch/],
    [['--event', 'workflow_dispatch', '--ref', 'refs/heads/untrusted'], /requires refs\/heads\/master/],
  ]) {
    const result = candidate.run('preflight', ['--mode', 'publish', ...args]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
  }
  const output = resolve(candidate.directory, 'preflight-output');
  const result = candidate.run('preflight', ['--mode', 'publish', '--event', 'workflow_dispatch', '--ref', 'refs/heads/master'], { GITHUB_OUTPUT: output });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(output, 'utf8'), 'mode=publish\npublication_enabled=true\n');
});

test('npm integrity verification retries propagation delay without publishing a package', async t => {
  const candidate = await promotion(t);
  await candidate.update({ npm: { '@marionette/utils': ['available', 'exact'] } });
  const result = candidate.exec('check-targets', 'verify-npm');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /retrying in 5 seconds/);
  const npmCalls = (await candidate.calls()).filter(call => call.tool === 'npm');
  assert.equal(npmCalls.length, 6);
  assert.equal(npmCalls[0].args[1], npmCalls[1].args[1]);
  assert.ok(npmCalls.every(call => call.args[0] === 'view'));
});

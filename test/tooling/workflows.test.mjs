import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, matchesGlob, resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

const checker = resolve(import.meta.dirname, '../../scripts/checks/workflows.mjs');
for (const [name, source, status, message] of [
  ['valid workflow', 'name: Test\non: push\njobs: {}\n', 0, /Validated 1 workflow/],
  ['duplicate mapping keys', 'name: Test\njobs: {}\njobs: {}\n', 1, /Map keys must be unique/],
  ['invalid YAML', 'jobs: [\n', 1, /Flow sequence/],
  ['empty workflow inventory', null, 1, /No workflow files found/],
]) {
  test(`workflow CLI rejects configuration drift: ${name}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'marionette-workflows-'));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    await mkdir(resolve(root, '.github/workflows'), { recursive: true });
    if (source !== null) { await writeFile(resolve(root, '.github/workflows/ci.yml'), source); }
    const result = spawnSync(process.execPath, [checker, '--root', root, '--yaml-only'], { encoding: 'utf8' });
    assert.equal(result.status, status, result.stderr);
    assert.match(result.stdout + result.stderr, message);
  });
}

test('release filter examples include infrastructure and exclude ordinary edits', async() => {
  const workflow = parse(await readFile(resolve(import.meta.dirname, '../../.github/workflows/release.yml'), 'utf8'));
  const paths = workflow.on.pull_request.paths;
  // This sample-path check uses Node's glob dialect, not GitHub's routing engine.
  // It assumes the current simple positive * and ** filters agree for these files.
  // Reassess the matcher before adding negation, ordered exclusions, directory-only
  // filters, or other glob syntax; passing here does not prove GitHub event routing.
  for (const path of [
    'tools/eslint/index.mjs', 'tools/eslint/index.d.cts', 'scripts/performance/bundle-size.mjs',
    'scripts/diagnostics/check-catalog.mjs', 'scripts/api-contracts/check.mjs',
    'package.json', 'packages/data/package.json', 'packages/adapters/rollup.config.mjs',
    '.babelrc', '.npmrc', 'test/fixtures/sample/.npmignore', 'build/.gitignore',
  ]) {
    assert.ok(paths.some(pattern => matchesGlob(path, pattern)), `${path} needs release certification`);
  }
  for (const path of ['src/modules/view.ts', 'packages/data/src/model.ts', 'test/unit/view.spec.js', 'docs/readme.md']) {
    assert.ok(!paths.some(pattern => matchesGlob(path, pattern)), `${path} should use regular CI`);
  }
});

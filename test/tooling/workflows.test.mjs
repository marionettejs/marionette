import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

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

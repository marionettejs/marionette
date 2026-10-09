import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { test } from 'node:test';

const smoke = resolve(import.meta.dirname, '../fixtures/smoke.sh');
const fixtures = ['cjs-node', 'standalone-packages', 'core-types', 'vite', 'cjs-adapters', 'collection-removal-survivors'];

for (const failure of ['', 'cjs-node', 'pack']) {
  test(`packed smoke completes diagnostics and propagates ${failure || 'success'}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'marionette-smoke-test-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const directory of ['.package', 'test/fixtures', 'bin', 'tmp', 'packages/data', 'packages/adapters', 'packages/utils', 'packages/radio']) {
      await mkdir(join(root, directory), { recursive: true });
    }
    await cp(smoke, join(root, 'test/fixtures/smoke.sh'));
    await writeFile(join(root, 'bin/npm'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.SMOKE_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'pack') {
  if (process.env.SMOKE_FAILURE === 'pack') process.exit(2);
  console.log('candidate.tgz');
} else {
  const fixture = args[args.indexOf('--fixture') + 1];
  const report = args[args.indexOf('--report') + 1];
  fs.mkdirSync(require('node:path').dirname(report), { recursive: true });
  fs.writeFileSync(report, fixture);
  if (fixture === process.env.SMOKE_FAILURE) process.exit(3);
}
`, { mode: 0o755 });
    const result = spawnSync('bash', ['test/fixtures/smoke.sh'], {
      cwd: root, encoding: 'utf8', env: {
        ...process.env, PATH: `${join(root, 'bin')}${delimiter}${process.env.PATH}`,
        TMPDIR: join(root, 'tmp'), SMOKE_LOG: join(root, 'calls.jsonl'), SMOKE_FAILURE: failure,
      },
    });
    assert.equal(result.status, failure === 'pack' ? 2 : Number(Boolean(failure)), result.stderr);
    const calls = (await readFile(join(root, 'calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const packs = calls.filter(args => args[0] === 'pack');
    assert.equal(packs.length, failure === 'pack' ? 1 : 5);
    assert.ok(packs.every(args => args.includes('--ignore-scripts')));
    const runs = calls.filter(args => args[0] === 'run');
    assert.deepEqual(runs.map(args => args[args.indexOf('--fixture') + 1]), failure === 'pack' ? [] : fixtures);
    for (const args of runs) {
      assert.equal(args[1], 'test:fixtures');
      assert.equal(await readFile(join(root, args[args.indexOf('--report') + 1]), 'utf8'), args[args.indexOf('--fixture') + 1]);
      for (const flag of ['--tarball', '--data-tarball', '--adapters-tarball', '--utils-tarball', '--radio-tarball']) {
        assert.equal(args[args.indexOf(flag) + 1], runs[0][runs[0].indexOf(flag) + 1]);
      }
    }
    assert.deepEqual(await readdir(join(root, 'tmp')), [], 'packed artifacts are removed on success and failure');
  });
}

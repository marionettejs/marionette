import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const command = resolve(import.meta.dirname, '../../scripts/checks/tooling-coverage.mjs');
for (const [name, scenario, expectedStatus, message] of [
  ['passes measured counts', 'valid', 0, /Release functions: 100/],
  ['rejects missing source rows', 'missing', 1, /missing from coverage report/],
  ['rejects a new unreported module', 'new-module', 1, /missing from coverage report/],
  ['ignores a forged percentage field', 'low', 1, /below 90/],
  ['rejects malformed counts', 'invalid', 1, /Invalid lines coverage/],
  ['rejects empty reports', 'empty', 1, /no executable lines/],
]) {
  test(`release coverage CLI ${name}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'marionette-coverage-gate-'));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    await mkdir(resolve(root, 'scripts/release'), { recursive: true });
    const source = resolve(root, 'scripts/release/command.mjs');
    await writeFile(source, 'console.log(1);');
    if (scenario === 'new-module') { await writeFile(resolve(root, 'scripts/release/new.mjs'), 'console.log(2);'); }
    const row = Object.fromEntries(['lines', 'statements', 'branches', 'functions'].map(metric => [metric, { total: 100, covered: 100, pct: 100 }]));
    if (scenario === 'low') { row.lines.covered = 89; }
    if (scenario === 'invalid') { row.lines.covered = 101; }
    if (scenario === 'empty') { row.lines.total = 0; row.lines.covered = 0; }
    const summary = scenario === 'missing' ? {} : { [source]: row };
    await writeFile(resolve(root, 'summary.json'), JSON.stringify(summary));
    const result = spawnSync(process.execPath, [command, '--root', root, '--summary', 'summary.json'], { encoding: 'utf8' });
    assert.equal(result.status, expectedStatus, result.stderr);
    assert.match(result.stdout + result.stderr, message);
  });
}

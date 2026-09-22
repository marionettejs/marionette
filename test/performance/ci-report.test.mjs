import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';

// Exercise the Linux CI shell with controlled measurement processes.
for (const failure of ['none', 'base', 'current', 'report']) {
  test(`bundle report preserves diagnostics when ${failure} fails`, {
    skip: process.platform === 'win32',
  }, async() => {
    const directory = await mkdtemp(join(tmpdir(), 'marionette-ci-size-'));
    try {
      const workflow = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
      const block = workflow.match(/- name: Measure and compare bundle sizes\n {8}id: measure\n {8}run: \|\n([\s\S]*?)(?=\n {6}- name:)/)[1];
      const script = block.replace(/^ {10}/gm, '');
      const nodeStub = join(directory, 'node');
      await writeFile(nodeStub, `#!/bin/sh
printf '%s\\n' "$*" >> "$CALLS"
case "$1:$2" in
  bundle-size-base/scripts/performance/bundle-size.mjs:--root) phase=base ;;
  scripts/performance/bundle-size.mjs:--json) phase=current ;;
  scripts/performance/bundle-size.mjs:--report) phase=report ;;
  *) exit 0 ;;
esac
if [ "$phase" = report ]; then
  printf '%s\\n' '<!-- bundle-size-report -->' 'Comparison generated'
else
  printf '%s\\n' '{"artifacts":[]}'
fi
if [ "$phase" = "$FAILURE" ]; then exit 1; fi
`);
      await chmod(nodeStub, 0o755);
      const result = spawnSync('bash', ['-c', script], {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          GITHUB_STEP_SUMMARY: join(directory, 'summary.md'),
          CALLS: join(directory, 'calls.txt'),
          FAILURE: failure,
        },
      });
      assert.equal(result.status, failure === 'none' ? 0 : 1, result.stderr);
      const summary = await readFile(join(directory, 'summary.md'), 'utf8');
      assert.match(summary, failure === 'base' ? /Base measurement failed.*unavailable/ : /Comparison generated/);
      const calls = await readFile(join(directory, 'calls.txt'), 'utf8');
      assert.match(calls, /bundle-size-base\/scripts\/performance\/bundle-size.mjs --root bundle-size-base/);
      assert.match(calls, /scripts\/performance\/bundle-size.mjs --json/);
      assert.match(await readFile(join(directory, 'bundle-size-current.json'), 'utf8'), /artifacts/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

for (const failure of ['none', 'browser']) {
  test(`timing CI combines both reports and propagates ${failure} failure`, {
    skip: process.platform === 'win32',
  }, async() => {
    const directory = await mkdtemp(join(tmpdir(), 'marionette-ci-timing-'));
    try {
      const workflow = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
      const block = workflow.match(/- name: Measure hosted timing\n {8}run: \|\n([\s\S]*?)(?=\n {6}- name:)/)[1];
      await mkdir(join(directory, 'test/tmp/performance-base/scripts/performance'), { recursive: true });
      await writeFile(join(directory, 'test/tmp/performance-base/scripts/performance/timing.mjs'), '');
      const nodeStub = join(directory, 'node');
      await writeFile(nodeStub, `#!/bin/sh
printf '%s\\n' "$*" >> "$CALLS"
case "$1:$2" in
  scripts/performance/timing.mjs:--report) printf 'Hosted report\\n' ;;
  scripts/performance/browser-report.mjs:*)
    if [ "$FAILURE" = browser ]; then exit 1; fi
    printf 'Browser report\\n' ;;
  *) printf '{"cases":[]}\\n' ;;
esac
`);
      await chmod(nodeStub, 0o755);
      const result = spawnSync('bash', ['-c', block.replace(/^ {10}/gm, '')], {
        cwd: directory, encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH}`,
          GITHUB_STEP_SUMMARY: join(directory, 'summary.md'),
          CALLS: join(directory, 'calls.txt'), FAILURE: failure },
      });
      assert.equal(result.status, failure === 'none' ? 0 : 1, result.stderr);
      const calls = await readFile(join(directory, 'calls.txt'), 'utf8');
      assert.match(calls, /test\/tmp\/performance-base\/scripts\/performance\/timing.mjs --root test\/tmp\/performance-base/);
      assert.match(calls, /browser-report.mjs test\/tmp\/performance-base\/test\/tmp\/browser-timing.json test\/tmp\/browser-timing.json/);
      if (failure === 'none') {
        assert.equal(await readFile(join(directory, 'summary.md'), 'utf8'), 'Hosted report\nBrowser report\n');
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {realpathSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('coverage gate rejects new gaps and unmeasured authored files', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'html-coverage-gate-')));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, 'coverage/runtime'), {recursive: true});
    copyFileSync(new URL('../scripts/check-coverage.mjs', import.meta.url), join(root, 'scripts/check-coverage.mjs'));
    writeFileSync(join(root, 'src/example.ts'), 'export const value = 1;');
    const metrics = ['lines', 'statements', 'functions', 'branches'];
    writeFileSync(join(root, 'coverage-baseline.json'), JSON.stringify({files: {'src/example.ts': Object.fromEntries(metrics.map(m => [m, 0]))}}));
    const summary = {[join(root, 'src/example.ts')]: Object.fromEntries(metrics.map(m => [m, {total: 1, covered: 1}]))};
    const run = () => {
      writeFileSync(join(root, 'coverage/runtime/coverage-summary.json'), JSON.stringify(summary));
      return spawnSync(process.execPath, ['scripts/check-coverage.mjs'], {cwd: root, encoding: 'utf8'});
    };
    const passing = run();
    assert.equal(passing.status, 0, passing.stderr);
    summary[join(root, 'src/example.ts')].lines.covered = 0;
    assert.match(run().stderr, /uncovered exceeds reviewed/);
    summary[join(root, 'src/example.ts')].lines.covered = 1;
    writeFileSync(join(root, 'src/new.ts'), '');
    assert.match(run().stderr, /Every authored source needs a reviewed coverage gate/);
    writeFileSync(join(root, 'coverage-baseline.json'), JSON.stringify({files: Object.fromEntries(['src/example.ts', 'src/new.ts'].map(path => [path, Object.fromEntries(metrics.map(m => [m, 0]))]))}));
    assert.match(run().stderr, /Coverage must include every authored source/);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

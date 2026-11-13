import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fixture } from '../release/fixture.mjs';

for (const script of ['test/package-compatibility/run.mjs', 'test/router/tarball.mjs']) {
  for (const mutation of ['missing', 'bytes']) {
    test(`${script} rejects ${mutation} candidate input before packing or accessing npm`, async t => {
      const candidate = await fixture(t);
      if (mutation === 'missing') { candidate.evidence.packages.pop(); await candidate.save(); } else { await writeFile(resolve(candidate.artifacts, 'utils.tgz'), 'corrupt'); }
      const log = resolve(candidate.directory, 'unexpected-npm-call');
      await writeFile(candidate.npmCli, `require('node:fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2))); console.log('11.17.0');`);
      const result = spawnSync(process.execPath, [resolve(import.meta.dirname, '../..', script), '--artifact-dir', candidate.artifacts], {
        cwd: resolve(import.meta.dirname, '../..'), encoding: 'utf8', timeout: 30000,
        env: { ...process.env, npm_execpath: candidate.npmCli },
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, mutation === 'missing' ? /all five packages/ : /integrity mismatch/);
      // Router reports the npm version before preflight; no package operations may run.
      const calls = await readFile(log, 'utf8').catch(error => { if (error.code === 'ENOENT') { return ''; } throw error; });
      assert(!/pack|install/.test(calls), calls);
    });
  }
}

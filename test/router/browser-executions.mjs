import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { routerBrowserNames } from './browser-policy.mjs';
import { verifyRouterBrowserReport } from './artifact.mjs';

// One installed consumer stays alive across independent engine processes. A
// failed or blocked engine cannot suppress another engine's raw evidence.
export function runRouterBrowserExecutions({ root, directory, env, blockedChromium, probes,
  config = join(root, 'playwright.router.config.mjs'), launch = spawnSync }) {
  if (probes) { assert.deepEqual(probes.map(entry => entry.engine).sort(), [...routerBrowserNames].sort(), 'Require one fresh probe record per engine'); }
  rmSync(directory, { recursive: true, force: true });
  const blobs = join(directory, 'merged-blobs');
  mkdirSync(blobs, { recursive: true });
  const cli = join(root, 'node_modules/@playwright/test/cli.js');
  const attempts = [];
  for (const engine of routerBrowserNames) {
    const attempt = { engine, status: 'running' };
    attempts.push(attempt);
    const probe = probes?.find(entry => entry.engine === engine);
    const reason = probe?.blocked || probe?.launchError || (engine === 'chromium' && blockedChromium);
    if (reason) {
      assert.equal(typeof reason, 'string');
      Object.assign(attempt, { status: 'blocked', reason, casesRun: 0 });
      continue;
    }
    const lane = join(directory, engine);
    const rawReport = join(lane, 'results.json');
    const laneBlobs = join(lane, 'blobs');
    const result = launch(process.execPath, [cli, 'test', '--config', config, `--project=router-${engine}`,
      '--reporter=list,json,blob', '--output', join(lane, 'results')], { cwd: root, stdio: 'inherit', env: {
      ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: rawReport, PLAYWRIGHT_BLOB_OUTPUT_FILE: '',
      PLAYWRIGHT_BLOB_OUTPUT_DIR: laneBlobs, PLAYWRIGHT_BLOB_OUTPUT_NAME: 'report.zip',
    } });
    Object.assign(attempt, { status: result.status === 0 && !result.error ? 'passed' : 'failed',
      exitCode: result.status, signal: result.signal, error: result.error?.message });
    try {
      attempt.stats = JSON.parse(readFileSync(rawReport, 'utf8')).stats;
      const files = readdirSync(laneBlobs).filter(file => file.endsWith('.zip'));
      if (files.length !== 1) { throw new Error('Require exactly one fresh engine blob report'); }
      cpSync(join(laneBlobs, files[0]), join(blobs, `${engine}.zip`));
    } catch (error) { attempt.status = 'failed'; attempt.reportError = error.message; }
  }
  const resultsFile = join(directory, 'results.json');
  const merge = readdirSync(blobs).length ? launch(process.execPath,
    [cli, 'merge-reports', '--reporter=json', blobs], { cwd: root, stdio: 'inherit',
      env: { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: resultsFile } }) : null;
  return { attempts, resultsFile, mergeError: !merge || merge.status !== 0 || merge.error || !existsSync(resultsFile) ?
    merge?.error?.message ?? 'Complete browser reports could not be merged' : undefined };
}
import assert from 'node:assert/strict';

export function verifyRouterBrowserExecutions(execution, inventory) {
  assert.equal(execution.mergeError, undefined, execution.mergeError);
  assert.deepEqual(execution.attempts.map(attempt => attempt.engine).sort(), [...routerBrowserNames].sort(), 'Require exactly one execution record per engine');
  assert.ok(execution.attempts.every(attempt => attempt.status === 'passed'), 'Every engine process and raw report must succeed');
  // Partial evidence is useful, but cannot satisfy this unchanged full policy.
  return verifyRouterBrowserReport(JSON.parse(readFileSync(execution.resultsFile, 'utf8')), inventory);
}

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { runRouterBrowserExecutions, verifyRouterBrowserExecutions } from './browser-executions.mjs';
import { routerBrowserNames } from './browser-policy.mjs';

const root = resolve(import.meta.dirname, '../..');

test('unavailable or malformed launch evidence cannot launch or certify engines', t => {
  const directory = mkdtempSync(join(tmpdir(), 'router-blocked-fixture-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const options = { root, directory, env: process.env, launch() { assert.fail('Blocked engines must not launch'); } };
  const probes = routerBrowserNames.map(engine => ({ engine, launchError: `${engine} fixture unavailable` }));
  for (const invalid of [[], probes.slice(1), [...probes, probes[0]]]) {
    assert.throws(() => runRouterBrowserExecutions({ ...options, probes: invalid }), /one fresh probe record/);
  }
  const execution = runRouterBrowserExecutions({ ...options, probes });
  assert.deepEqual(execution.attempts.map(({ engine, status, casesRun }) => ({ engine, status, casesRun })),
    routerBrowserNames.map(engine => ({ engine, status: 'blocked', casesRun: 0 })));
  assert.throws(() => verifyRouterBrowserExecutions(execution, {}), /could not be merged/);
});

for (const scenario of ['complete', 'blocked', 'failed-firefox-launch', 'behavior-probe-error', 'malformed-report', 'nonzero-with-passing-report']) {
  test(`independent engine reports preserve ${scenario} evidence and the full gate`, t => {
    const directory = mkdtempSync(join(tmpdir(), 'router-engine-fixture-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const config = join(directory, 'playwright.config.mjs');
    const testModule = pathToFileURL(join(root, 'node_modules/@playwright/test/index.mjs')).href;
    writeFileSync(config, `export default { testDir: '.', testMatch: 'fixture.spec.mjs', workers: 1, retries: 0,
      projects: ${JSON.stringify(routerBrowserNames.map(engine => ({ name: `router-${engine}` })))} };`);
    // Test-runner fixtures exercise reporting only. No browser is launched and
    // these synthetic annotations are never compatibility evidence.
    writeFileSync(join(directory, 'fixture.spec.mjs'), `import { test, expect } from ${JSON.stringify(testModule)};
      test('fixture', async () => { test.info().annotations.push({type: 'browser-version', description: 'reporting-fixture'}); expect(true).toBe(true); });`);
    const invoked = [];
    const execution = runRouterBrowserExecutions({ root, config, directory: join(directory, 'reports'), env: process.env,
      blockedChromium: scenario === 'blocked' ? 'fixture setup unavailable' : undefined,
      probes: ['failed-firefox-launch', 'behavior-probe-error'].includes(scenario) ? routerBrowserNames.map(engine => ({ engine,
        ...(engine === 'firefox' ? scenario === 'failed-firefox-launch' ? { launchError: 'fixture launch unavailable' } :
          { probes: { nativeHashChanges: { error: 'fixture behavior difference' } } } : {}),
      })) : undefined,
      launch(executable, args, options) {
        const project = args.find(arg => arg.startsWith('--project='));
        invoked.push(project ?? 'merge');
        const result = spawnSync(executable, args, { ...options, stdio: 'pipe', encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr || result.stdout);
        if (project === '--project=router-chromium') {
          if (scenario === 'malformed-report') { writeFileSync(options.env.PLAYWRIGHT_JSON_OUTPUT_FILE, '{broken'); }
          if (scenario === 'nonzero-with-passing-report') { return { ...result, status: 7 }; }
        }
        return result;
      } });
    assert.deepEqual(invoked, [...routerBrowserNames.filter(engine => !(engine === 'chromium' && scenario === 'blocked') &&
      !(engine === 'firefox' && scenario === 'failed-firefox-launch'))
      .map(engine => `--project=router-${engine}`), 'merge']);
    const inventory = { schemaVersion: 1, policy: 'chromium-firefox-webkit', tests: [{ file: 'fixture.spec.mjs', title: 'fixture' }] };
    const merged = JSON.parse(readFileSync(execution.resultsFile, 'utf8'));
    assert.equal(merged.stats.expected, ['blocked', 'failed-firefox-launch', 'malformed-report'].includes(scenario) ? 2 : 3);
    assert.equal(execution.attempts[2].status, 'passed');
    if (['complete', 'behavior-probe-error'].includes(scenario)) {
      assert.equal(verifyRouterBrowserExecutions(execution, inventory).expected, 3);
      for (const attempts of [[], execution.attempts.slice(1), [...execution.attempts, execution.attempts[0]]]) {
        assert.throws(() => verifyRouterBrowserExecutions({ ...execution, attempts }, inventory), /exactly one execution/);
      }
    } else {
      assert.throws(() => verifyRouterBrowserExecutions(execution, inventory), /Every engine process/);
      if (scenario === 'blocked') {
        assert.deepEqual(execution.attempts[0], { engine: 'chromium', status: 'blocked', reason: 'fixture setup unavailable', casesRun: 0 });
      } else if (scenario === 'failed-firefox-launch') {
        assert.deepEqual(execution.attempts[1], { engine: 'firefox', status: 'blocked', reason: 'fixture launch unavailable', casesRun: 0 });
      } else if (scenario === 'malformed-report') {
        assert.ok(execution.attempts[0].reportError);
      } else { assert.equal(execution.attempts[0].exitCode, 7); }
    }
  });
}

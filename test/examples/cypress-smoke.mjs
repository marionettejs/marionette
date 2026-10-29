import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import cypress from 'cypress';

const output = resolve('test-results/cypress/smoke.json');
mkdirSync(resolve(output, '..'), { recursive: true });
const report = { scenarios: [], passed: false };
const scenarios = [
  { name: 'component', spec: 'cypress/component/**/*.cy.js', failed: 0 },
  { name: 'startup', error: /mnjs-startup-probe/ },
  { name: 'cancellation', error: /Mounted Application startup was cancelled/ },
  { name: 'timeout', error: /cy\.then[\s\S]*timed out|timed out[\s\S]*cy\.then/i },
  { name: 'cleanup', error: /mnjs-cleanup-probe/ },
  { name: 'automatic-afterEach', spec: 'cypress/probes/after-each.cy.js', error: /mnjs-automatic-afterEach-cleanup-probe/ }
];
try {
  for (const scenario of scenarios) {
    const result = await cypress.run({ component: true, browser: process.env.MNJS_TEST_CYPRESS_BROWSER || 'electron', reporter: 'spec',
      config: { component: { specPattern: scenario.spec || 'cypress/probes/failure.cy.js' }, retries: 0 },
      expose: { mnjsProbe: scenario.name } });
    assert(Array.isArray(result.runs), result.message || 'Cypress did not produce test runs.');
    const tests = result.runs.flatMap(run => run.tests);
    report.scenarios.push({ name: scenario.name, cypressVersion: result.cypressVersion,
      browser: result.browserName, browserVersion: result.browserVersion,
      totalFailed: result.totalFailed, totalPassed: result.totalPassed,
      tests: tests.map(test => ({ title: test.title, state: test.state,
        error: test.displayError, attempts: test.attempts.map(attempt => attempt.state) })) });
    assert.equal(result.totalFailed, scenario.failed ?? 1, `${scenario.name}: unexpected runner failure count`);
    assert.equal(result.totalPending, 0, `${scenario.name}: no pending tests`);
    const hookFailure = scenario.name === 'automatic-afterEach';
    assert.equal(result.totalSkipped, hookFailure ? 1 : 0, `${scenario.name}: unexpected Cypress skip policy`);
    if (scenario.error) {
      assert.equal(result.totalPassed, hookFailure ? 0 : 1, `${scenario.name}: unexpected passing test count`);
      const failed = tests.filter(test => test.state === 'failed');
      assert.equal(failed.length, 1);
      assert.deepEqual(failed[0].title, [hookFailure ? 'reports automatic afterEach cleanup failure' : `reports the ${scenario.name} command failure`]);
      if (hookFailure) {
        const skipped = tests.filter(test => test.state === 'skipped');
        assert.equal(skipped.length, 1);
        assert.deepEqual(skipped[0].title, ['is skipped by Cypress after the automatic hook failure']);
        assert(/after each/i.test(failed[0].displayError || ''), 'The failure must originate in the automatic hook.');
      }
      assert.equal(failed[0].attempts.length, 1);
      assert.equal(failed[0].attempts[0].state, 'failed');
      assert(scenario.error.test(failed[0].displayError || ''),
        `${scenario.name}: failure was not the expected command error`);
    } else {
      assert(result.totalPassed >= 10, 'The component smoke must execute all lifecycle examples.');
    }
  }
  report.passed = true;
} catch (error) {
  report.error = error.message;
  throw error;
} finally {
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}

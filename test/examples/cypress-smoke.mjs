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
  { name: 'cleanup', error: /Mounted test cleanup failed/ }
];
try {
  for (const scenario of scenarios) {
    const result = await cypress.run({ component: true, browser: 'electron', reporter: 'spec',
      config: { specPattern: scenario.spec || 'cypress/probes/failure.cy.js', retries: 0 },
      env: { mnjsProbe: scenario.name } });
    assert(Array.isArray(result.runs), result.message || 'Cypress did not produce test runs.');
    const tests = result.runs.flatMap(run => run.tests);
    report.scenarios.push({ name: scenario.name, cypressVersion: result.cypressVersion,
      browser: result.browserName, browserVersion: result.browserVersion,
      totalFailed: result.totalFailed, totalPassed: result.totalPassed,
      tests: tests.map(test => ({ title: test.title, state: test.state,
        error: test.displayError, attempts: test.attempts.map(attempt => attempt.state) })) });
    assert.equal(result.totalFailed, scenario.failed ?? 1, `${scenario.name}: unexpected runner failure count`);
    assert.equal(result.totalPending, 0, `${scenario.name}: no pending tests`);
    assert.equal(result.totalSkipped, 0, `${scenario.name}: teardown must not skip the next test`);
    if (scenario.error) {
      assert.equal(result.totalPassed, 1, `${scenario.name}: the fresh-test check must pass`);
      const failed = tests.filter(test => test.state === 'failed');
      assert.equal(failed.length, 1);
      assert.deepEqual(failed[0].title, [`reports the ${scenario.name} command failure`]);
      assert.equal(failed[0].attempts.length, 1);
      assert.equal(failed[0].attempts[0].state, 'failed');
      assert(scenario.error.test(failed[0].displayError || ''),
        `${scenario.name}: failure was not the expected command error`);
    } else {
      assert(result.totalPassed >= 6, 'The component smoke must execute all lifecycle examples.');
    }
  }
  report.passed = true;
} catch (error) {
  report.error = error.message;
  throw error;
} finally {
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
}

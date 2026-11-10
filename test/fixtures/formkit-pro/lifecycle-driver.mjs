import { proVersion } from './consumer/version.js';

// The caller owns the sandbox-enabled browser/page and approved private bootstrap.
// No key, browser launch, screenshot, request URL or callback source is recorded.
export async function captureLifecycle(page, { origin = 'http://localhost:5190', expectedProVersion = proVersion } = {}) {
  const report = { scenario: 'lifecycle-01307', expectedProVersion, passed: false, pageErrors: [], requestFailures: [] };
  const onError = error => report.pageErrors.push({ name: ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'].includes(error.name) ? error.name : 'OtherError' });
  const onFailure = request => {
    const text = request.failure()?.errorText ?? '';
    report.requestFailures.push(/^net::[A-Z0-9_]+$/.test(text) ? text : 'UnclassifiedNetworkFailure');
  };
  page.on('pageerror', onError); page.on('requestfailed', onFailure);
  let timeout;
  try {
    const response = await page.request.get(`${origin}/receipt.json`);
    if (!response.ok()) { throw new Error('Prepared receipt is required.'); }
    const consumer = await response.json();
    if (consumer.stack !== 'native' || consumer.versions?.['node_modules/@formkit/pro'] !== expectedProVersion ||
      consumer.versions?.['node_modules/@formkit/core'] !== '2.1.2') { throw new Error('Consumer version or stack mismatch.'); }
    report.consumer = { sourceRevision: consumer.sourceRevision, sourceDirty: consumer.sourceDirty,
      artifacts: consumer.artifacts, versions: consumer.versions, lockSha256: consumer.lockSha256 };
    await page.goto(`${origin}/?mode=pro&scenario=lifecycle-01307`);
    await page.waitForFunction(() => window.proof?.observations?.bootstrap && window.proof.observations.bootstrap !== 'pending', undefined, { timeout: 15000 });
    report.bootstrap = await page.evaluate(() => window.proof.observations.bootstrap);
    if (report.bootstrap !== 'ready') { report.unexecuted = true; return report; }
    await page.waitForFunction(() => typeof window.proof?.runLifecycle === 'function', undefined, { timeout: 15000 });
    report.lifecycle = await Promise.race([
      page.evaluate(() => window.proof.runLifecycle()),
      new Promise((resolve, reject) => { timeout = setTimeout(() => reject(new Error('Lifecycle probe deadline reached.')), 90000); })
    ]);
    report.passed = report.lifecycle.passed && report.pageErrors.length === 0;
  } finally {
    clearTimeout(timeout);
    page.off('pageerror', onError); page.off('requestfailed', onFailure);
  }
  return report;
}

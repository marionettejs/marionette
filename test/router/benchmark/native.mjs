import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

// Serialized by Playwright; all library imports use the installed export map.
async function measureNative(plan) {
  const { Router } = await import('@mnjs/router');
  const rows = [];
  const cursors = { 10: 0, 100: 0, 1000: 0 };
  for (const step of plan) {
    const routes = Object.fromEntries(Array.from({ length: step.size }, (_, index) => [`r${index}`, {
      path: index % 2 ? `/r${index}/:id` : `/r${index}/static`,
    }]));
    let handled = 0;
    const router = new Router({ routes, handler() { handled++; } });
    const row = { ...step, workload: `native-navigate/${step.size}`, timestamp: new Date().toISOString(),
      unit: 'milliseconds/navigation', success: false };
    rows.push(row);
    try {
      await router.start();
      await router.getInitialDispatch();
      await router.navigate('r0', {}, { history: 'replace', focusReset: 'manual', scroll: 'manual' }).finished;
      const baseline = handled;
      let correct = 0;
      let last;
      const before = performance.now();
      for (let iteration = 0; iteration < step.iterations; iteration++) {
        const index = (cursors[step.size]++ * 37) % step.size;
        last = `r${index}`;
        correct += await router.navigate(last, index % 2 ? { id: '42' } : {},
          { history: 'replace', focusReset: 'manual', scroll: 'manual' }).finished === true;
      }
      row.value = (performance.now() - before) / step.iterations;
      if (correct !== step.iterations || handled - baseline !== step.iterations || router.getCurrent().name !== last ||
        router.getCurrent().signal.aborted || router.getCurrent().url.href !== location.href) {
        throw new Error(`Native public outcome mismatch: ${step.size}`);
      }
      row.success = true;
    } catch (error) {
      row.error = error.stack ?? String(error);
      return { rows, error: error.stack ?? String(error) };
    } finally {
      router.destroy();
      await globalThis.recordRouterBenchmarkRow(row);
    }
  }
  return { rows };
}

export async function runNative({ consumer, output, executable, report, save, shuffle, summarize }) {
  assert.ok(executable, '--chromium-executable is required for the native phase');
  const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
  const imports = {};
  const assets = new Map();
  for (const name of ['marionette', '@mnjs/utils', '@mnjs/radio', '@mnjs/router']) {
    const directory = join(consumer, 'node_modules', name);
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json')));
    const url = `/modules/${name.replaceAll('/', '-')}.js`;
    imports[name] = url;
    assets.set(url, readFileSync(join(directory, manifest.exports['.'].import.default)));
  }
  const html = `<!doctype html><script type="importmap">${JSON.stringify({ imports })}</script><title>Router native timing</title>`;
  const server = createServer((request, response) => {
    const asset = assets.get(request.url);
    response.setHeader('Content-Type', asset ? 'text/javascript' : 'text/html');
    response.end(asset ?? html);
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const xdg = join(output, 'xdg');
  mkdirSync(join(xdg, 'config'), { recursive: true }); mkdirSync(join(xdg, 'cache'), { recursive: true });
  let browser;
  try {
    report.browser = { executable, launcherSha256: hash(executable), chromiumSandbox: true, headless: true,
      version: execFileSync(executable, ['--version'], { encoding: 'utf8' }).trim(),
      playwright: JSON.parse(readFileSync(new URL('../../../node_modules/playwright-core/package.json', import.meta.url))).version,
      viewport: { width: 1280, height: 720 }, locale: 'en-US', xdg,
      serverUrl: `http://127.0.0.1:${server.address().port}/r0/static`,
      policy: 'replace; manual focus/scroll; synchronous handler; no DOM/data/network work',
      sandboxAttestation: 'launch requested; kernel namespace/seccomp modes not independently attested' };
    save();
    browser = await chromium.launch({ executablePath: executable, chromiumSandbox: true, headless: true, args: ['--enable-automation'],
      env: { ...process.env, XDG_CONFIG_HOME: join(xdg, 'config'), XDG_CACHE_HOME: join(xdg, 'cache') } });
    const context = await browser.newContext({ viewport: report.browser.viewport, locale: 'en-US' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('recordRouterBenchmarkRow', row => { report.rows.push(row); save(); });
    await page.goto(report.browser.serverUrl);
    const cdp = await browser.newBrowserCDPSession();
    report.browser.argv = (await cdp.send('Browser.getBrowserCommandLine')).arguments;
    report.browser.binarySha256 = hash(report.browser.argv[0]);
    assert.ok(!report.browser.argv.includes('--no-sandbox'));
    const plan = [];
    for (const phase of ['warmup', 'measured']) {
      const blocks = phase === 'warmup' ? report.protocol.warmupBlocks : report.protocol.sampleBlocks;
      for (let block = 0; block < blocks; block++) {
        shuffle([10, 100, 1000], report.protocol.seed + block + (phase === 'measured' ? 1000 : 0)).forEach((size, order) =>
          plan.push({ phase, block, order, size, iterations: 10 }));
      }
    }
    report.protocol.plan = plan;
    save();
    const result = await page.evaluate(measureNative, plan);
    report.rows = result.rows;
    assert.ok(!result.error, result.error);
    assert.deepEqual(errors, []);
    assert.equal(result.rows.length, plan.length);
    report.correctness = 'all per-batch route/readiness/liveness/URL checks passed; no page errors';
    report.summary = summarize(report.rows);
  } finally {
    await browser?.close();
    await new Promise(done => server.close(done));
  }
}

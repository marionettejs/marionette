import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as browserTypes from '@playwright/test';
import { routerBrowserNames, routerBrowserPolicy, routerBrowserProjects } from './browser-policy.mjs';

export const navigationModes = ['available', 'undefined', 'throwing'];

export function verifyLazyHistoryBrowserReport(report, engines = routerBrowserNames) {
  assert.equal(report.policy, routerBrowserPolicy);
  assert.deepEqual(report.engines.map(entry => entry.name).sort(), [...engines].sort());
  for (const entry of report.engines) {
    assert.equal(entry.status, 'passed', `${entry.name}: ${entry.error ?? entry.status}`);
    assert.ok(typeof entry.version === 'string' && entry.version.length > 0);
    if (entry.name === 'chromium') { assert.equal(entry.chromiumSandbox, true); }
    assert.deepEqual(entry.branches.map(branch => branch.mode), navigationModes);
    for (const branch of entry.branches) {
      assert.equal(branch.fallback, branch.mode !== 'available');
      assert.equal(branch.initialDispatch, 'matched');
      assert.equal(branch.navigationStateAndBack, 'passed');
      if (branch.mode === 'throwing') { assert.equal(branch.navigationGetterReads, 1); }
    }
  }
  return { engines: report.engines.length, cases: report.engines.length * navigationModes.length };
}

// Use the same launch policy as the complete Router inventory. A blocked engine
// is retained as a failure; it cannot prevent the other engines' evidence.
export async function verifyLazyHistoryBrowsers(directory, graph, {
  engines = routerBrowserNames, executablePath,
} = {}) {
  assert.ok(engines.length > 0 && new Set(engines).size === engines.length);
  assert.ok(engines.every(name => routerBrowserNames.includes(name)));
  const evidence = resolve(directory, 'browser-evidence');
  mkdirSync(evidence, { recursive: true });
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname !== '/' && !/^\/assets\/[\w.-]+\.js$/.test(pathname)) { response.writeHead(404).end(); return; }
    response.setHeader('content-type', pathname.endsWith('.js') ? 'text/javascript' : 'text/html');
    response.end(readFileSync(resolve(directory, 'dist', pathname === '/' ? 'index.html' : pathname.slice(1))));
  });
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready); });
  const report = { policy: routerBrowserPolicy, requestedEngines: [...engines], engines: [] };
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const { use } of routerBrowserProjects.filter(project => engines.includes(project.use.browserName))) {
      const name = use.browserName;
      const launchOptions = { ...use.launchOptions,
        ...(name === 'chromium' && executablePath ? { executablePath } : {}),
      };
      const entry = { name, status: 'running', branches: [],
        ...(name === 'chromium' ? { chromiumSandbox: launchOptions.chromiumSandbox } : {}),
      };
      report.engines.push(entry);
      let browser;
      try {
        browser = await browserTypes[name].launch(launchOptions);
        entry.version = browser.version();
        for (const mode of navigationModes) {
          const context = await browser.newContext();
          try {
            await context.addInitScript(selected => {
              globalThis.routerNavigationGetterReads = 0;
              if (selected === 'undefined') {
                Object.defineProperty(globalThis, 'navigation', { configurable: true, value: undefined });
              } else if (selected === 'throwing') {
                Object.defineProperty(globalThis, 'navigation', { configurable: true, get() {
                  globalThis.routerNavigationGetterReads++;
                  throw new Error('Navigation getter is unavailable');
                } });
              }
            }, mode);
            const page = await context.newPage();
            const requests = [];
            page.on('request', request => {
              if (request.url().endsWith('.js')) { requests.push(new URL(request.url()).pathname.slice(1)); }
            });
            await page.goto(origin);
            await page.waitForFunction(() => globalThis.routerConsumer || globalThis.routerConsumerError);
            assert.equal(await page.evaluate(() => globalThis.routerConsumerError), undefined);
            const fallback = mode !== 'available';
            assert.equal(await page.evaluate(() => globalThis.routerConsumer.fallback), fallback);
            await page.evaluate(async() => {
              const { router } = globalThis.routerConsumer;
              if (!await router.navigate('item', { id: 7 }, { state: { tab: 'details' } }).finished) {throw new Error('Navigation canceled');}
              if (router.getCurrent().params.id !== '7' || router.getCurrent().state.tab !== 'details') {throw new Error('Wrong route/state');}
              if (!await router.back() || router.getCurrent().name !== 'home') {throw new Error('Back failed');}
              router.destroy();
            });
            assert.equal(graph.historyImplementation.some(file => requests.includes(file)), fallback || graph.baseline);
            const expected = fallback ? [...graph.staticClosure, ...graph.historyExclusiveAssets] : graph.staticClosure;
            assert.deepEqual([...new Set(requests)].sort(), [...new Set(expected)].sort());
            entry.branches.push({ mode, fallback, requests,
              navigationGetterReads: await page.evaluate(() => globalThis.routerNavigationGetterReads),
              initialDispatch: 'matched', navigationStateAndBack: 'passed',
            });
          } finally { await context.close(); }
        }
        entry.status = 'passed';
      } catch (error) {
        entry.status = 'failed'; entry.error = error.stack ?? error.message;
      } finally {
        await browser?.close();
        writeFileSync(resolve(evidence, `${name}.json`), `${JSON.stringify(entry, null, 2)}\n`);
      }
    }
  } finally { await new Promise(closed => server.close(closed)); }
  return report;
}

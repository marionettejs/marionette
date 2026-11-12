// Raw browser operations: no Router import, driver replacement or polyfills.
// These diagnostics explain engine differences; they do not certify Router tests.
import * as browserTypes from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { routerBrowserProjects } from './browser-policy.mjs';
import { hashChanges } from './conformance/hash-changes.js';

const server = createServer((request, response) => {
  response.setHeader('content-type', 'text/html');
  response.end('<!doctype html><title>Raw browser probes</title>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = [];
const profile = JSON.parse(await readFile(new URL('../../config/release-profile.json', import.meta.url)));
try {
  for (const { use } of routerBrowserProjects) {
    const entry = { engine: use.browserName, probes: {} };
    report.push(entry);
    let browser;
    try {
      browser = await browserTypes[use.browserName].launch({ headless: true, ...use.launchOptions });
      entry.version = browser.version();
      assert.equal(entry.version, profile.browsers.playwright.browserBuilds.find(({ name }) => name === use.browserName).version);
      const run = async(name, operation, argument) => {
        const page = await browser.newPage();
        try {
          await page.goto(origin);
          entry.probes[name] = await Promise.race([
            page.evaluate(operation, argument),
            new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error(`${name} did not settle within 5 seconds`)), 5000); timer.unref(); }),
          ]);
        } catch (error) { entry.probes[name] = { error: error.message }; } finally { await page.close(); }
      };
      await run('capabilities', () => ({ navigation: typeof navigation, URLPattern: typeof URLPattern }));
      await run('nativeHashChanges', async cases => {
        const events = [];
        const observed = [];
        const fragment = href => href.includes('#') ? href.slice(href.indexOf('#') + 1) : null;
        navigation.addEventListener('navigate', event => {
          events.push({ hashChange: event.hashChange, sameDocument: event.destination.sameDocument,
            source: location.href, destination: event.destination.url,
            sourceFragment: fragment(location.href), destinationFragment: fragment(event.destination.url) });
          if (event.canIntercept) { event.intercept({ handler() {} }); }
        });
        for (const { from, to } of cases) {
          history.replaceState(null, '', from);
          // replaceState also emits a navigate event; compare only navigate().
          const offset = events.length;
          await navigation.navigate(to).finished;
          observed.push(...events.slice(offset));
        }
        return { cases, observed };
      }, hashChanges);
      await run('historyBackThenPush', async() => {
        for (const path of ['/a', '/b', '/c']) { history.pushState({ path }, '', path); }
        const popped = Promise.withResolvers();
        addEventListener('popstate', () => popped.resolve({ path: location.pathname, state: history.state }), { once: true });
        history.back();
        history.pushState({ path: '/d' }, '', '/d');
        const arrival = await Promise.race([popped.promise, new Promise(done => setTimeout(() => done(null), 1000))]);
        return { arrival, path: location.pathname, state: history.state };
      });
      await run('nativeDistinctBackCompletion', async() => {
        const gates = { '/first': Promise.withResolvers(), '/second': Promise.withResolvers() };
        const entered = { '/first': Promise.withResolvers(), '/second': Promise.withResolvers() };
        const events = [];
        let hold = false;
        navigation.addEventListener('navigate', event => {
          const path = new URL(event.destination.url).pathname;
          events.push(path);
          event.intercept({ handler() {
            if (hold && gates[path]) { entered[path].resolve(); return gates[path].promise; }
          } });
        });
        const observe = result => result.finished.then(() => 'fulfilled', error => error.name);
        for (const path of ['/first', '/second', '/third']) { await navigation.navigate(path).finished; }
        hold = true;
        const second = observe(navigation.back()); await entered['/second'].promise;
        const first = observe(navigation.back()); await entered['/first'].promise;
        const obsolete = await second;
        gates['/first'].resolve(); const current = await first;
        gates['/second'].resolve();
        return { obsolete, current, path: location.pathname, events };
      });
      await run('nativeBackAbortReentry', async() => {
        history.replaceState(null, '', '/home');
        const entered = Promise.withResolvers(); const work = Promise.withResolvers();
        const newer = Promise.withResolvers(); const events = [];
        navigation.addEventListener('navigate', event => {
          const path = new URL(event.destination.url).pathname;
          events.push(path);
          if (path === '/a') {
            event.signal.addEventListener('abort', () => queueMicrotask(() => newer.resolve(navigation.navigate('/c'))), { once: true });
          }
          event.intercept({ handler() {
            if (path === '/a') { entered.resolve(); return work.promise; }
          } });
        });
        const observe = result => result.finished.then(() => 'fulfilled', error => error.name);
        const a = observe(navigation.navigate('/a')); await entered.promise;
        const back = observe(navigation.back());
        const results = await Promise.all([a, back, newer.promise.then(observe)]);
        work.resolve();
        return { results, path: location.pathname, events };
      });
    } catch (error) { entry.launchError = error.message; } finally { await browser?.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  const output = resolve(import.meta.dirname, '../tmp/router-browser-probes.json');
  await mkdir(resolve(import.meta.dirname, '../tmp'), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `engines_ready=${report.length === 3 && report.every(entry => !entry.launchError)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}
if (report.some(entry => entry.launchError || Object.values(entry.probes).some(probe => probe.error))) { process.exitCode = 1; }

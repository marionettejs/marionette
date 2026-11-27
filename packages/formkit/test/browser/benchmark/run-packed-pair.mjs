import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';
import { observedMemory } from './cdp-milestones.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const work = fileURLToPath(new URL('../../tmp/browser/packed-pair', import.meta.url));
const fixture = join(here, 'fixture.mjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const arms = ['baseline', 'candidate'];
const [baseline, candidate] = process.argv.slice(2);
assert.equal(process.argv.length, 4, 'Pass exactly the baseline and candidate npm packs');
const profile = JSON.parse(await readFile(new URL('../../../../../config/release-profile.json', import.meta.url), 'utf8'));
const pinnedChromium = profile.browsers.playwright.browserBuilds.find(({ name }) => name === 'chromium').version;
const provenance = {
  source: process.env.GITHUB_SHA ?? null, baselineSource: process.env.FORMKIT_PAIR_BASELINE ?? null,
  fixtureSHA256: hash(await readFile(fixture)), architecture: process.arch, cpu: cpus()[0]?.model, packs: {},
};
for (const [arm, archive] of [[arms[0], baseline], [arms[1], candidate]]) {
  const pkg = join(work, arm, 'package');
  const files = join(work, arm, 'site');
  await mkdir(pkg, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '--directory', pkg, '--strip-components=1']);
  const manifest = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'));
  assert.equal(manifest.name, '@mnjs/formkit');
  await build({
    root: here, configFile: false, base: './',
    resolve: { alias: { '@mnjs/formkit': join(pkg, manifest.exports['.'].import.default) } },
    build: { outDir: files, emptyOutDir: true, target: 'esnext' },
  });
  const assets = await readdir(join(files, 'assets'));
  provenance.packs[arm] = {
    version: manifest.version, sha256: hash(await readFile(archive)),
    assets: Object.fromEntries(await Promise.all(assets.map(async name => [name, hash(await readFile(join(files, 'assets', name)))]))),
  };
}
assert.notEqual(provenance.packs.baseline.sha256, provenance.packs.candidate.sha256, 'The supplied packs must be distinct');
if (process.env.FORMKIT_PAIR_BUILD_ONLY === '1') {
  console.log(JSON.stringify(provenance, null, 2));
  process.exit(0);
}
function milestone(page, command) {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out at ${name}`)), 12000);
    window.bench[name]().then(resolve, reject).finally(() => clearTimeout(timeout));
  }), command);
}

const server = createServer(async(req, res) => {
  const route = /^\/(baseline|candidate)\/(index\.html|assets\/[a-zA-Z0-9_.-]+\.js)$/.exec(new URL(req.url, 'http://127.0.0.1').pathname);
  if (!route) { res.writeHead(404).end(); return; }
  try {
    const [, arm, path] = route;
    const body = await readFile(join(work, arm, 'site', path));
    res.writeHead(200, { 'Content-Type': path === 'index.html' ? 'text/html; charset=utf-8' : 'application/javascript' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
const resultPath = join(work, '..', 'packed-pair-results.json');
const results = { provenance, rows: [], memory: [] };
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ chromiumSandbox: true });
  provenance.chromium = browser.version();
  assert.equal(provenance.chromium, pinnedChromium);
  for (const shape of ['flat', 'validated']) {
    for (const fields of [450, 1500]) {
      for (let block = 0; block < 8; block++) {
        const order = block % 2 ? [...arms].reverse() : arms;
        for (const arm of order) {
          const row = { shape, fields, block, arm, warmup: block < 2, correct: false };
          results.rows.push(row);
          const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
          try {
            page.setDefaultTimeout(15000);
            await page.route('**/*', route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
            await page.goto(`${origin}/${arm}/index.html?arm=marionette&fields=${fields}&shape=${shape}&position=front`);
            await page.waitForFunction(() => window.bench);
            await milestone(page, 'mount');
            if (block === 0) {
              row.attachedComments = await page.evaluate(() => {
                const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_COMMENT);
                let n = 0;
                while (walker.nextNode()) { n++; }
                return n;
              });
            }
            const input = page.locator('#field-1');
            const value = 'edited-value';
            await page.evaluate(next => window.bench.armEdit(next), value);
            await input.fill(value);
            await page.waitForFunction(next => window.bench.report.events.at(-1)?.value === next, value);
            await page.locator('button[type=submit],input[type=submit]').click();
            await page.waitForFunction(() => window.bench.readSubmission());
            const payload = await page.evaluate(() => window.bench.readSubmission());
            assert.deepEqual(payload, Object.fromEntries(Array.from({ length: fields }, (_, i) => [`field${i}`, i === 1 ? value : `original-${i}`])));
            await milestone(page, 'observeDestroy');
            const report = await page.evaluate(() => window.bench.report);
            assert.equal(report.destroyedCount, fields + 1);
            assert.ok(report.events[0].trusted && report.events[0].commit >= report.events[0].capture);
            assert.equal(await page.locator('main').evaluate(el => el.childNodes.length), 0);
            Object.assign(row, {
              mountDomMs: report.mountDomMs, mountSettledMs: report.mountSettledMs,
              captureToCommitMs: report.events[0].commit - report.events[0].capture,
              fullDestroyMs: report.fullDestroyMs, correct: true,
            });
          } catch (error) {
            row.error = String(error);
            throw error;
          } finally {
            await page.close();
            await writeFile(resultPath, `${JSON.stringify(results, null, 2)}\n`);
          }
        }
      }
    }
  }
  // Separate phase: no GC commands or CDP sampling in the timed cells above.
  // Fresh context per observation, one warm-up then one observed full cycle.
  for (let block = 0; block < 6; block++) {
    const order = block % 2 ? [...arms].reverse() : arms;
    for (const arm of order) {
      const row = { fields: 1500, shape: 'flat', block, arm, correct: false };
      results.memory.push(row);
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
      try {
        page.setDefaultTimeout(15000);
        await page.route('**/*', route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
        await page.goto(`${origin}/${arm}/index.html?arm=marionette&fields=1500&shape=flat`);
        await page.waitForFunction(() => window.bench);
        const cdp = await page.context().newCDPSession(page);
        await milestone(page, 'mount');
        await milestone(page, 'observeDestroy');
        row.baseline = await observedMemory(cdp, true);
        await milestone(page, 'mount');
        row.live = await observedMemory(cdp, true);
        await milestone(page, 'observeDestroy');
        row.retained = await observedMemory(cdp, true);
        assert.equal(await page.evaluate(() => window.bench.report.destroyedCount), 1501);
        assert.equal(await page.locator('main').evaluate(el => el.childNodes.length), 0);
        assert.equal(row.retained.nodes, row.baseline.nodes);
        assert.equal(row.retained.jsEventListeners, row.baseline.jsEventListeners);
        row.correct = true;
      } catch (error) {
        row.error = String(error);
        throw error;
      } finally {
        await page.close();
        await writeFile(resultPath, `${JSON.stringify(results, null, 2)}\n`);
      }
    }
  }
} finally {
  await browser?.close();
  server.close();
  await writeFile(resultPath, `${JSON.stringify(results, null, 2)}\n`);
}

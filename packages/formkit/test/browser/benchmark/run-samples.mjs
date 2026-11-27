import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
const work = fileURLToPath(new URL('../../tmp/browser', import.meta.url));
const dist = join(work, 'benchmark');
const receipt = JSON.parse(await readFile(join(work, 'peer-results.json'), 'utf8'));
const peerLock = await readFile(new URL('../../../package-lock.json', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
await build({
  root: here, configFile: false,
  resolve: { alias: { '@mnjs/formkit': join(work, 'packed-formkit/dist/index.js') } },
  build: { outDir: dist, emptyOutDir: true, target: 'esnext' },
});
const assets = await readdir(join(dist, 'assets'));
const provenance = {
  source: receipt.source, prHead: process.env.FORMKIT_BENCH_PR_HEAD ?? null,
  tarballSHA256: receipt.tarballSHA256, peers: receipt.peers, peerLockSHA256: hash(peerLock),
  fixtureSHA256: hash(await readFile(join(here, 'fixture.mjs'))),
  bundles: Object.fromEntries(await Promise.all(assets.map(async asset => [asset, hash(await readFile(join(dist, 'assets', asset)))]))),
  runner: { os: process.platform, arch: process.arch, cpu: cpus()[0]?.model },
};
await writeFile(join(work, 'benchmark-provenance-results.json'), `${JSON.stringify(provenance, null, 2)}\n`);
if (process.env.FORMKIT_BROWSER_BUILD_ONLY === '1') { process.exit(0); }
const arms = ['marionette', 'vue', 'react'];
const orders = arms.flatMap(a => arms.filter(b => b !== a).map(b => [a, b, arms.find(c => c !== a && c !== b)]));
const server = createServer(async(request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const asset = path === '/' ? 'index.html' : path.slice(1);
  if (!/^(?:index\.html|assets\/[A-Za-z0-9_.-]+\.js)$/.test(asset)) {
    response.writeHead(404).end(); return;
  }
  try {
    const body = await readFile(join(dist, asset));
    response.writeHead(200, { 'Content-Type': asset === 'index.html' ? 'text/html; charset=utf-8' : 'application/javascript' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
let browser;
const rows = [];
try {
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ chromiumSandbox: true });
  console.log(`Sandboxed Chromium ${browser.version()}`);
  for (const shape of ['flat', 'validated']) {
    for (const fields of [450, 1500]) {
      shapeSamples: for (const [block, order] of [orders[0], orders[3], ...orders].entries()) {
        for (const arm of order) {
          const sample = { shape, fields, block, arm, warmup: block < 2, correct: false, chromium: browser.version() };
          rows.push(sample);
          let page;
          try {
            page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
            page.setDefaultTimeout(12000);
            await page.route('**/*', route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
            await page.goto(`${origin}/?arm=${arm}&fields=${fields}&shape=${shape}`);
            await page.waitForFunction(() => window.bench);
            await page.evaluate(() => new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Form mount did not settle within 12s')), 12000);
              window.bench.mount().then(resolve, reject).finally(() => clearTimeout(timer));
            }));
            const input = page.locator(`#field-${Math.floor(fields / 2)}`);
            const values = ['edited-alpha', 'edited-bravo', 'edited-charl'];
            for (const [i, value] of values.entries()) {
              if (i === 2) {
                await page.evaluate(async() => {
                  for (let j = 0; j < 2; j++) { await new Promise(resolve => requestAnimationFrame(resolve)); }
                  await new Promise(resolve => setTimeout(resolve, 600));
                });
              }
              await page.evaluate(text => window.bench.armEdit(text), value);
              await input.fill(value);
              await page.waitForFunction(expected => window.bench.report.events.at(-1)?.value === expected, value);
            }
            await page.locator('button[type=submit],input[type=submit]').click();
            await page.waitForFunction(() => window.bench.readSubmission());
            assert.equal(await page.evaluate(expected => window.bench.verifySubmission(expected), values.at(-1)), true);
            await page.evaluate(() => window.bench.destroy());
            const data = await page.evaluate(() => window.bench.report);
            assert.equal(data.events.length, 3);
            assert.ok(data.events.every(e => e.trusted && e.capture >= e.armedAt && e.commit >= e.capture));
            assert.ok(data.events[2].capture - data.events[1].commit >= 600);
            const [first, warm, late] = data.events.map(e => e.commit - e.capture);
            Object.assign(sample, data, {
              firstCaptureToCommitMs: first, warmCaptureToCommitMs: warm, lateCaptureToCommitMs: late,
              settleToFirstCaptureMs: data.events[0].capture - data.mountSettledMs,
              firstCommitToWarmCaptureMs: data.events[1].capture - data.events[0].commit,
              correct: true,
            });
          } catch (error) {
            sample.error = String(error);
            process.exitCode = 1;
          } finally {
            await page?.close();
          }
          await writeFile(join(work, 'benchmark-samples-results.json'), `${JSON.stringify(rows, null, 2)}\n`);
          console.log(shape, fields, block, arm, sample.correct ? 'verified' : sample.error);
          if (!sample.correct) { break shapeSamples; }
        }
      }
    }
  }
} finally {
  await browser?.close();
  server.close();
  await writeFile(join(work, 'benchmark-samples-results.json'), `${JSON.stringify(rows, null, 2)}\n`);
}

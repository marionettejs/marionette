import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { build } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const work = fileURLToPath(new URL('../tmp/browser', import.meta.url));
const dist = join(work, 'dist');
const [pack] = JSON.parse(await readFile(join(work, 'pack.json'), 'utf8'));
const tarball = join(work, pack.filename);
const installed = join(work, 'packed-formkit');
const profile = JSON.parse(await readFile(new URL('../../../../config/release-profile.json', import.meta.url), 'utf8'));
const expectedBrowsers = new Map(profile.browsers.playwright.browserBuilds.map(({ name, version }) => [name, version]));
const report = { source: process.env.GITHUB_SHA ?? null, tarballSHA256: null, peers: {}, results: [] };
const results = report.results;
const receipt = async() => {
  await writeFile(join(work, 'peer-results.json'), `${JSON.stringify(report, null, 2)}\n`);
};
const bytes = await readFile(tarball);
assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, pack.integrity);
report.tarballSHA256 = createHash('sha256').update(bytes).digest('hex');
await mkdir(installed, { recursive: true });
execFileSync('tar', ['-xzf', tarball, '--directory', installed, '--strip-components=1']);
const manifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
assert.equal(manifest.name, '@mnjs/formkit');
assert.equal(manifest.version, pack.version);
const modules = new URL('../../node_modules/', import.meta.url);
for (const name of ['marionette', '@formkit/core', '@formkit/vue', '@formkit/react', 'vue', 'react', 'react-dom']) {
  report.peers[name] = JSON.parse(await readFile(new URL(`${name}/package.json`, modules), 'utf8')).version;
}
assert.equal(report.peers.marionette, '5.2.0');
for (const framework of ['core', 'vue', 'react']) {
  assert.equal(report.peers[`@formkit/${framework}`], '2.9.0');
}
await receipt();
await build({
  root, configFile: false,
  resolve: { alias: { '@mnjs/formkit': join(installed, manifest.exports['.'].import.default) } },
  build: { outDir: dist, emptyOutDir: true, target: 'esnext' },
});
if (process.env.FORMKIT_BROWSER_BUILD_ONLY === '1') {
  process.exit(0);
}

const server = createServer(async(request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!/^(?:index\.html|assets\/[A-Za-z0-9_.-]+\.js)$/.test(path)) {
    response.writeHead(404).end(); return;
  }
  try {
    const content = await readFile(join(dist, path));
    response.writeHead(200, { 'Content-Type': path === 'index.html' ? 'text/html' : 'application/javascript' });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const arms = ['marionette', 'vue', 'react'];

async function open(browser, arm) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
  await page.goto(`${origin}/?arm=${arm}`);
  await page.waitForFunction(() => window.receipt && document.querySelector('#notes'));
  return page;
}

async function keyboard(browser, arm) {
  const page = await open(browser, arm);
  try {
    await page.locator('label[for=name]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'name');
    await page.keyboard.insertText('Synthetic name');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'notes');
    await page.keyboard.insertText('Synthetic edited note');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.type), 'submit');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.receipt.submissions.length);
    const firstSave = await page.evaluate(() => window.receipt.submissions);
    assert.deepEqual(firstSave, [{ name: 'Synthetic name', notes: 'Synthetic edited note' }]);
    await page.getByLabel('Show notes').uncheck();
    await page.locator('#notes').waitFor({ state: 'detached' });
    await page.getByLabel('Show notes').check();
    await page.locator('#notes').waitFor({ state: 'visible' });
    await page.locator('label[for=notes]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'notes');
    await page.evaluate(() => window.receipt.destroy());
    assert.equal(await page.locator('#host').evaluate(host => host.childElementCount), 0);
    return { firstSave, focusRetargeted: true, cleanTeardown: true };
  } finally {
    await page.close();
  }
}

async function composition(browser, arm) {
  const page = await open(browser, arm);
  try {
    const cdp = await page.context().newCDPSession(page);
    await page.locator('label[for=name]').click();
    await cdp.send('Input.imeSetComposition', { text: '엑', selectionStart: 1, selectionEnd: 1 });
    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
    assert.equal(await page.locator('#name').inputValue(), '');
    await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
    await cdp.send('Input.insertText', { text: '한글' });
    assert.equal(await page.locator('#name').inputValue(), '한글');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.receipt.submissions.length);
    const record = await page.evaluate(() => ({
      events: window.receipt.events.filter(event => event.target === 'name'),
      submissions: window.receipt.submissions,
    }));
    assert.equal(record.submissions.length, 1);
    assert.equal(record.submissions[0].name, '한글');
    assert.ok(record.events.some(event => event.type === 'compositionend' && event.trusted));
    return record;
  } finally {
    await page.close();
  }
}

try {
  for (const [engine, launcher] of Object.entries({ chromium, firefox, webkit })) {
    let browser;
    try {
      browser = await launcher.launch(engine === 'chromium' ? { chromiumSandbox: true } : {});
    } catch (error) {
      results.push({ engine, scenario: 'launch', error: String(error) });
      process.exitCode = 1;
      continue;
    }
    try {
      assert.equal(browser.version(), expectedBrowsers.get(engine), `Unexpected ${engine} version`);
      for (const arm of arms) {
        const cases = engine === 'chromium' ? { keyboard, composition } : { keyboard };
        for (const [scenario, test] of Object.entries(cases)) {
          const identity = { engine, version: browser.version(), arm, scenario };
          try {
            results.push({ ...identity, observed: await test(browser, arm) });
          } catch (error) {
            results.push({ ...identity, error: String(error) });
            process.exitCode = 1;
          }
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
  await receipt();
}

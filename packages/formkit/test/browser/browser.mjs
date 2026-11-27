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

async function open(browser, arm, scenario) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
  const params = new URLSearchParams({ arm });
  if (scenario) { params.set('scenario', scenario); }
  await page.goto(`${origin}/?${params}`);
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

async function stockDescriptions(browser, arm) {
  const page = await open(browser, arm, 'stock-descriptions');
  try {
    const input = page.locator('#name');
    await page.locator('label[for=name]').click();
    await page.keyboard.insertText('Synthetic draft');
    await input.evaluate(el => {
      window.originalStockInput = el;
      el.setSelectionRange(2, 6);
    });
    await page.evaluate(() => window.receipt.describe('Synthetic help', 'Synthetic error'));
    const hasBoth = () => {
      const control = document.querySelector('#name');
      const descriptions = (control.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
        .map(id => document.getElementById(id)?.textContent);
      return descriptions.includes('Synthetic help') && descriptions.includes('Synthetic error');
    };
    await page.waitForFunction(hasBoth);
    assert.deepEqual(await input.evaluate(el => ({
      same: el === window.originalStockInput,
      focused: el === document.activeElement,
      value: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    })), { same: true, focused: true, value: 'Synthetic draft', start: 2, end: 6 });
    await page.evaluate(() => window.receipt.describe('', ''));
    await page.waitForFunction(() => !document.querySelector('#name').getAttribute('aria-describedby') &&
      !document.querySelector('#host').textContent.includes('Synthetic help') &&
      !document.querySelector('#host').textContent.includes('Synthetic error'));
    assert.ok(await input.evaluate(el => el === window.originalStockInput && el === document.activeElement));
    await page.evaluate(() => window.receipt.destroy());
    assert.equal(await page.locator('#host').evaluate(host => host.childNodes.length), 0);
    return { accessibleDescriptions: true, focusAndSelectionPreserved: true, cleanTeardown: true };
  } finally {
    await page.close();
  }
}

async function composition(browser, arm, observed) {
  const page = await open(browser, arm);
  try {
    const cdp = await page.context().newCDPSession(page);
    await page.locator('label[for=name]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'name');
    await cdp.send('Input.imeSetComposition', { text: '엑', selectionStart: 1, selectionEnd: 1 });
    observed.cancelCandidate = await page.locator('#name').inputValue();
    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
    observed.cancelled = await page.locator('#name').inputValue();
    await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
    observed.commitCandidate = await page.locator('#name').inputValue();
    await cdp.send('Input.insertText', { text: '한글' });
    observed.committed = await page.locator('#name').inputValue();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.receipt.submissions.length);
    Object.assign(observed, await page.evaluate(() => ({
      events: window.receipt.events.filter(event => event.target === 'name'),
      submissions: window.receipt.submissions,
    })));
    assert.equal(observed.cancelCandidate, '엑');
    assert.equal(observed.cancelled, '');
    assert.equal(observed.commitCandidate, '한');
    assert.equal(observed.committed, '한글');
    assert.equal(observed.submissions.length, 1);
    assert.equal(observed.submissions[0].name, '한글');
    assert.ok(observed.events.some(event => event.type === 'input' && event.trusted && event.composing),
      'Chromium must emit a trusted composing input during the CDP composition');
    assert.ok(observed.events.some(event => event.type === 'input' && event.trusted && event.value === '한글'),
      'Chromium must emit a trusted input for the committed text');
    return observed;
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
        if (arm === 'marionette') { cases.stockDescriptions = stockDescriptions; }
        for (const [scenario, test] of Object.entries(cases)) {
          const identity = { engine, version: browser.version(), arm, scenario };
          const observed = {};
          try {
            results.push({ ...identity, observed: await test(browser, arm, observed) });
          } catch (error) {
            console.error(`${engine} ${arm} ${scenario}: ${error}`);
            results.push({ ...identity, observed, error: String(error) });
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

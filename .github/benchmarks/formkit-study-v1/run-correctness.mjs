import { createServer } from 'node:http';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { relative, resolve, sep, extname } from 'node:path';
import { chromium } from '@playwright/test';
const dist = resolve(new URL('./dist/', import.meta.url).pathname);
const mime = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(dist, '.' + new URL(req.url, 'http://127.0.0.1').pathname);
    const rel = relative(dist, path);
    if (!rel || rel === '..' || rel.startsWith('..' + sep) || !mime[extname(path)]) throw Error('disallowed');
    res.writeHead(200, { 'Content-Type': mime[extname(path)], 'Cache-Control': 'no-store' });
    res.end(await readFile(path));
  } catch { res.statusCode = 404; res.end(); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const binary = await realpath(chromium.executablePath());
const sha256 = createHash('sha256').update(await readFile(binary)).digest('hex');
const records = [], evidence = { study: 'hosted-formkit-synthetic-v1', mode: 'correctness-only', sha256, records };
const blocked = /^--(?:no-sandbox|disable-setuid-sandbox|disable-seccomp-filter-sandbox|disable-namespace-sandbox|disable-gpu-sandbox|allow-sandbox-debugging)(?:=|$)/;
const arms = ['baseline', 'candidate', 'vue', 'react'];
async function test(arm, count, shape) {
  const browser = await chromium.launch({ executablePath: binary, headless: true, chromiumSandbox: true, args: ['--enable-automation'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const cdp = await browser.newBrowserCDPSession();
    const { arguments: args } = await cdp.send('Browser.getBrowserCommandLine');
    if (!args.includes('--enable-automation') || args.some(arg => blocked.test(arg))) throw Error('unsafe or unverifiable launch');
    evidence.browserVersion = browser.version();
    evidence.observedSwitches = args.filter(arg => arg.startsWith('--')).map(arg => arg.split('=', 1)[0]);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/' + arm + '/index.html');
    await page.evaluate(({ count, shape }) => window.study.mount(count, shape), { count, shape });
    await page.waitForFunction(() => window.study.initial(), undefined, { timeout: 15000 });
    const target = page.locator('#study-input-' + (count - 1));
    const blur = page.locator('#blur');
    const commit = value => page.waitForFunction(value => window.study.committed(value), value, { timeout: 10000 });
    if (shape === 'validated') {
      await target.fill('a');
      await commit('a');
      await blur.focus();
      await page.waitForFunction(() => window.study.errorContains('3'), undefined, { timeout: 10000 });
      await target.fill('');
      await commit('');
      await blur.focus();
      await page.waitForFunction(() => window.study.errorContains('required'), undefined, { timeout: 10000 });
    }
    await target.fill('valid');
    await commit('valid');
    await blur.focus();
    if (shape === 'validated') await page.waitForFunction(() => window.study.errorContains(null), undefined, { timeout: 10000 });
    if (!await page.evaluate(() => window.study.identityRetained())) throw Error('input identity changed');
    await page.evaluate(() => window.study.unmount());
    await page.waitForFunction(() => window.study.clean(), undefined, { timeout: 10000 });
    if (errors.length) throw Error(errors.join('; ').slice(0, 300));
  } finally { await browser.close(); }
}
try {
  for (const count of [450, 1500]) for (const shape of ['flat', 'validated', 'rows']) for (const arm of arms) {
    const row = { arm, count, shape, status: 'failed' };
    records.push(row);
    try { await test(arm, count, shape); row.status = 'passed'; }
    catch (error) { row.error = String(error.message).split('\n')[0].slice(0, 320); console.error(arm, count, shape, row.error); }
  }
  if (records.some(row => row.status !== 'passed')) process.exitCode = 1;
} finally {
  server.close();
  await writeFile(process.env.FORMKIT_STUDY_REPORT, JSON.stringify(evidence, null, 2) + '\n');
}

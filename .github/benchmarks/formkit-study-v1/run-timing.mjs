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
const smoke = process.env.FORMKIT_STUDY_SMOKE === '1';
const records = [], evidence = { study: 'hosted-formkit-single-root-v5', mode: smoke ? 'instrumentation-smoke' : 'timing', sha256, records };
const blocked = /^--(?:no-sandbox|disable-setuid-sandbox|disable-seccomp-filter-sandbox|disable-namespace-sandbox|disable-gpu-sandbox|allow-sandbox-debugging)(?:=|$)/;
const armNames = ['baseline', 'candidate', 'v5'];
const squares = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]];
const workloads = [1500].flatMap(count => ['flat', 'validated', 'rows'].map(shape => ({ count, shape })));
evidence.protocol = { warmupsPerCell: 1, measuredPerCell: 6, noRetries: true, browserPerSample: true, squares, workloads };
const urls = arm => 'http://127.0.0.1:' + server.address().port + '/' + arm + '/index.html';

async function sample(arm, count, shape) {
  const browser = await chromium.launch({ executablePath: binary, headless: true, chromiumSandbox: true, args: ['--enable-automation'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const cdp = await browser.newBrowserCDPSession();
    const { arguments: args } = await cdp.send('Browser.getBrowserCommandLine');
    if (!args.includes('--enable-automation') || args.some(arg => blocked.test(arg))) throw Error('unsafe or unverifiable launch');
    if (evidence.browserVersion && evidence.browserVersion !== browser.version()) throw Error('browser binary changed');
    evidence.browserVersion = browser.version();
    evidence.observedSwitches = args.filter(arg => arg.startsWith('--')).map(arg => arg.split('=', 1)[0]);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(urls(arm));
    const target = page.locator('#study-input-' + (count - 1));
    await page.evaluate(({ count, shape }) => window.study.mount(count, shape, true), { count, shape });
    await target.fill('valid', { timeout: 10000 });
    await page.waitForFunction(() => window.study.measuredReady(0), undefined, { timeout: 10000 });
    await target.fill('warmer', { timeout: 10000 });
    await page.waitForFunction(() => window.study.measuredReady(1), undefined, { timeout: 10000 });
    if (!await page.evaluate(() => window.study.committed('warmer'))) throw Error('warm edit did not reach expected FormKit node');
    await page.evaluate(() => window.study.unmount());
    await page.waitForFunction(() => window.study.clean(), undefined, { timeout: 10000 });
    if (errors.length) throw Error(errors.join('; ').slice(0, 300));
    return await page.evaluate(() => window.study.measurement());
  } finally { await browser.close(); }
}

const persist = () => writeFile(process.env.FORMKIT_STUDY_REPORT, JSON.stringify(evidence, null, 2) + '\n');
async function enter(workload, block, position, armIndex) {
  const arm = armNames[armIndex];
  const row = { arm, ...workload, block, position, warmup: block < 0, status: 'pending' };
  records.push(row);
  await persist();
  try {
    const metrics = await sample(arm, workload.count, workload.shape);
    if (!smoke) row.metrics = metrics;
    row.status = 'passed';
  } catch (error) {
    row.status = 'failed';
    row.error = String(error.message).split('\n')[0].slice(0, 320);
    console.error(arm, workload.count, workload.shape, row.error);
  }
  await persist();
}
try {
  for (const [workloadIndex, workload] of workloads.entries()) {
    for (const [position, arm] of squares[workloadIndex % squares.length].entries()) await enter(workload, -1, position, arm);
    for (let block = 0; !smoke && block < 6; block++) {
      const order = squares[(block + workloadIndex) % squares.length];
      for (const [position, arm] of order.entries()) await enter(workload, block, position, arm);
    }
  }
  if (records.some(row => row.status !== 'passed')) process.exitCode = 1;
} finally {
  server.close();
  await persist();
}

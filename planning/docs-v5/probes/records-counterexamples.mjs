import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const example = join(root, 'examples/records');
const output = join(root, 'test/tmp/records-counterexamples');
const source = readFileSync(join(example, 'src/records-application.js'), 'utf8');
const mutations = [
  {
    name: 'skip-preparation-wait',
    grep: 'start waits for preparation',
    remove: 'const records = await recordsApi.list({ signal });',
    replacement: 'const records = []; void recordsApi.list({ signal });',
    expected: ['toHaveText', 'Loading records…', '0 records'],
  },
];
const summary = {
  scope: 'Chromium startup and cleanup baseline; one startup counterexample. Automatic destruction cleanup is covered by framework regression tests, not an example mutation. Not a general mutation score.',
  runs: [],
};
mkdirSync(output, { recursive: true });

function collectTests(suites) {
  return suites.flatMap(suite => [
    ...(suite.specs ?? []).flatMap(spec => spec.tests.map(test => ({
      title: spec.title,
      status: test.status,
      results: test.results.map(result => ({
        status: result.status,
        errors: (result.errors ?? []).map(error => error.message ?? error.value ?? String(error)),
      })),
    }))),
    ...collectTests(suite.suites ?? []),
  ]);
}

async function run(name, grep, mutation) {
  const candidate = join(output, name);
  rmSync(candidate, { recursive: true, force: true });
  mkdirSync(candidate, { recursive: true });
  for (const path of ['src', 'public', 'index.html', 'vite.config.js']) {
    cpSync(join(example, path), join(candidate, path), { recursive: true });
  }
  writeFileSync(join(candidate, 'package.json'), '{"private":true,"type":"module"}\n');
  symlinkSync(join(example, 'node_modules'), join(candidate, 'node_modules'), 'dir');
  if (mutation) {
    if (source.split(mutation.remove).length !== 2) {
      throw new Error(`Expected exactly one mutation target for ${name}; source changed.`);
    }
    writeFileSync(join(candidate, 'src/records-application.js'), source.replace(mutation.remove, mutation.replacement));
  }
  const reportPath = join(candidate, 'playwright.json');
  const config = join(candidate, 'playwright.config.mjs');
  writeFileSync(config, `import { defineConfig, devices } from ${JSON.stringify(pathToFileURL(join(root, 'node_modules/@playwright/test/index.mjs')).href)};
export default defineConfig({
  testDir: ${JSON.stringify(join(example, 'tests'))},
  outputDir: ${JSON.stringify(join(candidate, 'results'))},
  workers: 1, retries: 0,
  reporter: [['json', { outputFile: ${JSON.stringify(reportPath)} }]],
  use: { baseURL: 'http://127.0.0.1:5193' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});\n`);
  const server = spawn(process.execPath, [join(example, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5193', '--strictPort'], {
    cwd: candidate, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', chunk => { serverLog += chunk; });
  server.stderr.on('data', chunk => { serverLog += chunk; });
  const serverEnded = new Promise(resolve => server.once('close', resolve));
  try {
    const deadline = Date.now() + 15_000;
    while (!serverLog.includes('http://127.0.0.1:5193')) {
      if (server.exitCode !== null || Date.now() > deadline) { throw new Error(`Vite did not start: ${serverLog}`); }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', config, '--project', 'chromium', '--grep', grep], {
        cwd: candidate, env: { ...process.env, CI: '1', FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let log = '';
      child.stdout.on('data', chunk => { log += chunk; });
      child.stderr.on('data', chunk => { log += chunk; });
      child.once('error', reject);
      child.once('close', (exit, signal) => resolve({ exit, signal, log }));
    });
    writeFileSync(join(candidate, 'runner.log'), result.log);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const tests = collectTests(report.suites ?? []);
    const errors = report.errors ?? [];
    const runResult = { name, mutation: mutation ? { remove: mutation.remove, replacement: mutation.replacement } : null, exit: result.exit, signal: result.signal, tests, errors };
    summary.runs.push(runResult);
    if (!mutation) {
      runResult.accepted = result.exit === 0 && errors.length === 0 && tests.length === 2 && tests.every(test => test.status === 'expected' && test.results.every(item => item.status === 'passed'));
    } else {
      const messages = tests.flatMap(test => test.results.flatMap(item => item.errors)).join('\n');
      runResult.accepted = result.exit === 1 && errors.length === 0 && tests.length === 1 &&
        tests[0].title.includes(grep) && tests[0].status === 'unexpected' && tests[0].results.length === 1 &&
        tests[0].results[0].status === 'failed' && mutation.expected.every(text => messages.includes(text));
    }
    runResult.classification = runResult.accepted ? (mutation ? 'expected behavioral assertion' : 'baseline passes') : 'unexpected result or infrastructure failure';
    if (!runResult.accepted) { throw new Error(`${name}: ${runResult.classification}; inspect ${reportPath}`); }
  } finally {
    server.kill('SIGTERM');
    await serverEnded;
    writeFileSync(join(candidate, 'server.log'), serverLog);
  }
}

try {
  await run('baseline', 'start waits for preparation|stop releases views');
  for (const mutation of mutations) { await run(mutation.name, mutation.grep, mutation); }
  summary.passed = true;
} catch (error) {
  summary.passed = false;
  summary.error = error.message;
  process.exitCode = 1;
} finally {
  writeFileSync(join(output, 'report.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

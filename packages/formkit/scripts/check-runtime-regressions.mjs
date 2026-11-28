import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const reportPath = new URL('test/tmp/runtime-regressions.json', root);
await mkdir(new URL('test/tmp/', root), { recursive: true });
await rm(reportPath, { force: true });
const results = [];
for (const [name, file] of [['compile-count', 'compile-count.mjs'], ['dynamic-scope', 'dynamic-scope.mjs'], ['dependency-lifetime', 'dependency-lifetime.mjs']]) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`test/regressions/${file}`, root))], {
    cwd: fileURLToPath(root), encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, FORMKIT_COMPILE_ENTRY: new URL('src/index.mjs', root).href, FORMKIT_COMPILE_SIZES: '200,800' },
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, `${name} terminated: ${result.signal}`);
  assert.equal(result.status, 0, `${name} failed: ${result.stdout}\n${result.stderr}`);
  const lines = result.stdout.trim().split('\n');
  const report = JSON.parse(lines.at(-1));
  assert.equal(report.passed, true, `${name} must report passed`);
  results.push({ name, exitCode: result.status, report });
}
const report = { passed: true, scope: 'Deterministic compiler/outlet counts; actual built or extracted package scope and lifetime guards; no elapsed-time thresholds', results };
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));

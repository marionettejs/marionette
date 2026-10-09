import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const consumer = resolve(process.argv[2] || '');
assert(process.argv[2], 'Pass an isolated consumer with installed Marionette and TypeScript');
const packageRoot = join(consumer, 'node_modules/marionette');
const guide = readFileSync(join(packageRoot, 'docs/guides/typescript.md'), 'utf8');
const fences = [...guide.matchAll(/```ts\n([\s\S]*?)\n```/g)].map(match => match[1]);
assert.equal(fences.length, 4, 'Register every TypeScript guide example');
const tooling = readFileSync(join(packageRoot, 'docs/tooling.md'), 'utf8');
const configs = [...tooling.matchAll(/```json\n([\s\S]*?)\n```/g)];
assert.equal(configs.length, 1);
const config = JSON.parse(configs[0][1]);
assert.equal(config.compilerOptions.strict, true);
assert.equal(config.compilerOptions.skipLibCheck, false);
assert.equal(config.compilerOptions.moduleResolution, 'Bundler');
const output = join(consumer, 'consumer-typescript');
mkdirSync(output, { recursive: true });
const write = (name, source) => writeFileSync(join(output, name), `${source}\n`);
write('tsconfig.json', JSON.stringify(config, null, 2));
for (const [index, source] of fences.entries()) { write(`guide-${index + 1}.ts`, source); }
const types = () => {
  const result = spawnSync(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json', '--noEmit'], {
    cwd: output, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths' },
  });
  if (result.error) { throw result.error; }
  return { status: result.status, output: result.stdout + result.stderr };
};
const valid = types();
assert.equal(valid.status, 0, valid.output);
const mutations = [
  { index: 0, before: 'new CounterView({ label: \'Count\' })', after: 'new CounterView()',
    diagnostic: /TS2554/, check: 'required initializer options cannot be omitted' },
  { index: 1, before: '    if (!(input instanceof HTMLInputElement)) { return; }', after: '',
    diagnostic: /TS2339/, check: 'DOM properties require target narrowing' },
  { index: 3, before: 'const current: string | undefined', after: 'const current: string',
    diagnostic: /TS2322/, check: 'optional model attributes require handling' },
  { index: 3, before: 'this.options.model.get(\'title\')', after: 'this.model.get(\'title\')',
    diagnostic: /TS2571|TS18046/, check: 'provider registration does not narrow the View model' },
  { index: 0, before: 'new CounterView({ label: \'Count\' })', after: 'new CounterView({ label: 17 })',
    diagnostic: /TS2322/, check: 'invalid initializer option rejected' },
  { index: 2, before: 'const activation: Promise<boolean>', after: 'const activation: Promise<Summary>',
    diagnostic: /TS2322/, check: 'preparation data is not the lifecycle operation result' },
];
for (const mutation of mutations) {
  const source = fences[mutation.index];
  const invalid = source.replace(mutation.before, mutation.after);
  assert.notEqual(invalid, source, 'Mutation must change its documented example');
  write(`guide-${mutation.index + 1}.ts`, invalid);
  const rejected = types();
  assert.notEqual(rejected.status, 0, rejected.output);
  assert.match(rejected.output, mutation.diagnostic);
  assert(rejected.output.includes(`guide-${mutation.index + 1}.ts`), rejected.output);
  write(`guide-${mutation.index + 1}.ts`, source);
}
const restored = types();
assert.equal(restored.status, 0, restored.output);
const report = {
  passed: true, examples: fences.length,
  compiler: JSON.parse(readFileSync(join(consumer, 'node_modules/typescript/package.json'))).version,
  sourceSha256: fences.map(source => createHash('sha256').update(source).digest('hex')),
  checks: ['actual guide fences compile with documented strict browser configuration',
    ...mutations.map(mutation => mutation.check), 'restored examples compile'],
  limits: 'Installed declaration and compiler checks; not runtime validation, browser behavior, or reader effectiveness.',
};
write('report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

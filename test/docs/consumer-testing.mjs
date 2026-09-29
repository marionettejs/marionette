import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateConsumerTesting({ directory, packageRoot = join(directory, 'node_modules/marionette') }) {
  const markdown = readFileSync(join(packageRoot, 'docs/guides/testing.md'), 'utf8');
  const commands = [...markdown.matchAll(/```sh\n([\s\S]*?)\n```/g)].map(match => match[1]);
  assert.deepEqual(commands, [
    'npm install --save-dev --save-exact jsdom@30.1.0',
    'node --import ./test/dom.mjs --test --test-reporter=tap ./test/app.test.mjs',
  ]);
  assert.equal(JSON.parse(readFileSync(join(directory, 'node_modules/jsdom/package.json'))).version, '30.1.0');
  const files = [...markdown.matchAll(/## `([^`]+\.mjs)`[\s\S]*?```js\n([\s\S]*?)\n```/g)];
  assert.deepEqual(files.map(match => match[1]), [
    'test/dom.mjs', 'test/title-editor.mjs', 'test/summary-application.mjs', 'test/app.test.mjs',
  ]);
  assert.equal([...markdown.matchAll(/```js\n/g)].length, files.length);
  const output = join(directory, 'consumer-testing');
  mkdirSync(join(output, 'test'), { recursive: true });
  for (const [, name, source] of files) { writeFileSync(join(output, name), `${source}\n`); }
  const run = () => {
    const result = spawnSync(process.execPath, commands[1].split(' ').slice(1), {
      cwd: output, encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths' },
    });
    if (result.error) { throw result.error; }
    return { status: result.status, output: result.stdout + result.stderr };
  };
  const valid = run();
  assert.equal(valid.status, 0, valid.output);
  assert.match(valid.output, /# tests 5/);
  const editor = files.find(match => match[1] === 'test/title-editor.mjs')[2];
  const mutation = editor.replace('  modelEvents: { \'change:title\': \'render\' },', '  initialize() {\n    this.model.on(\'change:title\', this.render, this);\n  },');
  assert.notEqual(mutation, editor);
  writeFileSync(join(output, 'test/title-editor.mjs'), `${mutation}\n`);
  const rejected = run();
  assert.notEqual(rejected.status, 0, rejected.output);
  assert.match(rejected.output, /not ok 2 - replacing a Region destroys the old View/);
  assert.match(rejected.output, /# pass 4(?:\r?\n|$)/);
  assert.match(rejected.output, /# fail 1(?:\r?\n|$)/);
  writeFileSync(join(output, 'test/title-editor.mjs'), `${editor}\n`);
  assert.equal(run().status, 0, 'Restored documented recipe must pass');
  const report = {
    passed: true, tests: 5,
    checks: ['local interaction', 'Region replacement and borrowed-model cleanup',
      'async readiness and stop/destroy', 'failed readiness', 'superseded readiness',
      'unmanaged model subscription mutation rejected'],
    limits: 'JSDOM consumer recipe; does not prove browser behavior or reader effectiveness.',
  };
  writeFileSync(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2], 'Pass an isolated consumer with installed Marionette companions and JSDOM');
  console.log(JSON.stringify(validateConsumerTesting({ directory: resolve(process.argv[2]) })));
}

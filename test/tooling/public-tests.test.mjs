import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const checker = resolve(import.meta.dirname, '../../scripts/checks/public-tests.mjs');

for (const [name, source, expectedStatus] of [
  ['public behavior', 'import { View } from \'marionette\'; new View().isDestroyed();', 0],
  ['prototype-shaped user data', 'const data = { [\'__proto__\']: 1 }; data[\'__proto__\'];', 0],
  ['private object override', 'const View = { _renderTemplate() {} };', 1],
  ['private shorthand override', 'const _renderTemplate = () => {}; const View = { _renderTemplate };', 1],
  ['private class override', 'class View { _renderTemplate() {} }', 1],
  ['private class field override', 'class View { _renderTemplate = () => {}; }', 1],
  ['private field', 'view._isDestroyed;', 1],
  ['private computed field', 'view[\'_isDestroyed\'];', 1],
  ['private spy', 'vi.spyOn(view, \'_renderTemplate\');', 1],
  ['private dynamic access', 'const key = \'_events\'; view[key];', 1],
  ['source import', 'import View from \'../../src/modules/view\';', 1],
  ['CommonJS source import', 'const View = require(\'../../src/modules/view\');', 1],
  ['CommonJS public import', 'const { View } = require(\'marionette\');', 0],
  ['dynamic source import', 'await import(\'../../packages/radio/src/channel.ts\');', 1],
]) {
  test(`public-test CLI handles ${name}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'marionette-boundary-'));
    t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
    await mkdir(resolve(root, 'test/unit'), { recursive: true });
    await writeFile(resolve(root, 'test/unit/sample.spec.js'), source);
    const result = spawnSync(process.execPath, [checker, '--root', root], { encoding: 'utf8' });
    assert.equal(result.status, expectedStatus, result.stderr);
    if (expectedStatus) { assert.match(result.stderr, /sample.spec.js:1:/); }
  });
}

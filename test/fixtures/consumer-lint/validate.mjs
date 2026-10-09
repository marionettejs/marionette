import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';
import marionette from 'marionette/eslint';

const require = createRequire(import.meta.url);
const requiredPlugin = require('marionette/eslint');

assert.equal(marionette.meta.name, 'marionette');
assert.equal(requiredPlugin.meta.name, 'marionette');
assert.equal(requiredPlugin.rules['no-private-framework-members'].meta.diagnosticCode, 'MN0040');

const eslint = new ESLint({ cwd: import.meta.dirname, overrideConfigFile: 'consumer-eslint.config.mjs' });
const [valid, invalid] = await Promise.all(['valid', 'invalid'].map(async name => {
  const source = await readFile(new URL(`${name}.txt`, import.meta.url), 'utf8');
  return (await eslint.lintText(source, { filePath: `${name}.mjs` }))[0];
}));

assert.equal(valid.errorCount, 0);
assert.deepEqual(invalid.messages.map(({ ruleId, messageId }) => ({ ruleId, messageId })), [{
  ruleId: 'marionette/no-private-framework-members',
  messageId: 'privateMember',
}]);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Linter } from 'eslint';
import plugin from '../../tools/eslint/index.mjs';
import { PRIVATE_MEMBERS, PRIVATE_MEMBER_SOURCES } from '../../tools/eslint/framework-contract.mjs';

const repositoryRoot = resolve(import.meta.dirname, '../..');

function lint(code) {
  return new Linter().verify(code, {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { marionette: plugin },
    rules: { 'marionette/no-private-framework-members': 'error' },
  }).map(({ line, messageId }) => ({ line, messageId }));
}

test('recommended config enables the private framework member rule', function() {
  assert.deepEqual(plugin.configs.recommended.rules, {
    'marionette/no-private-framework-members': 'error',
  });
  assert.equal(plugin.configs.recommended.plugins.marionette, plugin);
});

test('follows named and namespace aliases through extend and native subclasses', function() {
  const messages = lint(`
    import { View as LocalView } from 'marionette';
    import * as Mn from 'marionette';
    const Extended = LocalView.extend({
      inspect() { this._getEl(); this._applicationCache; }
    });
    const view = new Extended();
    view._regions;
    view._applicationCache;
    view['_getEl']();
    class LocalRegion extends Mn.Region {
      inspect() { this._isDestroyed; super._ensureElement(); }
    }
  `);

  assert.deepEqual(messages, [
    { line: 5, messageId: 'privateMember' },
    { line: 8, messageId: 'privateMember' },
    { line: 12, messageId: 'privateMember' },
    { line: 12, messageId: 'privateMember' },
  ]);
});

test('does not infer arbitrary app fields, computed access, static this, or nested function this', function() {
  const messages = lint(`
    import { View } from 'marionette';
    const Extended = View.extend({
      inspect() {
        this._applicationField;
        this['_getEl']();
        function nested() { this._getEl(); }
        return nested;
      }
    });
    class Native extends View {
      static inspect() { this._getEl(); }
      _applicationField = true;
    }
    const view = new Extended();
    view._applicationField;
  `);

  assert.deepEqual(messages, []);
});

test('respects shadowing and abstains for mutable receiver or constructor bindings', function() {
  const messages = lint(`
    import { View } from 'marionette';
    import * as Mn from 'marionette';
    function shadow(View, Mn) {
      new View()._getEl();
      new Mn.Region()._ensureElement();
    }
    let view = new View();
    view = { _isRendered: false };
    view._isRendered;
    let Constructor = View;
    Constructor = Other;
    const other = new Constructor();
    other._isRendered;
  `);

  assert.deepEqual(messages, []);
});

test('reports private access on inline constructed framework receivers', function() {
  const messages = lint(`
    import { Application, CollectionView } from 'marionette';
    new Application()._lifecycleState;
    new CollectionView()._renderChildren();
  `);

  assert.deepEqual(messages, [
    { line: 3, messageId: 'privateMember' },
    { line: 4, messageId: 'privateMember' },
  ]);
});

test('static private-member inventory contains only current source facts', async function() {
  for (const [className, members] of Object.entries(PRIVATE_MEMBERS)) {
    const contents = (await Promise.all(PRIVATE_MEMBER_SOURCES[className].map(path =>
      readFile(resolve(repositoryRoot, path), 'utf8')))).join('\n');
    for (const member of members) {
      assert.match(contents, new RegExp(`\\b${member}\\b`), `${className}.${member}`);
    }
  }
});

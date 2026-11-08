import './setup.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {html, render} from '@mnjs/html';

test('an installed identity policy still enforces script and style sink checks', {skip: typeof render.setSanitizer !== 'function'}, () => {
  const root = document.createElement('div');
  let calls = 0;
  render.setSanitizer(() => value => { calls++; return value; });
  render(html`<p title=${'safe'}>${'text'}</p>`, root);
  assert.equal(root.textContent, 'text');
  assert.ok(calls >= 2);
  for (const template of [html`<script>${'script'}</script>`, html`<style>${'style'}</style>`]) {
    assert.throws(() => render(template, root), /Forbidden|security risk/);
  }
});

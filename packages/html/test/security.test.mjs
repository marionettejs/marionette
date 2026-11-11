import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { render, html } = await import('@mnjs/html');
const development = process.execArgv.includes('--conditions=development');
test('the default production API has no sanitizer policy hooks', {skip: development}, () => {
  assert.equal(render.setSanitizer, undefined);
  assert.equal(render.createSanitizer, undefined);
  const el = document.createElement('div');
  render(html`<p>${'<img src=x onerror=alert(1)>'}</p>`, el);
  assert.equal(el.querySelector('img'), null);
  assert.equal(el.textContent, '<img src=x onerror=alert(1)>');
});
test('development hooks visit sinks, propagate policy failures and install once', {skip: !development}, () => {
  const seen = [];
  // A synthetic callback policy, not an example of URL sanitization.
  render.setSanitizer((node, name, type) => value => {
    seen.push([node.nodeType, name, type, value]);
    if (name === 'title' && value === 'rejected-by-test-policy') {
      throw new Error('rejected by test policy');
    }
    return value;
  });
  const el = document.createElement('div');
  render(html`<p title=${'attr'} .value=${'prop'}>${'text'}</p><a href=${'https://example.test/'}>safe fixture</a>`, el);
  assert.ok(seen.some(x => x[1] === 'title' && x[2] === 'attribute'));
  assert.ok(seen.some(x => x[1] === 'value' && x[2] === 'property'));
  assert.ok(seen.some(x => x[1] === 'data'));
  assert.ok(seen.some(x => x[1] === 'href' && x[2] === 'attribute' && x[3] === 'https://example.test/'));
  const titled = value => html`<p title=${value}>policy fixture</p>`;
  render(titled('previous-title'), el);
  const existing = el.querySelector('p');
  assert.throws(() => render(titled('rejected-by-test-policy'), el), /rejected by test policy/);
  assert.equal(el.querySelector('p'), existing);
  assert.equal(existing.getAttribute('title'), 'previous-title');
  assert.equal(el.querySelector('[title="rejected-by-test-policy"]'), null);
  assert.throws(() => render.setSanitizer(() => x => x), /security policy/i);
});

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
test('development sanitizer hooks cannot be replaced after installation', {skip: !development}, () => {
    const seen = [];
    render.setSanitizer((node, name, type) => value => { seen.push([node.nodeType, name, type, value]); if (name === 'href' && String(value).startsWith('javascript:'))
        throw new Error('blocked URL'); return value; });
    const el = document.createElement('div');
    render(html `<p title=${'attr'} .value=${'prop'}>${'text'}</p>`, el);
    assert.ok(seen.some(x => x[1] === 'title' && x[2] === 'attribute'));
    assert.ok(seen.some(x => x[1] === 'value' && x[2] === 'property'));
    assert.ok(seen.some(x => x[1] === 'data'));
    assert.throws(() => render(html `<a href=${'javascript:alert(1)'}>bad</a>`, el), /blocked URL/);
    assert.throws(() => render.setSanitizer(() => x => x), /security policy/i);
});

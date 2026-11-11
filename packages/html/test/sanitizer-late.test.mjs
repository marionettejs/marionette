import './setup.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {html, render, nothing} from '@mnjs/html';

test('unused hooks are skipped, but a later policy applies to changed sinks', {skip: typeof render.setSanitizer !== 'function'}, () => {
  const root = document.createElement('div');
  const template = value => html`<p title=${value} .payload=${value}>${value}</p>`;
  render(template('before'), root);
  const seen = [];
  render.setSanitizer((node, name, type) => value => {
    seen.push({node: node.nodeType, name, type, value});
    return typeof value === 'string' ? `safe:${value}` : value;
  });
  render(template('after'), root);
  const element = root.firstElementChild;
  assert.equal(element.title, 'safe:after');
  assert.equal(element.payload, 'safe:after');
  assert.equal(element.textContent, 'safe:after');
  assert.ok(seen.some(sink => sink.name === 'title' && sink.type === 'attribute'));
  assert.ok(seen.some(sink => sink.name === 'payload' && sink.type === 'property'));
  assert.ok(seen.some(sink => sink.name === 'data' && sink.type === 'property'));
  render(template(nothing), root);
  assert.equal(element.hasAttribute('title'), false);
  assert.equal(element.payload, undefined);
  assert.equal(element.textContent, '');
  assert.throws(() => render.setSanitizer(() => value => value), /security policy/);
});

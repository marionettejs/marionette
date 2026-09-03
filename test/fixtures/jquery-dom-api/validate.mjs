import assert from 'assert';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

assert.strictEqual(existsSync(resolve(import.meta.dirname, 'node_modules/backbone')), false);

const { View } = await import('marionette');
const JQueryDomApi = (await import('@marionette/adapters/dom/jquery')).default;
const $ = (await import('jquery')).default;

const JQueryView = View.extend();
JQueryView.setDomApi(JQueryDomApi);

const el = document.createElement('div');
el.innerHTML = '<span class="child">child</span>';
const view = new JQueryView({ el });
const result = view.$('.child');

assert.ok(result instanceof $);
assert.strictEqual(result[0].textContent, 'child');
assert.ok(view.$el instanceof $);
assert.strictEqual(view.$el[0], el);

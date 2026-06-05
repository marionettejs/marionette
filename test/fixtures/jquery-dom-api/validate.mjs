import assert from 'assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const { View } = await import('marionette');
const JQueryDomApi = (await import('marionette/jquery-dom-api')).default;
const $ = (await import('jquery')).default;

const JQueryView = View.extend();
JQueryView.setDomApi(JQueryDomApi);

const el = document.createElement('div');
el.innerHTML = '<span class="child">child</span>';
const view = new JQueryView({ el });
const result = view.$('.child');

assert.ok(result instanceof $);
assert.strictEqual(result[0].textContent, 'child');
assert.strictEqual(Object.prototype.hasOwnProperty.call(view, '$el'), false);

const assert = require('assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const Marionette = require('marionette');
const Backbone = require('backbone');

assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);

const ShimmedBackbone = require('marionette/backbone');

assert.strictEqual(ShimmedBackbone, Backbone);
assert.strictEqual(typeof Backbone.Model.prototype.triggerMethod, 'function');

const JQueryDomApi = require('marionette/jquery-dom-api');
const $ = require('jquery');
const JQueryView = Marionette.View.extend();

JQueryView.setDomApi(JQueryDomApi);

const el = document.createElement('div');
el.innerHTML = '<span class="child">child</span>';

const view = new JQueryView({ el });
const result = view.$('.child');

assert.ok(result instanceof $);
assert.strictEqual(result[0].textContent, 'child');

dom.window.close();

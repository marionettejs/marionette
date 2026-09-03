const assert = require('assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const Marionette = require('marionette');
const Backbone = require('backbone');

assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);

const BackboneApi = require('@marionette/adapters/backbone');

Marionette.setDataApi(BackboneApi);
Marionette.setStateApi(BackboneApi);
assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);
assert.strictEqual(typeof Backbone.Model.prototype.bind, 'function');
assert.strictEqual(typeof Backbone.Model.prototype.unbind, 'function');

const JQueryDomApi = require('@marionette/adapters/dom/jquery');
const $ = require('jquery');
const JQueryView = Marionette.View.extend();

JQueryView.setDomApi(JQueryDomApi);

const el = document.createElement('div');
el.innerHTML = '<span class="child">child</span>';

const view = new JQueryView({ el });
const result = view.$('.child');

assert.ok(result instanceof $);
assert.strictEqual(result[0].textContent, 'child');
assert.ok(view.$el instanceof $);
assert.strictEqual(view.$el[0], el);

dom.window.close();

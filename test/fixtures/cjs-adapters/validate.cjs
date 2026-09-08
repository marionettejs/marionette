const assert = require('assert');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const Marionette = require('marionette');
const Backbone = require('backbone');

assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);

const BackboneApi = require('@mnjs/adapters/backbone');

Marionette.setDataApi(BackboneApi);
Marionette.setStateApi(BackboneApi);
assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);
assert.strictEqual(typeof Backbone.Model.prototype.bind, 'function');
assert.strictEqual(typeof Backbone.Model.prototype.unbind, 'function');

const JQueryDomApi = require('@mnjs/adapters/dom/jquery');
const createXStateActorApi = require('@mnjs/adapters/xstate');
const { createActor, createMachine } = require('xstate');
const $ = require('jquery');
const JQueryView = Marionette.View.extend({ initialize() { this.$el = $(this.el); } });
JQueryView.setDomApi(JQueryDomApi);

const el = document.createElement('div');
el.innerHTML = '<span class="child">child</span>';

const view = new JQueryView({ el });
const result = view.$('.child');

assert.ok(result instanceof $);
assert.strictEqual(result[0].textContent, 'child');
assert.ok(view.$el instanceof $);
assert.strictEqual(view.$el[0], el);

const childActor = createActor(createMachine({ context: { label: 'child' } })).start();
const parentActor = createActor(createMachine({ context: { children: [childActor] } })).start();
const XStateActorApi = createXStateActorApi({
  select: snapshot => snapshot.context.children
});
assert.strictEqual(XStateActorApi.models(parentActor)[0], childActor);
assert.strictEqual(XStateActorApi.serialize(childActor).label, 'child');
childActor.stop();
parentActor.stop();

dom.window.close();

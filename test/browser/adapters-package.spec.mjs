import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('packed adapters preserve Backbone and jQuery contracts', async({ page, browserName }) => {
  await page.addScriptTag({ url: '/underscore.js' });
  await page.addScriptTag({ url: '/backbone.js' });
  const result = await page.evaluate(async function() {
    const Backbone = window.Backbone;
    const originalBind = Backbone.Model.prototype.bind;
    const model = new Backbone.Model({ id: 1, name: 'before' });
    let preconfigurationCalls = 0;
    model.on('change:name', () => preconfigurationCalls++);

    const [
      Marionette,
      { default: BackboneApi },
      { default: JQueryDomApi },
      { default: $ },
      { default: createXStateActorApi }
    ] = await Promise.all([
      import('marionette'),
      import('@marionette/adapters/backbone'),
      import('@marionette/adapters/dom/jquery'),
      import('jquery'),
      import('@marionette/adapters/xstate')
    ]);
    const runtime = Marionette.createMarionette();
    runtime.setDataApi(BackboneApi);
    runtime.setStateApi(BackboneApi);
    const collection = new Backbone.Collection([model]);
    let modelCalls = 0;
    const ChildView = runtime.View.extend({ template: false });
    const ListView = runtime.CollectionView.extend({
      childView: ChildView,
      modelEvents: { 'change:name': 'onName' },
      onName() { modelCalls++; }
    });
    const view = new ListView({ collection, model });
    view.render();
    collection.add({ id: 2, name: 'second' });
    model.set('name', 'after');

    const JQueryView = runtime.View.extend({ template: false,
      initialize() { this.$el = $(this.el); } });
    JQueryView.setDomApi(JQueryDomApi);
    const el = document.createElement('section');
    el.innerHTML = '<span class="child">child</span>';
    const jqueryView = new JQueryView({ el });
    const jqueryResult = jqueryView.$('.child');

    const childSnapshot = { context: { label: 'child' } };
    const childActor = {
      getSnapshot: () => childSnapshot,
      subscribe: () => ({ unsubscribe() {} }),
      on: () => ({ unsubscribe() {} }),
      stop() {}
    };
    const parentActor = {
      getSnapshot: () => ({ context: { children: [childActor] } }),
      subscribe: () => ({ unsubscribe() {} })
    };
    const XStateActorApi = createXStateActorApi({
      select: snapshot => snapshot.context.children
    });
    const actorResult = {
      context: XStateActorApi.serialize(childActor).label,
      identity: XStateActorApi.models(parentActor)[0] === childActor
    };

    const output = {
      actorResult,
      children: view.children.length,
      jqueryText: jqueryResult[0].textContent,
      modelCalls,
      nativeBindPreserved: Backbone.Model.prototype.bind === originalBind,
      preconfigurationCalls,
      triggerMethodAbsent: Backbone.Model.prototype.triggerMethod === undefined
    };
    jqueryView.destroy();
    view.destroy();
    return output;
  });

  assert.deepEqual(result, {
    actorResult: { context: 'child', identity: true },
    children: 2,
    jqueryText: 'child',
    modelCalls: 1,
    nativeBindPreserved: true,
    preconfigurationCalls: 1,
    triggerMethodAbsent: true
  }, `${browserName}: packed @marionette/adapters runtime behavior`);
});

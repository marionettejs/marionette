import { describe, it, expect } from 'vitest';
import { createMarionette } from 'marionette';
import performanceContract from '../../config/performance.json';

function source(models) {
  const subscriptions = new Set();
  return {
    models,
    subscriptions,
    on(name, callback, context) { subscriptions.add({ name, callback, context }); },
    off(name, callback, context) {
      for (const entry of subscriptions) {
        if (entry.name === name && entry.callback === callback && entry.context === context) {
          subscriptions.delete(entry);
        }
      }
    },
    emit(name, ...args) {
      for (const entry of subscriptions) {
        if (entry.name === name) { entry.callback.apply(entry.context, args); }
      }
    }
  };
}

describe('repeated public lifecycle resource contracts', () => {
  const workload = performanceContract.deterministicResources;

  it(`preserves detached ownership across ${workload.attachDetachCycles} Region cycles`, () => {
    const runtime = createMarionette();
    const el = document.createElement('main');
    document.body.append(el);
    const region = new runtime.Region({ el });
    let attached = 0;
    let detached = 0;
    const view = new runtime.View({ template: false });
    view.on('attach', () => attached++);
    view.on('detach', () => detached++);
    for (let index = 0; index < workload.attachDetachCycles; index++) {
      region.show(view);
      expect(view.isAttached()).toBe(true);
      expect(region.detachView()).toBe(view);
      expect(region.hasView()).toBe(false);
      expect(view.isAttached()).toBe(false);
      expect(el.childNodes.length).toBe(0);
    }
    region.destroy();
    expect(view.isDestroyed()).toBe(false);
    expect(attached).toBe(workload.attachDetachCycles);
    expect(detached).toBe(workload.attachDetachCycles);
    view.destroy();
    el.remove();
  });

  it(`releases external subscriptions and owned children across ${workload.mountDestroyCycles} cycles`, () => {
    const runtime = createMarionette();
    const collection = source([{ id: 1 }]);
    const model = source();
    runtime.setDataApi({
      models: value => value.models,
      observeCollection(value, callback, context) {
        value.on('update', callback, context);
        return () => value.off('update', callback, context);
      }
    });
    let modelEvents = 0;
    let clicks = 0;
    let behavior;
    let destroyedBehaviors = 0;
    const Child = runtime.View.extend({ template: false, events: { click() { clicks++; } } });
    const Observer = runtime.Behavior.extend({
      initialize() { behavior = this; },
      onDestroy() { destroyedBehaviors++; },
      modelEvents: { change() { modelEvents++; } }
    });
    const Host = runtime.View.extend({ template: false, behaviors: [Observer] });
    for (let index = 0; index < workload.mountDestroyCycles; index++) {
      const list = new runtime.CollectionView({ collection, childView: Child }).render();
      const child = list.children.first();
      document.body.append(list.el);
      child.el.click();
      expect(clicks).toBe(index + 1);
      expect(collection.subscriptions.size).toBe(1);
      const emptyRegion = list.getEmptyRegion();
      list.destroy();
      child.el.click();
      expect(clicks).toBe(index + 1);
      expect(collection.subscriptions.size).toBe(0);
      expect(list.children.length).toBe(0);
      expect(child.isDestroyed()).toBe(true);
      expect(emptyRegion.isDestroyed()).toBe(true);
      expect(list.el.isConnected).toBe(false);
      expect(list.el.childNodes.length).toBe(0);

      const host = new Host({ model });
      const region = host.addRegion('content', { el: document.createElement('div') });
      region.show(new runtime.View({ template: false }));
      model.emit('change');
      expect(modelEvents).toBe(index + 1);
      expect(model.subscriptions.size).toBe(1);
      host.destroy();
      model.emit('change');
      expect(modelEvents).toBe(index + 1);
      expect(model.subscriptions.size).toBe(0);
      expect(destroyedBehaviors).toBe(index + 1);
      expect(behavior.view).toBe(host);
      expect(host.getRegions()).toEqual({});
      expect(region.hasView()).toBe(false);
      expect(region.isDestroyed()).toBe(true);
    }
  });
});

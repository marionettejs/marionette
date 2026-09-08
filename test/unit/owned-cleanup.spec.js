import { vi, describe, it, expect, afterEach } from 'vitest';
import { Application, MnObject } from 'marionette';
import { Radio } from '@marionette/radio';
import { Events } from '@marionette/utils';

const ObservableSource = function(attributes = {}) {
  this.attributes = { ...attributes };
};

Object.assign(ObservableSource.prototype, Events, {
  destroy() {
    this.destroyed = true;
    this.off();
  },
  isDestroyed() { return !!this.destroyed; },
  set(key, value) {
    this.attributes[key] = value;
    this.trigger(`change:${ key }`, this, value);
  }
});

const TestStateApi = {
  subscribe(source, eventName, callback, context) {
    source.on(eventName, callback, context);
    return () => source.off(eventName, callback, context);
  },
  disposeOwned(source) { source.destroy(); }
};

const ownerDefinitions = [
  { name: 'MnObject', OwnerClass: MnObject },
  { name: 'Application', OwnerClass: Application }
];

async function destroy(owner) {
  await owner.destroy();
}

describe('MnObject and Application owned cleanup', function() {
  afterEach(function() {
    Radio.reset();
  });

  for (const { name, OwnerClass } of ownerDefinitions) {
    it(`${ name } cleanup cannot be disabled with off()`, async function() {
      const channelName = `owned-cleanup-${ name }`;
      const onPing = vi.fn();
      const onReady = vi.fn();
      const state = new ObservableSource({ ready: false });
      const destroyState = vi.spyOn(state, 'destroy');
      const Owner = OwnerClass.extend({
        channelName,
        createState() { return state; },
        radioEvents: { ping: 'onPing' },
        radioRequests: { status: 'getStatus' },
        stateEvents: { 'change:ready': 'onReady' },
        getStatus() { return 'ready'; },
        onPing,
        onReady
      });
      Owner.setStateApi(TestStateApi);
      const owner = new Owner();

      owner.off();
      Radio.trigger(channelName, 'ping');
      state.set('ready', true);

      expect(onPing).toHaveBeenCalledTimes(1);
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(Radio.request(channelName, 'status')).to.equal('ready');

      await destroy(owner);
      await destroy(owner);
      Radio.trigger(channelName, 'ping');
      state.set('ready', false);

      expect(onPing).toHaveBeenCalledTimes(1);
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(Radio.request(channelName, 'status')).to.be.undefined;
      expect(state.isDestroyed()).to.be.true;
      expect(destroyState).toHaveBeenCalledTimes(1);
    });

    it(`${ name } preserves owned cleanup timing around public destroy`, async function() {
      const channelName = `cleanup-timing-${ name }`;
      const state = new ObservableSource();
      const lifecycle = [];
      const Owner = OwnerClass.extend({
        channelName,
        createState() { return state; },
        initialize() { this.getState(); },
        radioRequests: { status: 'getStatus' },
        getStatus() { return 'ready'; },
        onBeforeDestroy() {
          lifecycle.push([
            'onBeforeDestroy',
            this.isDestroyed(),
            state.isDestroyed(),
            Radio.request(channelName, 'status')
          ]);
        },
        onDestroy() {
          lifecycle.push([
            'onDestroy',
            this.isDestroyed(),
            state.isDestroyed(),
            Radio.request(channelName, 'status')
          ]);
        }
      });
      Owner.setStateApi(TestStateApi);
      const owner = new Owner();

      owner.on('before:destroy', currentOwner => {
        lifecycle.push([
          'before:destroy',
          currentOwner.isDestroyed(),
          state.isDestroyed(),
          Radio.request(channelName, 'status')
        ]);
      });
      owner.listenTo(owner, 'destroy', currentOwner => {
        lifecycle.push([
          'destroy',
          currentOwner.isDestroyed(),
          state.isDestroyed(),
          Radio.request(channelName, 'status')
        ]);
      });

      await destroy(owner);

      expect(lifecycle).to.deep.equal([
        ['onBeforeDestroy', false, false, 'ready'],
        ['before:destroy', false, false, 'ready'],
        ['onDestroy', true, true, undefined],
        ['destroy', true, true, undefined]
      ]);
    });

  }
});

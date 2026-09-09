import { Application, createMarionette } from 'marionette';
import { Collection, DataApi, Model } from '@mnjs/data';

function invariant(condition, message) {
  if (!condition) { throw new Error(message); }
}

function duration(startedAt) {
  return performance.now() - startedAt;
}

function makeModels(count) {
  return Array.from({ length: count }, (_, id) => new Model({ id, label: `row ${id}` }));
}

async function nativeDataList({ listSize }) {
  const runtime = createMarionette();
  const subscriptions = { collections: 0, models: 0 };
  function track(kind, dispose) {
    subscriptions[kind] += 1;
    let active = true;
    return () => {
      if (!active) { return; }
      active = false;
      subscriptions[kind] -= 1;
      dispose();
    };
  }
  const TrackingDataApi = {
    ...DataApi,
    subscribe(...args) {
      return track('models', DataApi.subscribe(...args));
    },
    observeCollection(...args) {
      return track('collections', DataApi.observeCollection(...args));
    }
  };
  runtime.setDataApi(TrackingDataApi);
  const RowView = runtime.View.extend({
    tagName: 'li',
    modelEvents: { 'change:label': 'render' },
    template(data) {
      return `<label>${data.label}<input value="${data.label}"></label>`;
    }
  });
  const ListView = runtime.CollectionView.extend({ childView: RowView, tagName: 'ul' });
  const models = makeModels(listSize);
  const collection = new Collection(models);
  const view = new ListView({ collection });
  const host = document.createElement('main');
  document.body.append(host);
  const region = new runtime.Region({ el: host });
  region.show(view);
  invariant(subscriptions.collections === 1, 'CollectionView did not observe the live collection');
  invariant(subscriptions.models === listSize, 'child Views did not observe their live models');

  const survivor = models[Math.floor(listSize / 2)];
  const updated = models[1];
  const replaced = models[listSize - 2];
  const survivorView = view.children.findByModel(survivor);
  const updatedView = view.children.findByModel(updated);
  const replacedView = view.children.findByModel(replaced);
  const survivorRoot = survivorView.el;
  const survivorInput = survivorRoot.querySelector('input');
  survivorInput.value = 'unfinished draft';
  survivorInput.focus();
  survivorInput.setSelectionRange(3, 11);

  let observedChanges = 0;
  const stopObserving = TrackingDataApi.observeCollection(collection, () => { observedChanges += 1; });
  invariant(subscriptions.collections === 2, 'consumer observer was not registered');
  const replacement = new Model({ id: replaced.id, label: 'replacement' });
  const replacementIndex = collection.indexOf(replaced);
  const startedAt = performance.now();
  updated.set('label', 'updated');
  collection.remove(replaced);
  collection.add(replacement, { at: replacementIndex });
  collection.move(models[0], listSize - 1);
  view.el.getBoundingClientRect();
  await new Promise(resolve => requestAnimationFrame(resolve));
  const elapsed = duration(startedAt);

  const replacementView = view.children.findByModel(replacement);
  invariant(view.children.length === listSize, 'native data list length changed');
  invariant(view.children.findByModel(survivor) === survivorView, 'survivor View identity changed');
  invariant(survivorView.el === survivorRoot, 'survivor root identity changed');
  invariant(survivorRoot.querySelector('input') === survivorInput, 'survivor input identity changed');
  invariant(document.activeElement === survivorInput, 'survivor focus changed');
  invariant(survivorInput.value === 'unfinished draft', 'survivor draft changed');
  invariant(survivorInput.selectionStart === 3 && survivorInput.selectionEnd === 11,
    'survivor selection changed');
  invariant(updatedView.el.textContent.includes('updated'), 'model update did not render');
  invariant(replacedView.isDestroyed(), 'replaced child was not destroyed');
  invariant(replacementView && replacementView !== replacedView, 'replacement child was not created');
  invariant(observedChanges === 3, 'native collection changes were not observed');

  stopObserving();
  const postUnsubscribe = collection.add({ id: listSize + 1, label: 'after unsubscribe' });
  collection.remove(postUnsubscribe);
  invariant(observedChanges === 3, 'collection observer remained after unsubscribe');
  invariant(subscriptions.collections === 1, 'consumer observer did not unsubscribe');
  const childCount = view.children.length;
  region.destroy();
  invariant(view.isDestroyed(), 'list View was not destroyed');
  invariant(subscriptions.collections === 0, 'CollectionView retained its live collection');
  invariant(subscriptions.models === 0, 'child Views retained their live models');
  updated.set('label', 'after owner destruction');
  const postDestroy = collection.add({ id: listSize + 2, label: 'live after owner destruction' });
  collection.remove(postDestroy);
  invariant(subscriptions.collections === 0 && subscriptions.models === 0,
    'destroyed list re-registered with live data');
  collection.destroy();
  invariant(collection.isDestroyed(), 'native collection was not destroyed');
  invariant(host.children.length === 0, 'managed DOM remained after Region destruction');
  host.remove();

  return {
    durationMilliseconds: elapsed,
    observations: {
      childCount,
      collectionChanges: observedChanges,
      collectionSubscriptionsAfterDestroy: subscriptions.collections,
      focusPreserved: true,
      modelSubscriptionsAfterDestroy: subscriptions.models,
      replacementDestroyed: true,
      survivorDraftPreserved: true,
      survivorIdentityPreserved: true,
      teardownComplete: true
    }
  };
}

async function applicationLifecycle({ applicationCycles }) {
  const activeResources = new Set();
  const events = [];
  let aborts = 0;
  const startedAt = performance.now();
  const CycleApplication = Application.extend({
    initialize() { this.startAttempts = 0; },
    onBeforeStart(application, options, context) {
      events.push('before:start');
      if (this.startAttempts++) { return; }
      return new Promise(resolve => {
        context.signal.addEventListener('abort', () => {
          aborts += 1;
          events.push('abort:start');
          resolve();
        }, { once: true });
      });
    },
    onStart() {
      events.push('start');
      activeResources.add(this);
    },
    onBeforeStop() { events.push('before:stop'); },
    onStop() {
      events.push('stop');
      activeResources.delete(this);
    },
    onBeforeDestroy() { events.push('before:destroy'); },
    onDestroy() { events.push('destroy'); }
  });

  for (let cycle = 0; cycle < applicationCycles; cycle += 1) {
    const app = new CycleApplication();
    const firstStart = app.start({ cycle });
    const restart = app.restart({ cycle });
    invariant(await firstStart === false, 'superseded Application start did not resolve false');
    invariant(await restart === true, 'Application restart did not complete');
    invariant(app.isRunning(), 'Application did not reach running state');
    invariant(await app.destroy({ cycle }) === true, 'Application destroy did not complete');
    invariant(app.isDestroyed(), 'Application did not reach destroyed state');
    invariant(activeResources.size === 0, 'Application external resource remained active');
  }

  const elapsed = duration(startedAt);
  await Promise.resolve();
  invariant(aborts === applicationCycles, 'Application did not abort each superseded start');
  invariant(events.filter(event => event === 'start').length === applicationCycles,
    'Application published a stale or missing start');
  invariant(events.filter(event => event === 'destroy').length === applicationCycles,
    'Application destroy event count changed');

  return {
    durationMilliseconds: elapsed,
    observations: {
      aborts,
      activeExternalResourcesAfterDestroy: activeResources.size,
      completedCycles: applicationCycles,
      destroyEvents: events.filter(event => event === 'destroy').length,
      lateStartEvents: 0,
      teardownComplete: true
    }
  };
}

function createExternalSource(metrics, owned) {
  const listeners = new Set();
  return {
    owned,
    listeners,
    on(eventName, callback, context) {
      listeners.add({ eventName, callback, context });
    },
    off(eventName, callback, context) {
      for (const listener of listeners) {
        if (listener.eventName === eventName && listener.callback === callback &&
            listener.context === context) {
          listeners.delete(listener);
        }
      }
    },
    emit(eventName, value) {
      for (const listener of [...listeners]) {
        if (listener.eventName === eventName) {
          listener.callback.call(listener.context, this, value);
        }
      }
    },
    dispose() {
      metrics.listenersAtDispose.push(listeners.size);
      metrics.ownedDisposals += 1;
    }
  };
}

async function stateMountDestroy({ mountCycles }) {
  const runtime = createMarionette();
  const metrics = {
    borrowedCallbacks: 0,
    clickCallbacks: 0,
    listenersAtDispose: [],
    ownedCallbacks: 0,
    ownedDisposals: 0
  };
  const ExternalStateApi = {
    subscribe(source, eventName, callback, context) {
      source.on(eventName, callback, context);
      return () => source.off(eventName, callback, context);
    },
    disposeOwned(source) { source.dispose(); }
  };
  const StatefulView = runtime.View.extend({
    stateEvents: { change: 'onStateChange' },
    events: { 'click button': 'onClick' },
    template: () => '<button type="button">state</button>',
    initialize(options) {
      this.metrics = options.metrics;
      this.kind = options.kind;
    },
    onClick() { this.metrics.clickCallbacks += 1; },
    onStateChange() { this.metrics[`${this.kind}Callbacks`] += 1; }
  });
  StatefulView.setStateApi(ExternalStateApi);
  const ownedSources = [];
  const OwnedView = StatefulView.extend({
    createState() {
      const source = createExternalSource(metrics, true);
      ownedSources.push(source);
      return source;
    }
  });
  const borrowedSource = createExternalSource(metrics, false);
  const host = document.createElement('main');
  document.body.append(host);
  const region = new runtime.Region({ el: host });
  const startedAt = performance.now();

  for (let cycle = 0; cycle < mountCycles; cycle += 1) {
    const borrowed = cycle % 2 === 0;
    const view = borrowed ?
      new StatefulView({ kind: 'borrowed', metrics, state: borrowedSource }) :
      new OwnedView({ kind: 'owned', metrics });
    const source = view.getState();
    region.show(view);
    const button = view.el.querySelector('button');
    const stateCallbacksBefore = metrics[`${borrowed ? 'borrowed' : 'owned'}Callbacks`];
    const clickCallbacksBefore = metrics.clickCallbacks;
    invariant(source.listeners.size === 1, 'mounted state View did not subscribe');
    source.emit('change', cycle);
    button.click();
    invariant(metrics[`${borrowed ? 'borrowed' : 'owned'}Callbacks`] === stateCallbacksBefore + 1,
      'mounted state View did not receive an external state callback');
    invariant(metrics.clickCallbacks === clickCallbacksBefore + 1,
      'mounted state View did not receive a delegated DOM callback');
    region.empty();
    const stateCallbacks = metrics[`${borrowed ? 'borrowed' : 'owned'}Callbacks`];
    const clickCallbacks = metrics.clickCallbacks;
    source.emit('change', cycle);
    button.click();
    invariant(view.isDestroyed(), 'mounted state View was not destroyed');
    invariant(!button.isConnected, 'mounted DOM remained connected after empty');
    invariant(source.listeners.size === 0, 'state subscription remained after View destruction');
    invariant(metrics[`${borrowed ? 'borrowed' : 'owned'}Callbacks`] === stateCallbacks,
      'destroyed View received an external state callback');
    invariant(metrics.clickCallbacks === clickCallbacks,
      'destroyed View received a delegated DOM callback');
  }

  const elapsed = duration(startedAt);
  region.destroy();
  const ownedCycles = Math.floor(mountCycles / 2);
  invariant(borrowedSource.listeners.size === 0, 'borrowed source retained subscriptions');
  invariant(metrics.ownedDisposals === ownedCycles, 'owned state disposal count changed');
  invariant(metrics.listenersAtDispose.every(count => count === 0),
    'owned state was disposed before subscription release');
  invariant(ownedSources.every(source => source.listeners.size === 0),
    'owned state retained subscriptions');
  invariant(host.children.length === 0, 'Region host retained mounted children');
  host.remove();

  return {
    durationMilliseconds: elapsed,
    observations: {
      borrowedCallbacks: metrics.borrowedCallbacks,
      borrowedListenersAfterDestroy: borrowedSource.listeners.size,
      completedCycles: mountCycles,
      domCallbacks: metrics.clickCallbacks,
      listenersAtOwnedDispose: metrics.listenersAtDispose,
      ownedCallbacks: metrics.ownedCallbacks,
      ownedDisposals: metrics.ownedDisposals,
      teardownComplete: true
    }
  };
}

export const workloads = {
  'application-async-lifecycle': applicationLifecycle,
  'native-data-list-mutations': nativeDataList,
  'state-mount-destroy': stateMountDestroy
};

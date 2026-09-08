import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

let runtimeLoaded = false;

function maxValue(target, key, ...values) {
  target[key] = Math.max(target[key], ...values);
}

const workloadFields = ['attachDetachCycles', 'mountDestroyCycles'];

function validCycleCount(value) {
  return Number.isInteger(value) && value > 0;
}

function validateWorkload(workload, label) {
  if (!workload || typeof workload !== 'object') {
    return [`${label} is missing`];
  }

  return workloadFields
    .filter(field => !validCycleCount(workload[field]))
    .map(field => `${label} ${field} must be a positive integer; received ${workload[field]}`);
}

function restoreGlobal(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete globalThis[name];
  }
}

async function loadRuntime(root) {
  if (runtimeLoaded) {
    throw new Error('Resource measurement supports one built runtime per process');
  }
  runtimeLoaded = true;

  let cleanup;

  try {
    const requireFromRoot = createRequire(resolve(root, 'package.json'));
    const { JSDOM } = requireFromRoot('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    cleanup = () => {
      restoreGlobal('window', previousWindow);
      restoreGlobal('document', previousDocument);
      dom.window.close();
    };
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;

    const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    const { createMarionette } = await import(pathToFileURL(resolve(root, manifest.exports['.'].import.default)).href);
    return { Marionette: createMarionette(), cleanup };
  } catch (error) {
    runtimeLoaded = false;
    cleanup?.();
    throw error;
  }
}

// The source and all registration counts belong to this consumer, not to framework
// bookkeeping. Leaked callbacks remain visible even after their owner is destroyed.
function eventSource() {
  const subscriptions = new Set();
  return {
    subscriptions,
    on(name, callback, context) {
      subscriptions.add({ name, callback, context });
      return this;
    },
    off(name, callback, context) {
      for (const entry of subscriptions) {
        if (entry.name === name && entry.callback === callback && entry.context === context) {
          subscriptions.delete(entry);
        }
      }
      return this;
    },
    emit(name, ...args) {
      for (const entry of [...subscriptions]) {
        if (entry.name === name) { entry.callback.apply(entry.context, args); }
      }
    }
  };
}

export async function measureResources({ root = '.', attachDetachCycles, mountDestroyCycles }) {
  const workload = { attachDetachCycles, mountDestroyCycles };
  const workloadViolations = validateWorkload(workload, 'Resource measurement workload');
  if (workloadViolations.length) { throw new Error(workloadViolations.join('; ')); }
  const runtime = await loadRuntime(resolve(root));
  const { Marionette } = runtime;
  const { Behavior, CollectionView, Region, View } = Marionette;
  const liveInstances = new Set();
  const delegatedListeners = new Set();
  const created = { viewInstances: 0, regionInstances: 0, behaviorInstances: 0, collectionViewInstances: 0 };
  let modelChanges = 0;
  let collectionChanges = 0;
  let mountedBehavior;
  function lifecycle(kind) {
    return {
      initialize() { created[kind]++; liveInstances.add(this); },
      onDestroy() { liveInstances.delete(this); }
    };
  }
  const PlainView = View.extend({ template: false, ...lifecycle('viewInstances') });
  const ChildView = PlainView.extend({ events: { click() {} } });
  const TrackedRegion = Region.extend(lifecycle('regionInstances'));
  const ListeningBehavior = Behavior.extend({
    ...lifecycle('behaviorInstances'),
    initialize() {
      created.behaviorInstances++;
      liveInstances.add(this);
      mountedBehavior = this;
    },
    modelEvents: { change() { modelChanges++; } }
  });
  const BehaviorView = PlainView.extend({ behaviors: [ListeningBehavior] });
  const TrackedCollectionView = CollectionView.extend({
    ...lifecycle('collectionViewInstances'),
    childView: ChildView,
    RegionClass: TrackedRegion
  });
  Marionette.setDataApi({
    models: source => source.models,
    observeCollection(source, callback, context) {
      const handler = change => { collectionChanges++; callback.call(context, change); };
      source.on('update', handler);
      return () => source.off('update', handler);
    }
  });
  Marionette.setEventDelegator({
    delegate({ rootEl, eventName, handler }) {
      const callback = event => handler(event);
      const registration = { rootEl, eventName, callback };
      delegatedListeners.add(registration);
      rootEl.addEventListener(eventName, callback);
      return () => {
        rootEl.removeEventListener(eventName, callback);
        delegatedListeners.delete(registration);
      };
    }
  });
  const retention = {
    collectionSubscriptionsWhileMounted: 0,
    modelSubscriptionsWhileMounted: 0,
    domListenersWhileMounted: 0,
    externalSubscriptionsAfterDestroy: 0,
    domListenersAfterDestroy: 0,
    callbacksAfterDestroy: 0,
    childViewsAfterDestroy: 0,
    regionViewsAfterEmpty: 0,
    regionsAfterHostDestroy: 0,
    managedDomChildrenAfterEmpty: 0,
    managedRootsConnectedAfterDestroy: 0,
    liveInstancesAfterDestroy: 0,
    detachedViewDestroyedWithFormerRegion: false,
    destroyedBehaviorRetainsHostReference: false
  };
  try {
    const detachRegionEl = document.createElement('div');
    document.body.append(detachRegionEl);
    const detachRegion = new TrackedRegion({ el: detachRegionEl });
    const detachView = new PlainView();
    for (let index = 0; index < attachDetachCycles; index++) {
      detachRegion.show(detachView);
      if (detachRegion.currentView !== detachView || !detachView.isAttached()) {
        throw new Error('Region resource scenario did not attach its view');
      }
      if (detachRegion.detachView() !== detachView || detachView.isAttached()) {
        throw new Error('Region resource scenario did not detach its view');
      }
      maxValue(retention, 'regionViewsAfterEmpty', Number(detachRegion.hasView()));
      maxValue(retention, 'managedDomChildrenAfterEmpty', detachRegionEl.childNodes.length);
    }
    detachRegion.destroy();
    retention.detachedViewDestroyedWithFormerRegion = detachView.isDestroyed();
    detachView.destroy();
    detachRegionEl.remove();

    const collection = Object.assign(eventSource(), { models: [{ id: 1 }] });
    const model = eventSource();
    for (let index = 0; index < mountDestroyCycles; index++) {
      const regionEl = document.createElement('div');
      document.body.append(regionEl);
      const regionHost = new PlainView({ regionClass: TrackedRegion });
      const cycleRegion = regionHost.addRegion('resource', { el: regionEl });
      if (regionHost.getRegion('resource') !== cycleRegion) {
        throw new Error('Region resource scenario did not establish public ownership');
      }
      cycleRegion.show(new PlainView());
      cycleRegion.empty();
      maxValue(retention, 'regionViewsAfterEmpty', Number(cycleRegion.hasView()));
      maxValue(retention, 'managedDomChildrenAfterEmpty', regionEl.childNodes.length);

      const collectionView = new TrackedCollectionView({ collection }).render();
      document.body.append(collectionView.el);
      const added = { id: index + 2 };
      collection.models.push(added);
      collection.emit('update', { kind: 'update', added: [added], removed: [], updated: [] });
      if (collectionView.children.length !== collection.models.length) {
        throw new Error('CollectionView resource scenario did not receive an external update');
      }
      maxValue(retention, 'collectionSubscriptionsWhileMounted', collection.subscriptions.size);
      maxValue(retention, 'domListenersWhileMounted', delegatedListeners.size);
      collectionView.destroy();
      const changesBefore = collectionChanges;
      collection.models.pop();
      collection.emit('update', { kind: 'update', added: [], removed: [added], updated: [] });
      maxValue(retention, 'callbacksAfterDestroy', collectionChanges - changesBefore);
      maxValue(retention, 'externalSubscriptionsAfterDestroy', collection.subscriptions.size);
      maxValue(retention, 'domListenersAfterDestroy', delegatedListeners.size);
      maxValue(retention, 'childViewsAfterDestroy', collectionView.children.length);
      maxValue(retention, 'managedDomChildrenAfterEmpty', collectionView.el.childNodes.length);
      maxValue(retention, 'managedRootsConnectedAfterDestroy', Number(collectionView.el.isConnected));

      const behaviorView = new BehaviorView({ model });
      document.body.append(behaviorView.el);
      const before = modelChanges;
      model.emit('change');
      if (modelChanges !== before + 1 || mountedBehavior.view !== behaviorView) {
        throw new Error('Behavior resource scenario did not receive its model event');
      }
      maxValue(retention, 'modelSubscriptionsWhileMounted', model.subscriptions.size);
      behaviorView.destroy();
      model.emit('change');
      maxValue(retention, 'callbacksAfterDestroy', modelChanges - before - 1);
      maxValue(retention, 'externalSubscriptionsAfterDestroy', model.subscriptions.size);
      maxValue(retention, 'managedDomChildrenAfterEmpty', behaviorView.el.childNodes.length);
      maxValue(retention, 'managedRootsConnectedAfterDestroy', Number(behaviorView.el.isConnected));
      retention.destroyedBehaviorRetainsHostReference ||= mountedBehavior.view === behaviorView;

      regionHost.destroy();
      maxValue(retention, 'regionsAfterHostDestroy', Object.keys(regionHost.getRegions()).length);
      maxValue(retention, 'liveInstancesAfterDestroy', liveInstances.size);
      regionEl.remove();
    }
    return { schemaVersion: 2, workload, created, retention };
  } finally {
    document.body.textContent = '';
    runtime.cleanup();
  }
}

function displayValue(value) {
  return String(value);
}

function compareValues(base, current, path, changes, violations) {
  if (typeof base === 'number' || typeof base === 'boolean') {
    if (typeof current !== typeof base) {
      violations.push(`${path} changed measurement type`);
      return;
    }
    const baseValue = Number(base);
    const currentValue = Number(current);
    if (currentValue !== baseValue) {
      const status = currentValue > baseValue ? 'increase' : 'decrease';
      changes.push({ path, base, current, status });
    }
    return;
  }

  if (!base || typeof base !== 'object' || Array.isArray(base) ||
      !current || typeof current !== 'object' || Array.isArray(current)) {
    violations.push(`${path} has unsupported measurement values`);
    return;
  }

  const baseKeys = Object.keys(base).sort();
  const currentKeys = Object.keys(current).sort();
  const missing = baseKeys.filter(key => !currentKeys.includes(key));
  const unknown = currentKeys.filter(key => !baseKeys.includes(key));
  if (missing.length) {
    violations.push(`${path} is missing metrics: ${missing.join(', ')}`);
  }
  if (unknown.length) {
    violations.push(`${path} has unknown metrics: ${unknown.join(', ')}`);
  }

  for (const metric of baseKeys.filter(key => currentKeys.includes(key))) {
    compareValues(base[metric], current[metric], `${path}.${metric}`, changes, violations);
  }
}

export function compareResources(base, current) {
  const changes = [];
  const violations = [];

  if (base.schemaVersion !== 2) {
    violations.push(`Exact-base resource schemaVersion must be 2; received ${base.schemaVersion}`);
  }
  if (current.schemaVersion !== 2) {
    violations.push(`Pull request resource schemaVersion must be 2; received ${current.schemaVersion}`);
  }
  const baseWorkloadViolations = validateWorkload(base.workload, 'Exact-base resource workload');
  const currentWorkloadViolations = validateWorkload(current.workload, 'Pull request resource workload');
  violations.push(...baseWorkloadViolations, ...currentWorkloadViolations);
  if (!baseWorkloadViolations.length && !currentWorkloadViolations.length &&
      JSON.stringify(base.workload) !== JSON.stringify(current.workload)) {
    violations.push('Resource measurement workload does not match the exact base');
  }

  compareValues(
    { created: base.created, retention: base.retention },
    { created: current.created, retention: current.retention },
    'resources',
    changes,
    violations
  );

  return { changes, violations };
}

export function resourceReportRows(comparison) {
  if (!comparison.changes.length) {
    return comparison.violations.length ?
      ['| Contract validation | Not comparable | Not comparable | Review required |'] :
      ['| None | No change | No change | Pass |'];
  }

  return comparison.changes.map(change => {
    return `| \`${change.path}\` | ${displayValue(change.base)} | ${displayValue(change.current)} | ${change.status === 'changed' ? 'Changed' : change.status === 'increase' ? 'Increase' : 'Decrease'} |`;
  });
}

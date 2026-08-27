import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

let runtimeLoaded = false;

function registrations(eventMap, owner) {
  return Object.values(eventMap || {})
    .flat()
    .filter(event => !owner || event.context === owner || event.ctx === owner || event.listener === owner)
    .length;
}

function marionetteRegistrations(emitter, owner) {
  return registrations(emitter._rdEvents, owner);
}

function backboneRegistrations(emitter, owner) {
  return registrations(emitter._events, owner);
}

function ledgerEntries(ledger) {
  return Object.keys(ledger || {}).length;
}

function childContainerEntries(container) {
  return Math.max(
    container.length,
    container._views.length,
    ledgerEntries(container._viewsByCid),
    ledgerEntries(container._indexByModel)
  );
}

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

function instanceMeasurement(instance, { Region }) {
  const ownProperties = Object.keys(instance).sort();
  const entries = ownProperties.map(property => [property, instance[property]]);
  const arrays = entries.filter(([, value]) => Array.isArray(value));
  const plainObjects = entries.filter(([, value]) => value?.constructor === Object);
  const childViewContainers = entries.filter(([, value]) => Array.isArray(value?._views) &&
    value?._viewsByCid && value?._indexByModel);
  const regions = entries.filter(([, value]) => value instanceof Region);
  const references = entries.filter(([, value]) =>
    value !== null && (typeof value === 'object' || typeof value === 'function'));

  return {
    ownProperties,
    ownReferences: references.map(([property]) => property),
    uniqueOwnReferences: new Set(references.map(([, value]) => value)).size,
    arrays: arrays.map(([property]) => property),
    arrayEntries: arrays.reduce((total, [, value]) => total + value.length, 0),
    plainObjects: plainObjects.map(([property]) => property),
    plainObjectEntries: plainObjects.reduce((total, [, value]) => total + Object.keys(value).length, 0),
    childViewContainers: childViewContainers.map(([property]) => property),
    childViewContainerEntries: childViewContainers.reduce((total, [, value]) => {
      return total + childContainerEntries(value);
    }, 0),
    regions: regions.map(([property]) => property),
    regionsWithViews: regions.filter(([, value]) => value.hasView()).length,
    marionetteEventRegistrations: marionetteRegistrations(instance),
    listeningContainers: ledgerEntries(instance._rdListeningTo),
  };
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

    const backboneUrl = pathToFileURL(resolve(root, 'dist/backbone.js'));
    const runtimeUrl = pathToFileURL(resolve(root, 'dist/marionette.js'));
    const [{ default: Backbone }, Marionette] = await Promise.all([
      import(backboneUrl.href),
      import(runtimeUrl.href),
    ]);

    return { Backbone, Marionette, cleanup };
  } catch (error) {
    runtimeLoaded = false;
    cleanup?.();
    throw error;
  }
}

export async function measureResources({ root = '.', attachDetachCycles, mountDestroyCycles }) {
  const workload = { attachDetachCycles, mountDestroyCycles };
  const workloadViolations = validateWorkload(workload, 'Resource measurement workload');
  if (workloadViolations.length) {
    throw new Error(workloadViolations.join('; '));
  }

  const resolvedRoot = resolve(root);
  const runtime = await loadRuntime(resolvedRoot);
  const { Backbone, Marionette } = runtime;
  const { Behavior, CollectionView, Region, View } = Marionette;
  const PlainView = View.extend({ template: false });
  const ChildView = View.extend({ template: false });
  const ListeningBehavior = Behavior.extend({
    modelEvents: {
      change: 'onModelChange'
    },
    onModelChange() {
      this.modelChanges = (this.modelChanges || 0) + 1;
    }
  });
  const BehaviorView = View.extend({
    behaviors: [ListeningBehavior],
    template: false,
  });

  try {
    const view = new View();
    const region = new Region({ el: document.createElement('div') });
    const behaviorHost = new View();
    const behavior = new Behavior({}, behaviorHost);
    const collectionView = new CollectionView({
      childView: ChildView,
      collection: new Backbone.Collection(),
    });
    const allocations = {
      View: instanceMeasurement(view, Marionette),
      Region: instanceMeasurement(region, Marionette),
      Behavior: instanceMeasurement(behavior, Marionette),
      CollectionView: instanceMeasurement(collectionView, Marionette),
    };

    behavior.destroy();
    behaviorHost.destroy();
    view.destroy();
    region.destroy();
    collectionView.destroy();

    const retention = {
      regionRegistrationsWhileShown: 0,
      collectionRegistrationsWhileMounted: 0,
      modelRegistrationsWhileMounted: 0,
      externalListenerOwnersWhileMounted: 0,
      collectionViewListeningToWhileMounted: 0,
      behaviorListeningToWhileMounted: 0,
      destroyedBehaviorRetainsHostReference: false,
      destroyedHostRetainsBehaviorCount: 0,
      externalRegistrationsAfterDestroy: 0,
      externalListenerOwnersAfterDestroy: 0,
      frameworkListeningToAfterDestroy: 0,
      childContainerEntriesAfterDestroy: 0,
      managedDomChildrenAfterEmpty: 0,
      managedRootsConnectedAfterDestroy: 0,
      regionParentReferencesAfterDestroy: 0,
    };
    const detachRegionEl = document.createElement('div');
    document.body.appendChild(detachRegionEl);
    const detachRegion = new Region({ el: detachRegionEl });
    const detachView = new PlainView();

    for (let index = 0; index < attachDetachCycles; index += 1) {
      detachRegion.show(detachView);
      if (!detachRegion.hasView() || detachRegion.currentView !== detachView) {
        throw new Error('Region resource scenario did not show its view');
      }
      maxValue(retention, 'regionRegistrationsWhileShown', marionetteRegistrations(detachView, detachRegion));
      detachRegion.detachView();
      if (detachRegion.hasView()) {
        throw new Error('Region resource scenario did not detach its view');
      }
      maxValue(retention, 'externalRegistrationsAfterDestroy', marionetteRegistrations(detachView, detachRegion));
      maxValue(retention, 'managedDomChildrenAfterEmpty', detachRegionEl.childNodes.length);
    }

    detachView.destroy();
    detachRegion.destroy();
    detachRegionEl.remove();

    const collection = new Backbone.Collection([{ id: 1 }]);
    const model = new Backbone.Model();

    for (let index = 0; index < mountDestroyCycles; index += 1) {
      const regionEl = document.createElement('div');
      document.body.appendChild(regionEl);
      const regionHost = new PlainView();
      const cycleRegion = regionHost.addRegion('resource', { el: regionEl });
      if (cycleRegion._parentView !== regionHost) {
        throw new Error('Region resource scenario did not establish parent ownership');
      }
      const regionView = new PlainView();
      cycleRegion.show(regionView);
      cycleRegion.empty();
      maxValue(retention, 'externalRegistrationsAfterDestroy', marionetteRegistrations(regionView, cycleRegion));
      maxValue(retention, 'managedDomChildrenAfterEmpty', regionEl.childNodes.length);

      const mountedCollectionView = new CollectionView({
        childView: ChildView,
        collection,
      });
      document.body.appendChild(mountedCollectionView.el);
      mountedCollectionView.render();
      if (mountedCollectionView.children.length !== collection.length) {
        throw new Error('CollectionView resource scenario did not render its collection');
      }
      maxValue(
        retention,
        'collectionRegistrationsWhileMounted',
        backboneRegistrations(collection, mountedCollectionView),
        marionetteRegistrations(collection, mountedCollectionView)
      );
      maxValue(retention, 'externalListenerOwnersWhileMounted', ledgerEntries(collection._rdListeners));
      maxValue(retention, 'collectionViewListeningToWhileMounted', ledgerEntries(mountedCollectionView._rdListeningTo));
      mountedCollectionView.destroy();

      maxValue(
        retention,
        'childContainerEntriesAfterDestroy',
        childContainerEntries(mountedCollectionView._children),
        childContainerEntries(mountedCollectionView.children)
      );
      maxValue(
        retention,
        'externalRegistrationsAfterDestroy',
        backboneRegistrations(collection, mountedCollectionView),
        marionetteRegistrations(collection, mountedCollectionView)
      );
      maxValue(retention, 'externalListenerOwnersAfterDestroy', ledgerEntries(collection._rdListeners));
      maxValue(retention, 'frameworkListeningToAfterDestroy', ledgerEntries(mountedCollectionView._rdListeningTo));
      maxValue(retention, 'managedDomChildrenAfterEmpty', mountedCollectionView.el.childNodes.length);
      maxValue(retention, 'managedRootsConnectedAfterDestroy', Number(mountedCollectionView.el.isConnected));

      const behaviorView = new BehaviorView({ model });
      const mountedBehavior = behaviorView._behaviors[0];
      document.body.appendChild(behaviorView.el);
      model.set('resourceCycle', index);
      if (mountedBehavior.modelChanges !== 1) {
        throw new Error('Behavior resource scenario did not receive its model event');
      }
      maxValue(
        retention,
        'modelRegistrationsWhileMounted',
        backboneRegistrations(model, mountedBehavior),
        marionetteRegistrations(model, mountedBehavior)
      );
      maxValue(retention, 'externalListenerOwnersWhileMounted', ledgerEntries(model._rdListeners));
      maxValue(retention, 'behaviorListeningToWhileMounted', ledgerEntries(mountedBehavior._rdListeningTo));
      behaviorView.destroy();

      maxValue(
        retention,
        'externalRegistrationsAfterDestroy',
        backboneRegistrations(model, behaviorView),
        backboneRegistrations(model, mountedBehavior),
        marionetteRegistrations(model, mountedBehavior)
      );
      maxValue(retention, 'externalListenerOwnersAfterDestroy', ledgerEntries(model._rdListeners));
      maxValue(retention, 'frameworkListeningToAfterDestroy', ledgerEntries(mountedBehavior._rdListeningTo));
      maxValue(retention, 'managedDomChildrenAfterEmpty', behaviorView.el.childNodes.length);
      maxValue(retention, 'managedRootsConnectedAfterDestroy', Number(behaviorView.el.isConnected));
      retention.destroyedBehaviorRetainsHostReference ||= mountedBehavior.view === behaviorView;
      maxValue(retention, 'destroyedHostRetainsBehaviorCount', behaviorView._behaviors.length);

      regionHost.destroy();
      maxValue(retention, 'regionParentReferencesAfterDestroy', Number(cycleRegion._parentView != null));
      regionEl.remove();
    }

    return {
      schemaVersion: 1,
      workload,
      allocations,
      retention,
    };
  } finally {
    document.body.textContent = '';
    runtime.cleanup();
  }
}

function displayValue(value) {
  return Array.isArray(value) ? value.join(', ') || 'None' : String(value);
}

function compareValues(base, current, path, changes, violations) {
  if (Array.isArray(base)) {
    if (!Array.isArray(current)) {
      violations.push(`${path} changed measurement type`);
      return;
    }
    const added = current.filter(value => !base.includes(value));
    const removed = base.filter(value => !current.includes(value));
    if (added.length || removed.length) {
      const status = added.length ? 'regression' : 'improvement';
      changes.push({ path, base, current, status });
    }
    if (added.length) {
      violations.push(`${path} added ${added.join(', ')}`);
    }
    return;
  }

  if (typeof base === 'number' || typeof base === 'boolean') {
    if (typeof current !== typeof base) {
      violations.push(`${path} changed measurement type`);
      return;
    }
    const baseValue = Number(base);
    const currentValue = Number(current);
    if (currentValue !== baseValue) {
      const status = currentValue > baseValue ? 'regression' : 'improvement';
      changes.push({ path, base, current, status });
      if (status === 'regression') {
        violations.push(`${path} increased from ${displayValue(base)} to ${displayValue(current)}`);
      }
    }
    return;
  }

  if (!base || typeof base !== 'object' || !current || typeof current !== 'object') {
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

  if (base.schemaVersion !== 1) {
    violations.push(`Exact-base resource schemaVersion must be 1; received ${base.schemaVersion}`);
  }
  if (current.schemaVersion !== 1) {
    violations.push(`Pull request resource schemaVersion must be 1; received ${current.schemaVersion}`);
  }
  const baseWorkloadViolations = validateWorkload(base.workload, 'Exact-base resource workload');
  const currentWorkloadViolations = validateWorkload(current.workload, 'Pull request resource workload');
  violations.push(...baseWorkloadViolations, ...currentWorkloadViolations);
  if (!baseWorkloadViolations.length && !currentWorkloadViolations.length &&
      JSON.stringify(base.workload) !== JSON.stringify(current.workload)) {
    violations.push('Resource measurement workload does not match the exact base');
  }

  compareValues(
    { allocations: base.allocations, retention: base.retention },
    { allocations: current.allocations, retention: current.retention },
    'resources',
    changes,
    violations
  );

  return { changes, violations };
}

export function validateCandidateResourceContract(authorityContract, candidateContract) {
  const authority = authorityContract.deterministicResources;
  const candidate = candidateContract.deterministicResources;
  if (!authority) {
    return ['Exact-base performance contract is missing deterministicResources'];
  }
  if (!candidate) {
    return ['Candidate performance contract is missing deterministicResources'];
  }

  const violations = [];
  for (const field of workloadFields) {
    if (!validCycleCount(authority[field])) {
      violations.push(`Exact-base authority ${field} must be a positive integer; received ${authority[field]}`);
      continue;
    }
    if (!validCycleCount(candidate[field])) {
      violations.push(`Candidate ${field} must be a positive integer; received ${candidate[field]}`);
    } else if (candidate[field] < authority[field]) {
      violations.push(`Candidate ${field} ${candidate[field]} is below the exact-base authority ${authority[field]}`);
    }
  }

  return violations;
}

export function resourceReportRows(comparison) {
  if (!comparison.changes.length) {
    return comparison.violations.length ?
      ['| Contract validation | Not comparable | Not comparable | Review required |'] :
      ['| None | No change | No change | Pass |'];
  }

  return comparison.changes.map(change => {
    return `| \`${change.path}\` | ${displayValue(change.base)} | ${displayValue(change.current)} | ${change.status === 'regression' ? 'Regression' : 'Improvement'} |`;
  });
}

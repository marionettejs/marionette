// current-303ddfbb/src/effects.ts
var owners = /* @__PURE__ */ new WeakMap();
var parents = /* @__PURE__ */ new WeakMap();
var families = /* @__PURE__ */ new WeakMap();
var readers = /* @__PURE__ */ new WeakMap();
var retired = /* @__PURE__ */ new WeakMap();
function effectRetirement(dependency, callback) {
  retired.set(dependency, callback);
}
function hasEffectReaders(dependency) {
  return !!readers.get(dependency)?.size;
}
var unknownMetadata = /* @__PURE__ */ new WeakSet();
var unknownProps = /* @__PURE__ */ new WeakSet();
var propTokens = /* @__PURE__ */ new WeakMap();
function propsMetadata(node) {
  unknownProps.add(node);
  const token2 = propTokens.get(node);
  if (token2) {
    readers.get(token2)?.forEach((effect) => effect.opaque());
  }
}
function readPropsEffect(node) {
  if (!active) {
    return;
  }
  let token2 = propTokens.get(node);
  if (!token2) {
    token2 = {};
    propTokens.set(node, token2);
  }
  active.read(token2);
  if (unknownProps.has(node)) {
    opaqueEffect();
  }
}
var generatedSchemas = /* @__PURE__ */ new WeakSet();
function generatedSchema(schema) {
  if (schema && typeof schema === 'object') {
    generatedSchemas.add(schema);
  }
  return schema;
}
function isGeneratedSchema(schema) {
  return !!schema && typeof schema === 'object' && generatedSchemas.has(schema);
}
function effectMetadata(node) {
  unknownMetadata.add(node);
  readers.get(node)?.forEach((effect) => {
    effect.opaque();
    effect.invalidate();
  });
}
function resetEffectMetadata(node) {
  unknownMetadata.delete(node);
}
var projectionValues = /* @__PURE__ */ new WeakMap();
function effectProjection(value, producer, version, node) {
  const projection = { producer, version, valid: true };
  projectionValues.set(value, projection);
  if (active && !active.unowned && !unknownMetadata.has(node)) {
    active.projection = projection;
  }
  return value;
}
function projectionAlias(target, proxy) {
  const projection = projectionValues.get(target);
  if (projection) {
    projectionValues.set(proxy, projection);
  }
}
function invalidateProjection(target) {
  const projection = projectionValues.get(target);
  if (projection) {
    projection.valid = false;
  }
}
var active;
var activeGraph;
function effectNode(node, parent) {
  owners.set(node, node);
  parents.set(node, parent);
}
function effectObject(object, node) {
  owners.set(object, node);
}
function readEffect(object, key, indexedName = false) {
  if (!active) {
    return;
  }
  const node = object && typeof object === 'object' ? owners.get(object) : void 0;
  if (node) {
    active.read(node);
    if (unknownMetadata.has(node)) {
      active.opaque();
    }
    if (object === node && key === 'name' && indexedName && parents.get(node)) {
      active.read(parents.get(node));
    }
  } else {
    active.unowned = true;
    active.opaque();
  }
}
function opaqueEffect() {
  active?.opaque();
}
function changedEffect(node) {
  readers.get(node)?.forEach((effect) => {
    if (effect !== active) {
      effect.invalidate();
    }
  });
}
function untrackedEffect(callback) {
  const previous = active;
  active = void 0;
  try {
    return callback();
  } finally {
    active = previous;
  }
}
function bindingEffect() {
  return active;
}
function notifyEffect(dependency) {
  readers.get(dependency)?.forEach((effect) => {
    if (effect !== active) {
      effect.invalidate();
    }
  });
}
var OwnedEffect = class {
  constructor(graph, callback) {
    this.graph = graph;
    this.callback = callback;
  }
  dirty = true;
  alive = true;
  dependencies = /* @__PURE__ */ new Map();
  unobserved = 0;
  values = /* @__PURE__ */ new Map();
  evaluation = 0;
  round = 0;
  epoch = 0;
  context;
  unowned = false;
  projection;
  read(dependency) {
    if (!this.alive) {
      return;
    }
    const seen = this.dependencies.get(dependency);
    if (seen !== void 0) {
      if (seen !== this.round) {
        this.dependencies.set(dependency, this.round);
        this.unobserved--;
      }
      return;
    }
    this.dependencies.set(dependency, this.round);
    let subscriptions = readers.get(dependency);
    if (!subscriptions) {
      subscriptions = /* @__PURE__ */ new Set();
      readers.set(dependency, subscriptions);
    }
    subscriptions.add(this);
  }
  defer() {
    if (!this.alive || this === active) {
      return;
    }
    this.dirty = true;
    this.graph.family.deferred.add(this);
  }
  opaque() {
    if (this.alive) {
      this.graph.family.opaque.add(this);
      this.graph.opaque.add(this);
    }
  }
  invalidate() {
    if (!this.alive) {
      return;
    }
    this.dirty = true;
    this.graph.enqueue(this);
  }
  nextEvaluation() {
    return String(this.evaluation++);
  }
  value(key, source, scope, compute, equal, fresh = false) {
    let binding = this.values.get(key);
    if (!binding) {
      binding = new BindingValue(this);
      this.values.set(key, binding);
    }
    return binding.get(source, scope, compute, equal, fresh);
  }
  run() {
    if (!this.alive) {
      return;
    }
    const round = ++this.round;
    this.evaluation = 0;
    this.unobserved = this.dependencies.size;
    this.graph.family.opaque.delete(this);
    this.graph.opaque.delete(this);
    this.dirty = false;
    this.unowned = false;
    this.projection = void 0;
    this.epoch = this.graph.epoch;
    this.graph.pending.delete(this);
    const previous = active, previousGraph = activeGraph;
    active = this;
    activeGraph = this.graph;
    try {
      this.callback();
    } finally {
      active = previous;
      activeGraph = previousGraph;
      if (this.round === round && this.unobserved) {
        this.detach(round);
        this.unobserved = 0;
      }
      for (const [key, binding] of this.values) {
        if (binding.seen !== this.round) {
          binding.stop();
          this.values.delete(key);
        }
      }
    }
  }
  detach(round) {
    this.dependencies.forEach((seen, dependency) => {
      if (round !== void 0 && seen === round) {
        return;
      }
      const subscriptions = readers.get(dependency);
      subscriptions.delete(this);
      this.dependencies.delete(dependency);
      if (!subscriptions.size) {
        retired.get(dependency)?.();
      }
    });
  }
  stop() {
    this.alive = false;
    this.values.forEach((binding) => binding.stop());
    this.values.clear();
    this.detach();
    this.graph.family.opaque.delete(this);
    this.graph.opaque.delete(this);
    this.graph.pending.delete(this);
    this.graph.family.deferred.delete(this);
    this.graph.effects.delete(this);
  }
};
var BindingValue = class {
  constructor(owner) {
    this.owner = owner;
    this.effect = owner.graph.create(() => {
    });
  }
  seen = 0;
  source;
  scope;
  value;
  projection;
  pulling = false;
  effect;
  get(source, scope, compute, equal, fresh = false) {
    this.seen = this.owner.round;
    if (this.source !== source || this.scope !== scope || fresh && this.effect.epoch !== this.effect.graph.epoch) {
      this.effect.dirty = true;
    }
    this.source = source;
    this.scope = scope;
    this.effect.context = scope;
    this.effect.callback = () => {
      const value = compute();
      const projection = value && typeof value === 'object' ? projectionValues.get(value) : void 0;
      const owned = projection && projection === this.effect.projection && !this.effect.unowned;
      const unchangedProjection = owned && projection.valid && this.projection?.valid && projection.producer === this.projection.producer && projection.version === this.projection.version;
      const changed = equal ? !equal(this.value, value) : !unchangedProjection && (!Object.is(value, this.value) || value !== null && typeof value === 'object');
      this.projection = owned ? projection : void 0;
      this.value = value;
      if (changed) {
        readers.get(this)?.forEach((effect) => {
          if (effect !== active && !(effect === this.owner && this.pulling)) {
            effect.invalidate();
          }
        });
      }
    };
    if (this.effect.dirty) {
      const previous = this.pulling;
      this.pulling = true;
      try {
        this.effect.run();
      } finally {
        this.pulling = previous;
      }
    }
    active?.read(this);
    return this.value;
  }
  stop() {
    this.effect.stop();
  }
};
var EffectGraph = class {
  constructor(data, schedule) {
    this.schedule = schedule;
    const node = owners.get(data);
    let root = node;
    while (root && parents.get(root)) {
      root = parents.get(root);
    }
    const family = activeGraph?.family ?? (root && families.get(root)) ?? { opaque: /* @__PURE__ */ new Set(), deferred: /* @__PURE__ */ new Set() };
    this.family = family;
    if (root) {
      families.set(root, family);
    }
  }
  family;
  epoch = 0;
  pending = /* @__PURE__ */ new Set();
  opaque = /* @__PURE__ */ new Set();
  effects = /* @__PURE__ */ new Set();
  alive = true;
  ready = false;
  create(callback) {
    const effect = new OwnedEffect(this, callback);
    this.effects.add(effect);
    return effect;
  }
  enqueue(effect) {
    if (!this.alive) {
      return;
    }
    this.pending.add(effect);
    if (this.ready) {
      this.schedule();
    }
  }
  discover(family = false) {
    for (const effect of [...this.family.deferred]) {
      if (family || effect.graph === this) {
        this.family.deferred.delete(effect);
        if (effect.graph === this) {
          effect.dirty = true;
          this.pending.add(effect);
        } else {
          effect.invalidate();
        }
      }
    }
    (family ? this.family.opaque : this.opaque).forEach((effect) => {
      if (this.family.opaque.has(effect)) {
        if (effect.graph === this) {
          effect.dirty = true;
          this.pending.add(effect);
        } else {
          effect.invalidate();
        }
      }
    });
  }
  activate() {
    this.ready = true;
    if (this.pending.size) {
      this.schedule();
    }
  }
  begin() {
    this.epoch++;
  }
  flush(current) {
    while (this.pending.size) {
      for (const effect of [...this.pending]) {
        if (!current()) {
          return;
        }
        if (effect.dirty) {
          effect.run();
        } else {
          this.pending.delete(effect);
        }
      }
    }
  }
  stop() {
    this.alive = false;
    [...this.effects].forEach((effect) => effect.stop());
  }
};
var projections = /* @__PURE__ */ new WeakMap();
function projectNative(component, projection) {
  projections.set(component, projection);
}
function updateNative(component, props, data, children, force) {
  const project = projections.get(component);
  if (!project) {
    return false;
  }
  project(props, data, children, force);
  return true;
}
var targets = /* @__PURE__ */ new WeakSet();
function isEffectTarget(value) {
  return !!value && typeof value === 'object' && targets.has(value);
}
function effectTarget(target) {
  let opaque = false;
  const changed = () => {
    readers.get(proxy)?.forEach((effect) => effect.defer());
  };
  const metadata = () => {
    opaque = true;
    readers.get(proxy)?.forEach((effect) => effect.opaque());
    changed();
  };
  const read = () => {
    active?.read(proxy);
    if (opaque) {
      opaqueEffect();
    }
  };
  const proxy = new Proxy(target, {
    get(object, key, receiver) {
      read();
      return Reflect.get(object, key, receiver);
    },
    ownKeys(object) {
      read();
      return Reflect.ownKeys(object);
    },
    set(object, key, value, receiver) {
      const previous = Reflect.get(object, key);
      const result = Reflect.set(object, key, value, receiver);
      if (result && !Object.is(previous, value)) {
        changed();
      }
      return result;
    },
    deleteProperty(object, key) {
      const present = Object.hasOwn(object, key);
      const result = Reflect.deleteProperty(object, key);
      if (present && result) {
        changed();
      }
      return result;
    },
    defineProperty(object, key, descriptor) {
      const result = Reflect.defineProperty(object, key, descriptor);
      if (result) {
        if (descriptor.get || descriptor.set) {
          metadata();
        } else {
          changed();
        }
      }
      return result;
    },
    setPrototypeOf(object, prototype) {
      const result = Reflect.setPrototypeOf(object, prototype);
      if (result) {
        metadata();
      }
      return result;
    }
  });
  targets.add(proxy);
  return proxy;
}

// current-303ddfbb/src/ownership.ts
var resources = /* @__PURE__ */ new WeakSet();
var owners2 = /* @__PURE__ */ new WeakMap();
function ownNodeResource(node) {
  resources.add(node);
  owners2.get(node)?.forEach((owner) => owner.manage(node));
}
function releaseNodeResource(node) {
  resources.delete(node);
  for (const owner of [...owners2.get(node) ?? []]) {
    owner.release(node);
  }
}
var NodeOwnership = class {
  constructor(nodes2) {
    this.nodes = nodes2;
  }
  #parents = /* @__PURE__ */ new Map();
  #boundaries = /* @__PURE__ */ new Map();
  #pending = /* @__PURE__ */ new Set();
  #dirty = /* @__PURE__ */ new Set();
  #fallback = /* @__PURE__ */ new Set();
  #disposed = false;
  add(node) {
    if (this.#disposed || this.#parents.has(node)) {
      return;
    }
    this.nodes.add(node);
    this.#parents.set(node, null);
    let known = owners2.get(node);
    if (!known) {
      known = /* @__PURE__ */ new Set();
      owners2.set(node, known);
    }
    known.add(this);
    if (!resources.has(node)) {
      this.#fallback.add(node);
    }
    this.#link(node);
    if (this.#disposed || !this.nodes.has(node)) {
      return;
    }
    if (node.type !== 'input') {
      this.#boundary(node);
    }
    this.#pending.add(node);
  }
  manage(node) {
    this.#fallback.delete(node);
    const boundary = this.#boundaries.get(node);
    if (boundary?.phase?.settled === true) {
      boundary.phase = void 0;
    }
  }
  release(node) {
    if (!this.nodes.has(node)) {
      return;
    }
    if (node.context === null) {
      this.delete(node);
    } else {
      this.#fallback.add(node);
    }
  }
  delete(node) {
    this.nodes.delete(node);
    this.#fallback.delete(node);
    this.#pending.delete(node);
    const parent = this.#parents.get(node);
    this.#parents.delete(node);
    owners2.get(node)?.delete(this);
    if (parent) {
      this.#boundaries.get(parent)?.members.delete(node);
      this.#unused(parent);
    }
    this.#unused(node);
  }
  #boundary(node) {
    let boundary = this.#boundaries.get(node);
    if (boundary) {
      return boundary;
    }
    boundary = { node, members: /* @__PURE__ */ new Set(), receipts: [], input: (value, next) => {
      if (this.#disposed || this.#boundaries.get(node) !== boundary) {
        return next(value);
      }
      const previous = boundary.phase;
      const phase = { dispatching: true, settled: void 0 };
      boundary.phase = phase;
      this.#dirty.add(boundary);
      queueMicrotask(() => {
        if (this.#disposed || this.#boundaries.get(node) !== boundary || boundary.phase !== phase) {
          return;
        }
        phase.dispatching = false;
        if (phase.settled === true) {
          boundary.phase = void 0;
        }
      });
      try {
        return next(value);
      } catch (error2) {
        if (boundary.phase === phase) {
          boundary.phase = boundary.settled === true ? void 0 : previous;
        }
        throw error2;
      }
    } };
    this.#boundaries.set(node, boundary);
    node.hook.input(boundary.input);
    if (this.#disposed || this.#boundaries.get(node) !== boundary) {
      node.hook.input.remove(boundary.input);
      return boundary;
    }
    for (const event of ['child', 'childRemoved', 'commitRaw', 'settled']) {
      const receipt = node.on(event, ({ payload }) => {
        if (this.#disposed || this.#boundaries.get(node) !== boundary) {
          return;
        }
        if (event === 'commitRaw') {
          if (boundary.phase) {
            this.#dirty.add(boundary);
          }
        } else if (event === 'settled') {
          boundary.settled = payload === true;
          const phase = boundary.phase;
          if (phase) {
            phase.settled = payload === true;
            if (payload && !phase.dispatching) {
              boundary.phase = void 0;
            }
          }
        } else if (this.nodes.has(payload)) {
          this.#pending.add(payload);
        }
      }, event === 'commitRaw' ? 'unshift' : 'push');
      if (this.#disposed || this.#boundaries.get(node) !== boundary) {
        node.off(receipt);
        break;
      }
      boundary.receipts.push(receipt);
    }
    return boundary;
  }
  #link(node) {
    const parent = node.parent;
    if (this.#disposed || !this.nodes.has(node)) {
      return;
    }
    const previous = this.#parents.get(node);
    if (previous === parent) {
      return;
    }
    this.#parents.set(node, parent);
    if (previous) {
      this.#boundaries.get(previous)?.members.delete(node);
      this.#unused(previous);
    }
    if (parent && !this.#disposed && this.nodes.has(node) && this.#parents.get(node) === parent) {
      const boundary = this.#boundary(parent);
      if (!this.#disposed && this.nodes.has(node) && this.#parents.get(node) === parent && this.#boundaries.get(parent) === boundary) {
        boundary.members.add(node);
      }
    }
  }
  #unused(node) {
    const boundary = this.#boundaries.get(node);
    if (!boundary || this.nodes.has(node) || boundary.members.size) {
      return;
    }
    this.#boundaries.delete(node);
    this.#dirty.delete(boundary);
    node.hook.input.remove(boundary.input);
    boundary.receipts.forEach((receipt) => node.off(receipt));
  }
  refresh() {
    if (this.#disposed) {
      return;
    }
    const pending = this.#pending, dirty = this.#dirty;
    this.#pending = /* @__PURE__ */ new Set();
    this.#dirty = /* @__PURE__ */ new Set();
    const seen = /* @__PURE__ */ new Set();
    const visited = /* @__PURE__ */ new Set();
    const check = (node, relink = false) => {
      if (this.#disposed || seen.has(node) || !this.nodes.has(node)) {
        return;
      }
      seen.add(node);
      if (node.context === null) {
        this.delete(node);
      } else if (relink) {
        this.#link(node);
      }
    };
    const visit = (boundary) => {
      if (this.#disposed || visited.has(boundary)) {
        return;
      }
      visited.add(boundary);
      check(boundary.node, true);
      for (const child of boundary.members) {
        const nested = this.#boundaries.get(child);
        check(child, true);
        if (nested) {
          visit(nested);
        }
      }
    };
    let complete = false;
    try {
      dirty.forEach(visit);
      pending.forEach((node) => check(node, true));
      this.#fallback.forEach((node) => check(node));
      complete = true;
    } finally {
      if (!complete && !this.#disposed) {
        dirty.forEach((boundary) => this.#dirty.add(boundary));
        pending.forEach((node) => this.#pending.add(node));
      }
    }
  }
  dispose() {
    this.#disposed = true;
    for (const node of this.nodes) {
      owners2.get(node)?.delete(this);
    }
    const boundaries = this.#boundaries;
    this.#boundaries = /* @__PURE__ */ new Map();
    this.#parents.clear();
    this.#pending.clear();
    this.#dirty.clear();
    this.#fallback.clear();
    for (const { node, input, receipts } of boundaries.values()) {
      node.hook.input.remove(input);
      receipts.forEach((receipt) => node.off(receipt));
    }
  }
};

// current-303ddfbb/src/composition.ts
var compositions = /* @__PURE__ */ new WeakMap();
var inputSources = /* @__PURE__ */ new WeakMap();
function fieldPathKey(path) {
  return Array.isArray(path) ? path.join('.') : JSON.stringify(path);
}

// current-303ddfbb/src/composition-input.ts
import { cloneAny as cloneAny2, undefine as undefine2 } from '@formkit/utils';
import { valueRemoved as valueRemoved2 } from '@formkit/core';

// current-303ddfbb/src/core-reads.ts
import { error } from '@formkit/core';
var bridges = /* @__PURE__ */ new WeakMap();
function coreValueChanged(node, key) {
  const bridge = bridges.get(node);
  if (bridge?.alive) {
    notifyEffect(bridge[key]);
  }
}
function releaseCoreReads(node) {
  const bridge = bridges.get(node);
  if (!bridge?.alive) {
    return;
  }
  bridge.alive = false;
  notifyEffect(bridge.value);
  notifyEffect(bridge._value);
}
function install(node) {
  const bridge = { alive: true, value: {}, _value: {} };
  bridges.set(node, bridge);
  const extend = node.extend;
  const traps = /* @__PURE__ */ new WeakMap();
  function managed(key, trap) {
    if (!trap || !['object', 'function'].includes(typeof trap)) {
      return trap;
    }
    let known = traps.get(trap);
    if (!known) {
      known = /* @__PURE__ */ new Map();
      traps.set(trap, known);
    }
    if (known.has(key)) {
      return known.get(key);
    }
    const functions = /* @__PURE__ */ new WeakMap();
    function handler(part) {
      if (part === 'get' && bridge.alive) {
        bindingEffect()?.read(bridge[key]);
      }
      const callback = Reflect.get(trap, part, trap);
      if (typeof callback !== 'function') {
        return callback;
      }
      if (!functions.has(callback)) {
        functions.set(callback, (...args) => Reflect.apply(callback, trap, args));
      }
      return functions.get(callback);
    }
    const wrapped = Object.defineProperties({}, {
      get: { get: () => handler('get') },
      set: { get: () => handler('set') }
    });
    known.set(key, wrapped);
    return wrapped;
  }
  for (const key of ['value', '_value']) {
    extend(key, managed(key, { get: false, set: false }));
  }
  extend('extend', {
    // Core's method getter supplies a fresh callable. Preserve that shape and
    // delegate future custom extend methods unchanged: a saved public method
    // still reaches this constructor-owned boundary with the original args.
    get: () => new Proxy(extend, {
      apply(target, receiver, args) {
        if (args[0] === 'value' || args[0] === '_value') {
          args[1] = managed(args[0], args[1]);
        }
        return Reflect.apply(target, receiver, args);
      }
    }),
    set: (actual, _context, property) => error(102, [actual, property])
  });
}
function coreReadBridge() {
  let claimed = false;
  const plugin = () => {
    claimed = true;
  };
  plugin.library = (node) => {
    if (!claimed) {
      claimed = true;
      install(node);
    }
  };
  return plugin;
}

// current-303ddfbb/src/runtime.ts
import { createNode, deregister as deregister2, isComponent, isConditional, isDOM, isNode as isNode2, register, sugar as sugar2 } from '@formkit/core';
import { createLibraryPlugin, extendSchema, inputs, runtimeProps } from '@formkit/inputs';
import { createThemePlugin } from '@formkit/themes';
import { eq as eq2, isPojo as isPojo2 } from '@formkit/utils';

// current-303ddfbb/src/bindings.ts
import { createClasses, createMessage, generateClassList, isNode } from '@formkit/core';
import { cloneAny, empty, eq, token, undefine } from '@formkit/utils';

// current-303ddfbb/src/invalidation.ts
import { kebab } from '@formkit/utils';
var owners3 = /* @__PURE__ */ new WeakMap();
var objects = /* @__PURE__ */ new WeakMap();
var proxyTargets = /* @__PURE__ */ new WeakMap();
var captures = /* @__PURE__ */ new WeakMap();
var defaultSubmitAttrs = /* @__PURE__ */ new WeakMap();
var inputFactories = /* @__PURE__ */ new WeakSet();
function markInputFactory(factory) {
  inputFactories.add(factory);
  return factory;
}
function isInputFactory(factory) {
  return inputFactories.has(factory);
}
var active2;
var guardDescriptors;
function descriptors(object) {
  const known = guardDescriptors?.get(object);
  if (known) {
    return known;
  }
  const result = Object.getOwnPropertyDescriptors(object);
  guardDescriptors?.set(object, result);
  return result;
}
var defaultRootClasses = (section) => ({ [`formkit-${kebab(section)}`]: true });
var nativeInvalidation = () => {
};
nativeInvalidation.library = (node) => {
  if (owners3.has(node)) {
    return;
  }
  const original = node.hook;
  const fresh = !node.isCreated;
  node.props = new Proxy(node.props, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      readEffect(node);
      readPropsEffect(node);
      if (!fresh || !Object.hasOwn(target, key)) {
        opaqueEffect();
      }
      return value;
    },
    defineProperty(target, key, descriptor) {
      const success = Reflect.defineProperty(target, key, descriptor);
      if (descriptor.get || descriptor.set) {
        propsMetadata(node);
      }
      contextChanged(node);
      return success;
    },
    deleteProperty(target, key) {
      const success = Reflect.deleteProperty(target, key);
      propsMetadata(node);
      contextChanged(node);
      return success;
    }
  });
  const owner = {
    node,
    props: node.props,
    config: node.config,
    configParent: node.parent,
    epoch: 0,
    hook: original,
    opaque: false,
    getters: /* @__PURE__ */ new Set()
  };
  if (!node.isCreated) {
    owner.core = node._c;
    owner.traps = owner.core.traps;
    owner.nativeTraps = new Map([...owner.traps].map(([key, trap]) => [key, trap.get]));
  }
  let attrsAssignments = 0, attrsOriginal, attrsPassed = true;
  original.prop((payload, next) => {
    if (payload.prop === '__propDefs') {
      propsMetadata(node);
    }
    if (payload.prop !== 'attrs') {
      return next(payload);
    }
    attrsAssignments++;
    const value = payload.value, result = next(payload);
    attrsPassed = attrsPassed && result.prop === 'attrs' && result.value === value;
    attrsOriginal = value;
    return result;
  });
  function watch(dispatcher, native = false) {
    const changed = () => {
      owner.opaque = true;
      effectMetadata(node);
    };
    const unshift = (...args) => {
      changed();
      return dispatcher.unshift(...args);
    };
    return new Proxy(dispatcher, {
      apply(target, receiver, args) {
        if (!native) {
          changed();
        }
        return Reflect.apply(target, receiver, args);
      },
      get(target, key, receiver) {
        return key === 'unshift' ? unshift : Reflect.get(target, key, receiver);
      },
      defineProperty(target, key, descriptor) {
        owner.opaque = true;
        effectMetadata(node);
        return Reflect.defineProperty(target, key, descriptor);
      }
    });
  }
  const initialClasses = original.classes, initialProps = original.prop;
  const classes = watch(initialClasses), props = watch(initialProps, true);
  owner.hook = new Proxy(original, {
    get(target, key, receiver) {
      return key === 'classes' ? classes : key === 'prop' ? props : Reflect.get(target, key, receiver);
    }
  });
  node.hook = owner.hook;
  owners3.set(node, owner);
  effectNode(node, owner.configParent);
  const createdAttrs = node.on('added-props', () => {
    const attrs = Object.getOwnPropertyDescriptor(node.props, 'attrs');
    if (!owner.opaque && attrsAssignments === 1 && attrsPassed && attrs && 'value' in attrs && attrs.value === attrsOriginal) {
      contextObject(node, attrs.value, 'attrs');
    }
    attrsAssignments = 0;
    attrsOriginal = void 0;
    attrsPassed = true;
  });
  node.on('destroying', () => {
    node.off(createdAttrs);
  });
};
function contextChanged(node) {
  const owner = owners3.get(node);
  if (owner) {
    owner.epoch++;
  }
  changedEffect(node);
}
function contextObject(node, value, role) {
  const owner = owners3.get(node);
  if (owner && value && typeof value === 'object') {
    const entry = { owner, role };
    objects.set(value, entry);
    effectObject(value, node);
    const target = proxyTargets.get(value);
    if (target) {
      objects.set(target, entry);
      effectObject(target, node);
    }
  }
  return value;
}
function contextProxy(target, proxy) {
  proxyTargets.set(proxy, target);
  projectionAlias(target, proxy);
  const entry = objects.get(target);
  if (entry) {
    objects.set(proxy, entry);
    effectObject(proxy, entry.owner.node);
  }
}
function certifyContext(node, context) {
  const owner = owners3.get(node);
  if (!owner) {
    return;
  }
  resetEffectMetadata(node);
  owner.context = context;
  owner.nativeGetters = Object.getOwnPropertyDescriptors(context);
  contextObject(node, context, 'context');
  for (const [key, role] of [['state', 'state'], ['handlers', 'handlers'], ['fns', 'functions']]) {
    contextObject(node, context[key], role);
  }
  for (const object of [context, context.state]) {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(object))) {
      if (descriptor.get) {
        owner.getters.add(descriptor.get);
      }
    }
  }
  owner.length = context.fns.length;
}
function nativeClassHook(node) {
  const owner = owners3.get(node);
  if (!owner || owner.opaque || !owner.core || owner.core.traps !== owner.traps || owner.traps?.get('hook')?.get !== owner.nativeTraps?.get('hook')) {
    return false;
  }
  return node.hook === owner.hook;
}
function opaqueRender() {
  opaqueEffect();
  if (active2) {
    active2.opaque = true;
  }
}
function iterationScope(scope, collection) {
  if (collection && typeof collection === 'object') {
    const entry = objects.get(collection);
    if (entry?.role === 'messages') {
      objects.set(scope, { owner: entry.owner, role: 'iteration' });
      effectObject(scope, entry.owner.node);
    }
  }
}
function scalar(value) {
  return value === null || !['object', 'function'].includes(typeof value);
}
function snapshot(object, allowFunctions = true) {
  const before = Object.getOwnPropertyDescriptors(object), keys2 = Object.keys(before);
  if (keys2.some((key) => !('value' in before[key]) || !scalar(before[key].value) && (!allowFunctions || typeof before[key].value !== 'function'))) {
    return;
  }
  return () => {
    const after = descriptors(object);
    return keys2.length === Object.keys(after).length && keys2.every((key) => after[key] && 'value' in after[key] && Object.is(before[key].value, after[key].value));
  };
}
function contextRead(receiver, key, value) {
  const source = receiver && typeof receiver === 'object' ? owners3.get(receiver) : void 0;
  const native = source?.core && source.core.traps === source.traps && source.traps?.get(key)?.get === source.nativeTraps?.get(key);
  if (source && !native) {
    opaqueEffect();
  }
  readEffect(receiver, key, !!native && typeof value === 'number');
  const readOwner = receiver && typeof receiver === 'object' ? objects.get(receiver) : void 0;
  if (readOwner?.role === 'context' && key === 'attrs' && value && typeof value === 'object' && !isEffectTarget(proxyTargets.get(value) ?? value)) {
    opaqueEffect();
  }
  if (readOwner?.role === 'message') {
    opaqueEffect();
  }
  if (readOwner?.role === 'functions' && key === 'length' && value !== readOwner.owner.length) {
    opaqueEffect();
  }
  if (!active2 || active2.opaque) {
    return;
  }
  const { owner } = active2;
  if (receiver === owner.node && key === 'name') {
    active2.checks.push(() => Object.is(owner.node.name, value));
    return;
  }
  const entry = objects.get(receiver);
  if (!entry || entry.owner !== owner) {
    active2.opaque = true;
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(receiver, key);
  if (!descriptor && entry.role !== 'classes' && (![Object.prototype, null].includes(Object.getPrototypeOf(receiver)) || Object.hasOwn(Object.prototype, key))) {
    active2.opaque = true;
    return;
  }
  if (descriptor?.get && !owner.getters.has(descriptor.get)) {
    active2.opaque = true;
    return;
  }
  if (entry.role === 'functions' && key === 'length' && value !== owner.length) {
    active2.opaque = true;
  }
  if (value && typeof value === 'object') {
    const child = objects.get(value);
    if (value !== owner.node && (!child || child.owner !== owner)) {
      active2.opaque = true;
      return;
    }
    if (child?.role === 'attrs' || child?.role === 'slots') {
      const check = snapshot(value);
      if (check) {
        active2.checks.push(check);
      } else {
        active2.opaque = true;
      }
    }
  }
}
function expressionCalls(expression) {
  if ([...expression.matchAll(/\$([A-Za-z0-9_.]+)\s*\(/g)].some(([, path]) => path !== 'fns.length')) {
    opaqueEffect();
  }
  if (!active2 || active2.opaque) {
    return;
  }
  const calls = expression.matchAll(/\$([A-Za-z0-9_.]+)\s*\(/g);
  for (const [, path] of calls) {
    if (path !== 'fns.length') {
      active2.opaque = true;
    }
  }
}
function captureRender(renderer, data, render) {
  const entry = objects.get(data), previous = active2;
  const capture = entry?.role === 'context' ? {
    owner: entry.owner,
    epoch: entry.owner.epoch,
    opaque: false,
    checks: []
  } : void 0;
  captures.delete(renderer);
  active2 = capture;
  try {
    render();
    if (capture && capture.epoch === capture.owner.epoch) {
      captures.set(renderer, capture);
    }
  } finally {
    active2 = previous;
  }
}
function certifyDefaultSubmitAttrs(node, expected) {
  defaultSubmitAttrs.set(node, expected);
}
function releaseCapture(renderer) {
  captures.delete(renderer);
}
var automaticRequests = /* @__PURE__ */ new WeakMap();
var automaticScopes = /* @__PURE__ */ new WeakSet();
function automaticUpdate(renderer, data, mode = 'context') {
  automaticRequests.set(renderer, mode);
  try {
    renderer.update(data);
  } finally {
    automaticRequests.delete(renderer);
  }
}
function takeAutomatic(renderer) {
  const automatic = automaticRequests.get(renderer);
  automaticRequests.delete(renderer);
  return automatic;
}
function automaticScope(scope, automatic) {
  if (automatic) {
    automaticScopes.add(scope);
  } else {
    automaticScopes.delete(scope);
  }
}
function isAutomaticScope(scope) {
  return automaticScopes.has(scope);
}
var renderHints = /* @__PURE__ */ new WeakMap();
function withRenderHint(node, needed, emit) {
  const previous = renderHints.get(node);
  renderHints.set(node, needed);
  try {
    emit();
  } finally {
    if (previous === void 0) {
      renderHints.delete(node);
    } else {
      renderHints.set(node, previous);
    }
  }
}
var initialComponents = /* @__PURE__ */ new WeakSet();
function markInitialComponent(component) {
  initialComponents.add(component);
}
function takeInitialComponent(component) {
  const initial = initialComponents.has(component);
  initialComponents.delete(component);
  return initial;
}

// current-303ddfbb/src/bindings.ts
function reactive(value, changed, metadataChanged) {
  const proxies = /* @__PURE__ */ new WeakMap();
  function wrap(item) {
    if (!item || typeof item !== 'object' || isNode(item) || Object.isFrozen(item) || !Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) {
      return item;
    }
    if (proxies.has(item)) {
      return proxies.get(item);
    }
    const proxy = new Proxy(item, {
      get(target, key, receiver) {
        readEffect(proxy);
        return wrap(Reflect.get(target, key, receiver));
      },
      set(target, key, next, receiver) {
        const previous = Reflect.get(target, key);
        const success = Reflect.set(target, key, next, receiver);
        if (receiver === proxy && success && !Object.is(previous, next)) {
          invalidateProjection(item);
          changed();
        }
        return success;
      },
      deleteProperty(target, key) {
        const present = Object.hasOwn(target, key);
        const success = Reflect.deleteProperty(target, key);
        if (present && success) {
          invalidateProjection(item);
          changed();
        }
        return success;
      },
      setPrototypeOf(target, prototype) {
        const success = Reflect.setPrototypeOf(target, prototype);
        invalidateProjection(item);
        metadataChanged();
        return success;
      },
      defineProperty(target, key, descriptor) {
        const success = Reflect.defineProperty(target, key, descriptor);
        if (success) {
          invalidateProjection(item);
          if (descriptor.get || descriptor.set) {
            metadataChanged();
          }
          changed();
        }
        return success;
      }
    });
    proxies.set(item, proxy);
    proxies.set(proxy, proxy);
    contextProxy(item, proxy);
    return proxy;
  }
  return wrap(value);
}
function sameClassSource(left, right) {
  const a = left, b = right;
  if (!a) {
    return false;
  }
  if (!a.intrinsic || !b.intrinsic) {
    return !a.intrinsic && !b.intrinsic && a.resolved === b.resolved;
  }
  return a.basis === b.basis && a.contributions.every((entry, index) => entry.scalar === b.contributions[index].scalar);
}
var nativeBindings = (node) => {
  let alive = true;
  let hasTicked = false;
  let shownValidation = false;
  let pendingNativeDateDelete = false;
  let pendingDOMInputValue;
  const domInputValue = (payload) => typeof pendingDOMInputValue === 'string' && node.props.number !== void 0 && node.props.number !== 'integer' && typeof payload === 'number' && Number.isFinite(payload) && pendingDOMInputValue.includes('.') && Number(pendingDOMInputValue) === payload && pendingDOMInputValue !== String(payload) ? pendingDOMInputValue : payload;
  const receipts = [];
  const messages = {};
  let inputErrorsReady = false;
  const ui = {};
  node.ledger.count('blocking', (message) => message.blocking);
  node.ledger.count('errors', (message) => message.type === 'error');
  const changed = (needed = true) => {
    contextChanged(node);
    if (alive && node.context !== null) {
      withRenderHint(node, needed, () => node.emit('context-update', node));
    }
  };
  const listen = (event, callback, pos) => {
    const receipt = node.on(event, callback, pos);
    receipts.push(receipt);
    return receipt;
  };
  const initialContext = {
    ...node.props,
    attrs: node.props.attrs ?? {},
    node,
    _value: node.value,
    value: node.value,
    didMount: false,
    defaultMessagePlacement: true,
    slots: node.props.__slots ?? {},
    ui,
    state: { blurred: false, dirty: false, submitted: false, failing: false, settled: node.isSettled },
    fns: {
      length: (object) => Object.keys(object).length,
      number: Number,
      string: String,
      json: JSON.stringify,
      eq
    },
    handlers: {
      blur(event) {
        if (pendingNativeDateDelete) {
          pendingNativeDateDelete = false;
          void node.input((event?.target).value);
        }
        if (node.props.number !== void 0 && ['number', 'range', 'hidden'].includes(node.props.type) && typeof node._value === 'string' && node._value !== '') {
          const number = Number(node._value);
          void node.input(Number.isFinite(number) ? number : void 0);
        }
        node.store.set(createMessage({ key: 'blurred', visible: false, value: true }));
        node.props.attrs?.onBlur?.(event);
      },
      touch() {
        if (context.state.dirty && node.props.dirtyBehavior !== 'compare') {
          return;
        }
        const dirty = !eq(node.props._init, node._value);
        if (dirty || node.props.dirtyBehavior === 'compare') {
          node.store.set(createMessage({ key: 'dirty', visible: false, value: dirty }));
        }
      },
      DOMInput(event) {
        const target = event.target;
        pendingNativeDateDelete = 'inputType' in event && String(event.inputType).startsWith('delete') && ['date', 'datetime-local', 'month', 'time', 'week'].includes(target.type) && target.value === '' && target.ownerDocument.activeElement === target && !empty(node._value);
        if (!pendingNativeDateDelete) {
          pendingDOMInputValue = target.value;
          void node.input(pendingDOMInputValue);
        }
        node.emit('dom-input-event', event);
      }
    }
  };
  if (!Object.hasOwn(initialContext, 'disabled')) {
    initialContext.disabled = node.props.disabled;
  }
  const context = reactive(initialContext, changed, () => {
    effectMetadata(node);
    contextChanged(node);
  });
  const validationVisible = () => {
    if (context.state.submitted) {
      return true;
    }
    if (!shownValidation && !context.state.settled) {
      return false;
    }
    const visibility = node.props.validationVisibility ?? (node.props.type === 'checkbox' ? 'dirty' : 'blur');
    switch (visibility) {
      case 'live':
        return true;
      case 'blur':
        return context.state.blurred;
      case 'dirty':
        return context.state.dirty;
      case 'submit':
        return false;
      default:
        return String(visibility).split(/[\s,|]+/).some((mode) => mode === 'live' || mode === 'blur' && context.state.blurred || mode === 'dirty' && context.state.dirty);
    }
  };
  Object.defineProperties(context.state, {
    valid: { enumerable: true, get: () => !node.ledger.value('blocking') },
    errors: { enumerable: true, get: () => !!node.ledger.value('errors') },
    required: { enumerable: true, get: () => !!node.props.parsedRules?.some((rule) => rule.name === 'required') },
    rules: { enumerable: true, get: () => !!node.props.parsedRules?.length },
    empty: { enumerable: true, get: () => empty(context.value) },
    passing: { enumerable: true, get: () => !context.state.failing },
    validationVisible: { enumerable: true, get: validationVisible },
    invalid: { enumerable: true, get: () => context.state.failing && validationVisible() },
    complete: { enumerable: true, get: () => context.state.rules ? context.state.valid && !context.state.errors : context.state.dirty && !context.state.empty }
  });
  const messageProducer = {};
  let messageVersion = 0;
  let visibleEntries = [];
  function visibleMessages() {
    opaqueRender();
    const entries = Object.entries(messages).filter(([, message]) => message.type !== 'validation' || validationVisible());
    if (entries.length !== visibleEntries.length || entries.some(([key, message], index) => key !== visibleEntries[index][0] || message !== visibleEntries[index][1])) {
      messageVersion++;
    }
    visibleEntries = entries;
    return contextObject(node, effectProjection(Object.fromEntries(entries), messageProducer, messageVersion, node), 'messages');
  }
  function classContribution(section, value) {
    if (typeof value === 'function') {
      return classContribution(section, Reflect.apply(value, void 0, [node, section]));
    }
    const constant = !value || typeof value === 'string';
    return {
      classes: constant ? void 0 : createClasses(section, node, value),
      scalar: typeof value === 'string' ? value : '',
      constant
    };
  }
  function classSources(section) {
    opaqueRender();
    readEffect(node);
    const root = node.config.rootClasses;
    let basis = 'empty';
    const rootClasses = typeof root === 'function' ? (() => {
      const configuration = node.config;
      const callback = configuration.rootClasses;
      basis = callback === defaultRootClasses ? 'default' : void 0;
      return basis === 'default' ? void 0 : Reflect.apply(callback, configuration, [section, node]);
    })() : void 0;
    const classes = node.config.classes;
    const contributions = [
      classContribution(section, classes?.[section]),
      classContribution(section, node.props[`_${section}Class`]),
      classContribution(section, node.props[`${section}Class`])
    ];
    const value = {
      root: rootClasses,
      basis,
      contributions,
      intrinsic: basis !== void 0 && contributions.every((entry) => entry.constant) && nativeClassHook(node)
    };
    if (!value.intrinsic) {
      value.resolved = generateSection(section, value);
    }
    return value;
  }
  function generateSection(section, value) {
    const root = value.basis === 'default' ? defaultRootClasses(section) : value.root ?? {};
    return generateClassList(node, section, root, ...value.contributions.map((entry) => entry.constant ? createClasses(section, node, entry.scalar) : entry.classes)) ?? '';
  }
  function sectionClasses(section) {
    const effect = bindingEffect();
    const source = effect ? effect.value(`class-source:${effect.nextEvaluation()}:${section}`, section, effect.context ?? node, () => classSources(section), sameClassSource, true) : classSources(section);
    const value = source;
    return value.intrinsic ? generateSection(section, value) : value.resolved;
  }
  Object.defineProperties(context, {
    items: { enumerable: true, configurable: true, get: () => node.children.map((child) => child.uid) },
    messages: { enumerable: true, configurable: true, get: visibleMessages },
    describedBy: { enumerable: true, configurable: true, get: () => [
      context.help ? `help-${context.id}` : '',
      ...Object.keys(context.messages).map((key) => `${context.id}-${key}`)
    ].filter(Boolean).join(' ') || void 0 },
    classes: { enumerable: true, configurable: true, get: () => contextObject(node, new Proxy({}, {
      get(target, section) {
        if (typeof section !== 'string' || section in Object.prototype) {
          return Reflect.get(target, section);
        }
        return sectionClasses(section);
      }
    }), 'classes') }
  });
  certifyContext(node, context);
  function applyErrors(errors) {
    node.store.apply((Array.isArray(errors) ? errors : []).map((value) => createMessage({
      key: `prop-error-${token()}`,
      type: 'error',
      value: String(value),
      meta: { source: 'prop' }
    })), (message) => message.type === 'error' && message.meta.source === 'prop');
  }
  const inputErrorSource = `input-prop-${token()}`;
  let inputErrorAddresses = [];
  function applyInputErrors(errors) {
    node.walk((child) => child.store.filter((message) => message.meta.source !== inputErrorSource));
    const supplied = errors ?? {};
    const messagesByAddress = Object.fromEntries([...inputErrorAddresses.map((address) => [address, []]), ...Object.entries(supplied).map(([address, entries]) => [
      address,
      (typeof entries === 'string' ? [entries] : entries).map((value) => createMessage({ key: `prop-error-${token()}`, type: 'error', value: String(value), meta: { source: inputErrorSource } }))
    ])]);
    inputErrorAddresses = Object.keys(supplied);
    node.store.apply(messagesByAddress, (message) => message.meta.source === inputErrorSource);
  }
  function messageChanged(message) {
    if (Object.isFrozen(message)) {
      contextObject(node, message, 'message');
    }
    delete ui[message.key];
    delete messages[message.key];
    if (message.type === 'ui' && message.visible && !message.meta.showAsMessage) {
      ui[message.key] = message;
    } else if (message.visible) {
      messages[message.key] = message;
    } else if (message.type === 'state') {
      context.state[message.key] = !!message.value;
    }
    if (validationVisible()) {
      shownValidation = true;
    }
    changed();
  }
  listen('prop', ({ payload: { prop, value } }) => {
    const descriptor = Object.getOwnPropertyDescriptor(context, prop);
    if (!descriptor?.get) {
      context[prop] = value;
    }
    if (prop === '__propDefs') {
      propsMetadata(node);
    }
    if (prop === 'errors') {
      applyErrors(value);
    }
    if (prop === 'inputErrors' && inputErrorsReady) {
      applyInputErrors(value);
    }
    changed();
  });
  for (const event of ['config:classes', 'config:rootClasses', 'child', 'childRemoved']) {
    listen(event, () => changed());
  }
  for (const name of ['blocking', 'errors']) {
    let nonzero = !!node.ledger.value(name);
    listen(`count:${name}`, ({ payload }) => {
      const next = !!payload, needed = next !== nonzero;
      nonzero = next;
      changed(needed);
    });
  }
  listen('input', ({ payload }) => {
    context._value = domInputValue(payload);
    coreValueChanged(node, '_value');
  });
  listen('commitRaw', ({ payload }) => {
    context.value = payload;
    context._value = domInputValue(payload);
    pendingDOMInputValue = void 0;
    node.emit('modelUpdated');
    changed();
    coreValueChanged(node, '_value');
  });
  listen('commit', () => {
    if (hasTicked && !node.store.validating?.value) {
      context.handlers.touch();
    }
    if (node.type === 'input' && context.state.errors && !undefine(node.props.preserveErrors)) {
      node.store.filter((message) => !(message.type === 'error' && message.meta.autoClear === true));
    }
    changed();
    coreValueChanged(node, 'value');
  });
  listen('settled', ({ payload }) => {
    context.state.settled = payload;
    changed();
  });
  listen('mounted', () => {
    context.didMount = true;
  });
  listen('created', () => {
    applyErrors(node.props.errors);
    inputErrorsReady = true;
    applyInputErrors(node.props.inputErrors);
    context.value = context._value = node.value;
    void node.settled.then(() => {
      if (alive) {
        node.props._init = cloneAny(node.value);
      }
    });
  });
  listen('message-added', ({ payload }) => messageChanged(payload));
  listen('message-updated', ({ payload }) => messageChanged(payload));
  listen('message-removed', ({ payload }) => {
    delete ui[payload.key];
    delete messages[payload.key];
    if (payload.type === 'state') {
      delete context.state[payload.key];
    }
    if (payload.key === 'validating' && hasTicked) {
      context.handlers.touch();
    }
    changed();
  });
  const dispose = () => {
    alive = false;
    releaseCoreReads(node);
    receipts.forEach((receipt) => node.off(receipt));
    node.context = void 0;
  };
  listen('destroying', dispose);
  listen('destroyed', dispose);
  queueMicrotask(() => {
    hasTicked = alive;
  });
  node.context = context;
  node.emit('context', node, false);
};

// current-303ddfbb/src/schema.ts
import { compile, deregister, getNode, stopWatch, sugar, watchRegistry } from '@formkit/core';
import { isPojo } from '@formkit/utils';
var scopeParents = /* @__PURE__ */ new WeakMap();
function scoped(parent, values) {
  const scope = Object.defineProperties(Object.create(parent), Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, enumerable: true, configurable: true, writable: true }])));
  scopeParents.set(scope, parent);
  automaticScope(scope, isAutomaticScope(parent));
  return scope;
}
var bound = /* @__PURE__ */ new WeakMap();
function tokenValue(scope, token2) {
  const parts = token2.split('.');
  const parent = scopeParents.get(scope);
  if (parent && !Object.hasOwn(scope, parts[0])) {
    return tokenValue(parent, token2);
  }
  let value = scope;
  let receiver;
  for (const part of parts) {
    receiver = value;
    if (value == null) {
      return parent ? tokenValue(parent, token2) : void 0;
    }
    value = value[part];
    contextRead(receiver, part, value);
  }
  if (value === void 0 && parent) {
    return tokenValue(parent, token2);
  }
  if (typeof value !== 'function') {
    return value;
  }
  if (typeof receiver !== 'object') {
    return value.bind(receiver);
  }
  if (!bound.has(receiver)) {
    bound.set(receiver, /* @__PURE__ */ new WeakMap());
  }
  const functions = bound.get(receiver);
  if (!functions.has(value)) {
    functions.set(value, value.bind(receiver));
  }
  return functions.get(value);
}
function compileExpression(expression) {
  const program = compile(expression);
  const entry = { program, requirements: [] };
  program.provide((requirements) => {
    entry.requirements = [...requirements];
    return {};
  });
  return entry;
}
function evaluate(value, scope, programs, resolve, path = '') {
  if (typeof value === 'string' && value.startsWith('$') && !/^\$(?:reset(?:\s|$)|remove:)/.test(value)) {
    if (resolve) {
      return resolve(path, value, scope, () => evaluate(value, scope, programs));
    }
    expressionCalls(value);
    if (/^\$[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(value)) {
      return tokenValue(scope, value.slice(1));
    }
    if (!value.includes('(')) {
      let entry = programs.get(value);
      if (!entry) {
        entry = compileExpression(value);
        if (programs.size >= 128) {
          programs.delete(programs.keys().next().value);
        }
        programs.set(value, entry);
      }
      return entry.program(Object.fromEntries(entry.requirements.map((token2) => [token2, () => tokenValue(scope, token2)])));
    }
    return compile(value).provide((requirements) => Object.fromEntries(
      requirements.map((token2) => [token2, () => tokenValue(scope, token2)])
    ))();
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => evaluate(item, scope, programs, resolve, `${path}[${index}]`));
  }
  if (isPojo(value)) {
    const object = value;
    if ('if' in object && 'then' in object) {
      return evaluate(evaluate(object.if, scope, programs, resolve, `${path}.if`) ? object.then : object.else, scope, programs, resolve, `${path}.branch`);
    }
    return Object.fromEntries(Object.entries(object).map(([key, item]) => key.startsWith('__raw__') ? [key.slice(7), item] : [key, evaluate(item, scope, programs, resolve, `${path}[${JSON.stringify(key)}]`)]));
  }
  return value;
}
function expand(schema, scope, prefix, identity, evaluateExpression, current, generated = false) {
  const result = [];
  if (!current()) {
    return result;
  }
  const entries = Array.isArray(schema) ? schema : [schema];
  const length = entries.length;
  for (let index = 0; index < length; index++) {
    if (!current()) {
      break;
    }
    const present = index in entries;
    if (!current()) {
      break;
    }
    if (!present) {
      continue;
    }
    const entry = entries[index];
    if (!current()) {
      break;
    }
    const key = `${prefix}${index}`;
    if (typeof entry === 'string') {
      if (entry.startsWith('$slots.')) {
        const slot = evaluateExpression(entry, scope);
        if (!current()) {
          break;
        }
        if (typeof slot === 'function') {
          opaqueRender();
          const content = slot(scope);
          if (!current()) {
            break;
          }
          if (content && typeof content === 'object' && 'schema' in content) {
            result.push(...expand(content.schema, content.data, `${key}.slot.`, identity, evaluateExpression, current, isGeneratedSchema(content.schema)));
          } else {
            result.push(...expand(content, scope, `${key}.slot.`, identity, evaluateExpression, current, isGeneratedSchema(content)));
          }
        } else if (slot !== void 0 || !/^\$slots\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(entry)) {
          result.push({ generated, key, schema: { $el: 'text' }, scope, text: slot });
        }
      } else {
        result.push({ generated, key, schema: entry, scope });
      }
      continue;
    }
    if ('nodeType' in entry) {
      result.push({ generated, key, schema: entry, scope });
      continue;
    }
    if ('then' in entry && !('for' in entry && entry.for)) {
      const visible = evaluateExpression(entry.if, scope);
      if (!current()) {
        break;
      }
      result.push(...expand(visible ? entry.then : entry.else ?? [], scope, `${key}.`, identity, evaluateExpression, current, generated));
      continue;
    }
    if (!current()) {
      break;
    }
    if ('for' in entry && entry.for) {
      if (!current()) {
        break;
      }
      const [valueName, keyOrValues, values] = entry.for;
      if (!current()) {
        break;
      }
      const collection = evaluateExpression(values ?? keyOrValues, scope);
      if (!current()) {
        break;
      }
      const pairs = typeof collection === 'number' ? Array.from({ length: collection }, (_, itemIndex) => [itemIndex, itemIndex]) : Array.isArray(collection) ? collection.map((item, itemIndex) => [itemIndex, item]) : Object.entries(collection ?? {});
      pairs.forEach(([itemKey, item]) => {
        if (!current()) {
          return;
        }
        const itemScope = scoped(scope, {
          [valueName]: item,
          ...values === void 0 ? {} : { [keyOrValues]: itemKey }
        });
        iterationScope(itemScope, collection);
        const descriptors2 = Object.getOwnPropertyDescriptors(entry);
        delete descriptors2.for;
        const copy = Object.defineProperties({}, descriptors2);
        const iteration = `${key}:${identity(evaluateExpression(('key' in copy ? copy.key : void 0) ?? itemKey, itemScope))}.`;
        if (current()) {
          result.push(...expand(copy, itemScope, iteration, identity, evaluateExpression, current, generated));
        }
      });
      continue;
    }
    const condition = entry.if;
    if (!current()) {
      break;
    }
    if (!condition || evaluateExpression(entry.if, scope)) {
      if (!current()) {
        break;
      }
      if ('$el' in entry && entry.$el === null) {
        result.push(...expand(entry.children ?? [], scope, `${key}.`, identity, evaluateExpression, current, generated));
        continue;
      }
      const explicitKey = evaluateExpression('key' in entry ? entry.key : void 0, scope);
      if (!current()) {
        break;
      }
      result.push({ generated, key: explicitKey === void 0 ? key : `${prefix}key:${identity(explicitKey)}`, schema: entry, scope });
    }
  }
  return result;
}
function nodes(record) {
  const result = [record.node];
  if (record.end) {
    let next = record.node.nextSibling;
    while (next) {
      result.push(next);
      if (next === record.end) {
        break;
      }
      next = next.nextSibling;
    }
  }
  return result;
}
function isPassiveSchemaEvent(attribute) {
  return attribute.length > 9 && attribute.endsWith('Passive');
}
function schemaEventName(attribute) {
  return attribute.slice(2, isPassiveSchemaEvent(attribute) ? -7 : void 0).toLowerCase();
}
function prepareListeners(record, entries) {
  const listeners = record.listeners;
  let names;
  for (const [attribute, value] of entries) {
    if (/^on[A-Z]/.test(attribute) && value != null) {
      (names ??= []).push(attribute);
    }
  }
  if (!names && !listeners.size) {
    return;
  }
  let reusable = listeners.size === (names?.length ?? 0);
  if (reusable && names) {
    const previous = listeners.keys();
    reusable = names.every((name) => previous.next().value === name && listeners.get(name).handler !== void 0);
  }
  listeners.forEach((binding, attribute) => {
    if (!reusable) {
      record.node.removeEventListener(schemaEventName(attribute), binding.listener);
    }
    binding.handler = void 0;
  });
  if (!reusable) {
    listeners.clear();
  }
}
var collectionEffects = /* @__PURE__ */ new WeakMap();
var collectionSources = /* @__PURE__ */ new WeakMap();
function cleanup(record, remove = true) {
  record.effect?.stop();
  if (record.children) {
    collectionEffects.get(record.children)?.stop();
  }
  record.children?.forEach((child) => cleanup(child, remove && record.keep === true));
  record.listeners?.forEach((binding) => {
    binding.handler = void 0;
  });
  record.releaseEvents?.();
  record.listeners?.forEach((binding, attribute) => {
    record.node.removeEventListener(schemaEventName(attribute), binding.listener);
    binding.handler = void 0;
  });
  record.listeners?.clear();
  record.component?.destroy();
  if (remove && !record.keep) {
    nodes(record).forEach((node) => node.parentNode?.removeChild(node));
  }
}
function elementHost(container) {
  let children;
  return {
    document: container.ownerDocument,
    nodes: () => children ??= container.childNodes,
    insert: (node, before) => container.insertBefore(node, before),
    contains: (node) => container.contains(node)
  };
}
function className(value) {
  if (Array.isArray(value)) {
    return value.map(className).filter(Boolean).join(' ');
  }
  if (isPojo(value)) {
    return Object.keys(value).filter((key) => value[key]).join(' ');
  }
  return value == null ? '' : String(value);
}
function ownElementListeners(target) {
  const window = target.ownerDocument.defaultView;
  const controller = new window.AbortController();
  const previous = Object.getOwnPropertyDescriptor(target, 'addEventListener');
  const add = target.addEventListener.bind(target);
  target.addEventListener = (event, listener, settings) => {
    const configured = typeof settings === 'boolean' ? { __proto__: null, capture: settings } : settings;
    const capture = configured?.capture;
    const once = configured?.once;
    const passive = configured?.passive;
    const source = configured?.signal;
    const signal = source ? window.AbortSignal.any([source, controller.signal]) : controller.signal;
    add(event, listener, { capture, once, passive, signal });
  };
  return () => {
    controller.abort();
    if (previous) {
      Object.defineProperty(target, 'addEventListener', previous);
    } else {
      Reflect.deleteProperty(target, 'addEventListener');
    }
  };
}
function createRenderer(host, options, existingRoot) {
  const document = host.document;
  const components = options.components ?? {};
  const programs = /* @__PURE__ */ new Map();
  const evaluateValue = (value, scope) => {
    if (!current()) {
      return void 0;
    }
    const effect = bindingEffect();
    if (!effect) {
      return evaluate(value, scope, programs);
    }
    const prefix = effect.nextEvaluation();
    return evaluate(value, scope, programs, (path, expression, data2, compute) => current() ? effect.value(`${prefix}${path}`, expression, data2, compute) : void 0);
  };
  const borrowed = /* @__PURE__ */ new Map();
  const retiredLookups = /* @__PURE__ */ new Set();
  const symbols = /* @__PURE__ */ new Map();
  function identity(value) {
    if (typeof value !== 'symbol') {
      return String(value);
    }
    if (!symbols.has(value)) {
      symbols.set(value, `symbol-${symbols.size}`);
    }
    return symbols.get(value);
  }
  const records = /* @__PURE__ */ new Map();
  let disposed = false, queued = false;
  let schemaVersion = 0;
  let activePass;
  let data = options.data ?? {};
  const graph = new EffectGraph(data, scheduleSignals);
  let forceEffects = true;
  let discoverRequested = false;
  function queue(discover) {
    discoverRequested ||= discover;
    if (queued || disposed) {
      return;
    }
    queued = true;
    queueMicrotask(() => {
      const requested = discoverRequested;
      queued = false;
      discoverRequested = false;
      if (!disposed) {
        automaticUpdate(renderer, data, requested ? 'context' : 'signals');
      }
    });
  }
  function schedule() {
    queue(true);
  }
  function scheduleSignals() {
    queue(false);
  }
  function releaseLookup(binding) {
    borrowed.delete(binding.id);
    retiredLookups.delete(binding);
    const registry = binding.registry, node = binding.node, receipts = binding.receipts;
    binding.registry = '';
    binding.node = void 0;
    binding.receipts = [];
    binding.renewal = void 0;
    stopWatch(registry);
    receipts.forEach((receipt) => node?.off(receipt));
  }
  function retireLookups() {
    for (const binding of [...retiredLookups]) {
      retiredLookups.delete(binding);
      if (!binding.external && !hasEffectReaders(binding) && borrowed.get(binding.id) === binding) {
        releaseLookup(binding);
      }
    }
  }
  function lookup(id) {
    if (!current()) {
      return;
    }
    const effect = bindingEffect();
    const external = !effect || effect.graph !== graph;
    if (!borrowed.has(id)) {
      const binding2 = { id, registry: '', node: void 0, receipts: [], external };
      effectRetirement(binding2, () => retiredLookups.add(binding2));
      const notify = () => {
        notifyEffect(binding2);
        if (binding2.external) {
          schedule();
        }
      };
      const rebind = () => {
        if (borrowed.get(id) !== binding2) {
          return;
        }
        const renewal = {};
        binding2.renewal = renewal;
        const oldNode = binding2.node, oldReceipts = binding2.receipts;
        binding2.node = void 0;
        binding2.receipts = [];
        oldReceipts.forEach((receipt) => oldNode?.off(receipt));
        const ownsRenewal = () => borrowed.get(id) === binding2 && binding2.renewal === renewal;
        if (!ownsRenewal()) {
          return;
        }
        const node = getNode(id);
        binding2.node = node;
        if (node) {
          for (const event of ['commit', 'prop', 'context-update', 'message-added', 'message-updated', 'message-removed']) {
            const receipt = node.on(event, notify);
            if (!ownsRenewal()) {
              node.off(receipt);
              return;
            }
            binding2.receipts.push(receipt);
          }
        }
        notify();
      };
      binding2.registry = watchRegistry(id, rebind);
      borrowed.set(id, binding2);
      retiredLookups.add(binding2);
      rebind();
    }
    if (!current()) {
      return;
    }
    const binding = borrowed.get(id);
    if (effect) {
      effect.read(binding);
    }
    if (external) {
      binding.external = true;
    }
    return getNode(id)?.context;
  }
  function releaseOwnedRegistryId(id) {
    if (typeof id !== 'string') {
      return;
    }
    const owner = getNode(id);
    if (!owner) {
      return;
    }
    const visit = (entries) => {
      for (const record of entries.values()) {
        if (record.input && record.component.node === owner) {
          deregister(owner);
          return true;
        }
        if (record.children && visit(record.children)) {
          return true;
        }
      }
      return false;
    };
    visit(records);
  }
  function interrupted(pass) {
    return disposed || pass.version !== schemaVersion || pass.superseded;
  }
  function current() {
    return !disposed && (!activePass || !interrupted(activePass));
  }
  function ownershipChanged(pass) {
    for (let outer = pass.parent; outer; outer = outer.parent) {
      outer.superseded = true;
    }
  }
  function setValue(element, value, pass) {
    if (element.type === 'file') {
      return;
    }
    const text = value == null ? '' : String(value);
    if (interrupted(pass)) {
      return;
    }
    if (element.value === text) {
      return;
    }
    if (element.ownerDocument.activeElement === element && 'selectionStart' in element && element.selectionStart != null) {
      const start = element.selectionStart, end = element.selectionEnd, direction = element.selectionDirection;
      element.value = text;
      element.setSelectionRange(start, end, direction);
    } else {
      element.value = text;
    }
  }
  function reconcile(parent, previous, schema, scope, pass, generated = isGeneratedSchema(options.schema)) {
    let effect = collectionEffects.get(previous);
    if (!effect) {
      effect = graph.create(() => {
      });
      collectionEffects.set(previous, effect);
    }
    effect.callback = () => reconcileNow(parent, previous, schema, scope, activePass, generated);
    if (forceEffects || effect.dirty || collectionSources.get(previous) !== schema) {
      effect.run();
    }
    collectionSources.set(previous, schema);
  }
  function recordCallback(callback) {
    return () => callback(activePass, forceEffects);
  }
  function reconcileNow(parent, previous, schema, scope, pass, generated) {
    if (!generated) {
      opaqueEffect();
    }
    const retained = /* @__PURE__ */ new Set();
    const evaluated = expand(schema, scope, '', identity, evaluateValue, current, generated);
    let offset = 0, reordered = false;
    for (const item of evaluated) {
      if (interrupted(pass)) {
        return;
      }
      if (retained.has(item.key)) {
        throw new Error(`Duplicate schema key: ${item.key}`);
      }
      retained.add(item.key);
      const supplied = typeof item.schema === 'object' && 'nodeType' in item.schema;
      const normalized = supplied ? item.schema : sugar(item.schema);
      const kind = supplied ? 'supplied' : '$cmp' in normalized ? `component:${normalized.$cmp}` : normalized.$el;
      let record = previous.get(item.key);
      if (record && (record.kind !== kind || supplied && record.node !== normalized)) {
        previous.delete(item.key);
        ownershipChanged(pass);
        cleanup(record);
        record = previous.get(item.key);
      }
      let effect = record?.effect;
      if (!effect) {
        effect = graph.create(() => {
        });
      }
      effect.callback = recordCallback((recordPass, force) => {
        if (!item.generated) {
          opaqueEffect();
        }
        const props = !supplied && '$cmp' in normalized ? {
          ...evaluateValue(normalized.bind ?? {}, item.scope),
          ...evaluateValue(normalized.props ?? {}, item.scope)
        } : {};
        if (interrupted(recordPass)) {
          return;
        }
        if (!record) {
          if (supplied) {
            record = { node: normalized, kind, effect };
          } else if ('$cmp' in normalized) {
            const factory = components[normalized.$cmp];
            if (!factory) {
              throw new Error(`No native schema component registered for ${normalized.$cmp}.`);
            }
            const input = isInputFactory(factory);
            if (input) {
              releaseOwnedRegistryId(props.id);
            }
            const component = untrackedEffect(() => factory({ document, props, data: item.scope, children: normalized.children }));
            markInitialComponent(component);
            const start = document.createComment('component'), end = document.createComment('/component');
            const pending = document.createDocumentFragment();
            pending.append(start, component.element, end);
            record = { node: start, end, pending, kind, component, input, effect };
          } else {
            const element = parent === host && normalized.$el === existingRoot?.tagName.toLowerCase() ? existingRoot : normalized.$el === 'text' ? document.createTextNode('') : document.createElement(normalized.$el);
            record = { kind, effect, node: element, keep: element === existingRoot, children: /* @__PURE__ */ new Map(), listeners: /* @__PURE__ */ new Map(), attributes: /* @__PURE__ */ new Set() };
            if (element.nodeType === 1) {
              record.releaseEvents = ownElementListeners(element);
            }
          }
          if (interrupted(recordPass) || previous.has(item.key)) {
            cleanup(record);
            return;
          }
          previous.set(item.key, record);
          ownershipChanged(recordPass);
        }
        if (!supplied && '$cmp' in normalized) {
          opaqueRender();
          untrackedEffect(() => {
            if (!record.input || !updateNative(record.component, props, item.scope, normalized.children, force)) {
              record.component.update(props, item.scope, normalized.children);
            }
          });
        } else if (!supplied && normalized.$el === 'text') {
          const value = Object.hasOwn(item, 'text') ? item.text : evaluateValue(normalized.children ?? '', item.scope);
          if (value && ['object', 'function'].includes(typeof value)) {
            opaqueEffect();
          }
          const text = String(value);
          if (interrupted(recordPass)) {
            return;
          }
          if (record.node.textContent !== text) {
            record.node.textContent = text;
          }
        } else if (!supplied) {
          const element = record.node;
          const attrs = { ...evaluateValue(normalized.bind ?? {}, item.scope), ...evaluateValue(normalized.attrs ?? {}, item.scope) };
          if (interrupted(recordPass)) {
            return;
          }
          for (const attribute of record.attributes) {
            if (!(attribute in attrs)) {
              element.removeAttribute(attribute);
              if (interrupted(recordPass)) {
                return;
              }
              if (attribute === 'value') {
                setValue(element, '', recordPass);
              }
              if (['checked', 'selected', 'disabled', 'multiple'].includes(attribute)) {
                element[attribute] = false;
              }
              if (attribute === 'innerHTML') {
                element.replaceChildren();
                record.html = void 0;
              }
            }
          }
          const attributes2 = /* @__PURE__ */ new Set();
          const entries = Object.entries(attrs);
          prepareListeners(record, entries);
          for (const [attribute, value] of entries) {
            if (interrupted(recordPass)) {
              return;
            }
            if (/^on[A-Z]/.test(attribute)) {
              if (value != null) {
                if (typeof value !== 'function') {
                  throw new Error('Schema event attributes require function bindings.');
                }
                const event = schemaEventName(attribute);
                const handler = value;
                let binding = record.listeners.get(attribute);
                if (!binding) {
                  const created = { listener: (nativeEvent) => created.handler?.call(element, nativeEvent), handler };
                  element.addEventListener(event, created.listener, isPassiveSchemaEvent(attribute) ? { passive: true } : void 0);
                  binding = created;
                } else {
                  binding.handler = handler;
                }
                record.listeners.set(attribute, binding);
              }
              continue;
            }
            if (/^on/i.test(attribute) || attribute === 'innerHTML' && !options.allowHTML) {
              throw new Error('Schema event attributes require function bindings; innerHTML requires trusted HTML opt-in.');
            }
            attributes2.add(attribute);
            if (value && ['object', 'function'].includes(typeof value)) {
              opaqueEffect();
            }
            if (attribute === 'value') {
              if (element.tagName !== 'SELECT') {
                setValue(element, value, recordPass);
              }
              continue;
            }
            if (attribute === 'innerHTML') {
              if (record.children.size) {
                const children = record.children;
                record.children = /* @__PURE__ */ new Map();
                collectionEffects.get(children)?.stop();
                ownershipChanged(recordPass);
                children.forEach((child) => cleanup(child));
              }
              if (interrupted(recordPass)) {
                return;
              }
              const html = String(value ?? '');
              if (interrupted(recordPass)) {
                return;
              }
              if (record.html !== html) {
                element.innerHTML = html;
                record.html = html;
              }
              continue;
            }
            const serialized = attribute === 'class' ? className(value) : value;
            if (interrupted(recordPass)) {
              return;
            }
            if (attribute === 'style' && value && typeof value === 'object') {
              element.removeAttribute('style');
              if (interrupted(recordPass)) {
                return;
              }
              for (const [key, setting] of Object.entries(value)) {
                if (interrupted(recordPass)) {
                  return;
                }
                const style = element.style;
                const custom = key.startsWith('--');
                const text = setting === null && !custom ? '' : String(setting);
                if (interrupted(recordPass)) {
                  return;
                }
                if (custom) {
                  style.setProperty(key, text);
                } else {
                  style[key] = text;
                }
              }
            } else if (serialized == null || serialized === false && !/^(aria-|data-)/.test(attribute)) {
              element.removeAttribute(attribute);
            } else {
              const text = serialized === true && !/^(aria-|data-)/.test(attribute) ? '' : String(serialized);
              if (interrupted(recordPass)) {
                return;
              }
              element.setAttribute(attribute, text);
            }
            if (interrupted(recordPass)) {
              return;
            }
            if (['checked', 'selected', 'disabled', 'multiple'].includes(attribute)) {
              element[attribute] = !!value;
            }
          }
          if (interrupted(recordPass)) {
            return;
          }
          record.attributes = attributes2;
          if (!('innerHTML' in attrs)) {
            reconcile(elementHost(element), record.children, normalized.children ?? [], item.scope, recordPass, item.generated);
          }
          if (interrupted(recordPass)) {
            return;
          }
          if (element.tagName === 'SELECT' && 'value' in attrs) {
            setValue(element, attrs.value, recordPass);
          }
        }
        if (interrupted(recordPass)) {
          return;
        }
      });
      if (forceEffects || effect.dirty || record?.source !== item.schema) {
        effect.run();
      }
      if (record) {
        record.source = item.schema;
      }
      if (interrupted(pass)) {
        return;
      }
      record = previous.get(item.key);
      if (!record) {
        return;
      }
      const position = parent.nodes()[offset] ?? null;
      if (position !== record.node) {
        reordered = true;
        if (record.pending) {
          const fragment = record.pending;
          record.pending = void 0;
          parent.insert(fragment, position);
        } else if (record.end) {
          const fragment = document.createDocumentFragment();
          fragment.append(...nodes(record));
          if (interrupted(pass)) {
            return;
          }
          parent.insert(fragment, position);
        } else {
          parent.insert(record.node, position);
        }
      }
      if (interrupted(pass)) {
        return;
      }
      offset += nodes(record).length;
    }
    for (const [key, record] of previous) {
      if (interrupted(pass)) {
        return;
      }
      if (!retained.has(key)) {
        previous.delete(key);
        ownershipChanged(pass);
        cleanup(record);
      }
    }
    if (reordered) {
      const ordered = [...retained].map((key) => [key, previous.get(key)]);
      previous.clear();
      for (const [key, record] of ordered) {
        previous.set(key, record);
      }
    }
  }
  function update(nextData = data) {
    if (disposed) {
      return;
    }
    const pass = { version: schemaVersion, parent: activePass, superseded: false };
    activePass = pass;
    try {
      data = nextData;
      graph.begin();
      const active3 = document.activeElement;
      const ownedFocus = active3 && host.contains(active3);
      const scope = scoped(data, { get: lookup, ...options.slots ? { slots: options.slots } : {} });
      const automatic = takeAutomatic(renderer);
      automaticScope(scope, !!automatic);
      const previousForce = forceEffects;
      forceEffects = !automatic;
      try {
        if (automatic) {
          if (automatic !== 'signals') {
            graph.discover(automatic === 'family');
          }
          graph.flush(current);
        } else {
          captureRender(renderer, data, () => {
            reconcile(host, records, options.schema, scope, pass);
          });
        }
      } finally {
        forceEffects = previousForce;
      }
      if (interrupted(pass)) {
        releaseCapture(renderer);
        return;
      }
      if (ownedFocus && host.contains(active3) && document.activeElement !== active3) {
        active3.focus({ preventScroll: true });
      }
    } finally {
      activePass = pass.parent;
      if (!activePass) {
        retireLookups();
      }
    }
  }
  function destroy() {
    if (disposed) {
      return;
    }
    disposed = true;
    releaseCapture(renderer);
    graph.stop();
    borrowed.forEach((binding) => releaseLookup(binding));
    retiredLookups.clear();
    symbols.clear();
    programs.clear();
    records.forEach((record) => cleanup(record));
    records.clear();
  }
  function setSchema(schema) {
    schemaVersion++;
    options.schema = schema;
    programs.clear();
    update();
  }
  const renderer = { update, setSchema, destroy };
  try {
    update();
    graph.activate();
  } catch (error2) {
    graph.stop();
    throw error2;
  }
  return renderer;
}
function createSchemaRenderer(container, options) {
  return createRenderer(elementHost(container), options);
}
function createRootRenderer(container, options) {
  return createRenderer({
    document: container.ownerDocument,
    nodes: () => [container],
    insert: container.appendChild.bind(container),
    contains: (node) => container.contains(node)
  }, options, container);
}
function createRangeRenderer(start, end, options) {
  const current = () => {
    const result = [];
    let next = start.nextSibling;
    while (next && next !== end) {
      result.push(next);
      next = next.nextSibling;
    }
    return result;
  };
  return createRenderer({
    document: start.ownerDocument,
    nodes: current,
    insert: (node, before) => end.parentNode.insertBefore(node, before ?? end),
    contains: (node) => current().some((child) => child === node || child.contains(node))
  }, options);
}

// current-303ddfbb/src/runtime.ts
function runtimePlugins(options) {
  return [
    coreReadBridge(),
    nativeInvalidation,
    createLibraryPlugin(inputs, options.inputs ?? {}),
    createThemePlugin(options.theme, options.icons, options.iconLoaderUrl, options.iconLoader ?? (() => void 0)),
    nativeBindings
  ];
}
function copyProps(value) {
  if (isNode2(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(copyProps);
  }
  if (isPojo2(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyProps(item)]));
  }
  return value;
}
function sameValues(left, right) {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => sameValues(item, right[index]));
  }
  if (isPojo2(left) && isPojo2(right)) {
    const a = left, b = right;
    return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => Object.hasOwn(b, key) && sameValues(a[key], b[key]));
  }
  return false;
}
function sameProjection(left, right) {
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return Object.is(left, right);
  }
  if (!(Array.isArray(left) && Array.isArray(right)) && !(isPojo2(left) && isPojo2(right))) {
    return false;
  }
  const a = left, b = right;
  const keys2 = Object.keys(a);
  return keys2.length === Object.keys(b).length && keys2.every((key) => Object.hasOwn(b, key) && sameProjection(a[key], b[key]));
}
var commonProps = /* @__PURE__ */ new Set([
  ...runtimeProps,
  'help',
  'label',
  'disabled',
  'validationVisibility',
  'attrs',
  'ignore',
  'dirtyBehavior',
  'preserve',
  'preserveErrors',
  'value',
  'slots',
  'itemKey'
]);
function inputProps(props) {
  return { ...props, ...Object.fromEntries(Object.entries(props.classes ?? {}).map(([section, value]) => [`_${section}Class`, value])) };
}
function attributes(props, node) {
  const definitionProps = node?.props.definition?.props;
  const known = /* @__PURE__ */ new Set([...commonProps, ...Array.isArray(definitionProps) ? definitionProps : Object.keys(definitionProps ?? {})]);
  return { ...Object.fromEntries(Object.entries(props).filter(([key]) => !known.has(key) && !/(?:Icon|Class)$/.test(key))), ...props.attrs };
}
function slotSchemas(children) {
  if (children === void 0) {
    return {};
  }
  if (children && typeof children === 'object' && !Array.isArray(children) && !isDOM(children) && !isComponent(children) && !isConditional(children) && !('$formkit' in children)) {
    return children;
  }
  return { default: children };
}
function scopedSlots(children, supplied, data) {
  const result = { ...supplied };
  for (const [name, schema] of Object.entries(slotSchemas(children))) {
    result[name] = (scope) => scope ? { schema, data: inheritScope(data(), scope) } : (Array.isArray(schema) ? schema : [schema]).map((entry) => sugar2(entry));
  }
  return result;
}
function inheritScope(data, scope, application = false) {
  const keys2 = /* @__PURE__ */ new Set();
  for (let object = scope; object; object = Object.getPrototypeOf(object)) {
    Object.keys(object).forEach((key) => keys2.add(key));
  }
  const inherited = scoped(data, Object.fromEntries([...keys2].filter((key) => key !== 'slots' && (!application || key === 'node' || !(key in data))).map((key) => [key, scope[key]])));
  automaticScope(inherited, isAutomaticScope(scope));
  return inherited;
}
var nextId = 0;
function inputFactory(parent, options, decorate) {
  const factory = ({ document, props, data, children }) => {
    props = inputProps(props);
    const start = document.createComment('input'), end = document.createComment('/input');
    const element = document.createDocumentFragment();
    element.append(start, end);
    let disposed = false, queued = false, alive = true;
    let currentData = data;
    let currentChildren = children;
    let currentProps = props;
    let renderer;
    let receipts = [];
    let node;
    let projectedAttrs;
    const schedule = () => {
      changedEffect(node);
      if (disposed || queued) {
        return;
      }
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (!disposed && alive && node.context) {
          automaticUpdate(renderer, node.context);
        }
      });
    };
    function generate() {
      const definition = node.props.definition;
      if (!definition) {
        throw new Error(`Unknown FormKit input: ${String(node.props.type)}.`);
      }
      if (definition.component) {
        const definitionFactory = typeof definition.component === 'string' ? options.components?.[definition.component] : definition.component;
        if (typeof definitionFactory !== 'function') {
          throw new Error('Input components must be native SchemaComponent factories.');
        }
        return {
          schema: { $cmp: 'Definition', props: { context: '$node.context' } },
          components: { Definition: definitionFactory }
        };
      }
      if (!definition.schema) {
        throw new Error(`FormKit input ${String(node.props.type)} has no schema.`);
      }
      const extensions = { ...options.sectionsSchema, ...node.props.sectionsSchema };
      extensions.input = extendSchema(
        { attrs: { 'aria-invalid': '$state.invalid || $state.errors || undefined' } },
        extendSchema(options.sectionsSchema?.input ?? {}, node.props.sectionsSchema?.input ?? {})
      );
      extensions.messages = extendSchema({ attrs: { 'aria-live': 'polite' } }, extensions.messages ?? {});
      const schema = typeof definition.schema === 'function' ? definition.schema(extensions) : definition.schema;
      if (options.sectionsSchema === void 0 && node.props.sectionsSchema === void 0 && Object.values(inputs).some((input) => input.schema === definition.schema)) {
        generatedSchema(schema);
      }
      return {
        schema,
        components: { ...definition.library, ...options.components, FormKit: decorate ? decorate(node, inputFactory(node, options, decorate)) : inputFactory(node, options) }
      };
    }
    function create(next) {
      alive = true;
      const inherited = next.parent ?? parent;
      const id = String(next.id ?? `${parent.props.id}-input-${nextId++}`);
      const slots = scopedSlots(currentChildren, next.slots ?? {}, () => currentData);
      node = createNode({
        parent: next.ignore === true ? null : inherited,
        name: next.name,
        index: next.index,
        sync: !!(next.sync || next.dynamic),
        value: next.value,
        config: { ...next.config },
        plugins: [coreReadBridge(), ...parent.plugins, ...inherited.plugins, ...next.plugins ?? []],
        props: { ...copyProps(next), id, attrs: attributes(next), __root: document, __slots: slots }
      });
      ownNodeResource(node);
      effectNode(node, parent);
      const attrs = attributes(next, node);
      projectedAttrs = { ...attrs };
      node.props.attrs = contextObject(node, effectTarget(attrs), 'attrs');
      node.context.slots = contextObject(node, slots, 'slots');
      const generated = generate();
      renderer = createRangeRenderer(start, end, { ...generated, data: node.context, allowHTML: true });
      receipts = ['context-update', 'schema'].map((event) => node.on(event, () => {
        if (event === 'schema') {
          const regenerated = generate();
          Object.keys(generated.components).forEach((key) => {
            delete generated.components[key];
          });
          Object.assign(generated.components, regenerated.components);
          renderer.setSchema(regenerated.schema);
        }
        schedule();
      }));
      receipts.push(node.on('destroying', () => {
        alive = false;
      }));
      receipts.push(node.on('destroyed', () => {
        alive = false;
      }));
      const mounted = node;
      queueMicrotask(() => {
        if (!disposed && alive && node === mounted && mounted.context) {
          mounted.emit('mounted');
        }
      });
    }
    function release() {
      receipts.forEach((receipt) => node.off(receipt));
      if (node.parent?.type === 'list' && node.parent.sync && !node.parent.children.includes(node)) {
        node.parent = null;
      }
      renderer.destroy();
      if (alive && node.context) {
        node.destroy();
      }
      releaseNodeResource(node);
    }
    create(props);
    const mount = {
      element,
      get node() {
        return node;
      },
      update(next, nextData, nextChildren) {
        if (disposed) {
          return;
        }
        next = inputProps(next);
        if (disposed) {
          return;
        }
        currentData = nextData;
        const inherited = next.parent ?? parent;
        const index = next.index === void 0 ? node.index : Number(next.index);
        const syncedList = inherited.type === 'list' && inherited.sync && !node.props.ignore;
        const terminal = node.context === null;
        if (disposed) {
          return;
        }
        if (terminal || syncedList && inherited.children[index] !== node) {
          const snapshot2 = copyProps(inherited.value);
          const value = next.value === void 0 && inherited.type === 'list' && !node.props.ignore ? snapshot2[index] : next.value;
          if (syncedList) {
            const existing = inherited.children[index];
            if (isNode2(existing)) {
              existing.props.preserve = true;
              inherited.remove(existing);
            }
            if (node.context) {
              node.props.preserve = true;
              inherited.remove(node);
            }
          }
          release();
          if (syncedList) {
            void inherited.input(snapshot2, false);
          }
          currentProps = next;
          currentChildren = nextChildren;
          create({ ...next, value });
          return;
        }
        if (!eq2(currentChildren, nextChildren) || !eq2(currentProps.slots, next.slots)) {
          currentChildren = nextChildren;
          node.context.slots = contextObject(node, scopedSlots(currentChildren, next.slots ?? {}, () => currentData), 'slots');
          node.props.__slots = node.context.slots;
        }
        if (next.type !== currentProps.type || next.name !== currentProps.name || next.parent !== currentProps.parent) {
          if (next.name === currentProps.name && next.parent === currentProps.parent) {
            node.props.preserve = true;
          }
          release();
          currentProps = next;
          create(next);
          return;
        }
        for (const key of /* @__PURE__ */ new Set([...Object.keys(currentProps), ...Object.keys(next)])) {
          if (key === 'value' ? sameValues(currentProps[key], next[key]) : eq2(currentProps[key], next[key])) {
            continue;
          }
          if (key === 'value') {
            void node.input(next[key], false);
          } else if (key === 'config') {
            Object.assign(node.config, copyProps(next.config));
          } else if (key === 'index') {
            node.index = Number(next.index);
          } else if (key === 'id') {
            deregister2(node);
            node.props.id = next.id;
            register(node);
          } else {
            node.props[key] = copyProps(next[key]);
          }
        }
        const attrs = attributes(next, node);
        projectedAttrs = { ...attrs };
        if (!eq2(node.props.attrs, attrs)) {
          node.props.attrs = contextObject(node, effectTarget(attrs), 'attrs');
        }
        currentProps = next;
        takeInitialComponent(mount);
        const automatic = isAutomaticScope(nextData);
        if (automatic) {
          automaticUpdate(renderer, node.context);
        } else {
          renderer.update(node.context);
        }
      },
      destroy() {
        disposed = true;
        release();
      }
    };
    let prepared;
    let preparedChildren;
    projectNative(mount, (next, nextData, nextChildren, force) => {
      if (disposed) {
        return;
      }
      currentData = nextData;
      const projectedChildren = nextChildren;
      const inherited = next.parent ?? parent;
      const index = next.index === void 0 ? node.index : Number(next.index);
      const attached = node.context !== null && (!(inherited.type === 'list' && inherited.sync && !node.props.ignore) || inherited.children[index] === node);
      if (disposed) {
        return;
      }
      if (!force && attached && prepared && sameProjection(prepared, next) && sameProjection(preparedChildren, projectedChildren) && sameProjection(node.props.attrs, projectedAttrs)) {
        return;
      }
      mount.update(next, nextData, projectedChildren);
      prepared = copyProps(next);
      preparedChildren = copyProps(projectedChildren);
    });
    return mount;
  };
  return markInputFactory(factory);
}
function mountFormSchema(form, root, options) {
  let data = options.schemaData ?? {};
  root.context.slots = contextObject(root, {
    ...options.slots,
    default: (scope) => ({
      schema: options.schema,
      data: inheritScope('slots' in data ? data : scoped(data, { slots: options.slots ?? {} }), scope, true)
    }),
    ...!options.slots?.actions ? { actions: () => ({ $el: 'div', if: '$actions', attrs: { class: '$classes.actions' }, children: [
      { $cmp: 'FormKit', bind: '$submitAttrs', props: { type: 'submit', label: '$submitLabel' } },
      { $el: 'button', attrs: { type: 'reset', disabled: '$disabled' }, children: '$resetLabel' }
    ] }) } : {}
  }, 'slots');
  const definition = root.props.definition;
  const schema = typeof definition.schema === 'function' ? definition.schema(options.sectionsSchema ?? {}) : definition.schema;
  if (definition.schema === inputs.form.schema && options.sectionsSchema === void 0) {
    generatedSchema(schema);
  }
  const factory = inputFactory(root, options);
  const renderer = createRootRenderer(form, {
    schema,
    data: root.context,
    allowHTML: true,
    components: { ...options.components, FormKit: factory }
  });
  let queued = false, disposed = false;
  const receipt = root.on('context-update.deep', ({ origin }) => {
    changedEffect(origin);
    if (queued || disposed) {
      return;
    }
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!disposed) {
        automaticUpdate(renderer, root.context, 'family');
      }
    });
  });
  return {
    update(next) {
      if (next !== void 0) {
        data = next;
      }
      renderer.update(root.context);
    },
    setSchema(nextSchema) {
      options.schema = nextSchema;
      renderer.setSchema(schema);
    },
    destroy() {
      disposed = true;
      root.off(receipt);
      renderer.destroy();
    }
  };
}

// current-303ddfbb/src/row-ownership.ts
import { View } from 'marionette';
import { createNode as createNode2, valueRemoved } from '@formkit/core';
var roots = /* @__PURE__ */ new WeakMap();
var lists = /* @__PURE__ */ new WeakMap();
var rowNodes = /* @__PURE__ */ new WeakMap();
function connectRows(root, bridge) {
  roots.set(root, { bridge, lists: /* @__PURE__ */ new Set() });
}
function disconnectRows(root) {
  roots.delete(root);
}
function rowLocation(node, name) {
  const suffix = name === void 0 ? [] : [name];
  for (let current = node; current; current = current.parent) {
    const row = rowNodes.get(current);
    if (row) {
      return { list: row.owner.path, keyProperty: row.owner.keyProperty, key: row.entry.key, suffix };
    }
    suffix.unshift(String(current.name));
  }
  return void 0;
}
function resolveRow(values, location) {
  const path = Array.isArray(location.list) ? location.list : resolveRow(values, location.list);
  if (!path) {
    return;
  }
  let list = values;
  for (const name of path) {
    list = list?.[name];
  }
  if (!Array.isArray(list)) {
    return;
  }
  const index = list.findIndex((item) => item?.[location.keyProperty] === location.key);
  return index < 0 ? void 0 : [...path, String(index), ...location.suffix];
}
function rowLocationKey(location) {
  return JSON.stringify([location.list, location.keyProperty, location.key]);
}
function isRowWithin(location, ancestor) {
  const key = rowLocationKey(ancestor);
  for (let current = location; current; current = Array.isArray(current.list) ? void 0 : current.list) {
    if (rowLocationKey(current) === key) {
      return true;
    }
  }
  return false;
}
function rowOwnerLocation(owner, key) {
  return { list: owner.path, keyProperty: owner.keyProperty, key, suffix: [] };
}
function keys(value, property) {
  if (!Array.isArray(value)) {
    throw new Error('Owned rows require an array.');
  }
  const found = /* @__PURE__ */ new Set();
  for (const row of value) {
    const key = row?.[property];
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof key !== 'string' || !key || found.has(key)) {
      throw new Error('Owned row keys must be unique non-empty strings on objects.');
    }
    found.add(key);
  }
  return [...found];
}
function endRow(owner, entry, forget) {
  entry.ending = true;
  entry.view?.destroy();
  if (entry.node.context !== null) {
    entry.node.props.preserve = true;
    entry.node.destroy();
  }
  releaseNodeResource(entry.node);
  owner.rows.delete(entry.key);
  rowNodes.delete(entry.node);
  if (forget) {
    owner.bridge.forget(rowOwnerLocation(owner, entry.key));
  }
}
function clearRow(owner, entry) {
  owner.bridge.mutate(() => {
    entry.ending = true;
    entry.node.props.preserve = false;
    entry.node.destroy();
    releaseNodeResource(entry.node);
    const index = owner.node.value.findIndex((item) => item[owner.keyProperty] === entry.key);
    if (index >= 0) {
      owner.node.disturb();
      owner.node.calm({ name: index, value: valueRemoved });
    }
    owner.rows.delete(entry.key);
    rowNodes.delete(entry.node);
    owner.bridge.forget(rowOwnerLocation(owner, entry.key));
  });
}
function listOwner(node, root) {
  const rootOwner = roots.get(root);
  if (!rootOwner || node.root !== root || node.type !== 'list' || node.context === null) {
    throw new Error('A RowView requires a live list owned by its form.');
  }
  const existing = lists.get(node);
  if (existing) {
    return existing;
  }
  for (let current = node; current.parent && current.parent !== root; current = current.parent) {
    const parent = current.parent;
    if (parent.type === 'list' && rowNodes.get(current)?.owner.node !== parent) {
      throw new Error('Nested owned lists require owned RowView ancestors.');
    }
  }
  const keyProperty = node.props.itemKey;
  if (typeof keyProperty !== 'string' || !keyProperty) {
    throw new Error('Owned lists require a string itemKey.');
  }
  keys(node.value, keyProperty);
  const owner = {
    node,
    path: rowLocation(node) ?? node.address.slice(1).map(String),
    keyProperty,
    rows: /* @__PURE__ */ new Map(),
    ending: false,
    bridge: rootOwner.bridge
  };
  lists.set(node, owner);
  rootOwner.lists.add(owner);
  const projection = (value, next) => {
    const nextKeys = new Set(keys(value, keyProperty));
    for (const entry of [...owner.rows.values()]) {
      if (!nextKeys.has(entry.key)) {
        endRow(owner, entry, true);
      }
    }
    return next(value);
  };
  node.hook.input.unshift(projection);
  const receipt = node.on('destroying', () => {
    owner.ending = true;
    node.hook.input.remove(projection);
    node.off(receipt);
    for (const entry of [...owner.rows.values()].reverse()) {
      endRow(owner, entry, false);
    }
    lists.delete(node);
    roots.get(root)?.lists.delete(owner);
  });
  return owner;
}
function prepareRowReset(root, values) {
  for (const owner of roots.get(root).lists) {
    const path = Array.isArray(owner.path) ? owner.path : resolveRow(values, owner.path);
    let target = values;
    for (const name of path) {
      target = target?.[name];
    }
    const nextKeys = keys(target, owner.keyProperty);
    const currentKeys = keys(owner.node.value, owner.keyProperty);
    if (nextKeys.length === currentKeys.length && nextKeys.every((key) => currentKeys.includes(key))) {
      continue;
    }
    for (const entry of owner.rows.values()) {
      entry.ending = true;
      entry.view?.destroy();
    }
    for (const entry of [...owner.rows.values()].reverse()) {
      endRow(owner, entry, true);
    }
  }
}
var RowView = class extends View {
  #rowOptions;
  #owner;
  #entry;
  constructor(options) {
    super(options);
    this.#rowOptions = options;
    this.on('destroy', () => {
      const entry = this.#entry;
      if (!entry) {
        return;
      }
      entry.view = void 0;
      if (options.removal === 'clear' && !entry.ending && !this.#owner.ending) {
        clearRow(this.#owner, entry);
      }
    });
  }
  get node() {
    if (!this.#entry) {
      throw new Error('Render the RowView before accessing its node.');
    }
    return this.#entry.node;
  }
  render() {
    if (this.isDestroyed()) {
      return this;
    }
    if (!this.#entry) {
      const { form, parent, rowKey } = this.#rowOptions;
      const owner = this.#owner = listOwner(parent, form.node);
      const index = keys(parent.value, owner.keyProperty).indexOf(rowKey);
      if (index < 0) {
        throw new Error('Row key must already exist.');
      }
      let entry = owner.rows.get(rowKey);
      if (entry?.view && !entry.view.isDestroyed()) {
        throw new Error('Row already mounted.');
      }
      owner.bridge.mutate(() => {
        if (!entry) {
          const node = createNode2({
            type: 'group',
            parent,
            index,
            value: parent.value[index],
            plugins: [coreReadBridge()],
            props: { type: 'group', id: `${this.cid}-group`, preserve: true }
          });
          entry = { key: rowKey, node, view: this, ending: false };
          ownNodeResource(node);
          owner.rows.set(rowKey, entry);
          rowNodes.set(node, { owner, entry });
          node.on('destroying', () => {
            entry.ending = true;
            entry.view?.destroy();
            owner.rows.delete(rowKey);
            rowNodes.delete(node);
          });
        }
        entry.view = this;
        this.#entry = entry;
      });
    }
    return super.render();
  }
};

// current-303ddfbb/src/composition-input.ts
function ownedInputFactory(parent, options, composition, onRelease) {
  const wrap = (inherited, base, releaseOwner) => markInputFactory((context) => {
    const { props } = context;
    if (props.type === 'form') {
      throw new Error('Composed inputs cannot create a nested form.');
    }
    const owner = props.parent ?? inherited;
    if (owner.context === null || owner.root !== parent.root) {
      throw new Error('Schema inputs require a live parent belonging to the same form.');
    }
    const name = props.name;
    if (owner.type === 'group' && name !== void 0 && (!name || name.includes('.') || owner.children.some((child) => child.name === name))) {
      throw new Error('Field names must be non-empty, unique within their group, and contain no dots.');
    }
    let mounted;
    let disposed = false;
    let current = context;
    let resource;
    let ignored = false;
    composition.mutate(() => {
      const supplied = name !== void 0 && Object.hasOwn(owner.value, name);
      const initialPath = name === void 0 ? void 0 : rowLocation(owner, name) ?? [...owner.address.slice(1).map(String), name];
      mounted = base(context);
      if (!mounted.node.parent || mounted.node.props.ignore) {
        ignored = true;
        return;
      }
      const remount = initialPath !== void 0 && composition.excluded.delete(fieldPathKey(initialPath));
      const path = rowLocation(mounted.node) ?? mounted.node.address.slice(1).map(String);
      if (remount) {
        void mounted.node.input(cloneAny2(composition.baseline(path, props.value === void 0 ? mounted.node.value : props.value)), false);
      } else if (!supplied && mounted.node.value === void 0 && props.value !== void 0) {
        void mounted.node.input(cloneAny2(props.value), false);
      }
      composition.baseline(path, mounted.node.value);
      resource = {
        parent: owner,
        release: () => releaseOwner ? releaseOwner() : destroy(),
        update: () => update(current.props, current.data, current.children)
      };
      composition.fields.add(resource);
    });
    if (ignored && !releaseOwner) {
      return mounted;
    }
    if (ignored) {
      resource = {
        parent: owner,
        release: () => releaseOwner(),
        update: () => update(current.props, current.data, current.children)
      };
      composition.fields.add(resource);
    }
    function update(...args) {
      if (disposed) {
        return;
      }
      current = {
        ...current,
        props: args[0],
        data: args[1],
        children: args[2]
      };
      mounted.update(args[0], args[1], args[2]);
    }
    function destroy() {
      if (disposed) {
        return;
      }
      disposed = true;
      composition.mutate(() => {
        const node = mounted.node;
        for (const child of [...composition.fields].reverse()) {
          if (child === resource) {
            continue;
          }
          let ancestor = child.parent;
          while (ancestor && ancestor !== node) {
            ancestor = ancestor.parent;
          }
          if (ancestor === node) {
            child.release();
          }
        }
        let preserved;
        for (let ancestor = node; ancestor && preserved === void 0; ancestor = ancestor.parent) {
          preserved = undefine2(ancestor.props.preserve);
        }
        const path = node.address.slice(1).map(String), clear = !ignored && (!!releaseOwner && current.props.preserve === false || !preserved);
        if (clear) {
          const location = rowLocation(node) ?? path;
          composition.excluded.set(fieldPathKey(location), location);
        }
        composition.fields.delete(resource);
        mounted.destroy();
        if (clear && owner.context !== null && owner.type === 'group' && Object.hasOwn(owner.value, String(node.name))) {
          owner.disturb();
          owner.calm({
            name: node.name,
            value: valueRemoved2
          });
        }
      });
    }
    return {
      element: mounted.element,
      get node() {
        return mounted.node;
      },
      update,
      destroy
    };
  });
  const decorate = (inherited, base) => wrap(inherited, base);
  return wrap(parent, inputFactory(parent, options, decorate), onRelease);
}

// current-303ddfbb/src/index.ts
import { View as View4 } from 'marionette';
import { createMessage as createMessage2, createNode as createNode3, isNode as isNode4, reset as resetNode, valueRemoved as valueRemoved3 } from '@formkit/core';
import { createValidationPlugin } from '@formkit/validation';
import * as rules from '@formkit/rules';
import { createI18nPlugin, en } from '@formkit/i18n';
import { isKilled } from '@formkit/observer';
import { cloneAny as cloneAny3, eq as eq3, isPojo as isPojo3, undefine as undefine3 } from '@formkit/utils';

// current-303ddfbb/src/schema-view.ts
import { View as View2 } from 'marionette';
var SchemaView = class extends View2 {
  #schemaOptions;
  #renderer;
  #resource;
  #parentReceipt;
  #releaseNative;
  #disposed = false;
  constructor(options) {
    super({
      ...options,
      template: () => ''
    });
    this.#schemaOptions = options;
    this.on('before:destroy', () => this.#dispose());
  }
  get node() {
    return this.#schemaOptions.parent ?? this.#schemaOptions.form.node;
  }
  render() {
    if (this.isDestroyed()) {
      return this;
    }
    const { form } = this.#schemaOptions;
    if (!compositions.has(form.node)) {
      throw new Error('The SchemaView owner has been destroyed.');
    }
    if (this.node.context === null || this.node.root !== form.node || this.node.type !== 'group') {
      throw new Error('Schema parent must be a live group owned by its form.');
    }
    if (!this.isRendered()) {
      super.render();
    }
    return this;
  }
  attachElContent() {
    const { form, schema, components } = this.#schemaOptions;
    const parent = this.node;
    const composition = compositions.get(form.node);
    this.#releaseNative = composition.captureNativeEvents(this.el);
    this.#resource = {
      // Construction runs inside mutate; refresh cannot observe an unfinished renderer.
      parent,
      release: () => this.destroy(),
      update: () => this.#renderer.update(this.#data())
    };
    composition.fields.add(this.#resource);
    this.#parentReceipt = parent.on('destroying', () => this.destroy());
    try {
      composition.mutate(() => {
        this.#renderer = createSchemaRenderer(this.el, {
          schema,
          data: this.#data(),
          components: {
            ...composition.options.components,
            ...components,
            FormKit: ownedInputFactory(parent, {
              ...composition.options,
              components: {
                ...composition.options.components,
                ...components
              }
            }, composition)
          }
        });
      });
    } catch (error2) {
      this.#dispose();
      throw error2;
    }
  }
  #data() {
    return scoped(this.#schemaOptions.schemaData ?? {}, { node: this.node });
  }
  setSchemaData(data) {
    if (!this.#disposed) {
      this.#schemaOptions.schemaData = data;
      this.#renderer?.update(this.#data());
    }
    return this;
  }
  setSchema(schema) {
    if (!this.#disposed) {
      this.#schemaOptions.schema = schema;
      this.#renderer?.setSchema(schema);
    }
    return this;
  }
  #dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#releaseNative?.();
    const composition = compositions.get(this.#schemaOptions.form.node);
    if (this.#parentReceipt) {
      this.node.off(this.#parentReceipt);
    }
    if (this.#resource) {
      composition.fields.delete(this.#resource);
    }
    this.#renderer?.destroy();
    this.#renderer = void 0;
  }
};

// current-303ddfbb/src/view-components.ts
import { View as View3, CollectionView } from 'marionette';
import { isNode as isNode3 } from '@formkit/core';
var immutable = ['type', 'id', 'plugins', 'config', 'name', 'parent', 'preserve', 'ignore'];
var nextRegion = 0;
function createViewComponents({ getForm, getOwner = getForm, getParent, registrations }) {
  const registry = Object.fromEntries(Object.entries(registrations).map(([name, spec]) => [name, (context) => {
    const { document, data, children } = context;
    const props = context.props;
    const form = getForm(), owner = getOwner();
    if (!form || form.isDestroyed() || !owner || owner.isDestroyed()) {
      throw new Error('A live form and ordinary Region owner are required.');
    }
    const resolveParent = (nextProps, nextData) => getParent ? getParent(nextProps, nextData) : isNode3(nextData.node) ? nextData.node : form.node;
    const parent = resolveParent(props, data);
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-schema-view', name);
    const regionName = `schemaViewBridge${++nextRegion}`;
    const region = owner.addRegion(regionName, {
      el: wrapper
    });
    let view, disposed = false, previous = copyProps(props);
    const isField = spec.kind === 'field';
    if (isField && props.input?.type === 'form') {
      owner.removeRegion(regionName);
      throw new Error('Nested form inputs are excluded from this bridge.');
    }
    const identity = (fieldProps) => ({
      name: fieldProps.name,
      removal: fieldProps.removal ?? 'preserve',
      input: Object.fromEntries(immutable.filter((key) => Object.hasOwn(fieldProps.input ?? {}, key)).map((key) => [key, fieldProps.input[key]]))
    });
    const originalIdentity = identity(props);
    function destroy() {
      if (disposed) {
        return;
      }
      disposed = true;
      owner.off('before:destroy', destroy);
      view?.off('destroy', destroy);
      if (!region.isDestroyed()) {
        owner.removeRegion(regionName);
      }
      if (view && !view.isDestroyed()) {
        view.destroy();
      }
    }
    try {
      queueMicrotask(() => {
        if (disposed || view.isDestroyed() || owner.isDestroyed()) {
          return;
        }
        if (!owner.el.contains(wrapper)) {
          destroy();
          throw new Error('The schema wrapper must be inserted inside its Region owner before placement.');
        }
        region.show(view);
      });
      view = isField ? spec.create({
        form,
        parent,
        name: props.name,
        removal: props.removal ?? 'preserve',
        input: props.input
      }) : spec.create({
        form,
        parent,
        props,
        data,
        children
      });
      if (!(view instanceof View3 || view instanceof CollectionView) || view instanceof FormView) {
        throw new Error('The registry must return an ordinary Marionette View, CollectionView or FieldView, never FormView.');
      }
      if (!isField && view instanceof FieldView) {
        throw new Error('FieldView requires an explicit field registration.');
      }
      if (isField && !(view instanceof FieldView)) {
        throw new Error('Field registration must return an actual FieldView.');
      }
      view.render();
      view.on('destroy', destroy);
      owner.on('before:destroy', destroy);
    } catch (error2) {
      destroy();
      throw error2;
    }
    const component = {
      element: wrapper,
      update(nextProps, nextData, nextChildren) {
        const next = nextProps;
        if (disposed || view.isDestroyed()) {
          return;
        }
        if (isField && (!sameValues(identity(next), originalIdentity) || resolveParent(next, nextData) !== parent)) {
          throw new Error('Change the schema key to replace FieldView identity; dispose first when reusing its group/name.');
        }
        const old = previous;
        previous = copyProps(next);
        if (isField) {
          const allowed = Object.fromEntries(Object.entries(next.input ?? {}).filter(([key]) => !immutable.includes(key) && key !== 'value'));
          const oldAllowed = Object.fromEntries(Object.entries(old.input ?? {}).filter(([key]) => !immutable.includes(key) && key !== 'value'));
          if (!sameValues(allowed, oldAllowed)) {
            const cleared = Object.fromEntries(Object.keys(oldAllowed).filter((key) => !Object.hasOwn(allowed, key)).map((key) => [key, void 0]));
            view.setInput({
              ...cleared,
              ...allowed
            });
          }
          if (Object.hasOwn(next.input ?? {}, 'value') && !sameValues(next.input.value, old.input?.value)) {
            view.setValue(next.input.value);
          }
        } else {
          spec.update?.(view, next, nextData, nextChildren);
        }
      },
      destroy
    };
    return component;
  }]));
  return registry;
}

// current-303ddfbb/src/index.ts
function hasPath(values, path) {
  let value = values;
  for (const key of path) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) {
      return false;
    }
    value = value[key];
  }
  return true;
}
function readPath(values, path) {
  return path.reduce((value, key) => value[key], values);
}
function writePath(values, path, value) {
  let target = values;
  path.slice(0, -1).forEach((key) => {
    target = target[key] ??= {};
  });
  target[path.at(-1)] = value;
}
function deletePath(values, path) {
  if (hasPath(values, path)) {
    const parent = readPath(values, path.slice(0, -1));
    delete parent[path.at(-1)];
  }
}
function fieldsSchema(definitions, path = []) {
  return definitions.map((definition) => {
    const address = [...path, definition.name];
    if (definition.type === 'group') {
      return { $formkit: 'group', name: definition.name, label: definition.label, children: [{ $el: 'fieldset', children: [
        { $el: 'legend', children: '$label' },
        ...fieldsSchema(definition.children, address)
      ] }] };
    }
    return {
      $formkit: definition.type,
      ...definition,
      ...definition.type === 'number' || definition.type === 'range' ? { number: true } : {},
      disabled: definition.attrs?.disabled,
      ...definition.options ? { options: definition.options.map((option) => ({ ...option, attrs: { disabled: option.disabled } })) } : {},
      sectionsSchema: { input: { attrs: { name: address.join('.') } } }
    };
  });
}
var SubmissionError = class extends Error {
  fieldErrors;
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'SubmissionError';
    this.fieldErrors = fieldErrors;
  }
};
function fieldDefault(definition, document) {
  if (definition.value !== void 0) {
    return definition.value;
  }
  if (definition.type === 'checkbox') {
    return false;
  }
  if (definition.type === 'number') {
    return void 0;
  }
  if (definition.type === 'range' || definition.type === 'color') {
    const input = document.createElement('input');
    input.type = definition.type;
    for (const [key, value] of Object.entries(definition.attrs ?? {})) {
      if (value !== false) {
        input.setAttribute(key, value === true ? '' : String(value));
      }
    }
    input.value = '';
    return definition.type === 'range' ? input.valueAsNumber : input.value;
  }
  return '';
}
function defaults(definitions, document) {
  return Object.fromEntries(definitions.map((definition) => [definition.name, definition.type === 'group' ? defaults(definition.children, document) : fieldDefault(definition, document)]));
}
function mergeValues(base, supplied) {
  return Object.fromEntries(Object.entries({ ...base, ...supplied }).map(([name, value]) => [
    name,
    isPojo3(base[name]) && isPojo3(supplied[name]) ? mergeValues(base[name], supplied[name]) : value
  ]));
}
function guardedValidation(baseRules, evaluating) {
  return (node) => {
    let alive = true;
    const wrapped = /* @__PURE__ */ new WeakMap();
    const receipt = node.on('destroying', () => {
      alive = false;
      node.off(receipt);
    });
    function guard(rule) {
      if (wrapped.has(rule)) {
        return wrapped.get(rule);
      }
      let invocation = 0;
      const invoke = (...args) => {
        const current = ++invocation;
        const run = () => {
          if (!node.props.ignore) {
            evaluating();
          }
          const result = rule(...args);
          if (!(result instanceof Promise)) {
            return result;
          }
          const value = cloneAny3(node.value);
          const values = cloneAny3(node.root.value);
          if (node.parent && !node.isCreated) {
            const path = node.address.slice(1).map(String);
            if (!hasPath(values, path)) {
              writePath(values, path, value);
            }
          }
          const active3 = () => alive && node.context !== null && current === invocation && !isKilled(args[0]);
          const changed = () => !sameValues(value, node.value) || !sameValues(values, node.root.value);
          return result.then((accepted) => active3() && changed() ? run() : accepted, (error2) => {
            if (active3()) {
              if (changed()) {
                return run();
              }
              node.emit('validation-error', error2);
            }
            return false;
          });
        };
        return run();
      };
      Object.assign(invoke, rule);
      Object.defineProperty(invoke, 'name', { value: rule.name });
      wrapped.set(rule, invoke);
      wrapped.set(invoke, invoke);
      return invoke;
    }
    const map = (validationRules) => Object.fromEntries(Object.entries(validationRules).map(([key, rule]) => [key, guard(rule)]));
    const specification = (value) => Array.isArray(value) ? value.map((entry) => Array.isArray(entry) && typeof entry[0] === 'function' ? [guard(entry[0]), ...entry.slice(1)] : entry) : value;
    node.hook.prop((payload, next) => next(payload.prop === 'validationRules' && payload.value ? { ...payload, value: map(payload.value) } : payload.prop === 'validation' ? { ...payload, value: specification(payload.value) } : payload));
    if (node.props.validationRules) {
      node.props.validationRules = map(node.props.validationRules);
    }
    node.props.validation = specification(node.props.validation);
    createValidationPlugin(map(baseRules))(node);
    let previous = node.props.validationRules;
    const rulesReceipt = node.on('prop:validationRules', ({ payload }) => {
      const changed = previous && payload && Object.keys(previous).length === Object.keys(payload).length && Object.keys(payload).some((key) => previous[key] !== payload[key]);
      previous = payload;
      if (changed) {
        const validation = node.props.validation;
        node.props.validation = void 0;
        node.props.validationRules = {};
        node.props.validationRules = payload;
        node.props.validation = validation;
      }
    });
    const validationReceipt = node.on('prop:validation', () => {
      if (!node.props.parsedRules.length) {
        node.store.remove('validating');
      }
    });
    node.on('destroying', () => {
      node.off(rulesReceipt);
      node.off(validationReceipt);
    });
  };
}
function listValues(node, value, supersede = false) {
  if (node.type === 'list' && Array.isArray(value)) {
    const used = /* @__PURE__ */ new Set();
    const key = node.props.itemKey;
    const identity = (item) => typeof key === 'function' ? key(item) : typeof key === 'string' && item && typeof item === 'object' ? item[key] : void 0;
    return value.map((item) => {
      const id = identity(item);
      const child = node.children.filter(isNode4).find((candidate) => !used.has(candidate) && (id === void 0 ? eq3(candidate.value, item) : Object.is(id, identity(candidate.value))));
      if (!child) {
        return item;
      }
      used.add(child);
      const normalized = listValues(child, item);
      if (supersede) {
        settleWrittenValues(child, normalized);
      }
      if (!eq3(child.value, normalized)) {
        void child.input(normalized, false);
      }
      return child.value;
    });
  }
  if (node.type === 'group' && isPojo3(value)) {
    const result = { ...value };
    node.children.forEach((child) => {
      if (isNode4(child) && Object.hasOwn(result, child.name)) {
        result[String(child.name)] = listValues(child, result[String(child.name)], supersede);
      }
    });
    return result;
  }
  return value;
}
function orderResetLists(node, value) {
  if (node.type === 'list' && Array.isArray(value)) {
    const children = node.children.filter(isNode4), used = /* @__PURE__ */ new Set();
    const key = node.props.itemKey;
    const identity = (item) => typeof key === 'function' ? key(item) : typeof key === 'string' && item && typeof item === 'object' ? item[key] : void 0;
    const matches = value.map((item) => {
      const id = identity(item);
      const child = id === void 0 ? void 0 : children.find((candidate) => !used.has(candidate) && Object.is(id, identity(candidate.value)));
      if (child) {
        used.add(child);
      }
      return child;
    });
    const remaining = children.filter((child) => !used.has(child));
    const ordered = matches.map((child) => child ?? remaining.shift());
    ordered.push(...remaining);
    ordered.forEach((child, index) => {
      if (child && child.index !== index) {
        child.index = index;
      }
    });
    value.forEach((item, index) => {
      const child = matches[index] ?? (identity(item) === void 0 ? ordered[index] : void 0);
      if (child) {
        orderResetLists(child, item);
      }
    });
  } else if (node.type === 'group' && isPojo3(value)) {
    node.children.forEach((child) => {
      if (isNode4(child) && Object.hasOwn(value, child.name)) {
        orderResetLists(child, value[String(child.name)]);
      }
    });
  }
}
function settleWrittenValues(node, supplied) {
  if (node.type === 'group' && isPojo3(supplied)) {
    node.children.forEach((child) => {
      if (isNode4(child) && Object.hasOwn(supplied, child.name)) {
        settleWrittenValues(child, supplied[String(child.name)]);
      }
    });
  } else if (!node.isSettled) {
    void node.input(listValues(node, supplied, true), false);
  }
}
function validateNames(definitions) {
  const names = /* @__PURE__ */ new Set();
  for (const definition of definitions) {
    if (!definition.name || definition.name.includes('.') || names.has(definition.name)) {
      throw new Error('Field names must be non-empty, unique within their group, and contain no dots.');
    }
    names.add(definition.name);
    if (definition.type === 'group') {
      validateNames(definition.children);
    }
  }
}
var FormView = class extends View4 {
  node;
  formOptions;
  receipts = [];
  initial;
  submitted = false;
  disabledBySubmission = false;
  previousDisabled;
  pending;
  disposed = false;
  formCleanup;
  changeSource = 'programmatic';
  nativeInput;
  notifyChanges = true;
  notifyFields = true;
  lastValues;
  schemaRenderer;
  ownedNodes = /* @__PURE__ */ new Set();
  #ownership = new NodeOwnership(this.ownedNodes);
  ownedElements = /* @__PURE__ */ new Set();
  actionDisabled;
  mutationDepth = 0;
  rowBaselines = /* @__PURE__ */ new Map();
  #submissionCallback;
  #submissionRevision = 0;
  #submissionChanged() {
    this.#submissionRevision++;
    this.#submissionCallback?.abort();
  }
  excludeAbsent(values) {
    const excluded = compositions.get(this.node).excluded;
    this.rowBaselines.forEach((entry, key) => {
      if (!resolveRow(values, entry.location)) {
        this.rowBaselines.delete(key);
      }
    });
    excluded.forEach((location, key) => {
      const path = Array.isArray(location) ? location : resolveRow(values, location);
      if (path) {
        deletePath(values, path);
      } else {
        excluded.delete(key);
      }
    });
    return values;
  }
  constructor(options) {
    if ([options.fields, options.schema, options.template].filter((value) => value !== void 0).length !== 1) {
      throw new Error('Provide exactly one of fields, schema, or template.');
    }
    validateNames(options.fields ?? []);
    options.el?.replaceChildren();
    super({ ...options, tagName: 'form', template: options.template ?? (() => '') });
    this.formOptions = options;
    this.initial = mergeValues(defaults(options.fields ?? [], this.el.ownerDocument), options.values ?? {});
    const suppliedFormProps = { ...options.formProps };
    const defaultSubmitAttrs2 = !options.config && !options.inputs && !options.plugins?.length && !options.validationRules && Object.keys(suppliedFormProps).every((key) => ['actions', 'id', 'disabled', 'attrs'].includes(key)) ? { disabled: suppliedFormProps.disabled } : void 0;
    this.node = createNode3({
      type: 'group',
      props: {
        ...suppliedFormProps,
        ...defaultSubmitAttrs2 ? { submitAttrs: defaultSubmitAttrs2 } : {},
        id: String(options.formProps?.id ?? (this.el.id || `${this.cid}-form`)),
        type: 'form',
        attrs: effectTarget({ ...options.formProps?.attrs }),
        submitLabel: options.submitLabel ?? 'Submit',
        resetLabel: options.resetLabel ?? 'Reset'
      },
      value: cloneAny3(this.initial),
      config: { delay: 0, rootClasses: defaultRootClasses, ...options.config },
      plugins: [
        ...runtimePlugins(options),
        (node) => {
          const participates = !node.props.ignore;
          if (participates) {
            this.#submissionChanged();
          }
          this.#ownership.add(node);
          node.hook.input((value, next) => {
            const native = !!this.nativeInput?.deref()?.eventPhase;
            if (native && node.props.disabled) {
              return node._value;
            }
            const proposed = next(value);
            if (native && !sameValues(node._value, proposed)) {
              this.changeSource = 'user';
              this.clearSubmissionErrors();
            }
            if (!sameValues(node._value, proposed)) {
              if (participates) {
                this.#submissionChanged();
              }
              inputSources.set(node, this.changeSource);
              for (let parent = node.parent; parent; parent = parent.parent) {
                inputSources.set(parent, this.changeSource);
              }
            }
            return proposed;
          });
          const constraints = node.on('prop', ({ payload: { prop } }) => {
            if (participates && (prop === 'validation' || prop === 'validationRules')) {
              this.#submissionChanged();
            }
          });
          const receipts = ['destroying', 'destroyed'].map((event) => node.on(event, () => {
            if (participates && event === 'destroying') {
              this.#submissionChanged();
            }
            this.#ownership.delete(node);
            node.off(constraints);
            receipts.forEach((receipt) => node.off(receipt));
          }));
        },
        createI18nPlugin({ en }),
        guardedValidation({ ...rules, ...options.validationRules }, () => this.#submissionChanged()),
        ...options.plugins ?? []
      ]
    });
    ownNodeResource(this.node);
    if (defaultSubmitAttrs2) {
      certifyDefaultSubmitAttrs(this.node, defaultSubmitAttrs2);
    }
    this.node.hook.prop((payload, next) => {
      if (payload.prop === 'disabled' && this.disabledBySubmission) {
        this.previousDisabled = payload.value;
      }
      return next(payload);
    });
    compositions.set(this.node, {
      options,
      fields: /* @__PURE__ */ new Set(),
      excluded: /* @__PURE__ */ new Map(),
      captureNativeEvents: (element) => {
        this.ownedElements.add(element);
        const native = (event) => {
          this.nativeInput = new WeakRef(event);
        };
        const events = ['input', 'change', 'blur'];
        events.forEach((name) => element.addEventListener(name, native, true));
        return () => {
          this.ownedElements.delete(element);
          events.forEach((name) => element.removeEventListener(name, native, true));
        };
      },
      mutate: (operation) => {
        const previous = this.lastValues, notify = this.notifyChanges, notifyFields = this.notifyFields, source = this.changeSource;
        this.notifyChanges = false;
        this.notifyFields = false;
        const committed = !sameValues(previous, this.node.value);
        this.mutationDepth++;
        try {
          operation();
        } finally {
          this.mutationDepth--;
          this.lastValues = previous;
          this.notifyChanges = notify;
          this.notifyFields = notifyFields;
          this.changeSource = source === 'user' && !committed && !this.hasPendingUserInput() ? 'programmatic' : source;
        }
        if (!this.mutationDepth) {
          queueMicrotask(() => {
            if (!this.disposed) {
              this.refresh();
            }
          });
        }
      },
      notify: () => this.notifyFields,
      write: (node, value, updateOptions) => this.updateValues(() => {
        let supplied = cloneAny3(value);
        if (node.root === this.node) {
          const path = node.address.slice(1).map(String);
          const snapshot2 = this.getValues();
          writePath(snapshot2, path, supplied);
          this.excludeAbsent(snapshot2);
          supplied = readPath(snapshot2, path);
        }
        settleWrittenValues(node, supplied);
        void node.input(listValues(node, supplied), false);
      }, updateOptions),
      baseline: (location, value) => {
        let baseline = this.initial;
        let path;
        if (Array.isArray(location)) {
          path = location;
        } else {
          const original = resolveRow(this.initial, location);
          if (original) {
            path = original;
          } else {
            const key = rowLocationKey(location);
            if (!this.rowBaselines.has(key)) {
              this.rowBaselines.set(key, { location, values: {} });
            }
            baseline = this.rowBaselines.get(key).values;
            path = location.suffix;
          }
        }
        if (!hasPath(baseline, path)) {
          writePath(baseline, path, cloneAny3(value));
        }
        return readPath(baseline, path);
      }
    });
    connectRows(this.node, {
      mutate: (operation) => compositions.get(this.node).mutate(operation),
      forget: (location) => {
        this.rowBaselines.forEach((entry, key) => {
          if (isRowWithin(entry.location, location)) {
            this.rowBaselines.delete(key);
          }
        });
        const excluded = compositions.get(this.node)?.excluded;
        excluded?.forEach((path, key) => {
          if (!Array.isArray(path) && isRowWithin(path, location)) {
            excluded.delete(key);
          }
        });
      }
    });
    this.receipts = ['commit', 'message-added.deep', 'message-updated.deep', 'message-removed.deep'].map((event) => this.node.on(event, ({ payload }) => {
      if ((event === 'message-added.deep' || event === 'message-updated.deep') && payload.key === 'validating' && payload.value) {
        this.#submissionChanged();
      }
      this.refresh();
    }));
    this.receipts.push(this.node.on('settled', ({ payload }) => {
      if (payload && this.notifyChanges && this.changeSource === 'user') {
        this.changeSource = 'programmatic';
      }
    }));
    this.on('before:destroy', () => this.#dispose());
  }
  render() {
    if (this.isDestroyed()) {
      return this;
    }
    if (!this.isRendered()) {
      this.notifyChanges = false;
      this.notifyFields = false;
      super.render();
      this.notifyChanges = true;
      this.notifyFields = true;
      this.lastValues = void 0;
    }
    this.refresh();
    return this;
  }
  attachElContent(html) {
    const form = this.el;
    form.replaceChildren();
    form.id = this.node.props.id;
    form.noValidate = true;
    const releaseNative = compositions.get(this.node).captureNativeEvents(form);
    const submit = (event) => {
      event.preventDefault();
      void this.submit(event);
    };
    const reset = (event) => {
      event.preventDefault();
      this.resetForm();
    };
    form.addEventListener('submit', submit);
    form.addEventListener('reset', reset);
    this.formCleanup = () => {
      releaseNative();
      form.removeEventListener('submit', submit);
      form.removeEventListener('reset', reset);
      this.nativeInput = void 0;
    };
    if (this.formOptions.template !== void 0) {
      super.attachElContent(html);
    } else {
      this.node.context.handlers.submit = (event) => event.preventDefault();
      const schema = this.formOptions.schema ?? fieldsSchema(this.formOptions.fields);
      this.schemaRenderer = mountFormSchema(form, this.node, { ...this.formOptions, schema });
      this.initial = cloneAny3(this.node.value);
    }
    queueMicrotask(() => {
      if (!this.disposed) {
        this.node.emit('mounted');
      }
    });
  }
  getValues() {
    return cloneAny3(this.node.value);
  }
  setValues(values, options = {}) {
    if (this.disposed) {
      return this;
    }
    const supplied = cloneAny3(values);
    const candidate = mergeValues(this.node.value, supplied);
    this.updateValues(() => {
      const merged = this.excludeAbsent(candidate);
      settleWrittenValues(this.node, supplied);
      if (!sameValues(this.node.value, merged)) {
        void this.node.input(listValues(this.node, merged), false);
      }
    }, options);
    return this;
  }
  updateValues(operation, options) {
    const previous = this.lastValues, notify = this.notifyChanges, fields = this.notifyFields, source = this.changeSource;
    this.notifyChanges = false;
    this.notifyFields = options.notify ?? true;
    this.changeSource = options.source ?? 'programmatic';
    try {
      this.mutationDepth++;
      try {
        operation();
        this.schemaRenderer?.update();
      } finally {
        this.mutationDepth--;
      }
      this.lastValues = previous;
      this.notifyChanges = options.notify ?? true;
      this.changeSource = options.source ?? 'programmatic';
      this.refresh();
    } finally {
      this.notifyChanges = notify;
      this.notifyFields = fields;
      this.changeSource = source === 'user' && !this.hasPendingUserInput() ? 'programmatic' : source;
    }
  }
  hasPendingUserInput() {
    return [...this.ownedNodes].some((node) => node.type === 'input' && inputSources.get(node) === 'user' && !sameValues(node.value, node._value));
  }
  getFormState() {
    return {
      submitted: this.submitted,
      submitting: !!this.pending,
      valid: this.node.ledger.value('blocking') === 0,
      errors: this.node.store.reduce((errors, message) => {
        if (message.type === 'error') {
          errors.push(String(message.value));
        }
        return errors;
      }, [])
    };
  }
  setSchemaData(data) {
    if (!this.disposed) {
      this.formOptions.schemaData = data;
      this.schemaRenderer?.update(data);
    }
    return this;
  }
  setSchema(schema) {
    if (!this.disposed) {
      this.formOptions.schema = schema;
      this.schemaRenderer?.setSchema(schema);
    }
    return this;
  }
  setErrors(errors = [], fieldErrors = {}) {
    if (this.disposed) {
      return;
    }
    this.node.clearErrors();
    this.node.setErrors(errors, fieldErrors);
    this.refresh();
    this.schemaRenderer?.update();
  }
  clearSubmissionErrors() {
    if (!undefine3(this.node.props.preserveErrors)) {
      this.node.store.filter((message) => message.meta.autoClear !== true, 'error');
    }
  }
  refresh() {
    if (this.mutationDepth) {
      return;
    }
    this.#ownership.refresh();
    if (this.disposed) {
      return;
    }
    {
      const autoDisable = this.pending && this.node.props.submitBehavior !== 'live';
      if (autoDisable && !this.disabledBySubmission) {
        this.previousDisabled = this.node.props.disabled;
        this.node.props.disabled = true;
        this.disabledBySubmission = true;
      } else if (!autoDisable && this.disabledBySubmission) {
        this.disabledBySubmission = false;
        this.node.props.disabled = this.previousDisabled;
      }
      this.el.setAttribute('aria-busy', String(!!this.pending));
      if (!!this.node.store.loading !== !!this.pending) {
        if (this.pending) {
          this.node.store.set(createMessage2({ key: 'loading', visible: false, value: true }));
        } else {
          this.node.store.remove('loading');
        }
      }
    }
    compositions.get(this.node)?.fields.forEach((field) => field.update());
    const state = this.getFormState();
    if (this.pending || this.actionDisabled) {
      this.actionDisabled ??= /* @__PURE__ */ new WeakMap();
      for (const button of this.el.querySelectorAll('button[type="submit"], button[type="reset"]')) {
        if (this.pending) {
          if (!this.actionDisabled.has(button)) {
            this.actionDisabled.set(button, button.disabled);
          }
          button.disabled = true;
        } else if (this.actionDisabled.has(button)) {
          button.disabled = this.actionDisabled.get(button);
          this.actionDisabled.delete(button);
        }
      }
    }
    const values = this.getValues();
    if (!sameValues(this.lastValues, values)) {
      this.lastValues = cloneAny3(values);
      if (this.notifyChanges) {
        const source = this.changeSource;
        this.changeSource = 'programmatic';
        this.triggerMethod('form:change', values, state, { source });
      }
    }
    this.triggerMethod('form:state', state);
  }
  waitForValue(node, signal) {
    if (node.isSettled) {
      return node.settled;
    }
    let receipt;
    let release;
    const removed = new Promise((resolve) => {
      release = () => resolve();
      receipt = node.on('destroying', release);
      signal.addEventListener('abort', release, { once: true });
    });
    return Promise.race([node.settled, removed]).finally(() => {
      node.off(receipt);
      signal.removeEventListener('abort', release);
    });
  }
  // Subclasses that own asynchronous field placement settle it at the same
  // validation boundary as native edits, including edits made during validation.
  settleSubmission() {
  }
  // Keep notification intent with a queued prototype placement operation rather
  // than holding a global silent flag across awaits and unrelated native edits.
  compositionUpdateOptions(origin = this.node) {
    return {
      notify: this.notifyFields,
      source: this.changeSource === 'programmatic' ? inputSources.get(origin) ?? this.changeSource : this.changeSource
    };
  }
  updateComposition(operation, options) {
    this.updateValues(operation, options);
  }
  // Prototype placement owners know absent paths before a FieldView exists.
  // Commit an actual child-value removal without hydrating an entire root copy.
  clearAbsentField(path) {
    if (this.node.at([...path])) {
      throw new Error('Cannot clear an absent field while its node is mounted.');
    }
    const parent = path.length === 1 ? this.node : this.node.at(path.slice(0, -1));
    if (!parent || parent.type !== 'group') {
      throw new Error('Absent field removal requires a live group parent.');
    }
    compositions.get(this.node).excluded.set(path.join('.'), path);
    if (Object.hasOwn(parent.value, path.at(-1))) {
      parent.disturb();
      parent.calm({ name: path.at(-1), value: valueRemoved3 });
    }
  }
  async submit(event) {
    if (this.disposed) {
      return 'cancelled';
    }
    if (this.pending) {
      return 'busy';
    }
    this.render();
    const focused = this.el.ownerDocument.activeElement;
    const ownedFocus = focused && this.el.contains(focused);
    const pending = new AbortController();
    this.pending = pending;
    this.submitted = true;
    {
      const submitted = (node) => node.store.set(createMessage2({ key: 'submitted', visible: false, value: true }));
      submitted(this.node);
      this.node.walk(submitted);
    }
    this.node.clearErrors();
    this.refresh();
    const cancelled = new Promise((resolve) => {
      pending.signal.addEventListener('abort', () => resolve('cancelled'), { once: true });
    });
    const complete = async() => {
      let raw = false;
      do {
        const revision = this.#submissionRevision;
        await Promise.all([...this.ownedNodes].filter((node) => node.root === this.node).map((node) => this.waitForValue(node, pending.signal)));
        if (pending.signal.aborted) {
          return 'cancelled';
        }
        await this.node.ledger.settled('validating');
        if (pending.signal.aborted) {
          return 'cancelled';
        }
        await this.settleSubmission();
        if (pending.signal.aborted) {
          return 'cancelled';
        }
        if (!raw) {
          raw = true;
          this.node.emit('submit-raw');
          this.node.props.onSubmitRaw?.(event, this.node);
        }
        if (revision !== this.#submissionRevision) {
          continue;
        }
        if (![...this.ownedNodes].some((node) => node.root === this.node && !node.isSettled)) {
          break;
        }
      } while (!pending.signal.aborted);
      if (pending.signal.aborted) {
        return 'cancelled';
      }
      if (!this.getFormState().valid) {
        this.node.props.onSubmitInvalid?.(this.node);
        if (this.node.props.incompleteMessage !== false) {
          this.node.store.set(createMessage2({
            key: 'incomplete',
            type: 'ui',
            blocking: false,
            value: this.node.props.incompleteMessage ?? 'Form incomplete.',
            meta: { localize: this.node.props.incompleteMessage === void 0, i18nArgs: [{ node: this.node }], showAsMessage: true }
          }));
        }
        this.triggerMethod('submit:invalid', this.getValues());
        return 'invalid';
      }
      try {
        this.#submissionCallback = pending;
        const values = this.node.hook.submit.dispatch(this.getValues());
        if (pending.signal.aborted) {
          return 'cancelled';
        }
        const result = await (this.formOptions.submit ? this.formOptions.submit(values, { node: this.node, signal: pending.signal }) : this.node.props.onSubmit?.(values, this.node));
        if (pending.signal.aborted) {
          return 'cancelled';
        }
        this.triggerMethod('submit:success', values, result);
        return 'success';
      } catch (error2) {
        if (pending.signal.aborted) {
          return 'cancelled';
        }
        this.setErrors(
          [error2 instanceof Error ? error2.message : 'Unable to submit.'],
          error2 instanceof SubmissionError ? error2.fieldErrors : {}
        );
        this.triggerMethod('submit:error', error2);
        return 'error';
      }
    };
    try {
      return await Promise.race([complete(), cancelled]);
    } finally {
      if (this.#submissionCallback === pending) {
        this.#submissionCallback = void 0;
      }
      if (this.pending === pending) {
        this.pending = void 0;
        this.refresh();
        this.schemaRenderer?.update();
        const invalid = [...new Set([...this.ownedElements].flatMap((element) => [...element.querySelectorAll('[aria-invalid="true"]')]))].filter((control) => control.isConnected && !control.matches(':disabled, input[type="hidden"]') && !control.closest('[hidden], [inert]')).sort((left, right) => left.compareDocumentPosition(right) & 4 ? -1 : 1);
        const attempted = /* @__PURE__ */ new Set();
        const focusedInvalid = invalid.some((control) => {
          let target = control;
          if (control.matches('input[type="radio"][tabindex]') && control.tabIndex < 0) {
            let scope = control.parentElement;
            while (scope && !this.ownedElements.has(scope) && scope.tagName !== 'FORM' && !scope.hasAttribute('tabindex')) {
              scope = scope.parentElement;
            }
            if (scope && !this.ownedElements.has(scope) && scope.tagName !== 'FORM') {
              const name = control.name;
              const members = [...scope.querySelectorAll('input, select, textarea, button')];
              if (name && members.every((member) => member.matches('input[type="radio"]') && member.name === name)) {
                if (scope.tabIndex < 0) {
                  return false;
                }
                target = scope;
              }
            }
          }
          if (attempted.has(target) || !target.isConnected || target.matches(':disabled') || target.closest('[hidden], [inert]')) {
            return false;
          }
          attempted.add(target);
          target.focus();
          return target.ownerDocument.activeElement === target;
        });
        if (!focusedInvalid && ownedFocus && this.el.ownerDocument.activeElement === this.el.ownerDocument.body) {
          focused.focus({ preventScroll: true });
        }
      }
    }
  }
  resetForm() {
    if (this.disposed) {
      return this;
    }
    this.pending?.abort();
    this.pending = void 0;
    this.submitted = false;
    this.changeSource = 'reset';
    this.mutationDepth++;
    try {
      const values = this.excludeAbsent(cloneAny3(this.initial));
      prepareRowReset(this.node, values);
      orderResetLists(this.node, values);
      resetNode(this.node, values);
    } finally {
      this.mutationDepth--;
    }
    this.node.clearErrors();
    this.refresh();
    this.changeSource = 'programmatic';
    this.schemaRenderer?.update();
    this.triggerMethod('form:reset', this.getValues());
    return this;
  }
  #dispose() {
    this.disposed = true;
    this.formCleanup?.();
    for (const receipt of this.receipts) {
      this.node.off(receipt);
    }
    this.pending?.abort();
    this.pending = void 0;
    const composition = compositions.get(this.node);
    for (const field of [...composition.fields].reverse()) {
      field.release();
    }
    disconnectRows(this.node);
    compositions.delete(this.node);
    this.schemaRenderer?.destroy();
    for (const node of [...this.ownedNodes].reverse()) {
      if (node !== this.node && node.context !== null) {
        node.destroy();
      }
    }
    this.node.destroy();
    this.#ownership.dispose();
    this.receipts = [];
  }
};
var FieldView = class extends View4 {
  fieldOptions;
  mount;
  released = false;
  receipt;
  previous;
  releaseNative;
  constructor(options) {
    super({ ...options, template: () => '' });
    this.fieldOptions = options;
    this.on('before:destroy', () => this.#release());
  }
  get node() {
    if (!this.mount) {
      throw new Error('Render the FieldView before accessing its node.');
    }
    return this.mount.node;
  }
  render() {
    if (this.isDestroyed()) {
      return this;
    }
    if (!compositions.has(this.fieldOptions.form.node)) {
      throw new Error('The FieldView owner has been destroyed.');
    }
    if (!this.isRendered()) {
      super.render();
    }
    return this;
  }
  attachElContent() {
    const { form, input, removal, name } = this.fieldOptions;
    const parent = this.fieldOptions.parent ?? form.node;
    if (parent.context === null || parent.root !== form.node || parent.type !== 'group') {
      throw new Error('Field parent must be a live group owned by its form.');
    }
    const composition = compositions.get(form.node);
    composition.mutate(() => {
      this.mount = ownedInputFactory(parent, composition.options, composition, () => this.destroy())({
        document: this.el.ownerDocument,
        props: {
          ...input,
          name,
          preserve: removal === 'preserve',
          value: input.value,
          id: input.id ?? `${this.cid}-input`
        },
        data: {}
      });
      this.releaseNative = composition.captureNativeEvents(this.el);
      this.el.replaceChildren(this.mount.element);
      this.previous = cloneAny3(this.node.value);
      this.receipt = this.node.on('commit', () => {
        const value = cloneAny3(this.node.value), source = inputSources.get(this.node) ?? 'programmatic';
        const notify = composition.notify();
        inputSources.delete(this.node);
        if (sameValues(value, this.previous)) {
          return;
        }
        this.previous = cloneAny3(value);
        if (notify) {
          queueMicrotask(() => {
            if (!this.released) {
              this.triggerMethod('field:change', value, { source });
            }
          });
        }
      });
    });
  }
  setValue(value, options = {}) {
    if (this.released) {
      return this;
    }
    if (this.node.type !== 'input' || !this.node.isSettled || !sameValues(this.node.value, value)) {
      compositions.get(this.fieldOptions.form.node).write(this.node, value, options);
    }
    return this;
  }
  getValue() {
    return cloneAny3(this.node.value);
  }
  setInput(props) {
    if (this.released) {
      return this;
    }
    if (['type', 'id', 'value', 'name', 'parent', 'preserve', 'plugins', 'config', 'ignore'].some((key) => Object.hasOwn(props, key))) {
      throw new Error('Replace the FieldView to change ownership or input identity; use setValue for values.');
    }
    this.fieldOptions.input = { ...this.fieldOptions.input, ...props };
    const { input, name, removal } = this.fieldOptions;
    this.mount?.update({ ...input, name, preserve: removal === 'preserve', id: input.id ?? `${this.cid}-input` }, {}, void 0);
    return this;
  }
  #release() {
    this.released = true;
    if (!this.mount) {
      return;
    }
    this.releaseNative();
    const composition = compositions.get(this.fieldOptions.form.node);
    composition.mutate(() => {
      this.node.off(this.receipt);
      this.mount.destroy();
    });
  }
};
export {
  FieldView,
  FormView,
  RowView,
  SchemaView,
  SubmissionError,
  createSchemaRenderer,
  createViewComponents
};

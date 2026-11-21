import type { FormKitNode } from '@formkit/core';

type Family = { opaque: Set<OwnedEffect>; deferred: Set<OwnedEffect> };
const owners = new WeakMap<object, FormKitNode>();
const parents = new WeakMap<FormKitNode, FormKitNode | null>();
const families = new WeakMap<FormKitNode, Family>();
const readers = new WeakMap<object, Set<OwnedEffect>>();
const retired = new WeakMap<object, () => void>();
export function effectRetirement(dependency: object, callback: () => void) { retired.set(dependency, callback); }
export function hasEffectReaders(dependency: object) { return !!readers.get(dependency)?.size; }
const unknownMetadata = new WeakSet<FormKitNode>();
const unknownProps = new WeakSet<FormKitNode>();
const propTokens = new WeakMap<FormKitNode, object>();
export function propsMetadata(node: FormKitNode) {
  unknownProps.add(node);
  const token = propTokens.get(node);
  if (token) { readers.get(token)?.forEach(effect => effect.opaque()); }
}
export function readPropsEffect(node: FormKitNode) {
  if (!active) { return; }
  let token = propTokens.get(node);
  if (!token) { token = {}; propTokens.set(node, token); }
  active.read(token);
  if (unknownProps.has(node)) { opaqueEffect(); }
}

const generatedSchemas = new WeakSet<object>();
export function generatedSchema<T>(schema: T): T {
  if (schema && typeof schema === 'object') { generatedSchemas.add(schema); }
  return schema;
}
export function isGeneratedSchema(schema: unknown) { return !!schema && typeof schema === 'object' && generatedSchemas.has(schema); }
export function effectMetadata(node: FormKitNode) {
  unknownMetadata.add(node);
  readers.get(node)?.forEach(effect => { effect.opaque(); effect.invalidate(); });
}
export function resetEffectMetadata(node: FormKitNode) { unknownMetadata.delete(node); }
type Projection = { producer: object; version: number; valid: boolean };
const projectionValues = new WeakMap<object, Projection>();
export function effectProjection<T extends object>(value: T, producer: object, version: number, node: FormKitNode): T {
  const projection = { producer, version, valid: true };
  projectionValues.set(value, projection);
  if (active && !active.unowned && !unknownMetadata.has(node)) { active.projection = projection; }
  return value;
}
export function projectionAlias(target: object, proxy: object) {
  const projection = projectionValues.get(target);
  if (projection) { projectionValues.set(proxy, projection); }
}
export function invalidateProjection(target: object) { const projection = projectionValues.get(target); if (projection) { projection.valid = false; } }
let active: OwnedEffect | undefined;
let activeGraph: EffectGraph | undefined;

export function effectNode(node: FormKitNode, parent: FormKitNode | null) {
  owners.set(node, node);
  parents.set(node, parent);
}
export function effectObject(object: object, node: FormKitNode) { owners.set(object, node); }
export function readEffect(object: unknown, key?: string, indexedName = false) {
  if (!active) { return; }
  const node = object && typeof object === 'object' ? owners.get(object) : undefined;
  if (node) {
    active.read(node);
    if (unknownMetadata.has(node)) { active.opaque(); }
    if (object === node && key === 'name' && indexedName && parents.get(node)) { active.read(parents.get(node)!); }
  } else { active.unowned = true; active.opaque(); }
}
export function opaqueEffect() { active?.opaque(); }
export function changedEffect(node: FormKitNode) {
  readers.get(node)?.forEach(effect => { if (effect !== active) { effect.invalidate(); } });
}
export function untrackedEffect<T>(callback: () => T): T {
  const previous = active;
  active = undefined;
  try { return callback(); } finally { active = previous; }
}

export function bindingEffect() { return active; }
export function notifyEffect(dependency: object) {
  readers.get(dependency)?.forEach(effect => { if (effect !== active) { effect.invalidate(); } });
}

export class OwnedEffect {
  dirty = true;
  alive = true;
  private dependencies = new Map<object, number>();
  private unobserved = 0;
  private values = new Map<string, BindingValue>();
  private evaluation = 0;
  round = 0;
  epoch = 0;
  context?: object;
  unowned = false;
  projection?: Projection;
  constructor(readonly graph: EffectGraph, public callback: () => void) {}
  read(dependency: object) {
    if (!this.alive) { return; }
    const seen = this.dependencies.get(dependency);
    if (seen !== undefined) {
      if (seen !== this.round) { this.dependencies.set(dependency, this.round); this.unobserved--; }
      return;
    }
    this.dependencies.set(dependency, this.round);
    let subscriptions = readers.get(dependency);
    if (!subscriptions) { subscriptions = new Set(); readers.set(dependency, subscriptions); }
    subscriptions.add(this);
  }
  defer() {
    if (!this.alive || this === active) { return; }
    this.dirty = true; this.graph.family.deferred.add(this);
  }
  opaque() { if (this.alive) { this.graph.family.opaque.add(this); this.graph.opaque.add(this); } }
  invalidate() {
    if (!this.alive) { return; }
    this.dirty = true;
    this.graph.enqueue(this);
  }
  nextEvaluation() { return String(this.evaluation++); }
  value(key: string, source: string, scope: object, compute: () => unknown, equal?: (left: unknown, right: unknown) => boolean, fresh = false) {
    let binding = this.values.get(key);
    if (!binding) { binding = new BindingValue(this); this.values.set(key, binding); }
    return binding.get(source, scope, compute, equal, fresh);
  }
  run() {
    if (!this.alive) { return; }
    const round = ++this.round; this.evaluation = 0;
    this.unobserved = this.dependencies.size;
    this.graph.family.opaque.delete(this); this.graph.opaque.delete(this);
    this.dirty = false;
    this.unowned = false; this.projection = undefined; this.epoch = this.graph.epoch;
    this.graph.pending.delete(this);
    const previous = active, previousGraph = activeGraph;
    active = this; activeGraph = this.graph;
    try { this.callback(); } finally {
      active = previous; activeGraph = previousGraph;
      // Every previous dependency was actually read again. There is nothing to
      // retire; skip walking the retained set. A new run owns nested captures.
      if (this.round === round && this.unobserved) { this.detach(round); this.unobserved = 0; }
      for (const [key, binding] of this.values) {
        if (binding.seen !== this.round) { binding.stop(); this.values.delete(key); }
      }
    }
  }
  private detach(round?: number) {
    this.dependencies.forEach((seen, dependency) => {
      if (round !== undefined && seen === round) { return; }
      const subscriptions = readers.get(dependency)!;
      subscriptions.delete(this);
      this.dependencies.delete(dependency);
      if (!subscriptions.size) { retired.get(dependency)?.(); }
    });
  }
  stop() {
    this.alive = false;
    this.values.forEach(binding => binding.stop()); this.values.clear();
    this.detach();
    this.graph.family.opaque.delete(this); this.graph.opaque.delete(this);
    this.graph.pending.delete(this);
    this.graph.family.deferred.delete(this);
    this.graph.effects.delete(this);
  }
}

class BindingValue {
  seen = 0;
  private source?: string;
  private scope?: object;
  private value: unknown;
  private projection?: Projection;
  private pulling = false;
  private effect: OwnedEffect;
  constructor(private owner: OwnedEffect) { this.effect = owner.graph.create(() => {}); }
  get(source: string, scope: object, compute: () => unknown, equal?: (left: unknown, right: unknown) => boolean, fresh = false) {
    this.seen = this.owner.round;
    if (this.source !== source || this.scope !== scope || fresh && this.effect.epoch !== this.effect.graph.epoch) { this.effect.dirty = true; }
    this.source = source; this.scope = scope;
    this.effect.context = scope;
    this.effect.callback = () => {
      const value = compute();
      const projection = value && typeof value === 'object' ? projectionValues.get(value) : undefined;
      const owned = projection && projection === this.effect.projection && !this.effect.unowned;
      const unchangedProjection = owned && projection.valid && this.projection?.valid &&
        projection.producer === this.projection.producer && projection.version === this.projection.version;
      const changed = equal ? !equal(this.value, value) : !unchangedProjection &&
        (!Object.is(value, this.value) || value !== null && typeof value === 'object');
      this.projection = owned ? projection : undefined;
      this.value = value;
      if (changed) {
        readers.get(this)?.forEach(effect => {
          if (effect !== active && !(effect === this.owner && this.pulling)) { effect.invalidate(); }
        });
      }
    };
    if (this.effect.dirty) {
      const previous = this.pulling; this.pulling = true;
      try { this.effect.run(); } finally { this.pulling = previous; }
    }
    active?.read(this);
    return this.value;
  }
  stop() { this.effect.stop(); }
}

export class EffectGraph {
  readonly family: Family;
  epoch = 0;
  readonly pending = new Set<OwnedEffect>();
  readonly opaque = new Set<OwnedEffect>();
  readonly effects = new Set<OwnedEffect>();
  private alive = true;
  private ready = false;
  constructor(data: object, private schedule: () => void) {
    const node = owners.get(data);
    let root = node;
    while (root && parents.get(root)) { root = parents.get(root)!; }
    const family = activeGraph?.family ?? (root && families.get(root)) ?? { opaque: new Set(), deferred: new Set() };
    this.family = family;
    if (root) { families.set(root, family); }
  }
  create(callback: () => void) {
    const effect = new OwnedEffect(this, callback);
    this.effects.add(effect);
    return effect;
  }
  enqueue(effect: OwnedEffect) {
    if (!this.alive) { return; }
    this.pending.add(effect);
    if (this.ready) { this.schedule(); }
  }
  discover(family = false) {
    for (const effect of [...this.family.deferred]) {
      if (family || effect.graph === this) {
        this.family.deferred.delete(effect);
        if (effect.graph === this) { effect.dirty = true; this.pending.add(effect); } else { effect.invalidate(); }
      }
    }
    (family ? this.family.opaque : this.opaque).forEach(effect => {
      if (this.family.opaque.has(effect)) {
        if (effect.graph === this) { effect.dirty = true; this.pending.add(effect); } else { effect.invalidate(); }
      }
    });
  }
  activate() { this.ready = true; if (this.pending.size) { this.schedule(); } }
  begin() { this.epoch++; }
  flush(current: () => boolean) {
    // Drain bounded snapshots so a changed computed value can apply its target
    // in the same pass. New structural ownership still interrupts the old pass.
    while (this.pending.size) {
      for (const effect of [...this.pending]) {
        if (!current()) { return; }
        if (effect.dirty) { effect.run(); } else { this.pending.delete(effect); }
      }
    }
  }
  stop() {
    this.alive = false;
    [...this.effects].forEach(effect => effect.stop());
  }
}

type NativeProjection = (props: Record<string, unknown>, data: Record<string, unknown>, children: unknown, force: boolean) => void;
const projections = new WeakMap<object, NativeProjection>();
export function projectNative(component: object, projection: NativeProjection) { projections.set(component, projection); }
export function updateNative(component: object, props: Record<string, unknown>, data: Record<string, unknown>, children: unknown, force: boolean) {
  const project = projections.get(component);
  if (!project) { return false; }
  project(props, data, children, force);
  return true;
}

const targets = new WeakSet<object>();
export function isEffectTarget(value: unknown) { return !!value && typeof value === 'object' && targets.has(value); }
export function effectTarget<T extends object>(target: T): T {
  let opaque = false;
  const changed = () => { readers.get(proxy)?.forEach(effect => effect.defer()); };
  const metadata = () => {
    opaque = true;
    readers.get(proxy)?.forEach(effect => effect.opaque());
    changed();
  };
  const read = () => { active?.read(proxy); if (opaque) { opaqueEffect(); } };
  const proxy = new Proxy(target, {
    get(object, key, receiver) { read(); return Reflect.get(object, key, receiver); },
    ownKeys(object) { read(); return Reflect.ownKeys(object); },
    set(object, key, value, receiver) {
      const previous = Reflect.get(object, key);
      const result = Reflect.set(object, key, value, receiver);
      if (result && !Object.is(previous, value)) { changed(); }
      return result;
    },
    deleteProperty(object, key) {
      const present = Object.hasOwn(object, key);
      const result = Reflect.deleteProperty(object, key);
      if (present && result) { changed(); }
      return result;
    },
    defineProperty(object, key, descriptor) {
      const result = Reflect.defineProperty(object, key, descriptor);
      if (result) { if (descriptor.get || descriptor.set) { metadata(); } else { changed(); } }
      return result;
    },
    setPrototypeOf(object, prototype) {
      const result = Reflect.setPrototypeOf(object, prototype);
      if (result) { metadata(); }
      return result;
    }
  });
  targets.add(proxy);
  return proxy;
}

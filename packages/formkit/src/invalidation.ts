import { kebab } from '@formkit/utils';
import type { FormKitNode, FormKitPlugin } from '@formkit/core';

type Scope = Record<string, unknown>;
type Role = 'context' | 'state' | 'handlers' | 'functions' | 'slots' | 'attrs' | 'classes' | 'messages' | 'message' | 'iteration';
type Owner = { node: FormKitNode; props: FormKitNode['props']; config: FormKitNode['config']; configParent: FormKitNode | null; epoch: number; hook: FormKitNode['hook']; opaque: boolean;
  context?: object; nativeGetters?: Record<string, PropertyDescriptor>; getters: Set<Function>; length?: Function };
type Capture = { owner: Owner; epoch: number; opaque: boolean; checks: (() => boolean)[] };
const owners = new WeakMap<FormKitNode, Owner>();
const metadataProofs = new WeakMap<Owner, { epoch: number; valid: boolean }>();
const objects = new WeakMap<object, { owner: Owner; role: Role }>();
const proxyTargets = new WeakMap<object, object>();
const captures = new WeakMap<object, Capture>();
let active: Capture | undefined;
let guardDescriptors: WeakMap<object, PropertyDescriptorMap> | undefined;
let configProofs: WeakMap<object, boolean> | undefined;
export function guardPass<T>(check: () => T): T {
  const previous = guardDescriptors, previousConfig = configProofs;
  guardDescriptors = new WeakMap(); configProofs = new WeakMap();
  try { return check(); } finally { guardDescriptors = previous; configProofs = previousConfig; }
}
function descriptors(object: object) {
  const known = guardDescriptors?.get(object);
  if (known) { return known; }
  const result = Object.getOwnPropertyDescriptors(object);
  guardDescriptors?.set(object, result);
  return result;
}


export const defaultRootClasses = (section: string) => ({ [`formkit-${kebab(section)}`]: true });

// Library discovery precedes definition features. Observe class-hook registration
// before any feature can install behavior with dependencies outside this context.
export const nativeInvalidation: FormKitPlugin = () => {};
nativeInvalidation.library = node => {
  if (owners.has(node)) { return; }
  const original = node.hook;
  node.props = new Proxy(node.props, {
    defineProperty(target, key, descriptor) {
      const success = Reflect.defineProperty(target, key, descriptor);
      contextChanged(node);
      return success;
    },
    deleteProperty(target, key) {
      const success = Reflect.deleteProperty(target, key);
      contextChanged(node);
      return success;
    }
  });
  const owner: Owner = { node, props: node.props, config: node.config, configParent: node.parent,
    epoch: 0, hook: original, opaque: false, getters: new Set() };
  let attrsAssignments = 0, attrsOriginal: unknown, attrsPassed = true;
  original.prop((payload, next) => {
    if (payload.prop !== 'attrs') { return next(payload); }
    attrsAssignments++;
    const value = payload.value, result = next(payload);
    attrsPassed = attrsPassed && result.prop === 'attrs' && result.value === value;
    attrsOriginal = value;
    return result;
  });
  function watch(dispatcher: typeof original.classes, native = false) {
    const changed = () => { owner.opaque = true; };
    const unshift = (...args: Parameters<typeof dispatcher.unshift>) => { changed(); return dispatcher.unshift(...args); };
    return new Proxy(dispatcher, {
      apply(target, receiver, args) { if (!native) { changed(); } return Reflect.apply(target, receiver, args); },
      get(target, key, receiver) { return key === 'unshift' ? unshift : Reflect.get(target, key, receiver); },
      defineProperty(target, key, descriptor) { owner.opaque = true; return Reflect.defineProperty(target, key, descriptor); }
    });
  }
  const initialClasses = original.classes, initialProps = original.prop;
  const classes = watch(initialClasses), props = watch(initialProps as unknown as typeof original.classes, true);
  owner.hook = new Proxy(original, {
    get(target, key, receiver) { return key === 'classes' ? classes : key === 'prop' ? props : Reflect.get(target, key, receiver); }
  });
  node.hook = owner.hook;
  owners.set(node, owner);
  // Core creates a fresh attrs object when it promotes definition props.
  const createdAttrs = node.on('added-props', () => {
    const attrs = Object.getOwnPropertyDescriptor(node.props, 'attrs');
    if (!owner.opaque && attrsAssignments === 1 && attrsPassed && attrs && 'value' in attrs && attrs.value === attrsOriginal) { contextObject(node, attrs.value, 'attrs'); }
    attrsAssignments = 0; attrsOriginal = undefined; attrsPassed = true;
  });
  node.on('destroying', () => { node.off(createdAttrs); });
};

export function contextChanged(node: FormKitNode) { const owner = owners.get(node); if (owner) { owner.epoch++; } }
export function contextObject<T>(node: FormKitNode, value: T, role: Role): T {
  const owner = owners.get(node);
  if (owner && value && typeof value === 'object') {
    const entry = { owner, role };
    objects.set(value, entry);
    const target = proxyTargets.get(value); if (target) { objects.set(target, entry); }
  }
  return value;
}
export function contextProxy(target: object, proxy: object) {
  proxyTargets.set(proxy, target);
  const entry = objects.get(target); if (entry) { objects.set(proxy, entry); }
}
export function certifyContext(node: FormKitNode, context: Scope) {
  const owner = owners.get(node); if (!owner) { return; }
  owner.context = context;
  owner.nativeGetters = Object.getOwnPropertyDescriptors(context);
  contextObject(node, context, 'context');
  for (const [key, role] of [['state', 'state'], ['handlers', 'handlers'], ['fns', 'functions']] as const) {
    contextObject(node, context[key], role);
  }
  for (const object of [context, context.state]) {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(object))) {
      if (descriptor.get) { owner.getters.add(descriptor.get); }
    }
  }
  owner.length = (context.fns as Scope).length as Function;
}
export function opaqueRender() { if (active) { active.opaque = true; } }
export function iterationScope(scope: object, collection: unknown) {
  if (collection && typeof collection === 'object') {
    const entry = objects.get(collection);
    if (entry?.role === 'messages') { objects.set(scope, { owner: entry.owner, role: 'iteration' }); }
  }
}
function scalar(value: unknown) { return value === null || !['object', 'function'].includes(typeof value); }
function snapshot(object: object): (() => boolean) | undefined {
  const before = Object.getOwnPropertyDescriptors(object), keys = Object.keys(before);
  if (keys.some(key => !('value' in before[key]) || !scalar(before[key].value) && typeof before[key].value !== 'function')) { return; }
  return () => {
    const after = descriptors(object);
    return keys.length === Object.keys(after).length && keys.every(key =>
      after[key] && 'value' in after[key] && Object.is(before[key].value, after[key].value));
  };
}
export function contextRead(receiver: unknown, key: string, value: unknown) {
  if (!active || active.opaque) { return; }
  const { owner } = active;
  if (receiver === owner.node && key === 'name') { active.checks.push(() => Object.is(owner.node.name, value)); return; }
  const entry = objects.get(receiver as object);
  if (!entry || entry.owner !== owner) { active.opaque = true; return; }
  const descriptor = Object.getOwnPropertyDescriptor(receiver as object, key);
  if (!descriptor && entry.role !== 'classes' &&
    (![Object.prototype, null].includes(Object.getPrototypeOf(receiver)) || Object.hasOwn(Object.prototype, key))) { active.opaque = true; return; }
  if (descriptor?.get && !owner.getters.has(descriptor.get)) { active.opaque = true; return; }
  if (entry.role === 'functions' && key === 'length' && value !== owner.length) { active.opaque = true; }
  if (value && typeof value === 'object') {
    const child = objects.get(value);
    if (value !== owner.node && (!child || child.owner !== owner)) { active.opaque = true; return; }
    if (child?.role === 'attrs' || child?.role === 'slots') {
      const check = snapshot(value);
      if (check) { active.checks.push(check); } else { active.opaque = true; }
    }
  }
}
export function expressionCalls(expression: string) {
  if (!active) { return; }
  // Function-valued event bindings are not executions. Unknown executed functions
  // retain the full path, including registry lookup and application callbacks.
  const calls = expression.matchAll(/\$([A-Za-z0-9_.]+)\s*\(/g);
  for (const [, path] of calls) {
    if (path !== 'fns.length') { active.opaque = true; }
  }
}
export function captureRender(renderer: object, data: Scope, render: () => void) {
  const entry = objects.get(data), previous = active;
  const capture = entry?.role === 'context' ? { owner: entry.owner, epoch: entry.owner.epoch,
    opaque: false, checks: [] } as Capture : undefined;
  captures.delete(renderer);
  active = capture;
  try {
    render();
    if (capture && capture.epoch === capture.owner.epoch) { captures.set(renderer, capture); }
  } finally { active = previous; }
}
function dataProperties(object: object) {
  if (![Object.prototype, null].includes(Object.getPrototypeOf(object))) { return; }
  return ownDataProperties(object);
}
function ownDataProperties(object: object) {
  const fields = descriptors(object);
  return Object.values(fields).every(descriptor => 'value' in descriptor) ? fields : undefined;
}
function plainClasses(fields: PropertyDescriptorMap) {
  return Object.keys(fields).every(key => !key.endsWith('Class') || fields[key].value === undefined);
}
function configuredPlain(config: object) {
  const previous = configProofs?.get(config);
  if (previous !== undefined) { return previous; }
  const fields = dataProperties(config);
  const valid = !!fields && fields.rootConfig?.value === undefined && plainClasses(fields);
  configProofs?.set(config, valid);
  return valid;
}
function independentOwner(owner: Owner) {
  const node = owner.node;
  if (owner.opaque || node.context !== owner.context || node.props !== owner.props || node.hook !== owner.hook) { return false; }
  // Core props fall back through ancestor configuration. Prove these containers
  // before reading class/visibility values; unknown rootConfig remains dynamic.
  for (let current: FormKitNode | null = node; current;) {
    const configured = owners.get(current);
    if (!configured || current.config !== configured.config) { return false; }
    if (!configuredPlain(configured.config)) { return false; }
    // Ignored controls detach from values while retaining Core's configuration
    // closure. A later resetConfig changes identity and takes the full path.
    current = configured.configParent;
  }
  if (node.config.rootClasses !== defaultRootClasses || node.config.classes) { return false; }
  const functions = owner.context && Object.getOwnPropertyDescriptor(owner.context, 'fns');
  if (!functions || !('value' in functions) || !ownedObject(node, functions.value) ||
    Object.getOwnPropertyDescriptor(functions.value, 'length')?.value !== owner.length) { return false; }
  const prior = metadataProofs.get(owner);
  if (prior?.epoch === owner.epoch) { return prior.valid; }
  const epoch = owner.epoch;
  const valid = proveMetadata(owner);
  metadataProofs.set(owner, { epoch, valid });
  return valid;
}
function proveMetadata(owner: Owner) {
  const node = owner.node;
  // Array declarations contain only property names. Object declarations can run
  // Core property getters with dependencies outside the native context.
  // Core reads own props, then configuration/defaults; it ignores the props
  // object's prototype. Context and configuration have different lookup rules.
  const properties = ownDataProperties(owner.props);
  if (!properties || !Array.isArray(properties.__propDefs?.value) || !plainClasses(properties)) { return false; }
  if (!owner.context || ![Object.prototype, null].includes(Object.getPrototypeOf(owner.context))) { return false; }
  const fields = descriptors(owner.context);
  if (Object.values(fields).some(field => field.get && !owner.getters.has(field.get))) { return false; }
  for (const key of ['state', 'handlers', 'fns']) {
    const field = fields[key];
    if (!field || !('value' in field) || !ownedObject(node, field.value)) { return false; }
  }
  const state = fields.state.value;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(state)) ||
    Object.values(descriptors(state)).some(field => field.get && !owner.getters.has(field.get))) { return false; }
  return true;
}

export function ownedObject(node: FormKitNode, object: unknown): object is object {
  const owner = owners.get(node);
  return !!owner && !!object && typeof object === 'object' && objects.get(proxyTargets.get(object) ?? object)?.owner === owner;
}
export function independentRoot(node: FormKitNode) {
  const owner = owners.get(node);
  return !!owner && independentOwner(owner) &&
    ['messages', 'classes'].every(key => descriptors(owner.context!)[key]?.get === owner.nativeGetters?.[key]?.get);
}
export function unchangedObject(node: FormKitNode, object: unknown) {
  const unchanged = independentRoot(node) && ownedObject(node, object) ? snapshot(object) : undefined;
  return unchanged ?? (() => false);
}
export function canReuseRender(renderer: object, node: FormKitNode, pending = false) {
  const capture = captures.get(renderer);
  if (!capture || capture.opaque || capture.owner.node !== node || !pending && capture.epoch !== capture.owner.epoch) { return false; }
  const { owner } = capture;
  if (!independentOwner(owner)) { return false; }
  return capture.checks.every(check => check());
}
export function renderCapture(renderer: object) { return captures.get(renderer); }
export function releaseCapture(renderer: object) { captures.delete(renderer); }

const automaticRequests = new WeakSet<object>();
const automaticScopes = new WeakSet<object>();
export function automaticUpdate(renderer: { update(data: Scope): void }, data: Scope) {
  automaticRequests.add(renderer);
  try { renderer.update(data); } finally { automaticRequests.delete(renderer); }
}
export function takeAutomatic(renderer: object) { const automatic = automaticRequests.has(renderer); automaticRequests.delete(renderer); return automatic; }
export function automaticScope(scope: object, automatic: boolean) { if (automatic) { automaticScopes.add(scope); } else { automaticScopes.delete(scope); } }
export function isAutomaticScope(scope: object) { return automaticScopes.has(scope); }

const renderHints = new WeakMap<FormKitNode, boolean>();
export function withRenderHint(node: FormKitNode, needed: boolean, emit: () => void) {
  const previous = renderHints.get(node);
  renderHints.set(node, needed);
  try { emit(); } finally { if (previous === undefined) { renderHints.delete(node); } else { renderHints.set(node, previous); } }
}
export function contextNeedsRender(node: FormKitNode) {
  const needed = renderHints.get(node) !== false;
  // A listener can emit a nested public update before this observer runs. Only
  // one event may use the hint; another event must force the queued projection.
  renderHints.delete(node);
  return needed;
}

const initialComponents = new WeakSet<object>();
export function markInitialComponent(component: object) { initialComponents.add(component); }
export function takeInitialComponent(component: object) { const initial = initialComponents.has(component); initialComponents.delete(component); return initial; }

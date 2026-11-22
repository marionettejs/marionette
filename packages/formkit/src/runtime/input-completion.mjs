// Pinned FormKit Core 2.5.0 integration. The context timer assignment is the
// scheduling boundary. Dispatcher entry captures its executing generation before
// public middleware runs. Never replace, cancel or estimate a timer.
const states = new WeakMap();

function markForeign(node, owner) {
  states.set(node, { state: { foreign: true, listeners: new Set() } });
  // A fresh inherited producer whose features already ran must be visible to
  // its owner so the fence rejects rather than silently omitting its work.
  if (owner && !node.isCreated) {
    let release = () => {};
    const receipt = node.on('destroying', () => { release(); node.off(receipt); });
    release = owner.add(node);
  }
}

function install(node, completionScope) {
  if (states.has(node)) { return; }
  const context = node._c, originalTimer = Object.getOwnPropertyDescriptor(context, '_tmo');
  const state = { pending: false, depth: 0, dead: false, foreign: !!node.isCreated || context.plugins.size > 0 || context._tmo !== false, listeners: new Set() };
  if (state.foreign || originalTimer && !Object.hasOwn(originalTimer, 'value')) {
    markForeign(node, completionScope); return;
  }
  let releaseOwner = () => {};
  const notify = () => { for (const listener of state.listeners) { listener(); } };
  let timer = context._tmo;
  const getTimer = () => timer;
  const setTimer = value => { timer = value; state.pending = Symbol('Core input timer'); notify(); };
  Object.defineProperty(context, '_tmo', { configurable: true, enumerable: true, get: getTimer, set: setTimer });
  const wrappers = new Map();
  for (const name of ['input', 'add', 'calm']) {
    const original = context.traps.get(name);
    const wrapper = { ...original, get(owner, target) {
      const invoke = original.get(owner, target);
      return (...args) => {
        state.depth++;
        try { return invoke(...args); } finally { state.depth--; }
      };
    } };
    wrappers.set(name, { original, wrapper }); node.extend(name, wrapper);
  }
  const dispatcher = node.hook.commit, originalDispatch = dispatcher.dispatch;
  function dispatch(...args) {
    // Initialization and synchronous input/add/calm commits do not execute a timer.
    const executing = node.isCreated && !state.depth ? state.pending : false;
    try { return Reflect.apply(originalDispatch, this, args); } finally {
      // Middleware can schedule/cancel/replace work before or after calling next.
      // Retire only the generation that entered this dispatch, never its successor.
      if (executing && state.pending === executing) { state.pending = false; notify(); }
    }
  }
  dispatcher.dispatch = dispatch;
  const dispose = () => {
    if (state.dead) { return; } state.dead = true; state.pending = false; releaseOwner(); notify(); state.listeners.clear();
    if (dispatcher.dispatch === dispatch) { dispatcher.dispatch = originalDispatch; }
    for (const [name, { original, wrapper }] of wrappers) {
      if (context.traps.get(name) === wrapper) { context.traps.set(name, original); }
    }
    if (Object.getOwnPropertyDescriptor(context, '_tmo')?.set === setTimer) {
      if (originalTimer) { Object.defineProperty(context, '_tmo', { ...originalTimer, value: timer }); } else { delete context._tmo; context._tmo = timer; }
    }
    node.off(receipt);
  };
  const receipt = node.on('destroying', dispose);
  states.set(node, { state, context, wrappers, setTimer, dispatcher, dispatch });
  releaseOwner = completionScope?.add(node) ?? releaseOwner;
}

// Completion ownership is separate from Core value ancestry: ignored inputs
// have parent:null but still belong to the constructing form. Registration adds
// no snapshots or active observation subscriptions until an API is requested.
export function createInputCompletionScope() {
  const nodes = new Set(), listeners = new Set(); let closed = false;
  const emit = (kind, node) => { for (const listener of listeners) { listener(kind, node); } };
  return {
    nodes,
    add(node) {
      if (closed || nodes.has(node)) { return () => {}; }
      nodes.add(node); emit('add', node);
      return () => { if (nodes.delete(node)) { emit('remove', node); } };
    },
    watch(listener) {
      if (closed) { return () => {}; }
      listeners.add(listener); return () => listeners.delete(listener);
    },
    destroy() { closed = true; nodes.clear(); listeners.clear(); }
  };
}

// A factory or inherited library plugin may claim a fresh node only before
// definition features execute. Already-created/replaced producers stay rejected.
export function createInputCompletion(owner) {
  const claim = node => { if (!states.has(node)) { install(node, owner); } };
  const plugin = node => {
    if (!states.has(node)) { markForeign(node, owner); }
  };
  plugin.library = claim;
  return { plugin, definition(definition) {
    return definition ? { ...definition, features: [claim, ...(definition.features ?? [])] } : definition;
  } };
}

export function pendingInput(node) {
  const entry = states.get(node);
  if (!entry || entry.state.foreign) { throw new TypeError('Pending edit fences require nodes created with the FormKit adapter input-completion plugin before library features.'); }
  const { state, context, wrappers, setTimer, dispatcher, dispatch } = entry;
  if (state.dead) { return false; }
  if (Object.getOwnPropertyDescriptor(context, '_tmo')?.set !== setTimer || dispatcher.dispatch !== dispatch ||
    [...wrappers].some(([name, { wrapper }]) => context.traps.get(name) !== wrapper)) {
    throw new TypeError('Pending edit fences cannot observe replaced Core input/add/calm implementations, commit dispatcher or timer context.');
  }
  return !!state.pending;
}

export function watchInputCompletion(node, callback) {
  const entry = states.get(node);
  if (!entry || entry.state.dead) { return () => {}; }
  entry.state.listeners.add(callback);
  return () => entry.state.listeners.delete(callback);
}

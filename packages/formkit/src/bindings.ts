import { createClasses, createMessage, generateClassList, isNode } from '@formkit/core';
import { cloneAny, empty, eq, token, undefine } from '@formkit/utils';
import type { FormKitFrameworkContext, FormKitMessage, FormKitNode, FormKitPlugin } from '@formkit/core';

// Implements the public framework-context contract. The MIT v2.1.2 bindings are
// the behavioral reference; this implementation has no Vue reactivity dependency.
function reactive<T extends object>(value: T, changed: () => void): T {
  const proxies = new WeakMap<object, object>();
  function wrap<V>(item: V): V {
    if (!item || typeof item !== 'object' || isNode(item) || Object.isFrozen(item) ||
      (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item)))) { return item; }
    if (proxies.has(item)) { return proxies.get(item) as V; }
    const proxy = new Proxy(item, {
      get(target, key, receiver) { return wrap(Reflect.get(target, key, receiver)); },
      set(target, key, next, receiver) {
        const previous = Reflect.get(target, key);
        const success = Reflect.set(target, key, next, receiver);
        if (receiver === proxy && success && !Object.is(previous, next)) { changed(); }
        return success;
      },
      deleteProperty(target, key) {
        const present = Object.hasOwn(target, key);
        const success = Reflect.deleteProperty(target, key);
        if (present && success) { changed(); }
        return success;
      },
      defineProperty(target, key, descriptor) {
        const success = Reflect.defineProperty(target, key, descriptor);
        if (success) { changed(); }
        return success;
      }
    });
    proxies.set(item, proxy);
    proxies.set(proxy, proxy);
    return proxy as V;
  }
  return wrap(value);
}

export const nativeBindings: FormKitPlugin = node => {
  let alive = true;
  let hasTicked = false;
  let shownValidation = false;
  let pendingNativeDateDelete = false;
  let pendingDOMInputValue: string | undefined;
  const domInputValue = (payload: unknown) => typeof pendingDOMInputValue === 'string' &&
    node.props.number !== undefined && node.props.number !== 'integer' &&
    typeof payload === 'number' && Number.isFinite(payload) && pendingDOMInputValue.includes('.') &&
    Number(pendingDOMInputValue) === payload && pendingDOMInputValue !== String(payload) ? pendingDOMInputValue : payload;
  const receipts: string[] = [];
  const messages: Record<string, FormKitMessage> = {};
  let inputErrorsReady = false;
  const ui: Record<string, FormKitMessage> = {};
  node.ledger.count('blocking', message => message.blocking);
  node.ledger.count('errors', message => message.type === 'error');
  const changed = () => { if (alive && node.context !== null) { node.emit('context-update', node); } };
  const listen: FormKitNode['on'] = (event, callback, pos) => {
    const receipt = node.on(event, callback, pos);
    receipts.push(receipt);
    return receipt;
  };
  const context = reactive({
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
      length: (object: object) => Object.keys(object).length,
      number: Number, string: String, json: JSON.stringify, eq
    },
    handlers: {
      blur(event?: FocusEvent) {
        if (pendingNativeDateDelete) {
          pendingNativeDateDelete = false;
          void node.input((event?.target as HTMLInputElement).value);
        }
        if (node.props.number !== undefined && ['number', 'range', 'hidden'].includes(node.props.type) &&
          typeof node._value === 'string' && node._value !== '') {
          const number = Number(node._value);
          void node.input(Number.isFinite(number) ? number : undefined);
        }
        node.store.set(createMessage({ key: 'blurred', visible: false, value: true }));
        node.props.attrs?.onBlur?.(event);
      },
      touch() {
        if (context.state.dirty && node.props.dirtyBehavior !== 'compare') { return; }
        const dirty = !eq(node.props._init, node._value);
        if (dirty || node.props.dirtyBehavior === 'compare') {
          node.store.set(createMessage({ key: 'dirty', visible: false, value: dirty }));
        }
      },
      DOMInput(event: Event) {
        const target = event.target as HTMLInputElement;
        pendingNativeDateDelete = 'inputType' in event && String(event.inputType).startsWith('delete') &&
          ['date', 'datetime-local', 'month', 'time', 'week'].includes(target.type) && target.value === '' &&
          target.ownerDocument.activeElement === target && !empty(node._value);
        if (!pendingNativeDateDelete) {
          pendingDOMInputValue = target.value;
          void node.input(pendingDOMInputValue);
        }
        node.emit('dom-input-event', event);
      }
    }
  } as unknown as FormKitFrameworkContext, changed);
  const validationVisible = () => {
    if (context.state.submitted) { return true; }
    if (!shownValidation && !context.state.settled) { return false; }
    switch (node.props.validationVisibility ?? (node.props.type === 'checkbox' ? 'dirty' : 'blur')) {
      case 'live': return true;
      case 'blur': return context.state.blurred;
      case 'dirty': return context.state.dirty;
      default: return false;
    }
  };
  Object.defineProperties(context.state, {
    valid: { enumerable: true, get: () => !node.ledger.value('blocking') },
    errors: { enumerable: true, get: () => !!node.ledger.value('errors') },
    required: { enumerable: true, get: () => !!node.props.parsedRules?.some((rule: { name: string }) => rule.name === 'required') },
    rules: { enumerable: true, get: () => !!node.props.parsedRules?.length },
    empty: { enumerable: true, get: () => empty(context.value) },
    passing: { enumerable: true, get: () => !context.state.failing },
    validationVisible: { enumerable: true, get: validationVisible },
    invalid: { enumerable: true, get: () => context.state.failing && validationVisible() },
    complete: { enumerable: true, get: () => context.state.rules ? context.state.valid && !context.state.errors :
      context.state.dirty && !context.state.empty }
  });
  Object.defineProperties(context, {
    items: { enumerable: true, configurable: true, get: () => node.children.map(child => child.uid) },
    messages: { enumerable: true, configurable: true, get: () => Object.fromEntries(Object.entries(messages).filter(([, message]) =>
      message.type !== 'validation' || validationVisible())) },
    describedBy: { enumerable: true, configurable: true, get: () => [context.help ? `help-${context.id}` : '',
      ...Object.keys(context.messages).map(key => `${context.id}-${key}`)].filter(Boolean).join(' ') || undefined },
    classes: { enumerable: true, configurable: true, get: () => new Proxy({}, {
      get(target, section) {
        if (typeof section !== 'string' || section in Object.prototype) { return Reflect.get(target, section); }
        return generateClassList(node, section,
          typeof node.config.rootClasses === 'function' ? node.config.rootClasses(section, node) : {},
          createClasses(section, node, node.config.classes?.[section]),
          createClasses(section, node, node.props[`_${section}Class`]),
          createClasses(section, node, node.props[`${section}Class`])) ?? '';
      }
    }) }
  });
  function applyErrors(errors: unknown) {
    node.store.apply((Array.isArray(errors) ? errors : []).map(value => createMessage({ key: `prop-error-${token()}`,
      type: 'error', value: String(value), meta: { source: 'prop' } })), message => message.type === 'error' && message.meta.source === 'prop');
  }
  const inputErrorSource = `input-prop-${token()}`;
  let inputErrorAddresses: string[] = [];
  type InputErrors = Record<string, string | string[]>;
  function applyInputErrors(errors?: InputErrors) {
    node.walk(child => child.store.filter(message => message.meta.source !== inputErrorSource));
    const supplied = errors ?? {};
    const messagesByAddress = Object.fromEntries([...inputErrorAddresses.map(address => [address, []]), ...Object.entries(supplied).map(([address, entries]) => [address,
      (typeof entries === 'string' ? [entries] : entries)
        .map(value => createMessage({ key: `prop-error-${token()}`, type: 'error', value: String(value), meta: { source: inputErrorSource } }))])]);
    inputErrorAddresses = Object.keys(supplied);
    node.store.apply(messagesByAddress, message => message.meta.source === inputErrorSource);
  }
  function messageChanged(message: FormKitMessage) {
    delete ui[message.key];
    delete messages[message.key];
    if (message.type === 'ui' && message.visible && !message.meta.showAsMessage) { ui[message.key] = message; } else if (message.visible) { messages[message.key] = message; } else if (message.type === 'state') { context.state[message.key] = !!message.value; }
    if (validationVisible()) { shownValidation = true; }
    changed();
  }
  listen('prop', ({ payload: { prop, value } }) => {
    const descriptor = Object.getOwnPropertyDescriptor(context, prop);
    if (!descriptor?.get) { context[prop] = value; }
    if (prop === 'errors') { applyErrors(value); }
    if (prop === 'inputErrors' && inputErrorsReady) { applyInputErrors(value as InputErrors | undefined); }
    changed();
  });
  for (const event of ['config:classes', 'config:rootClasses', 'child', 'childRemoved', 'count:blocking', 'count:errors']) {
    listen(event, changed);
  }
  listen('input', ({ payload }) => { context._value = domInputValue(payload); });
  listen('commitRaw', ({ payload }) => {
    context.value = payload;
    context._value = domInputValue(payload);
    pendingDOMInputValue = undefined;
    node.emit('modelUpdated');
    changed();
  });
  listen('commit', () => {
    if (hasTicked && !node.store.validating?.value) { context.handlers.touch(); }
    if (node.type === 'input' && context.state.errors && !undefine(node.props.preserveErrors)) {
      node.store.filter(message => !(message.type === 'error' && message.meta.autoClear === true));
    }
    changed();
  });
  listen('settled', ({ payload }) => { context.state.settled = payload; changed(); });
  listen('mounted', () => { context.didMount = true; });
  listen('created', () => {
    applyErrors(node.props.errors);
    inputErrorsReady = true;
    applyInputErrors(node.props.inputErrors);
    context.value = context._value = node.value;
    void node.settled.then(() => { if (alive) { node.props._init = cloneAny(node.value); } });
  });
  listen('message-added', ({ payload }) => messageChanged(payload));
  listen('message-updated', ({ payload }) => messageChanged(payload));
  listen('message-removed', ({ payload }) => {
    delete ui[payload.key];
    delete messages[payload.key];
    if (payload.type === 'state') { delete context.state[payload.key]; }
    if (payload.key === 'validating' && hasTicked) { context.handlers.touch(); }
    changed();
  });
  const dispose = () => {
    alive = false;
    receipts.forEach(receipt => node.off(receipt));
    node.context = undefined;
  };
  listen('destroying', dispose);
  listen('destroyed', dispose);
  queueMicrotask(() => { hasTicked = alive; });
  node.context = context;
  node.emit('context', node, false);
};

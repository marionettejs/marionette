import { EffectGraph, bindingEffect, effectRetirement, hasEffectReaders, notifyEffect, isGeneratedSchema, opaqueEffect, untrackedEffect, updateNative } from './effects.ts';
import type { OwnedEffect } from './effects.ts';
/* global EventListener, EventListenerOrEventListenerObject, AddEventListenerOptions, NodeListOf, ChildNode */
import { compile, deregister, getNode, stopWatch, sugar, watchRegistry } from '@formkit/core';
import type { FormKitNode, FormKitSchemaDefinition, FormKitSchemaNode, FormKitSchemaDOMNode, FormKitSchemaComponent } from '@formkit/core';
import { isPojo } from '@formkit/utils';
import { automaticScope, automaticUpdate, captureRender, contextRead, expressionCalls, isAutomaticScope,
  iterationScope, markInitialComponent, opaqueRender, releaseCapture, takeAutomatic, isInputFactory } from './invalidation.ts';
type Scope = Record<string, unknown>;
export type SchemaSlot = (scope: Scope) => FormKitSchemaDefinition | Node | { schema: FormKitSchemaDefinition; data: Scope };
export interface SchemaComponent {
  element: Node;
  update(props: Scope, data: Scope, children?: FormKitSchemaDefinition): void;
  destroy(): void;
}
export type SchemaComponentFactory = (context: {
  document: Document; props: Scope; data: Scope; children?: FormKitSchemaDefinition;
}) => SchemaComponent;
export interface SchemaOptions {
  schema: FormKitSchemaDefinition;
  data?: Scope;
  components?: Record<string, SchemaComponentFactory>;
  slots?: Record<string, SchemaSlot>;
  /** Trusted application HTML only. Native input schemas use this for SVG icons. */
  allowHTML?: boolean;
}
type SchemaListener = { listener: EventListener; handler?: EventListener };
type RecordNode = { node: Node; end?: Node; pending?: DocumentFragment; kind: string; keep?: boolean;
  children?: Map<string, RecordNode>; component?: SchemaComponent; listeners?: Map<string, SchemaListener>;
  effect?: OwnedEffect; source?: unknown; attributes?: Set<string>; html?: string; releaseEvents?: () => void; input?: boolean };
type Evaluated = { generated?: boolean; key: string; schema: FormKitSchemaNode | Node; scope: Scope; text?: unknown };
type Normalized = FormKitSchemaDOMNode & { $cmp?: string; props?: FormKitSchemaComponent['props'] };
type Host = { document: Document; nodes(): ArrayLike<Node>; insert(node: Node, before: Node | null): void; contains(node: Node): boolean };
type RenderPass = { version: number; parent?: RenderPass; superseded: boolean };
type ValueControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const scopeParents = new WeakMap<Scope, Scope>();
export function scoped(parent: Scope, values: Scope): Scope {
  const scope = Object.defineProperties(Object.create(parent), Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, { value, enumerable: true, configurable: true, writable: true }])));
  scopeParents.set(scope, parent);
  automaticScope(scope, isAutomaticScope(parent));
  return scope;
}
const bound = new WeakMap<object, WeakMap<Function, Function>>();
function tokenValue(scope: Scope, token: string): unknown {
  const parts = token.split('.');
  const parent = scopeParents.get(scope);
  if (parent && !Object.hasOwn(scope, parts[0])) { return tokenValue(parent, token); }
  let value: unknown = scope;
  let receiver: unknown;
  for (const part of parts) {
    receiver = value;
    if (value == null) { return parent ? tokenValue(parent, token) : undefined; }
    value = (value as Scope)[part];
    contextRead(receiver, part, value);
  }
  if (value === undefined && parent) { return tokenValue(parent, token); }
  if (typeof value !== 'function') { return value; }
  if (typeof receiver !== 'object') { return value.bind(receiver); }
  if (!bound.has(receiver!)) { bound.set(receiver!, new WeakMap()); }
  const functions = bound.get(receiver!)!;
  if (!functions.has(value)) { functions.set(value, value.bind(receiver)); }
  return functions.get(value);
}
type ExpressionProgram = { program: ReturnType<typeof compile>; requirements: string[] };
// This helper receives no application scope. Retain the raw public token-map
// program, not the bound evaluator returned by provide() or any token values.
function compileExpression(expression: string): ExpressionProgram {
  const program = compile(expression);
  const entry: ExpressionProgram = { program, requirements: [] };
  program.provide(requirements => { entry.requirements = [...requirements]; return {}; });
  return entry;
}
type Evaluate = (value: unknown, scope: Scope) => unknown;
type ResolveValue = (path: string, source: string, scope: Scope, compute: () => unknown) => unknown;
function evaluate(value: unknown, scope: Scope, programs: Map<string, ExpressionProgram>, resolve?: ResolveValue, path = ''): unknown {
  if (typeof value === 'string' && value.startsWith('$') && !/^\$(?:reset(?:\s|$)|remove:)/.test(value)) {
    if (resolve) { return resolve(path, value, scope, () => evaluate(value, scope, programs)); }
    expressionCalls(value);
    // A lone path has the same provider lookup as Core's compiled expression.
    // Resolve it directly; compound expressions retain the official compiler.
    if (/^\$[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(value)) { return tokenValue(scope, value.slice(1)); }
    // Core 2.1.2 call expressions keep mutable provider/tail state. Leave
    // every expression containing a parenthesis on the fresh compiler path.
    if (!value.includes('(')) {
      let entry = programs.get(value);
      if (!entry) {
        entry = compileExpression(value);
        // Dynamic slot schemas can introduce new expressions without setSchema.
        if (programs.size >= 128) { programs.delete(programs.keys().next().value!); }
        programs.set(value, entry);
      }
      return entry.program(Object.fromEntries(entry.requirements.map(token => [token, () => tokenValue(scope, token)])));
    }
    return compile(value).provide(requirements => Object.fromEntries(
      requirements.map(token => [token, () => tokenValue(scope, token)])
    ))();
  }
  if (Array.isArray(value)) { return value.map((item, index) => evaluate(item, scope, programs, resolve, `${path}[${index}]`)); }
  if (isPojo(value)) {
    const object = value as Scope;
    if ('if' in object && 'then' in object) {
      return evaluate(evaluate(object.if, scope, programs, resolve, `${path}.if`) ? object.then : object.else, scope, programs, resolve, `${path}.branch`);
    }
    return Object.fromEntries(Object.entries(object).map(([key, item]) =>
      key.startsWith('__raw__') ? [key.slice(7), item] : [key, evaluate(item, scope, programs, resolve, `${path}[${JSON.stringify(key)}]`)]));
  }
  return value;
}
function expand(schema: FormKitSchemaDefinition | Node, scope: Scope, prefix: string, identity: (value: unknown) => string, evaluateExpression: Evaluate, current: () => boolean, generated = false): Evaluated[] {
  const result: Evaluated[] = [];
  if (!current()) { return result; }
  const entries = Array.isArray(schema) ? schema : [schema];
  const length = entries.length;
  for (let index = 0; index < length; index++) {
    if (!current()) { break; }
    const present = index in entries;
    if (!current()) { break; }
    if (!present) { continue; }
    const entry = entries[index];
    if (!current()) { break; }
    const key = `${prefix}${index}`;
    if (typeof entry === 'string') {
      if (entry.startsWith('$slots.')) {
        const slot = evaluateExpression(entry, scope);
        if (!current()) { break; }
        if (typeof slot === 'function') {
          opaqueRender();
          const content = slot(scope);
          if (!current()) { break; }
          if (content && typeof content === 'object' && 'schema' in content) {
            result.push(...expand(content.schema, content.data, `${key}.slot.`, identity, evaluateExpression, current, isGeneratedSchema(content.schema)));
          } else { result.push(...expand(content as FormKitSchemaDefinition | Node, scope, `${key}.slot.`, identity, evaluateExpression, current, isGeneratedSchema(content))); }
        } else if (slot !== undefined || !/^\$slots\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(entry)) {
          // A compound slot expression may choose ordinary fallback text.
          // Retain the evaluated value: do not call it or parse it as schema.
          result.push({ generated, key, schema: { $el: 'text' }, scope, text: slot });
        }
      } else { result.push({ generated, key, schema: entry, scope }); }
      continue;
    }
    if ('nodeType' in entry) { result.push({ generated, key, schema: entry, scope }); continue; }
    if ('then' in entry && !('for' in entry && entry.for)) {
      const visible = evaluateExpression(entry.if, scope);
      if (!current()) { break; }
      result.push(...expand(visible ? entry.then : entry.else ?? [], scope, `${key}.`, identity, evaluateExpression, current, generated));
      continue;
    }
    if (!current()) { break; }
    if ('for' in entry && entry.for) {
      if (!current()) { break; }
      const [valueName, keyOrValues, values] = entry.for;
      if (!current()) { break; }
      const collection = evaluateExpression(values ?? keyOrValues, scope);
      if (!current()) { break; }
      const pairs = typeof collection === 'number' ?
        Array.from({ length: collection }, (_, itemIndex) => [itemIndex, itemIndex] as const) :
        Array.isArray(collection) ? collection.map((item, itemIndex) => [itemIndex, item] as const) : Object.entries(collection as Scope ?? {});
      pairs.forEach(([itemKey, item]) => {
        if (!current()) { return; }
        const itemScope = scoped(scope, { [valueName]: item,
          ...(values === undefined ? {} : { [keyOrValues as string]: itemKey }) });
        iterationScope(itemScope, collection);
        // Official input sections expose schema discriminators as non-enumerable
        // getters. Retain them (and conditional accessors) when consuming a loop.
        const descriptors = Object.getOwnPropertyDescriptors(entry);
        delete descriptors.for;
        const copy = Object.defineProperties({}, descriptors) as typeof entry;
        const iteration = `${key}:${identity(evaluateExpression(('key' in copy ? copy.key : undefined) ?? itemKey, itemScope))}.`;
        if (current()) { result.push(...expand(copy, itemScope, iteration, identity, evaluateExpression, current, generated)); }
      });
      continue;
    }
    const condition = entry.if;
    if (!current()) { break; }
    if (!condition || evaluateExpression(entry.if, scope)) {
      if (!current()) { break; }
      if ('$el' in entry && entry.$el === null) { result.push(...expand(entry.children ?? [], scope, `${key}.`, identity, evaluateExpression, current, generated)); continue; }
      const explicitKey = evaluateExpression('key' in entry ? entry.key : undefined, scope);
      if (!current()) { break; }
      result.push({ generated, key: explicitKey === undefined ? key : `${prefix}key:${identity(explicitKey)}`, schema: entry, scope });
    }
  }
  return result;
}
function nodes(record: RecordNode): Node[] {
  const result = [record.node];
  if (record.end) {
    let next = record.node.nextSibling;
    while (next) { result.push(next); if (next === record.end) { break; } next = next.nextSibling; }
  }
  return result;
}
function isPassiveSchemaEvent(attribute: string) { return attribute.length > 9 && attribute.endsWith('Passive'); }
function schemaEventName(attribute: string) { return attribute.slice(2, isPassiveSchemaEvent(attribute) ? -7 : undefined).toLowerCase(); }
function prepareListeners(record: RecordNode, entries: [string, unknown][]) {
  const listeners = record.listeners!;
  let names: string[] | undefined;
  for (const [attribute, value] of entries) {
    if (/^on[A-Z]/.test(attribute) && value != null) { (names ??= []).push(attribute); }
  }
  if (!names && !listeners.size) { return; }
  let reusable = listeners.size === (names?.length ?? 0);
  if (reusable && names) {
    const previous = listeners.keys();
    reusable = names.every(name => previous.next().value === name && listeners.get(name)!.handler !== undefined);
  }
  listeners.forEach((binding, attribute) => {
    if (!reusable) { record.node.removeEventListener(schemaEventName(attribute), binding.listener); }
    // Attribute callbacks can dispatch events or reenter rendering. Reactivate
    // each binding only when its authored position is reached below.
    binding.handler = undefined;
  });
  if (!reusable) { listeners.clear(); }
}
const collectionEffects = new WeakMap<Map<string, RecordNode>, OwnedEffect>();
const collectionSources = new WeakMap<Map<string, RecordNode>, unknown>();
function cleanup(record: RecordNode, remove = true) {
  record.effect?.stop();
  if (record.children) { collectionEffects.get(record.children)?.stop(); }
  // Callers detach this record/collection or end the renderer before callbacks.
  // Release descendant resources without dismantling a detached DOM subtree.
  // The renderer retains an adopted root, so its owned child roots need removal.
  record.children?.forEach(child => cleanup(child, remove && record.keep === true));
  record.listeners?.forEach(binding => { binding.handler = undefined; });
  record.releaseEvents?.();
  record.listeners?.forEach((binding, attribute) => {
    record.node.removeEventListener(schemaEventName(attribute), binding.listener); binding.handler = undefined;
  });
  record.listeners?.clear();
  record.component?.destroy();
  if (remove && !record.keep) { nodes(record).forEach(node => node.parentNode?.removeChild(node)); }
}
function elementHost(container: Element): Host {
  let children: NodeListOf<ChildNode> | undefined;
  return { document: container.ownerDocument, nodes: () => children ??= container.childNodes,
    insert: (node, before) => container.insertBefore(node, before), contains: node => container.contains(node) };
}
function className(value: unknown): string {
  if (Array.isArray(value)) { return value.map(className).filter(Boolean).join(' '); }
  if (isPojo(value)) { return Object.keys(value).filter(key => (value as Scope)[key]).join(' '); }
  return value == null ? '' : String(value);
}

// Native input plugins can register listeners on rendered elements. Keep those
// listeners within this mount, then restore a retained element's original API.
function ownElementListeners(target: HTMLElement): () => void {
  const window = target.ownerDocument.defaultView!;
  const controller = new window.AbortController();
  const previous = Object.getOwnPropertyDescriptor(target, 'addEventListener');
  const add = target.addEventListener.bind(target);
  target.addEventListener = (event: string, listener: EventListenerOrEventListenerObject | null, settings?: boolean | AddEventListenerOptions) => {
    const configured = typeof settings === 'boolean' ? { __proto__: null, capture: settings } as AddEventListenerOptions : settings;
    // Event options are a Web IDL dictionary: inherited/non-enumerable members
    // count too. Read the standard members once, in dictionary order.
    const capture = configured?.capture;
    const once = configured?.once;
    const passive = configured?.passive;
    const source = configured?.signal;
    const signal = source ? window.AbortSignal.any([source, controller.signal]) : controller.signal;
    add(event, listener!, { capture, once, passive, signal });
  };
  return () => {
    controller.abort();
    if (previous) { Object.defineProperty(target, 'addEventListener', previous); } else { Reflect.deleteProperty(target, 'addEventListener'); }
  };
}
function createRenderer(host: Host, options: SchemaOptions, existingRoot?: Element) {
  const document = host.document;
  const components = options.components ?? {};
  const programs = new Map<string, ExpressionProgram>();
  const evaluateValue: Evaluate = (value, scope) => {
    if (!current()) { return undefined; }
    const effect = bindingEffect();
    if (!effect) { return evaluate(value, scope, programs); }
    const prefix = effect.nextEvaluation();
    return evaluate(value, scope, programs, (path, expression, data, compute) =>
      current() ? effect.value(`${prefix}${path}`, expression, data, compute) : undefined);
  };
  type Borrowed = { id: string; registry: string; node?: FormKitNode; receipts: string[]; external: boolean; renewal?: object };
  const borrowed = new Map<string, Borrowed>();
  const retiredLookups = new Set<Borrowed>();
  const symbols = new Map<symbol, string>();
  function identity(value: unknown) {
    if (typeof value !== 'symbol') { return String(value); }
    if (!symbols.has(value)) { symbols.set(value, `symbol-${symbols.size}`); }
    return symbols.get(value)!;
  }
  const records = new Map<string, RecordNode>();
  let disposed = false, queued = false;
  let schemaVersion = 0;
  let activePass: RenderPass | undefined;
  let data = options.data ?? {};
  const graph = new EffectGraph(data, scheduleSignals);
  let forceEffects = true;
  let discoverRequested = false;
  function queue(discover: boolean) {
    discoverRequested ||= discover;
    if (queued || disposed) { return; }
    queued = true;
    queueMicrotask(() => {
      const requested = discoverRequested;
      queued = false; discoverRequested = false;
      if (!disposed) { automaticUpdate(renderer, data, requested ? 'context' : 'signals'); }
    });
  }
  function schedule() { queue(true); }
  function scheduleSignals() { queue(false); }
  function releaseLookup(binding: Borrowed) {
    borrowed.delete(binding.id);
    retiredLookups.delete(binding);
    const registry = binding.registry, node = binding.node, receipts = binding.receipts;
    binding.registry = ''; binding.node = undefined; binding.receipts = []; binding.renewal = undefined;
    stopWatch(registry);
    receipts.forEach(receipt => node?.off(receipt));
  }
  function retireLookups() {
    for (const binding of [...retiredLookups]) {
      retiredLookups.delete(binding);
      if (!binding.external && !hasEffectReaders(binding) && borrowed.get(binding.id) === binding) { releaseLookup(binding); }
    }
  }
  function lookup(id: string) {
    if (!current()) { return; }
    const effect = bindingEffect();
    const external = !effect || effect.graph !== graph;
    if (!borrowed.has(id)) {
      const binding: Borrowed = { id, registry: '', node: undefined, receipts: [], external };
      effectRetirement(binding, () => retiredLookups.add(binding));
      const notify = () => { notifyEffect(binding); if (binding.external) { schedule(); } };
      const rebind = () => {
        if (borrowed.get(id) !== binding) { return; }
        const renewal = {};
        binding.renewal = renewal;
        const oldNode = binding.node, oldReceipts = binding.receipts;
        binding.node = undefined; binding.receipts = [];
        // Finish only this detached receipt collection. Its callbacks can retire
        // the acquisition or install a newer registry owner and renewal.
        oldReceipts.forEach(receipt => oldNode?.off(receipt));
        const ownsRenewal = () => borrowed.get(id) === binding && binding.renewal === renewal;
        if (!ownsRenewal()) { return; }
        const node = getNode(id);
        binding.node = node;
        if (node) {
          for (const event of ['commit', 'prop', 'context-update', 'message-added', 'message-updated', 'message-removed']) {
            const receipt = node.on(event, notify);
            if (!ownsRenewal()) { node.off(receipt); return; }
            binding.receipts.push(receipt);
          }
        }
        notify();
      };
      binding.registry = watchRegistry(id, rebind);
      borrowed.set(id, binding);
      // A first acquisition can be interrupted before its first reader exists.
      // Classify external ownership before callback-capable receipt creation.
      retiredLookups.add(binding);
      rebind();
    }
    if (!current()) { return; }
    const binding = borrowed.get(id)!;
    if (effect) { effect.read(binding); }
    if (external) { binding.external = true; }
    return getNode(id)?.context;
  }
  function releaseOwnedRegistryId(id: unknown) {
    if (typeof id !== 'string') { return; }
    const owner = getNode(id);
    if (!owner) { return; }
    const visit = (entries: Map<string, RecordNode>): boolean => {
      for (const record of entries.values()) {
        if (record.input && (record.component as SchemaComponent & { node: FormKitNode }).node === owner) {
          // Core's old-node destroy deregisters by ID without checking its
          // current owner. Release only its registry claim before the new node
          // registers; retain its normal update/cleanup and DOM lifetime.
          deregister(owner);
          return true;
        }
        if (record.children && visit(record.children)) { return true; }
      }
      return false;
    };
    // An unrelated renderer may own this ID. Only release records in our tree.
    visit(records);
  }
  function interrupted(pass: RenderPass) {
    return disposed || pass.version !== schemaVersion || pass.superseded;
  }
  function current() { return !disposed && (!activePass || !interrupted(activePass)); }
  function ownershipChanged(pass: RenderPass) {
    // A nested pass owns its new collection. Older passes may still finish a
    // value-only reentry, but must not prune or reorder a changed live tree.
    for (let outer = pass.parent; outer; outer = outer.parent) { outer.superseded = true; }
  }
  function setValue(element: ValueControl, value: unknown, pass: RenderPass) {
    if (element.type === 'file') { return; }
    const text = value == null ? '' : String(value);
    if (interrupted(pass)) { return; }
    if (element.value === text) { return; }
    if (element.ownerDocument.activeElement === element && 'selectionStart' in element && element.selectionStart != null) {
      const start = element.selectionStart, end = element.selectionEnd, direction = element.selectionDirection;
      element.value = text;
      element.setSelectionRange(start, end!, direction!);
    } else { element.value = text; }
  }
  function reconcile(parent: Host, previous: Map<string, RecordNode>, schema: FormKitSchemaDefinition, scope: Scope, pass: RenderPass, generated = isGeneratedSchema(options.schema)) {
    let effect = collectionEffects.get(previous);
    if (!effect) { effect = graph.create(() => {}); collectionEffects.set(previous, effect); }
    effect.callback = () => reconcileNow(parent, previous, schema, scope, activePass!, generated);
    if (forceEffects || effect.dirty || collectionSources.get(previous) !== schema) { effect.run(); }
    collectionSources.set(previous, schema);
  }
  function recordCallback(callback: (currentPass: RenderPass, force: boolean) => void) {
    return () => callback(activePass!, forceEffects);
  }
  function reconcileNow(parent: Host, previous: Map<string, RecordNode>, schema: FormKitSchemaDefinition, scope: Scope, pass: RenderPass, generated: boolean) {
    if (!generated) { opaqueEffect(); }
    const retained = new Set<string>();
    const evaluated = expand(schema, scope, '', identity, evaluateValue, current, generated);
    let offset = 0, reordered = false;
    for (const item of evaluated) {
      if (interrupted(pass)) { return; }
      if (retained.has(item.key)) { throw new Error(`Duplicate schema key: ${item.key}`); }
      retained.add(item.key);
      const supplied = typeof item.schema === 'object' && 'nodeType' in item.schema;
      const normalized = (supplied ? item.schema : sugar(item.schema as FormKitSchemaNode)) as Normalized;
      const kind = supplied ? 'supplied' : '$cmp' in normalized ? `component:${normalized.$cmp}` : normalized.$el!;
      let record = previous.get(item.key);
      if (record && (record.kind !== kind || supplied && record.node !== normalized as unknown as Node)) {
        previous.delete(item.key);
        ownershipChanged(pass);
        cleanup(record);
        record = previous.get(item.key);
      }
      let effect = record?.effect;
      if (!effect) { effect = graph.create(() => {}); }
      effect.callback = recordCallback((recordPass, force) => {
        if (!item.generated) { opaqueEffect(); }
        const props = !supplied && '$cmp' in normalized ? { ...evaluateValue(normalized.bind ?? {}, item.scope) as Scope,
          ...evaluateValue(normalized.props ?? {}, item.scope) as Scope } : {};
        if (interrupted(recordPass)) { return; }
        if (!record) {
          if (supplied) { record = { node: normalized as unknown as Node, kind, effect }; } else if ('$cmp' in normalized) {
            const factory = components[normalized.$cmp!];
            if (!factory) { throw new Error(`No native schema component registered for ${normalized.$cmp}.`); }
            const input = isInputFactory(factory);
            if (input) { releaseOwnedRegistryId(props.id); }
            const component = untrackedEffect(() => factory({ document, props, data: item.scope, children: normalized.children }));
            markInitialComponent(component);
            const start = document.createComment('component'), end = document.createComment('/component');
            const pending = document.createDocumentFragment();
            pending.append(start, component.element, end);
            record = { node: start, end, pending, kind, component, input, effect };
          } else {
            const element = parent === host && normalized.$el === existingRoot?.tagName.toLowerCase() ? existingRoot :
              normalized.$el === 'text' ? document.createTextNode('') : document.createElement(normalized.$el!);
            record = { kind, effect, node: element, keep: element === existingRoot, children: new Map(), listeners: new Map(), attributes: new Set() };
            if (element.nodeType === 1) {
              record.releaseEvents = ownElementListeners(element as HTMLElement);
            }
          }
          // A constructor or component factory can render or end this owner before
          // returning its resource. Never replace the nested recordPass's live record.
          if (interrupted(recordPass) || previous.has(item.key)) { cleanup(record); return; }
          previous.set(item.key, record);
          ownershipChanged(recordPass);
        }
        if (!supplied && '$cmp' in normalized) {
          opaqueRender();
          untrackedEffect(() => {
            if (!record!.input || !updateNative(record!.component!, props, item.scope, normalized.children, force)) {
            record!.component!.update(props, item.scope, normalized.children);
            }
          });
        } else if (!supplied && normalized.$el === 'text') {
          const value = Object.hasOwn(item, 'text') ? item.text : evaluateValue(normalized.children ?? '', item.scope);
          if (value && ['object', 'function'].includes(typeof value)) { opaqueEffect(); }
          const text = String(value);
          if (interrupted(recordPass)) { return; }
          if (record.node.textContent !== text) { record.node.textContent = text; }
        } else if (!supplied) {
          const element = record.node as HTMLElement;
          const attrs = { ...evaluateValue(normalized.bind ?? {}, item.scope) as Scope, ...evaluateValue(normalized.attrs ?? {}, item.scope) as Scope };
          if (interrupted(recordPass)) { return; }
          for (const attribute of record.attributes!) {
            if (!(attribute in attrs)) {
              element.removeAttribute(attribute);
              if (interrupted(recordPass)) { return; }
              if (attribute === 'value') { setValue(element as HTMLInputElement, '', recordPass); }
              if (['checked', 'selected', 'disabled', 'multiple'].includes(attribute)) { (element as unknown as Scope)[attribute] = false; }
              if (attribute === 'innerHTML') { element.replaceChildren(); record.html = undefined; }
            }
          }
          const attributes = new Set<string>();
          const entries = Object.entries(attrs);
          prepareListeners(record, entries);
          for (const [attribute, value] of entries) {
            if (interrupted(recordPass)) { return; }
            if (/^on[A-Z]/.test(attribute)) {
              if (value != null) {
                if (typeof value !== 'function') { throw new Error('Schema event attributes require function bindings.'); }
                const event = schemaEventName(attribute);
                const handler = value as EventListener;
                // Reentry may have replaced the tracked binding during an earlier
                // attribute setter. Resolve its current state at activation time.
                let binding = record.listeners!.get(attribute);
                if (!binding) {
                  const created: SchemaListener = { listener: nativeEvent => created.handler?.call(element, nativeEvent), handler };
                  element.addEventListener(event, created.listener, isPassiveSchemaEvent(attribute) ? { passive: true } : undefined);
                  binding = created;
                } else { binding.handler = handler; }
              // Plain and passive bindings can target the same native event.
              record.listeners!.set(attribute, binding);
              }
              continue;
            }
            if (/^on/i.test(attribute) || attribute === 'innerHTML' && !options.allowHTML) {
              throw new Error('Schema event attributes require function bindings; innerHTML requires trusted HTML opt-in.');
            }
            attributes.add(attribute);
            if (value && ['object', 'function'].includes(typeof value)) { opaqueEffect(); }
            if (attribute === 'value') {
              if (element.tagName !== 'SELECT') { setValue(element as ValueControl, value, recordPass); }
              continue;
            }
            if (attribute === 'innerHTML') {
              if (record.children!.size) {
              // Destructors may install a newer child collection. Detach the
              // old ownership map before callbacks and finish only its cleanup.
                const children = record.children!;
                record.children = new Map();
                collectionEffects.get(children)?.stop();
                ownershipChanged(recordPass);
                children.forEach(child => cleanup(child));
              }
              if (interrupted(recordPass)) { return; }
              // DOM serialization expands self-closing SVG tags. Compare the
              // authored markup so unchanged icons survive blur during a click.
              const html = String(value ?? '');
              if (interrupted(recordPass)) { return; }
              if (record.html !== html) { element.innerHTML = html; record.html = html; }
              continue;
            }
            const serialized = attribute === 'class' ? className(value) : value;
            if (interrupted(recordPass)) { return; }
            if (attribute === 'style' && value && typeof value === 'object') {
              element.removeAttribute('style');
              if (interrupted(recordPass)) { return; }
              for (const [key, setting] of Object.entries(value)) {
                if (interrupted(recordPass)) { return; }
                const style = element.style;
                const custom = key.startsWith('--');
                const text = setting === null && !custom ? '' : String(setting);
                if (interrupted(recordPass)) { return; }
                if (custom) { style.setProperty(key, text); } else { (style as unknown as Scope)[key] = text; }
              }
            } else if (serialized == null || serialized === false && !/^(aria-|data-)/.test(attribute)) { element.removeAttribute(attribute); } else {
              const text = serialized === true && !/^(aria-|data-)/.test(attribute) ? '' : String(serialized);
              if (interrupted(recordPass)) { return; }
              element.setAttribute(attribute, text);
            }
            if (interrupted(recordPass)) { return; }
            if (['checked', 'selected', 'disabled', 'multiple'].includes(attribute)) { (element as unknown as Scope)[attribute] = !!value; }
          }
          if (interrupted(recordPass)) { return; }
          record.attributes = attributes;
          if (!('innerHTML' in attrs)) { reconcile(elementHost(element), record.children!, normalized.children ?? [], item.scope, recordPass, item.generated); }
          if (interrupted(recordPass)) { return; }
          // Options must exist before a select can accept its native value.
          if (element.tagName === 'SELECT' && 'value' in attrs) { setValue(element as HTMLSelectElement, attrs.value, recordPass); }
        }
        if (interrupted(recordPass)) { return; }
      });
      if (forceEffects || effect.dirty || record?.source !== item.schema) { effect.run(); }
      if (record) { record.source = item.schema; }
      if (interrupted(pass)) { return; }
      record = previous.get(item.key);
      if (!record) { return; }
      const position = parent.nodes()[offset] ?? null;
      if (position !== record.node) {
        reordered = true;
        if (record.pending) {
          const fragment = record.pending;
          record.pending = undefined;
          parent.insert(fragment, position);
        } else if (record.end) {
          const fragment = document.createDocumentFragment();
          // Move the complete range before custom-element disconnection callbacks
          // can reenter. A nested pass must see both boundary comments together.
          fragment.append(...nodes(record));
          if (interrupted(pass)) { return; }
          parent.insert(fragment, position);
        } else { parent.insert(record.node, position); }
      }
      if (interrupted(pass)) { return; }
      offset += nodes(record).length;
    }
    for (const [key, record] of previous) {
      if (interrupted(pass)) { return; }
      if (!retained.has(key)) { previous.delete(key); ownershipChanged(pass); cleanup(record); }
    }
    if (reordered) {
      // Preserve authored cleanup order after a keyed move without replacing
      // the live ownership map while application callbacks can reenter it.
      const ordered = [...retained].map(key => [key, previous.get(key)!] as const);
      previous.clear();
      for (const [key, record] of ordered) { previous.set(key, record); }
    }
  }
  function update(nextData: Scope = data) {
    if (disposed) { return; }
    const pass: RenderPass = { version: schemaVersion, parent: activePass, superseded: false };
    activePass = pass;
    try {
      data = nextData;
      graph.begin();
      const active = document.activeElement;
      const ownedFocus = active && host.contains(active);
      const scope = scoped(data, { get: lookup, ...(options.slots ? { slots: options.slots } : {}) });
      const automatic = takeAutomatic(renderer);
      automaticScope(scope, !!automatic);
      const previousForce = forceEffects;
      forceEffects = !automatic;
      try {
        if (automatic) {
          if (automatic !== 'signals') { graph.discover(automatic === 'family'); }
          graph.flush(current);
        } else { captureRender(renderer, data, () => { reconcile(host, records, options.schema, scope, pass); }); }
      } finally { forceEffects = previousForce; }
      if (interrupted(pass)) { releaseCapture(renderer); return; }
      if (ownedFocus && host.contains(active) && document.activeElement !== active) { (active as HTMLElement).focus({ preventScroll: true }); }
    } finally {
      activePass = pass.parent;
      if (!activePass) { retireLookups(); }
    }
  }
  function destroy() {
    if (disposed) { return; }
    disposed = true;
    releaseCapture(renderer);
    graph.stop();
    borrowed.forEach(binding => releaseLookup(binding));
    retiredLookups.clear();
    symbols.clear();
    programs.clear();
    records.forEach(record => cleanup(record));
    records.clear();
  }
  function setSchema(schema: FormKitSchemaDefinition) { schemaVersion++; options.schema = schema; programs.clear(); update(); }
  const renderer = { update, setSchema, destroy };
  try { update(); graph.activate(); } catch (error) { graph.stop(); throw error; }
  return renderer;
}
export function createSchemaRenderer(container: Element, options: SchemaOptions) { return createRenderer(elementHost(container), options); }
export function createRootRenderer(container: Element, options: SchemaOptions) {
  return createRenderer({ document: container.ownerDocument, nodes: () => [container],
    insert: container.appendChild.bind(container), contains: node => container.contains(node) }, options, container);
}
export function createRangeRenderer(start: Comment, end: Comment, options: SchemaOptions) {
  const current = () => {
    const result: Node[] = [];
    let next = start.nextSibling;
    while (next && next !== end) { result.push(next); next = next.nextSibling; }
    return result;
  };
  return createRenderer({ document: start.ownerDocument, nodes: current,
    insert: (node, before) => end.parentNode!.insertBefore(node, before ?? end),
    contains: node => current().some(child => child === node || child.contains(node)) }, options);
}

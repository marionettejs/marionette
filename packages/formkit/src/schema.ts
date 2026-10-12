/* global EventListener, EventListenerOrEventListenerObject, AddEventListenerOptions */
import { compile, getNode, stopWatch, sugar, watchRegistry } from '@formkit/core';
import type { FormKitNode, FormKitSchemaDefinition, FormKitSchemaNode, FormKitSchemaDOMNode, FormKitSchemaComponent } from '@formkit/core';
import { isPojo } from '@formkit/utils';
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
type RecordNode = { node: Node; end?: Node; pending?: DocumentFragment; kind: string; keep?: boolean;
  children?: Map<string, RecordNode>; component?: SchemaComponent; listeners?: Map<string, EventListener>;
  attributes?: Set<string>; releaseEvents?: () => void };
type Evaluated = { key: string; schema: FormKitSchemaNode | Node; scope: Scope };
type Normalized = FormKitSchemaDOMNode & { $cmp?: string; props?: FormKitSchemaComponent['props'] };
type Host = { document: Document; nodes(): Node[]; insert(node: Node, before: Node | null): void; contains(node: Node): boolean };
type ValueControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const scopeParents = new WeakMap<Scope, Scope>();
export function scoped(parent: Scope, values: Scope): Scope {
  const scope = Object.defineProperties(Object.create(parent), Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, { value, enumerable: true, configurable: true, writable: true }])));
  scopeParents.set(scope, parent);
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
  }
  if (value === undefined && parent) { return tokenValue(parent, token); }
  if (typeof value !== 'function') { return value; }
  if (typeof receiver !== 'object') { return value.bind(receiver); }
  if (!bound.has(receiver!)) { bound.set(receiver!, new WeakMap()); }
  const functions = bound.get(receiver!)!;
  if (!functions.has(value)) { functions.set(value, value.bind(receiver)); }
  return functions.get(value);
}
function evaluate(value: unknown, scope: Scope): unknown {
  if (typeof value === 'string' && value.startsWith('$') && !/^\$(?:reset(?:\s|$)|remove:)/.test(value)) {
    return compile(value).provide(requirements => Object.fromEntries(
      requirements.map(token => [token, () => tokenValue(scope, token)])
    ))();
  }
  if (Array.isArray(value)) { return value.map(item => evaluate(item, scope)); }
  if (isPojo(value)) {
    const object = value as Scope;
    if ('if' in object && 'then' in object) {
      return evaluate(evaluate(object.if, scope) ? object.then : object.else, scope);
    }
    return Object.fromEntries(Object.entries(object).map(([key, item]) =>
      key.startsWith('__raw__') ? [key.slice(7), item] : [key, evaluate(item, scope)]));
  }
  return value;
}
function expand(schema: FormKitSchemaDefinition | Node, scope: Scope, prefix: string, identity: (value: unknown) => string): Evaluated[] {
  const result: Evaluated[] = [];
  const entries = Array.isArray(schema) ? schema : [schema];
  entries.forEach((entry, index) => {
    const key = `${prefix}${index}`;
    if (typeof entry === 'string') {
      if (entry.startsWith('$slots.')) {
        const slot = evaluate(entry, scope) as SchemaSlot | undefined;
        if (slot) {
          const content = slot(scope);
          if (content && typeof content === 'object' && 'schema' in content) {
            result.push(...expand(content.schema, content.data, `${key}.slot.`, identity));
          } else { result.push(...expand(content as FormKitSchemaDefinition | Node, scope, `${key}.slot.`, identity)); }
        }
      } else { result.push({ key, schema: entry, scope }); }
      return;
    }
    if ('nodeType' in entry) { result.push({ key, schema: entry, scope }); return; }
    if ('then' in entry && !('for' in entry && entry.for)) {
      result.push(...expand(evaluate(entry.if, scope) ? entry.then : entry.else ?? [], scope, `${key}.`, identity));
      return;
    }
    if ('for' in entry && entry.for) {
      const [valueName, keyOrValues, values] = entry.for;
      const collection = evaluate(values ?? keyOrValues, scope);
      const pairs = typeof collection === 'number' ?
        Array.from({ length: collection }, (_, itemIndex) => [itemIndex, itemIndex] as const) :
        Array.isArray(collection) ? collection.map((item, itemIndex) => [itemIndex, item] as const) : Object.entries(collection as Scope ?? {});
      pairs.forEach(([itemKey, item]) => {
        const itemScope = scoped(scope, { [valueName]: item,
          ...(values === undefined ? {} : { [keyOrValues as string]: itemKey }) });
        const copy = { ...entry };
        delete copy.for;
        const iteration = `${key}:${identity(evaluate(('key' in copy ? copy.key : undefined) ?? itemKey, itemScope))}.`;
        result.push(...expand(copy, itemScope, iteration, identity));
      });
      return;
    }
    if (!entry.if || evaluate(entry.if, scope)) {
      if ('$el' in entry && entry.$el === null) { result.push(...expand(entry.children ?? [], scope, `${key}.`, identity)); return; }
      const explicitKey = evaluate('key' in entry ? entry.key : undefined, scope);
      result.push({ key: explicitKey === undefined ? key : `${prefix}key:${identity(explicitKey)}`, schema: entry, scope });
    }
  });
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
function cleanup(record: RecordNode) {
  record.children?.forEach(cleanup);
  record.releaseEvents?.();
  record.listeners?.forEach((listener, event) => record.node.removeEventListener(event, listener));
  record.component?.destroy();
  if (!record.keep) { nodes(record).forEach(node => node.parentNode?.removeChild(node)); }
}
function elementHost(container: Element): Host {
  return { document: container.ownerDocument, nodes: () => [...container.childNodes],
    insert: (node, before) => container.insertBefore(node, before), contains: node => container.contains(node) };
}
function className(value: unknown): string {
  if (Array.isArray(value)) { return value.map(className).filter(Boolean).join(' '); }
  if (isPojo(value)) { return Object.keys(value).filter(key => (value as Scope)[key]).join(' '); }
  return value == null ? '' : String(value);
}
function setValue(element: ValueControl, value: unknown) {
  if (element.type === 'file') { return; }
  const text = value == null ? '' : String(value);
  if (element.value === text) { return; }
  if (element.ownerDocument.activeElement === element && 'selectionStart' in element && element.selectionStart != null) {
    const start = element.selectionStart, end = element.selectionEnd, direction = element.selectionDirection;
    element.value = text;
    element.setSelectionRange(start, end!, direction!);
  } else { element.value = text; }
}

// Native input plugins can register listeners on rendered elements. Keep those
// listeners within this mount, then restore a retained element's original API.
function ownElementListeners(target: HTMLElement): () => void {
  const window = target.ownerDocument.defaultView!;
  const controller = new window.AbortController();
  const previous = Object.getOwnPropertyDescriptor(target, 'addEventListener');
  const add = target.addEventListener.bind(target);
  target.addEventListener = (event: string, listener: EventListenerOrEventListenerObject | null, settings?: boolean | AddEventListenerOptions) => {
    const configured = typeof settings === 'boolean' ? { capture: settings } : settings;
    const signal = configured?.signal ? window.AbortSignal.any([configured.signal, controller.signal]) : controller.signal;
    add(event, listener!, { ...configured, signal });
  };
  return () => {
    controller.abort();
    if (previous) { Object.defineProperty(target, 'addEventListener', previous); } else { Reflect.deleteProperty(target, 'addEventListener'); }
  };
}
function createRenderer(host: Host, options: SchemaOptions, existingRoot?: Element) {
  const document = host.document;
  const components = options.components ?? {};
  const borrowed = new Map<string, { registry: string; node?: FormKitNode; receipts: string[] }>();
  const symbols = new Map<symbol, string>();
  function identity(value: unknown) {
    if (typeof value !== 'symbol') { return String(value); }
    if (!symbols.has(value)) { symbols.set(value, `symbol-${symbols.size}`); }
    return symbols.get(value)!;
  }
  let records = new Map<string, RecordNode>();
  let disposed = false, queued = false;
  let data = options.data ?? {};
  function schedule() {
    if (queued || disposed) { return; }
    queued = true;
    queueMicrotask(() => { queued = false; if (!disposed) { update(data); } });
  }
  function lookup(id: string) {
    if (!borrowed.has(id)) {
      const binding = { registry: '', node: undefined as FormKitNode | undefined, receipts: [] as string[] };
      const rebind = () => {
        binding.receipts.forEach(receipt => binding.node?.off(receipt));
        binding.node = getNode(id);
        binding.receipts = binding.node ? ['commit', 'prop', 'context-update', 'message-added', 'message-updated', 'message-removed']
          .map(event => binding.node!.on(event, schedule)) : [];
        schedule();
      };
      binding.registry = watchRegistry(id, rebind);
      borrowed.set(id, binding);
      rebind();
    }
    return getNode(id)?.context;
  }
  function reconcile(parent: Host, previous: Map<string, RecordNode>, schema: FormKitSchemaDefinition, scope: Scope) {
    const next = new Map<string, RecordNode>();
    let offset = 0;
    for (const item of expand(schema, scope, '', identity)) {
      if (next.has(item.key)) { throw new Error(`Duplicate schema key: ${item.key}`); }
      const supplied = typeof item.schema === 'object' && 'nodeType' in item.schema;
      const normalized = (supplied ? item.schema : sugar(item.schema as FormKitSchemaNode)) as Normalized;
      const kind = supplied ? 'supplied' : '$cmp' in normalized ? `component:${normalized.$cmp}` : normalized.$el!;
      let record = previous.get(item.key);
      if (record && (record.kind !== kind || supplied && record.node !== normalized as unknown as Node)) { cleanup(record); record = undefined; }
      const props = !supplied && '$cmp' in normalized ? { ...evaluate(normalized.bind ?? {}, item.scope) as Scope,
        ...evaluate(normalized.props ?? {}, item.scope) as Scope } : {};
      if (!record) {
        if (supplied) { record = { node: normalized as unknown as Node, kind }; } else if ('$cmp' in normalized) {
          const factory = components[normalized.$cmp!];
          if (!factory) { throw new Error(`No native schema component registered for ${normalized.$cmp}.`); }
          const component = factory({ document, props, data: item.scope, children: normalized.children });
          const start = document.createComment('component'), end = document.createComment('/component');
          const pending = document.createDocumentFragment();
          pending.append(start, component.element, end);
          record = { node: start, end, pending, kind, component };
        } else {
          const element = parent === host && normalized.$el === existingRoot?.tagName.toLowerCase() ? existingRoot :
            normalized.$el === 'text' ? document.createTextNode('') : document.createElement(normalized.$el!);
          record = { kind, node: element, keep: element === existingRoot, children: new Map(), listeners: new Map(), attributes: new Set() };
          if (element.nodeType === 1) {
            record.releaseEvents = ownElementListeners(element as HTMLElement);
          }
        }
      }
      next.set(item.key, record);
      if (!supplied && '$cmp' in normalized) { record.component!.update(props, item.scope, normalized.children); } else if (!supplied && normalized.$el === 'text') {
        const text = String(evaluate(normalized.children ?? '', item.scope));
        if (record.node.textContent !== text) { record.node.textContent = text; }
      } else if (!supplied) {
        const element = record.node as HTMLElement;
        const attrs = { ...evaluate(normalized.bind ?? {}, item.scope) as Scope, ...evaluate(normalized.attrs ?? {}, item.scope) as Scope };
        for (const attribute of record.attributes!) {
          if (!(attribute in attrs)) {
            element.removeAttribute(attribute);
            if (attribute === 'value') { setValue(element as HTMLInputElement, ''); }
            if (['checked', 'selected', 'disabled', 'multiple'].includes(attribute)) { (element as unknown as Scope)[attribute] = false; }
            if (attribute === 'innerHTML') { element.replaceChildren(); }
          }
        }
        const attributes = new Set<string>();
        record.listeners!.forEach((listener, event) => element.removeEventListener(event, listener));
        record.listeners!.clear();
        for (const [attribute, value] of Object.entries(attrs)) {
          if (/^on[A-Z]/.test(attribute)) {
            if (value != null) {
              if (typeof value !== 'function') { throw new Error('Schema event attributes require function bindings.'); }
              const event = attribute.slice(2).toLowerCase();
              const listener = value as EventListener;
              element.addEventListener(event, listener);
              record.listeners!.set(event, listener);
            }
            continue;
          }
          if (/^on/i.test(attribute) || attribute === 'innerHTML' && !options.allowHTML) {
            throw new Error('Schema event attributes require function bindings; innerHTML requires trusted HTML opt-in.');
          }
          attributes.add(attribute);
          if (attribute === 'value') {
            if (element.tagName !== 'SELECT') { setValue(element as ValueControl, value); }
            continue;
          }
          if (attribute === 'innerHTML') {
            record.children!.forEach(cleanup);
            record.children!.clear();
            if (element.innerHTML !== String(value ?? '')) { element.innerHTML = String(value ?? ''); }
            continue;
          }
          const serialized = attribute === 'class' ? className(value) : value;
          if (attribute === 'style' && value && typeof value === 'object') {
            element.removeAttribute('style');
            for (const [key, setting] of Object.entries(value)) {
              if (key.startsWith('--')) { element.style.setProperty(key, String(setting)); } else { (element.style as unknown as Scope)[key] = setting; }
            }
          } else if (serialized == null || serialized === false && !/^(aria-|data-)/.test(attribute)) { element.removeAttribute(attribute); } else { element.setAttribute(attribute, serialized === true && !/^(aria-|data-)/.test(attribute) ? '' : String(serialized)); }
          if (['checked', 'selected', 'disabled', 'multiple'].includes(attribute)) { (element as unknown as Scope)[attribute] = !!value; }
        }
        record.attributes = attributes;
        if (!('innerHTML' in attrs)) { record.children = reconcile(elementHost(element), record.children!, normalized.children ?? [], item.scope); }
        // Options must exist before a select can accept its native value.
        if (element.tagName === 'SELECT' && 'value' in attrs) { setValue(element as HTMLSelectElement, attrs.value); }
      }
      const position = parent.nodes()[offset] ?? null;
      if (position !== record.node) {
        if (record.pending) { parent.insert(record.pending, position); record.pending = undefined; } else if (record.end) {
          const fragment = document.createDocumentFragment();
          nodes(record).forEach(node => fragment.append(node));
          parent.insert(fragment, position);
        } else { parent.insert(record.node, position); }
      }
      offset += nodes(record).length;
    }
    previous.forEach((record, key) => { if (!next.has(key)) { cleanup(record); } });
    return next;
  }
  function update(nextData: Scope = data) {
    if (disposed) { return; }
    data = nextData;
    const active = document.activeElement;
    const ownedFocus = active && host.contains(active);
    const scope = scoped(data, { get: lookup, ...(options.slots ? { slots: options.slots } : {}) });
    records = reconcile(host, records, options.schema, scope);
    if (ownedFocus && host.contains(active) && document.activeElement !== active) { (active as HTMLElement).focus({ preventScroll: true }); }
  }
  function destroy() {
    if (disposed) { return; }
    disposed = true;
    borrowed.forEach(binding => { stopWatch(binding.registry); binding.receipts.forEach(receipt => binding.node?.off(receipt)); });
    borrowed.clear();
    symbols.clear();
    records.forEach(cleanup);
    records.clear();
  }
  function setSchema(schema: FormKitSchemaDefinition) { options.schema = schema; update(); }
  update();
  return { update, setSchema, destroy };
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

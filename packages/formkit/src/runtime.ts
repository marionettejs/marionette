import { createNode, deregister, isComponent, isConditional, isDOM, isNode, register, sugar } from '@formkit/core';
import { createLibraryPlugin, extendSchema, inputs, runtimeProps } from '@formkit/inputs';
import { createThemePlugin } from '@formkit/themes';
import { eq, isPojo } from '@formkit/utils';
import { nativeBindings } from './bindings.ts';
import { createRangeRenderer, createRootRenderer, scoped } from './schema.ts';
import type { FormKitConfig, FormKitLibrary, FormKitNode, FormKitPlugin, FormKitSchemaDefinition, FormKitSectionsSchema, FormKitSchemaNode } from '@formkit/core';
import type { FormKitIconLoader, FormKitIconLoaderUrl } from '@formkit/themes';
import type { SchemaComponentFactory, SchemaSlot } from './schema.ts';

type Scope = Record<string, unknown>;
export interface RuntimeOptions {
  schema?: FormKitSchemaDefinition;
  schemaData?: Scope;
  inputs?: FormKitLibrary;
  components?: Record<string, SchemaComponentFactory>;
  slots?: Record<string, SchemaSlot>;
  sectionsSchema?: FormKitSectionsSchema;
  formProps?: Scope;
  theme?: string;
  icons?: Record<string, string | undefined>;
  iconLoader?: FormKitIconLoader;
  iconLoaderUrl?: FormKitIconLoaderUrl;
}

export function runtimePlugins(options: RuntimeOptions): FormKitPlugin[] {
  return [createLibraryPlugin(inputs, options.inputs ?? {}),
    createThemePlugin(options.theme, options.icons, options.iconLoaderUrl, options.iconLoader ?? (() => undefined)), nativeBindings];
}

export function copyProps(value: unknown): unknown {
  if (isNode(value)) { return value; }
  if (Array.isArray(value)) { return value.map(copyProps); }
  if (isPojo(value)) { return Object.fromEntries(Object.entries(value as Scope).map(([key, item]) => [key, copyProps(item)])); }
  return value;
}

export function sameValues(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) { return true; }
  if (Array.isArray(left) && Array.isArray(right)) { return left.length === right.length && left.every((item, index) => sameValues(item, right[index])); }
  if (isPojo(left) && isPojo(right)) {
    const a = left as Scope, b = right as Scope;
    return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && sameValues(a[key], b[key]));
  }
  return false;
}

const commonProps = new Set([...runtimeProps, 'help', 'label', 'disabled', 'validationVisibility',
  'attrs', 'ignore', 'dirtyBehavior', 'preserve', 'preserveErrors', 'value', 'slots', 'itemKey']);
function attributes(props: Scope, node?: FormKitNode) {
  const definitionProps = node?.props.definition?.props;
  const known = new Set([...commonProps, ...(Array.isArray(definitionProps) ? definitionProps : Object.keys(definitionProps ?? {}))]);
  return { ...Object.fromEntries(Object.entries(props).filter(([key]) =>
    !known.has(key) && !/(?:Icon|Class)$/.test(key))), ...props.attrs as Scope };
}
function slotSchemas(children: FormKitSchemaDefinition | undefined): Record<string, FormKitSchemaDefinition> {
  if (children === undefined) { return {}; }
  if (children && typeof children === 'object' && !Array.isArray(children) &&
    !isDOM(children) && !isComponent(children) && !isConditional(children) && !('$formkit' in children)) {
    return children as Record<string, FormKitSchemaDefinition>;
  }
  return { default: children };
}
function scopedSlots(children: FormKitSchemaDefinition | undefined, supplied: Scope, data: () => Scope) {
  const result: Record<string, SchemaSlot> = { ...supplied as Record<string, SchemaSlot> };
  for (const [name, schema] of Object.entries(slotSchemas(children))) {
    result[name] = scope => scope ? { schema, data: inheritScope(data(), scope) } :
      (Array.isArray(schema) ? schema : [schema]).map(entry => sugar(entry));
  }
  return result;
}

function inheritScope(data: Scope, scope: Scope, application = false) {
  const keys = new Set<string>();
  for (let object: Scope | null = scope; object; object = Object.getPrototypeOf(object)) {
    Object.keys(object).forEach(key => keys.add(key));
  }
  return scoped(data, Object.fromEntries([...keys].filter(key => !application || key === 'node' || !(key in data))
    .map(key => [key, scope[key]])));
}

// Native factories own only the nodes they create, including ignored button/meta
// nodes that are deliberately absent from their parent's children collection.
let nextId = 0;
export type InputMount = ReturnType<SchemaComponentFactory> & { readonly node: FormKitNode };
export type InputFactoryDecorator = (parent: FormKitNode, factory: (...args: Parameters<SchemaComponentFactory>) => InputMount) => (...args: Parameters<SchemaComponentFactory>) => InputMount;
export function inputFactory(parent: FormKitNode, options: RuntimeOptions, decorate?: InputFactoryDecorator):
  (...args: Parameters<SchemaComponentFactory>) => InputMount {
  return ({ document, props, data, children }) => {
    const start = document.createComment('input'), end = document.createComment('/input');
    const element = document.createDocumentFragment();
    element.append(start, end);
    let disposed = false, queued = false, alive = true;
    let currentData = data;
    let currentChildren = children;
    let currentProps = props;
    let renderer: ReturnType<typeof createRangeRenderer>;
    let receipts: string[] = [];
    let node: FormKitNode;
    const schedule = () => {
      if (disposed || queued) { return; }
      queued = true;
      queueMicrotask(() => { queued = false; if (!disposed && alive && node.context) { renderer.update(node.context); } });
    };
    function generate(): { schema: FormKitSchemaDefinition; components: Record<string, SchemaComponentFactory> } {
      const definition = node.props.definition;
      if (!definition) { throw new Error(`Unknown FormKit input: ${String(node.props.type)}.`); }
      if (definition.component) {
        const factory = typeof definition.component === 'string' ? options.components?.[definition.component] : definition.component;
        if (typeof factory !== 'function') { throw new Error('Input components must be native SchemaComponent factories.'); }
        return { schema: { $cmp: 'Definition', props: { context: '$node.context' } } as FormKitSchemaDefinition,
          components: { Definition: factory as SchemaComponentFactory } };
      }
      if (!definition.schema) { throw new Error(`FormKit input ${String(node.props.type)} has no schema.`); }
      const extensions = { ...options.sectionsSchema, ...node.props.sectionsSchema };
      extensions.input = extendSchema({ attrs: { 'aria-invalid': '$state.invalid || $state.errors || undefined' } } as unknown as FormKitSchemaNode,
        extendSchema((options.sectionsSchema?.input ?? {}) as FormKitSchemaNode, node.props.sectionsSchema?.input ?? {}));
      extensions.messages = extendSchema({ attrs: { 'aria-live': 'polite' } } as unknown as FormKitSchemaNode, extensions.messages ?? {});
      return { schema: typeof definition.schema === 'function' ? definition.schema(extensions) : definition.schema,
        components: { ...definition.library, ...options.components, FormKit: decorate ? decorate(node, inputFactory(node, options, decorate)) : inputFactory(node, options) } };
    }
    function create(next: Scope) {
      alive = true;
      const inherited = next.parent as FormKitNode | undefined ?? parent;
      const id = String(next.id ?? `${parent.props.id}-input-${nextId++}`);
      const slots = scopedSlots(currentChildren, next.slots as Scope ?? {}, () => currentData);
      node = createNode({ parent: next.ignore === true ? null : inherited, name: next.name as string | undefined, index: next.index as number | undefined,
        sync: !!(next.sync || next.dynamic), value: next.value,
        config: { ...next.config as Partial<FormKitConfig>, ...(next.classes ? { classes: next.classes as FormKitConfig['classes'] } : {}) },
        plugins: [...parent.plugins, ...inherited.plugins, ...next.plugins as FormKitPlugin[] ?? []],
        props: { ...copyProps(next) as Scope, id, attrs: attributes(next), __root: document, __slots: slots } });
      node.props.attrs = attributes(next, node);
      node.context!.slots = slots;
      const generated = generate();
      renderer = createRangeRenderer(start, end, { ...generated, data: node.context!, allowHTML: true });
      receipts = ['context-update', 'schema'].map(event => node.on(event, () => {
        if (event === 'schema') {
          const regenerated = generate();
          Object.keys(generated.components).forEach(key => { delete generated.components[key]; });
          Object.assign(generated.components, regenerated.components);
          renderer.setSchema(regenerated.schema);
        }
        schedule();
      }));
      receipts.push(node.on('destroying', () => { alive = false; }));
      receipts.push(node.on('destroyed', () => { alive = false; }));
      node.emit('mounted');
    }
    function release() {
      receipts.forEach(receipt => node.off(receipt));
      // A synced list can replace an attachment without clearing its old
      // parent pointer. Descendant teardown must not write through that pointer.
      if (node.parent?.type === 'list' && node.parent.sync && !node.parent.children.includes(node)) { node.parent = null; }
      renderer.destroy();
      if (alive && node.context) { node.destroy(); }
    }
    create(props);
    return { element, get node() { return node; },
      update(next, nextData, nextChildren) {
        currentData = nextData;
        const inherited = next.parent as FormKitNode | undefined ?? parent;
        const index = next.index === undefined ? node.index : Number(next.index);
        const syncedList = inherited.type === 'list' && inherited.sync;
        if (node.context === null || (syncedList && inherited.children[index] !== node)) {
          const snapshot = copyProps(inherited.value);
          const value = next.value === undefined && inherited.type === 'list' ?
            (snapshot as unknown[])[index] : next.value;
          if (syncedList) {
            // Batched reset can reuse a different row's node or detach a live
            // subtree. Preserve the authoritative list before releasing either.
            const existing = inherited.children[index];
            if (isNode(existing)) { existing.props.preserve = true; inherited.remove(existing); }
            if (node.context) { node.props.preserve = true; inherited.remove(node); }
          }
          release();
          if (syncedList) { void inherited.input(snapshot, false); }
          currentProps = next;
          currentChildren = nextChildren;
          create({ ...next, value });
          return;
        }
        if (!eq(currentChildren, nextChildren) || !eq(currentProps.slots, next.slots)) {
          currentChildren = nextChildren;
          node.context!.slots = scopedSlots(currentChildren, next.slots as Scope ?? {}, () => currentData);
          node.props.__slots = node.context!.slots;
        }
        if (next.type !== currentProps.type || next.name !== currentProps.name || next.parent !== currentProps.parent) {
          if (next.name === currentProps.name && next.parent === currentProps.parent) { node.props.preserve = true; }
          release();
          currentProps = next;
          create(next);
          return;
        }
        for (const key of new Set([...Object.keys(currentProps), ...Object.keys(next)])) {
          if (key === 'value' ? sameValues(currentProps[key], next[key]) : eq(currentProps[key], next[key])) { continue; }
          if (key === 'value') { void node.input(next[key], false); } else if (key === 'index') { node.index = Number(next.index); } else if (key === 'id') { deregister(node); node.props.id = next.id as string | undefined; register(node); } else { node.props[key] = copyProps(next[key]); }
        }
        const attrs = attributes(next, node);
        if (!eq(node.props.attrs, attrs)) { node.props.attrs = attrs; }
        currentProps = next;
        renderer.update(node.context!);
      },
      destroy() { disposed = true; release(); }
    };
  };
}

export function mountFormSchema(form: HTMLFormElement, root: FormKitNode, options: RuntimeOptions) {
  let data = options.schemaData ?? {};
  root.context!.slots = { ...options.slots,
    default: (scope: Scope) => ({ schema: options.schema!, data: inheritScope(data, scope, true) }),
    ...(!options.slots?.actions ? { actions: () => ({ $el: 'div', if: '$actions', attrs: { class: '$classes.actions' }, children: [
      { $formkit: 'submit', label: '$submitLabel', attrs: { ...root.props.submitAttrs, disabled: '$disabled' } },
      { $el: 'button', attrs: { type: 'reset', disabled: '$disabled' }, children: '$resetLabel' }
    ] }) } : {}) };
  const definition = root.props.definition!;
  const schema = typeof definition.schema === 'function' ? definition.schema(options.sectionsSchema ?? {}) : definition.schema!;
  const renderer = createRootRenderer(form, { schema, data: root.context!, allowHTML: true,
    components: { ...options.components, FormKit: inputFactory(root, options) } });
  let queued = false, disposed = false;
  const receipt = root.on('context-update.deep', () => {
    if (queued || disposed) { return; }
    queued = true;
    queueMicrotask(() => { queued = false; if (!disposed) { renderer.update(root.context!); } });
  });
  root.emit('mounted');
  return { update(next: Scope = data) { data = next; renderer.update(root.context!); },
    setSchema(nextSchema: FormKitSchemaDefinition) { options.schema = nextSchema; renderer.update(root.context!); },
    destroy() { disposed = true; root.off(receipt); renderer.destroy(); } };
}

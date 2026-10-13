import { compositions, inputSources } from './composition.ts';
import { ownedInputFactory } from './composition-input.ts';
import { connectRows, disconnectRows, resolveRow, prepareRowReset, rowLocationKey, isRowWithin } from './row-ownership.ts';
import type { RowLocation } from './row-ownership.ts';
import { View } from 'marionette';
import { createMessage, createNode, isNode, reset as resetNode, valueRemoved } from '@formkit/core';
import { createValidationPlugin } from '@formkit/validation';
import * as rules from '@formkit/rules';
import { createI18nPlugin, en } from '@formkit/i18n';
import { isKilled } from '@formkit/observer';
import { cloneAny, eq, isPojo, undefine } from '@formkit/utils';
import { mountFormSchema, runtimePlugins, sameValues } from './runtime.ts';
import type { InputMount, RuntimeOptions } from './runtime.ts';
import type { ViewConfiguration } from 'marionette';
import type { FormKitConfig, FormKitNode, FormKitPlugin, FormKitSchemaDefinition, FormKitSchemaNode } from '@formkit/core';
import type { FormKitValidationRule, FormKitValidationRules, FormKitValidationMessages } from '@formkit/validation';

export type FormValues = { [name: string]: unknown };
export type NativeType = 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' |
  'search' | 'tel' | 'url' | 'date' | 'datetime-local' | 'month' | 'time' | 'week' | 'color' | 'range' | 'hidden';
export interface FieldDefinition {
  name: string;
  type: NativeType;
  label: string;
  help?: string;
  value?: string | number | boolean;
  validation?: string;
  validationMessages?: FormKitValidationMessages;
  options?: readonly { label: string; value: string; disabled?: boolean }[];
  attrs?: { autocomplete?: string; placeholder?: string; min?: string | number; max?: string | number;
    step?: string | number; rows?: number; disabled?: boolean; readonly?: boolean };
}
export interface GroupDefinition {
  name: string;
  type: 'group';
  label: string;
  children: readonly Definition[];
}
export type Definition = FieldDefinition | GroupDefinition;
export interface ValueUpdateOptions {
  notify?: boolean;
  source?: unknown;
}
export interface SubmissionContext {
  node: FormKitNode;
  signal: AbortSignal;
}
export type SubmitResult = 'success' | 'invalid' | 'error' | 'busy' | 'cancelled';
export interface FormState {
  submitted: boolean;
  submitting: boolean;
  valid: boolean;
  errors: readonly string[];
}
interface FormConfiguration<Values extends object> extends Omit<RuntimeOptions, 'schema'>,
  Omit<ViewConfiguration, 'el' | 'tagName' | 'template'> {
  values?: Partial<Values>;
  submit?: (values: Values, context: SubmissionContext) => unknown | Promise<unknown>;
  submitLabel?: string;
  resetLabel?: string;
  plugins?: FormKitPlugin[];
  validationRules?: FormKitValidationRules;
  config?: Partial<FormKitConfig>;
  el?: HTMLFormElement;
}
export type FormOptions<Values extends object = FormValues> = FormConfiguration<Values> & (
  | { fields: readonly Definition[]; schema?: never; template?: never }
  | { schema: FormKitSchemaDefinition; fields?: never; template?: never }
  | { template: ViewConfiguration['template']; fields?: never; schema?: never }
);

export type RemovalPolicy = 'preserve' | 'clear';
export interface FieldInput extends Record<string, unknown> {
  type: string;
  name?: never;
  parent?: never;
  preserve?: never;
}
export type FieldInputUpdate = Partial<FieldInput> & {
  type?: never; id?: never; value?: never; plugins?: never; config?: never; ignore?: never;
};
export interface FieldOptions<Values extends object = FormValues> extends Omit<ViewConfiguration, 'template' | 'el'> {
  form: FormView<Values>;
  parent?: FormKitNode;
  name: string;
  input: FieldInput;
  removal: RemovalPolicy;
}

function hasPath(values: FormValues, path: string[]): boolean {
  let value: unknown = values;
  for (const key of path) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) { return false; }
    value = (value as FormValues)[key];
  }
  return true;
}
function readPath(values: FormValues, path: string[]): unknown {
  return path.reduce<unknown>((value, key) => (value as FormValues)[key], values);
}
function writePath(values: FormValues, path: string[], value: unknown) {
  let target = values;
  path.slice(0, -1).forEach(key => { target = (target[key] ??= {}) as FormValues; });
  target[path.at(-1)!] = value;
}
function deletePath(values: FormValues, path: string[]) {
  if (hasPath(values, path)) {
    const parent = readPath(values, path.slice(0, -1)) as FormValues;
    delete parent[path.at(-1)!];
  }
}

// Convenience definitions describe layout/defaults only. Official inputs own
// every control, listener, value conversion and message in all authoring modes.
function fieldsSchema(definitions: readonly Definition[], path: string[] = []): FormKitSchemaNode[] {
  return definitions.map(definition => {
    const address = [...path, definition.name];
    if (definition.type === 'group') {
      return { $formkit: 'group', name: definition.name, label: definition.label, children: [{ $el: 'fieldset', children: [
        { $el: 'legend', children: '$label' }, ...fieldsSchema(definition.children, address)
      ] }] };
    }
    return { $formkit: definition.type, ...definition,
      ...(definition.type === 'number' || definition.type === 'range' ? { number: true } : {}),
      disabled: definition.attrs?.disabled,
      ...(definition.options ? { options: definition.options.map(option => ({ ...option, attrs: { disabled: option.disabled } })) } : {}),
      sectionsSchema: { input: { attrs: { name: address.join('.') } } }
    };
  });
}
export class SubmissionError extends Error {
  readonly fieldErrors: Record<string, string[]>;
  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'SubmissionError';
    this.fieldErrors = fieldErrors;
  }
}

function fieldDefault(definition: FieldDefinition, document: Document) {
  if (definition.value !== undefined) { return definition.value; }
  if (definition.type === 'checkbox') { return false; }
  if (definition.type === 'number') { return undefined; }
  if (definition.type === 'range' || definition.type === 'color') {
    const input = document.createElement('input');
    input.type = definition.type;
    for (const [key, value] of Object.entries(definition.attrs ?? {})) {
      if (value !== false) { input.setAttribute(key, value === true ? '' : String(value)); }
    }
    input.value = '';
    return definition.type === 'range' ? input.valueAsNumber : input.value;
  }
  return '';
}

function defaults(definitions: readonly Definition[], document: Document): FormValues {
  return Object.fromEntries(definitions.map(definition => [definition.name, definition.type === 'group' ?
    defaults(definition.children, document) : fieldDefault(definition, document)]));
}

function mergeValues(base: FormValues, supplied: FormValues): FormValues {
  return Object.fromEntries(Object.entries({ ...base, ...supplied }).map(([name, value]) => [name,
    isPojo(base[name]) && isPojo(supplied[name]) ? mergeValues(base[name] as FormValues, supplied[name] as FormValues) : value]));
}

function capturedValuesMatch(captured: unknown, current: unknown): boolean {
  // Newly mounted fields were absent from the captured tree. Existing values
  // still invalidate a pending rule, including cross-field dependencies.
  if (isPojo(captured) && isPojo(current)) {
    const previous = captured as FormValues, latest = current as FormValues;
    return Object.keys(previous).every(key => Object.hasOwn(latest, key) && capturedValuesMatch(previous[key], latest[key]));
  }
  return sameValues(captured, current);
}

function guardedValidation(baseRules: FormKitValidationRules, evaluating: () => void): FormKitPlugin {
  // Rules can read other nodes through the public observer. The conservative
  // root snapshot guards that case; unrelated edits can also retry an async rule.
  return node => {
    let alive = true;
    const wrapped = new WeakMap<FormKitValidationRule, FormKitValidationRule>();
    const receipt = node.on('destroying', () => { alive = false; node.off(receipt); });
    function guard(rule: FormKitValidationRule): FormKitValidationRule {
      if (wrapped.has(rule)) { return wrapped.get(rule)!; }
      let invocation = 0;
      const invoke: FormKitValidationRule = (...args) => {
        const current = ++invocation;
        const run = (): ReturnType<FormKitValidationRule> => {
          if (!node.props.ignore) { evaluating(); }
          const result = rule(...args);
          if (!(result instanceof Promise)) { return result; }
          const value = cloneAny(node.value);
          const values = cloneAny(node.root.value);
          const active = () => alive && node.context !== null && current === invocation && !isKilled(args[0] as Parameters<typeof isKilled>[0]);
          const changed = () => !sameValues(value, node.value) || !capturedValuesMatch(values, node.root.value);
          return result.then(accepted => active() && changed() ? run() : accepted, error => {
            if (active()) {
              if (changed()) { return run(); }
              node.emit('validation-error', error);
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
    const map = (validationRules: FormKitValidationRules) => Object.fromEntries(Object.entries(validationRules).map(([key, rule]) => [key, guard(rule)])) as FormKitValidationRules;
    const specification = (value: unknown) => Array.isArray(value) ? value.map(entry => Array.isArray(entry) && typeof entry[0] === 'function' ?
      [guard(entry[0]), ...entry.slice(1)] : entry) : value;
    node.hook.prop((payload, next) => next(payload.prop === 'validationRules' && payload.value ?
      { ...payload, value: map(payload.value) } : payload.prop === 'validation' ? { ...payload, value: specification(payload.value) } : payload));
    if (node.props.validationRules) { node.props.validationRules = map(node.props.validationRules); }
    node.props.validation = specification(node.props.validation);
    createValidationPlugin(map(baseRules))(node);
    let previous = node.props.validationRules;
    const rulesReceipt = node.on('prop:validationRules', ({ payload }) => {
      const changed = previous && payload && Object.keys(previous).length === Object.keys(payload).length &&
        Object.keys(payload).some(key => previous![key] !== payload[key]);
      previous = payload;
      if (changed) {
        const validation = node.props.validation;
        // FormKit 2.1.2 compares only rule-map keys on reboot. Rebuild through
        // the public props when a rule implementation changes under its name.
        node.props.validation = undefined;
        node.props.validationRules = {};
        node.props.validationRules = payload;
        node.props.validation = validation;
      }
    });
    const validationReceipt = node.on('prop:validation', () => {
      if (!node.props.parsedRules.length) { node.store.remove('validating'); }
    });
    node.on('destroying', () => { node.off(rulesReceipt); node.off(validationReceipt); });
  };
}

function listValues(node: FormKitNode, value: unknown, supersede = false): unknown {
  if (node.type === 'list' && Array.isArray(value)) {
    const used = new Set<FormKitNode>();
    const key = node.props.itemKey;
    const identity = (item: unknown) => typeof key === 'function' ? key(item) :
      typeof key === 'string' && item && typeof item === 'object' ? (item as FormValues)[key] : undefined;
    return value.map(item => {
      const id = identity(item);
      const child = node.children.filter(isNode).find(candidate => !used.has(candidate) &&
        (id === undefined ? eq(candidate.value, item) : Object.is(id, identity(candidate.value))));
      if (!child) { return item; }
      used.add(child);
      const normalized = listValues(child, item);
      if (supersede) { settleWrittenValues(child, normalized); }
      if (!eq(child.value, normalized)) { void child.input(normalized, false); }
      return child.value;
    });
  }
  if (node.type === 'group' && isPojo(value)) {
    const result = { ...value as FormValues };
    node.children.forEach(child => {
      if (isNode(child) && Object.hasOwn(result, child.name)) { result[String(child.name)] = listValues(child, result[String(child.name)], supersede); }
    });
    return result;
  }
  return value;
}

function orderResetLists(node: FormKitNode, value: unknown) {
  if (node.type === 'list' && Array.isArray(value)) {
    const children = node.children.filter(isNode), used = new Set<FormKitNode>();
    const key = node.props.itemKey;
    const identity = (item: unknown) => typeof key === 'function' ? key(item) :
      typeof key === 'string' && item && typeof item === 'object' ? (item as FormValues)[key] : undefined;
    // Reserve every keyed match before assigning positional rows. Moving one
    // child changes neighboring indices, so order the complete permutation
    // before recursing; otherwise a keyless row can reuse a matched child.
    const matches = value.map(item => {
      const id = identity(item);
      const child = id === undefined ? undefined : children.find(candidate =>
        !used.has(candidate) && Object.is(id, identity(candidate.value)));
      if (child) { used.add(child); }
      return child;
    });
    const remaining = children.filter(child => !used.has(child));
    const ordered = matches.map(child => child ?? remaining.shift());
    ordered.push(...remaining);
    ordered.forEach((child, index) => {
      if (child && child.index !== index) { child.index = index; }
    });
    value.forEach((item, index) => {
      const child = matches[index] ?? (identity(item) === undefined ? ordered[index] : undefined);
      if (child) { orderResetLists(child, item); }
    });
  } else if (node.type === 'group' && isPojo(value)) {
    node.children.forEach(child => {
      if (isNode(child) && Object.hasOwn(value, child.name)) { orderResetLists(child, (value as FormValues)[String(child.name)]); }
    });
  }
}

function settleWrittenValues(node: FormKitNode, supplied: unknown) {
  // Core hydration intentionally leaves pending children alone. An explicit
  // owner write supersedes those drafts only along the supplied partial paths.
  if (node.type === 'group' && isPojo(supplied)) {
    node.children.forEach(child => {
      if (isNode(child) && Object.hasOwn(supplied, child.name)) {
        settleWrittenValues(child, (supplied as FormValues)[String(child.name)]);
      }
    });
  } else if (!node.isSettled) {
    void node.input(listValues(node, supplied, true), false);
  }
}

function validateNames(definitions: readonly Definition[]) {
  const names = new Set<string>();
  for (const definition of definitions) {
    if (!definition.name || definition.name.includes('.') || names.has(definition.name)) {
      throw new Error('Field names must be non-empty, unique within their group, and contain no dots.');
    }
    names.add(definition.name);
    if (definition.type === 'group') { validateNames(definition.children); }
  }
}

export class FormView<Values extends object = FormValues> extends View {
  readonly node: FormKitNode;
  private formOptions: FormOptions<Values>;
  private receipts: string[] = [];
  private initial: FormValues;
  private submitted = false;
  private disabledBySubmission = false;
  private previousDisabled: unknown;
  private pending?: AbortController;
  private disposed = false;
  private formCleanup?: () => void;
  private changeSource: unknown = 'programmatic';
  private nativeInput?: WeakRef<Event>;
  private notifyChanges = true;
  private notifyFields = true;
  private lastValues?: Values;
  private schemaRenderer?: ReturnType<typeof mountFormSchema>;
  private ownedNodes = new Set<FormKitNode>();
  private actionDisabled = new WeakMap<HTMLButtonElement, boolean>();
  private mutationDepth = 0;
  private rowBaselines = new Map<string, { location: RowLocation; values: FormValues }>();
  #submissionCallback?: AbortController;
  #submissionRevision = 0;

  #submissionChanged() {
    this.#submissionRevision++;
    // Never automatically repeat an external effect. Once its snapshot has been
    // handed to the callback, changed values or validation ownership cancel the
    // attempt. The callback receives the same abort signal and late results are
    // ignored even if the application cannot cancel its remote operation.
    this.#submissionCallback?.abort();
  }

  private excludeAbsent(values: FormValues) {
    const excluded = compositions.get(this.node)!.excluded;
    // Authoritative row deletion ends logical state even while its list placement
    // is absent and therefore has no live Core input hook.
    this.rowBaselines.forEach((entry, key) => {
      if (!resolveRow(values, entry.location)) { this.rowBaselines.delete(key); }
    });
    excluded.forEach((location, key) => {
      const path = Array.isArray(location) ? location : resolveRow(values, location);
      if (path) { deletePath(values, path); } else { excluded.delete(key); }
    });
    return values;
  }

  constructor(options: FormOptions<Values>) {
    if ([options.fields, options.schema, options.template].filter(value => value !== undefined).length !== 1) {
      throw new Error('Provide exactly one of fields, schema, or template.');
    }
    validateNames(options.fields ?? []);
    // A FormView owns the supplied form's contents. Empty it before Marionette
    // classifies adopted markup as already rendered and a Region skips mounting.
    options.el?.replaceChildren();
    super({ ...options, tagName: 'form', template: options.template ?? (() => '') });
    this.formOptions = options;
    this.initial = mergeValues(defaults(options.fields ?? [], this.el.ownerDocument), options.values as FormValues ?? {});
    this.node = createNode({ type: 'group', props: { ...options.formProps, id: `${this.cid}-form`,
      type: 'form', attrs: { ...options.formProps?.attrs as object },
      submitLabel: options.submitLabel ?? 'Submit', resetLabel: options.resetLabel ?? 'Reset' }, value: cloneAny(this.initial),
    config: { delay: 0, rootClasses: section => ({ [`formkit-${section}`]: true }), ...options.config },
    plugins: [...runtimePlugins(options), (node: FormKitNode) => {
      const participates = !node.props.ignore;
      if (participates) { this.#submissionChanged(); }
      this.ownedNodes.add(node);
      node.hook.input((value, next) => {
        const native = !!this.nativeInput?.deref()?.eventPhase;
        if (native && node.props.disabled) { return node._value; }
        const proposed = next(value);
        if (native && !sameValues(node._value, proposed)) {
          this.changeSource = 'user';
          // Clear during the control's handler, after it has read the DOM value.
          // A capture listener can trigger reconciliation before that handler runs.
          this.clearSubmissionErrors();
        }
        if (!sameValues(node._value, proposed)) {
          if (participates) { this.#submissionChanged(); }
          inputSources.set(node, this.changeSource);
          for (let parent = node.parent; parent; parent = parent.parent) { inputSources.set(parent, this.changeSource); }
        }
        return proposed;
      });
      const constraints = node.on('prop', ({ payload: { prop } }) => {
        if (participates && (prop === 'validation' || prop === 'validationRules')) { this.#submissionChanged(); }
      });
      const receipts = ['destroying', 'destroyed'].map(event => node.on(event, () => {
        if (participates && event === 'destroying') { this.#submissionChanged(); }
        this.ownedNodes.delete(node);
        node.off(constraints);
        receipts.forEach(receipt => node.off(receipt));
      }));
    },
    createI18nPlugin({ en }), guardedValidation({ ...rules, ...options.validationRules }, () => this.#submissionChanged()),
    ...options.plugins ?? []] });
    compositions.set(this.node, { options, fields: new Set(), excluded: new Map(),
      captureNativeEvents: element => {
        // Logical form ownership also covers controls in external/detached Views.
        // Capture before their handlers read the DOM; the input hook clears errors.
        const native = (event: Event) => { this.nativeInput = new WeakRef(event); };
        const events = ['input', 'change', 'blur'];
        events.forEach(name => element.addEventListener(name, native, true));
        return () => events.forEach(name => element.removeEventListener(name, native, true));
      },
      mutate: operation => {
        const previous = this.lastValues, notify = this.notifyChanges, notifyFields = this.notifyFields, source = this.changeSource;
        this.notifyChanges = false;
        this.notifyFields = false;
        const committed = !sameValues(previous, this.node.value);
        this.mutationDepth++;
        try { operation(); } finally {
          this.mutationDepth--; this.lastValues = previous; this.notifyChanges = notify; this.notifyFields = notifyFields;
          this.changeSource = source === 'user' && !committed && !this.hasPendingUserInput() ? 'programmatic' : source;
        }
        queueMicrotask(() => { if (!this.disposed) { this.refresh(); } });
      },
      notify: () => this.notifyFields,
      write: (node, value, updateOptions) => this.updateValues(() => {
        const path = node.address.slice(1).map(String);
        const snapshot = this.getValues() as FormValues;
        writePath(snapshot, path, cloneAny(value));
        this.excludeAbsent(snapshot);
        const supplied = readPath(snapshot, path);
        settleWrittenValues(node, supplied);
        void node.input(listValues(node, supplied), false);
      }, updateOptions),
      baseline: (location, value) => {
        let baseline = this.initial;
        let path: string[];
        if (Array.isArray(location)) { path = location; } else {
          const original = resolveRow(this.initial, location);
          if (original) { path = original; } else {
            const key = rowLocationKey(location);
            if (!this.rowBaselines.has(key)) { this.rowBaselines.set(key, { location, values: {} }); }
            baseline = this.rowBaselines.get(key)!.values;
            path = location.suffix;
          }
        }
        if (!hasPath(baseline, path)) { writePath(baseline, path, cloneAny(value)); }
        return readPath(baseline, path);
      }
    });
    connectRows(this.node, {
      mutate: operation => compositions.get(this.node)!.mutate(operation),
      forget: location => {
        this.rowBaselines.forEach((entry, key) => {
          if (isRowWithin(entry.location, location)) { this.rowBaselines.delete(key); }
        });
        const excluded = compositions.get(this.node)?.excluded;
        excluded?.forEach((path, key) => {
          if (!Array.isArray(path) && isRowWithin(path, location)) { excluded.delete(key); }
        });
      }
    });
    this.receipts = ['commit', 'message-added.deep', 'message-updated.deep', 'message-removed.deep'].map(event =>
      this.node.on(event, ({ payload }) => {
        // The official validator marks an observed dependency invalidation
        // immediately, before its scheduled rule evaluation. Cancel at this
        // public message boundary so a fast callback result cannot overtake it.
        if ((event === 'message-added.deep' || event === 'message-updated.deep') &&
          payload.key === 'validating' && payload.value) { this.#submissionChanged(); }
        this.refresh();
      }));
    this.receipts.push(this.node.on('settled', ({ payload }) => {
      // A delayed edit can return to the committed value without a value change.
      if (payload && this.notifyChanges && this.changeSource === 'user') { this.changeSource = 'programmatic'; }
    }));
    this.on('before:destroy', () => this.dispose());
  }

  render() {
    if (this.isDestroyed()) { return this; }
    if (!this.isRendered()) {
      this.notifyChanges = false;
      this.notifyFields = false;
      super.render();
      this.notifyChanges = true;
      this.notifyFields = true;
      this.lastValues = undefined;
    }
    this.refresh();
    return this;
  }

  attachElContent(html: unknown) {
    const form = this.el as HTMLFormElement;
    form.replaceChildren();
    form.noValidate = true;
    const releaseNative = compositions.get(this.node)!.captureNativeEvents(form);
    const submit = (event: Event) => { event.preventDefault(); void this.submit(event); };
    const reset = (event: Event) => { event.preventDefault(); this.resetForm(); };
    form.addEventListener('submit', submit);
    form.addEventListener('reset', reset);
    this.formCleanup = () => {
      releaseNative(); form.removeEventListener('submit', submit);
      form.removeEventListener('reset', reset); this.nativeInput = undefined;
    };
    if (this.formOptions.template !== undefined) {
      super.attachElContent(html);
    } else {
      // FormView owns native submit/reset in all modes; avoid installing the
      // official form feature's submission handler a second time.
      this.node.context!.handlers.submit = (event: Event) => event.preventDefault();
      const schema = this.formOptions.schema ?? fieldsSchema(this.formOptions.fields!);
      this.schemaRenderer = mountFormSchema(form, this.node, { ...this.formOptions, schema });
      this.initial = cloneAny(this.node.value) as FormValues;
    }
  }

  getValues(): Values { return cloneAny(this.node.value) as Values; }

  setValues(values: Partial<Values>, options: ValueUpdateOptions = {}) {
    if (this.disposed) { return this; }
    const supplied = cloneAny(values) as FormValues;
    const candidate = mergeValues(this.node.value as FormValues, supplied);
    this.updateValues(() => {
      const merged = this.excludeAbsent(candidate);
      settleWrittenValues(this.node, supplied);
      if (!sameValues(this.node.value, merged)) { void this.node.input(listValues(this.node, merged), false); }
    }, options);
    return this;
  }

  private updateValues(operation: () => void, options: ValueUpdateOptions) {
    const previous = this.lastValues, notify = this.notifyChanges, fields = this.notifyFields, source = this.changeSource;
    this.notifyChanges = false;
    this.notifyFields = options.notify ?? true;
    this.changeSource = options.source ?? 'programmatic';
    try {
      this.mutationDepth++;
      try { operation(); this.schemaRenderer?.update(); } finally { this.mutationDepth--; }
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

  private hasPendingUserInput() {
    return [...this.ownedNodes].some(node =>
      node.type === 'input' && inputSources.get(node) === 'user' && !sameValues(node.value, node._value));
  }

  getFormState(): FormState {
    return { submitted: this.submitted, submitting: !!this.pending,
      valid: this.node.ledger.value('blocking') === 0,
      errors: this.node.store.reduce<string[]>((errors, message) => {
        if (message.type === 'error') { errors.push(String(message.value)); }
        return errors;
      }, []) };
  }

  setSchemaData(data: Record<string, unknown>) {
    if (!this.disposed) { this.formOptions.schemaData = data; this.schemaRenderer?.update(data); }
    return this;
  }

  setSchema(schema: FormKitSchemaDefinition) {
    if (!this.disposed) { this.formOptions.schema = schema; this.schemaRenderer?.setSchema(schema); }
    return this;
  }

  setErrors(errors: string[] = [], fieldErrors: Record<string, string[]> = {}) {
    if (this.disposed) { return; }
    this.node.clearErrors();
    this.node.setErrors(errors, fieldErrors);
    this.refresh();
    this.schemaRenderer?.update();
  }

  private clearSubmissionErrors() {
    if (!undefine(this.node.props.preserveErrors)) {
      this.node.store.filter(message => message.meta.autoClear !== true, 'error');
    }
  }

  private refresh() {
    if (this.mutationDepth) { return; }
    // Core reset batches events; synced-list disposal can finish before the
    // queued lifecycle events are delivered. Do not retain those terminal nodes.
    for (const node of this.ownedNodes) { if (node.context === null) { this.ownedNodes.delete(node); } }
    {
      const autoDisable = this.pending && this.node.props.submitBehavior !== 'live';
      if (autoDisable && !this.disabledBySubmission) {
        this.previousDisabled = this.node.props.disabled;
        this.disabledBySubmission = true;
        this.node.props.disabled = true;
      } else if (!autoDisable && this.disabledBySubmission) {
        this.disabledBySubmission = false;
        this.node.props.disabled = this.previousDisabled;
      }
      this.el.setAttribute('aria-busy', String(!!this.pending));
      if (!!this.node.store.loading !== !!this.pending) {
        if (this.pending) { this.node.store.set(createMessage({ key: 'loading', visible: false, value: true })); } else { this.node.store.remove('loading'); }
      }
    }
    compositions.get(this.node)?.fields.forEach(field => field.update());
    const state = this.getFormState();
    // Template action controls are ordinary DOM; official input controls inherit
    // disabled from the root. Restore each action's authored disabled state.
    for (const button of this.el.querySelectorAll<HTMLButtonElement>('button[type="submit"], button[type="reset"]')) {
      if (this.pending) {
        if (!this.actionDisabled.has(button)) { this.actionDisabled.set(button, button.disabled); }
        button.disabled = true;
      } else if (this.actionDisabled.has(button)) {
        button.disabled = this.actionDisabled.get(button)!;
        this.actionDisabled.delete(button);
      }
    }
    const values = this.getValues();
    if (!sameValues(this.lastValues, values)) {
      this.lastValues = cloneAny(values);
      // Consume a user origin on the value commit, including delayed inputs.
      if (this.notifyChanges) {
        const source = this.changeSource;
        this.changeSource = 'programmatic';
        this.triggerMethod('form:change', values, state, { source });
      }
    }
    this.triggerMethod('form:state', state);
  }

  private waitForValue(node: FormKitNode, signal: AbortSignal): Promise<unknown> {
    if (node.isSettled) { return node.settled; }
    let receipt: string;
    let release: () => void;
    const removed = new Promise<void>(resolve => {
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
  protected settleSubmission(): void | Promise<void> {}

  // Keep notification intent with a queued prototype placement operation rather
  // than holding a global silent flag across awaits and unrelated native edits.
  protected compositionUpdateOptions(origin: FormKitNode = this.node): ValueUpdateOptions {
    return { notify: this.notifyFields,
      source: this.changeSource === 'programmatic' ? inputSources.get(origin) ?? this.changeSource : this.changeSource };
  }

  protected updateComposition(operation: () => void, options: ValueUpdateOptions) {
    this.updateValues(operation, options);
  }

  // Prototype placement owners know absent paths before a FieldView exists.
  // Commit an actual child-value removal without hydrating an entire root copy.
  protected clearAbsentField(path: string[]) {
    if (this.node.at([...path])) { throw new Error('Cannot clear an absent field while its node is mounted.'); }
    const parent = path.length === 1 ? this.node : this.node.at(path.slice(0, -1));
    if (!parent || parent.type !== 'group') { throw new Error('Absent field removal requires a live group parent.'); }
    compositions.get(this.node)!.excluded.set(path.join('.'), path);
    if (Object.hasOwn(parent.value as object, path.at(-1)!)) {
      parent.disturb();
      parent.calm({ name: path.at(-1)!, value: valueRemoved });
    }
  }

  async submit(event?: Event): Promise<SubmitResult> {
    if (this.disposed) { return 'cancelled'; }
    if (this.pending) { return 'busy'; }
    this.render();
    const focused = this.el.ownerDocument.activeElement;
    const ownedFocus = focused && this.el.contains(focused);
    const pending = new AbortController();
    this.pending = pending;
    this.submitted = true;
    {
      const submitted = (node: FormKitNode) => node.store.set(createMessage({ key: 'submitted', visible: false, value: true }));
      submitted(this.node);
      this.node.walk(submitted);
    }
    this.node.clearErrors();
    this.refresh();
    // Value settlement and validation settlement are separate core contracts.
    const cancelled = new Promise<'cancelled'>(resolve => {
      pending.signal.addEventListener('abort', () => resolve('cancelled'), { once: true });
    });
    const complete = async(): Promise<SubmitResult> => {
      let raw = false;
      do {
        const revision = this.#submissionRevision;
        await Promise.all([...this.ownedNodes].filter(node => node.root === this.node).map(node => this.waitForValue(node, pending.signal)));
        if (pending.signal.aborted) { return 'cancelled'; }
        await this.node.ledger.settled('validating');
        if (pending.signal.aborted) { return 'cancelled'; }
        await this.settleSubmission();
        if (pending.signal.aborted) { return 'cancelled'; }
        if (!raw) {
          raw = true;
          this.node.emit('submit-raw');
          this.node.props.onSubmitRaw?.(event, this.node);
        }
        // Live controls can start another delayed edit while a rule awaits.
        // Both contracts must be settled together before capturing values.
        // Raw-submit handlers may also change values or validation ownership.
        if (revision !== this.#submissionRevision) { continue; }
        // Any new validator invalidation increments the revision above. Values
        // can still be disturbed by an unchanged delayed write, so check those
        // separately after the settled validation boundary.
        if (![...this.ownedNodes].some(node => node.root === this.node && !node.isSettled)) { break; }
      } while (!pending.signal.aborted);
      if (pending.signal.aborted) { return 'cancelled'; }
      if (!this.getFormState().valid) {
        this.node.props.onSubmitInvalid?.(this.node);
        if (this.node.props.incompleteMessage !== false) {
          this.node.store.set(createMessage({ key: 'incomplete', type: 'ui', blocking: false,
            value: this.node.props.incompleteMessage ?? 'Form incomplete.',
            meta: { localize: this.node.props.incompleteMessage === undefined, i18nArgs: [{ node: this.node }], showAsMessage: true } }));
        }
        this.triggerMethod('submit:invalid', this.getValues());
        return 'invalid';
      }
      try {
        this.#submissionCallback = pending;
        const values = this.node.hook.submit.dispatch(this.getValues()) as Values;
        if (pending.signal.aborted) { return 'cancelled'; }
        const result = await (this.formOptions.submit ? this.formOptions.submit(values, { node: this.node, signal: pending.signal }) :
          this.node.props.onSubmit?.(values, this.node));
        if (pending.signal.aborted) { return 'cancelled'; }
        this.triggerMethod('submit:success', values, result);
        return 'success';
      } catch (error) {
        if (pending.signal.aborted) { return 'cancelled'; }
        this.setErrors([error instanceof Error ? error.message : 'Unable to submit.'],
          error instanceof SubmissionError ? error.fieldErrors : {});
        this.triggerMethod('submit:error', error);
        return 'error';
      }
    };
    try {
      return await Promise.race([complete(), cancelled]);
    } finally {
      if (this.#submissionCallback === pending) { this.#submissionCallback = undefined; }
      if (this.pending === pending) {
        this.pending = undefined;
        this.refresh();
        this.schemaRenderer?.update();
        const invalid = [...this.el.querySelectorAll<HTMLElement>('[aria-invalid="true"]')]
          .find(control => !control.matches(':disabled, input[type="hidden"]'));
        if (invalid) { invalid.focus(); } else if (ownedFocus && this.el.ownerDocument.activeElement === this.el.ownerDocument.body) {
          (focused as HTMLElement).focus({ preventScroll: true });
        }
      }
    }
  }

  resetForm() {
    if (this.disposed) { return this; }
    this.pending?.abort();
    this.pending = undefined;
    this.submitted = false;
    this.changeSource = 'reset';
    this.mutationDepth++;
    try {
      const values = this.excludeAbsent(cloneAny(this.initial));
      // Core reset assigns descendant baselines by current numeric address.
      // Restore known row identities first, without inputting values a second time.
      prepareRowReset(this.node, values);
      orderResetLists(this.node, values);
      resetNode(this.node, values);
    } finally { this.mutationDepth--; }
    this.node.clearErrors();
    this.refresh();
    this.changeSource = 'programmatic';
    this.schemaRenderer?.update();
    this.triggerMethod('form:reset', this.getValues());
    return this;
  }

  private dispose() {
    this.disposed = true;
    this.formCleanup?.();
    for (const receipt of this.receipts) { this.node.off(receipt); }
    this.pending?.abort();
    this.pending = undefined;
    const composition = compositions.get(this.node)!;
    // Regions retain View ownership. End input resources before their root,
    // including fields detached from their placement Regions.
    for (const field of [...composition.fields].reverse()) { field.release(); }
    disconnectRows(this.node);
    compositions.delete(this.node);
    this.schemaRenderer?.destroy();
    for (const node of [...this.ownedNodes].reverse()) { if (node !== this.node && node.context !== null) { node.destroy(); } }
    this.node.destroy();
    this.receipts = [];
  }
}

export class FieldView<Values extends object = FormValues> extends View {
  private fieldOptions: FieldOptions<Values>;
  private mount?: InputMount;
  private released = false;
  private receipt?: string;
  private previous: unknown;
  private releaseNative?: () => void;

  constructor(options: FieldOptions<Values>) {
    super({ ...options, template: () => '' });
    this.fieldOptions = options;
    this.on('before:destroy', () => this.release());
  }

  get node(): FormKitNode {
    if (!this.mount) { throw new Error('Render the FieldView before accessing its node.'); }
    return this.mount.node;
  }

  render() {
    if (this.isDestroyed()) { return this; }
    if (!compositions.has(this.fieldOptions.form.node)) { throw new Error('The FieldView owner has been destroyed.'); }
    if (!this.isRendered()) { super.render(); }
    return this;
  }

  attachElContent() {
    const { form, input, removal, name } = this.fieldOptions;
    const parent = this.fieldOptions.parent ?? form.node;
    if (parent.context === null || parent.root !== form.node || parent.type !== 'group') {
      throw new Error('Field parent must be a live group owned by its form.');
    }
    const composition = compositions.get(form.node)!;
    composition.mutate(() => {
      this.mount = ownedInputFactory(parent, composition.options, composition, () => this.destroy())({ document: this.el.ownerDocument,
        props: { ...input, name, preserve: removal === 'preserve', value: input.value,
          id: input.id ?? `${this.cid}-input` }, data: {} });
      this.releaseNative = composition.captureNativeEvents(this.el);
      this.el.replaceChildren(this.mount.element);
      this.previous = cloneAny(this.node.value);
      this.receipt = this.node.on('commit', () => {
        const value = cloneAny(this.node.value), source = inputSources.get(this.node) ?? 'programmatic';
        const notify = composition.notify();
        inputSources.delete(this.node);
        if (sameValues(value, this.previous)) { return; }
        this.previous = cloneAny(value);
        // Place the Region and finish node commits before consumer callbacks can
        // synchronously echo a snapshot or change conditional Region membership.
        if (notify) {
          queueMicrotask(() => {
            if (!this.released) { this.triggerMethod('field:change', value, { source }); }
          });
        }
      });

    });
  }

  setValue(value: unknown, options: ValueUpdateOptions = {}) {
    if (this.released) { return this; }
    if (this.node.type !== 'input' || !this.node.isSettled || !sameValues(this.node.value, value)) {
      compositions.get(this.fieldOptions.form.node)!.write(this.node, value, options);
    }
    return this;
  }

  getValue(): unknown { return cloneAny(this.node.value); }

  setInput(props: FieldInputUpdate) {
    if (this.released) { return this; }
    if (['type', 'id', 'value', 'name', 'parent', 'preserve', 'plugins', 'config', 'ignore'].some(key => Object.hasOwn(props, key))) {
      throw new Error('Replace the FieldView to change ownership or input identity; use setValue for values.');
    }
    this.fieldOptions.input = { ...this.fieldOptions.input, ...props };
    const { input, name, removal } = this.fieldOptions;
    this.mount?.update({ ...input, name, preserve: removal === 'preserve', id: input.id ?? `${this.cid}-input` }, {}, undefined);
    return this;
  }

  private release() {
    this.released = true;
    if (!this.mount) { return; }
    this.releaseNative!();
    const composition = compositions.get(this.fieldOptions.form.node)!;
    composition.mutate(() => {
      this.node.off(this.receipt!);
      this.mount!.destroy();
    });
  }
}

export { createSchemaRenderer } from './schema.ts';
export type { SchemaOptions, SchemaComponent, SchemaComponentFactory, SchemaSlot } from './schema.ts';
export type { RuntimeOptions } from './runtime.ts';

export { RowView } from './row-ownership.ts';
export type { RowOptions } from './row-ownership.ts';

export { SchemaView } from './schema-view.ts';
export type { SchemaViewOptions } from './schema-view.ts';
export { createViewComponents } from './view-components.ts';
export type { ViewComponentRegistration, ViewComponentsOptions } from './view-components.ts';

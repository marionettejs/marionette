// Isolated design prototype. Not exported by @mnjs/formkit.
import { FormView, FieldView } from '../../src/index.ts';
import { createObserver } from '@formkit/observer';
import { cloneAny, undefine } from '@formkit/utils';
import type { FormOptions, FieldInput, RemovalPolicy, ValueUpdateOptions } from '../../src/index.ts';
import type { FormKitNode } from '@formkit/core';
import type { RegionInstance } from 'marionette';

type Path = readonly string[];
type Condition = {
  dependencies: Readonly<Record<string, Path>>;
  test(values: Readonly<Record<string, unknown>>): boolean;
};
export interface CompositionDefinition {
  key: string;
  path: Path;
  region: string;
  input: FieldInput;
  retention: RemovalPolicy;
  when?: Condition;
}
type Entry = { definition: CompositionDefinition; region: RegionInstance; field?: FieldView };
const pathKey = (path: Path) => JSON.stringify(path);
const overlaps = (left: Path, right: Path) => left.slice(0, Math.min(left.length, right.length))
  .every((part, index) => part === right[index]);
const has = (value: unknown, path: Path): boolean => path.every(part => {
  if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) { return false; }
  value = (value as Record<string, unknown>)[part];
  return true;
});
const read = (value: unknown, path: Path): unknown => path.reduce<unknown>((current, part) =>
  current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined, value);
function freeze(value: unknown): unknown {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export class CompositionForm extends FormView {
  #manifest: readonly CompositionDefinition[];
  #entries: Entry[] = [];
  #observer?: ReturnType<typeof createObserver>;
  #compositionReceipts: string[] = [];
  #placementReceipts: { region: RegionInstance; wake: () => void }[] = [];
  #staged = new Map<string, unknown>();
  #queued = false;
  #running?: Promise<void>;
  #ended = false;
  #failure?: Error;
  #wakeRevision = 0;
  #pendingOptions: ValueUpdateOptions = {};
  #stop!: () => void;
  #stopped = new Promise<void>(resolve => { this.#stop = resolve; });

  constructor(options: FormOptions & { composition: readonly CompositionDefinition[] }) {
    if (!options.template || options.schema || options.fields) {
      throw new Error('Prototype composition requires an ordinary template; schema owns schema layouts.');
    }
    super(options);
    this.#manifest = options.composition.map(definition => ({ ...definition,
      path: [...definition.path], input: { ...definition.input },
      when: definition.when && { ...definition.when,
        dependencies: Object.fromEntries(Object.entries(definition.when.dependencies).map(([key, path]) => [key, [...path]])) }
    }));
    this.on('before:destroy', () => {
      this.#ended = true;
      this.#stop();
      this.#observer?.kill();
      this.#compositionReceipts.forEach(receipt => this.node.off(receipt));
      this.#compositionReceipts = [];
      this.#placementReceipts.forEach(({ region, wake }) => {
        for (const event of ['before:show', 'before:empty', 'before:destroy']) { region.off(event, wake); }
      });
      this.#placementReceipts = [];
      this.#entries = [];
      this.#staged.clear();
    });
  }

  render() {
    super.render();
    if (!this.#observer && !this.#ended) { this.#install(); }
    return this;
  }

  #install() {
    const byPath = new Map<string, CompositionDefinition>();
    const regions = new Set<string>(), keys = new Set<string>();
    for (const definition of this.#manifest) {
      if (!definition.key || keys.has(definition.key) || byPath.has(pathKey(definition.path)) || regions.has(definition.region)) {
        throw new Error('Composition keys, paths and placement Regions must be unique.');
      }
      for (const path of [definition.path, ...Object.values(definition.when?.dependencies ?? {})]) {
        if (!path.length || path.some(part => !part || part.includes('.') || /^\d+$/.test(part) || ['__proto__', 'constructor', 'prototype'].includes(part))) {
          throw new Error('Prototype paths require explicit nonempty group-name segments; dynamic list placement is deferred.');
        }
      }
      const region = this.getRegion(definition.region);
      if (!region || region.isDestroyed() || region.hasView()) {
        throw new Error(`Composition placement requires an empty live owned Region: ${definition.region}`);
      }
      keys.add(definition.key); regions.add(definition.region); byPath.set(pathKey(definition.path), definition);
    }
    const order: CompositionDefinition[] = [], visiting = new Set<CompositionDefinition>(), visited = new Set<CompositionDefinition>();
    const visit = (definition: CompositionDefinition) => {
      if (visiting.has(definition)) { throw new Error(`Cyclic composition dependencies: ${definition.key}`); }
      if (visited.has(definition)) { return; }
      visiting.add(definition);
      for (const path of Object.values(definition.when?.dependencies ?? {})) {
        if (overlaps(path, definition.path)) { throw new Error(`Self-dependent composition condition: ${definition.key}`); }
        for (const candidate of this.#manifest) { if (overlaps(path, candidate.path)) { visit(candidate); } }
      }
      visiting.delete(definition); visited.add(definition); order.push(definition);
    };
    this.#manifest.forEach(visit);
    this.#entries = order.map(definition => ({ definition, region: this.getRegion(definition.region)! }));
    this.#placementReceipts = this.#entries.map(({ region }) => {
      const wake = () => this.#schedule();
      for (const event of ['before:show', 'before:empty', 'before:destroy']) { region.on(event, wake); }
      return { region, wake };
    });
    this.#observer = createObserver(this.node);
    // Actual FormKit observation: value tracks commit; structural additions and
    // removal also need explicit wakeups when a declared node is currently absent.
    this.#observer.watch(root => { void root.children; return root.value; }, () => this.#schedule());
    this.#compositionReceipts = [this.node.on('commitRaw.deep', ({ origin }) => {
      // Capture the actual input origin before ordinary commit delivery consumes
      // it. Passive observer/settlement wakes do not replace this operation.
      this.#schedule(this.compositionUpdateOptions(origin));
    }), ...['child.deep', 'childRemoved.deep', 'settled'].map(event =>
      this.node.on(event, () => this.#schedule()))];
    this.#schedule();
  }

  #schedule(options?: ValueUpdateOptions) {
    if (this.#ended || this.#failure) { return; }
    if (options) { this.#pendingOptions = options; } else if (!this.#queued && !this.#running) {
      this.#pendingOptions = this.compositionUpdateOptions();
    }
    this.#wakeRevision++;
    if (this.#queued || this.#running) { return; }
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (this.#ended || this.#failure) { return; }
      this.#running = this.#reconcile().catch(error => {
        this.#failure = error;
        this.triggerMethod('composition:error', error);
      }).finally(() => { this.#running = undefined; });
    });
  }

  #committed(path: Path) {
    const node = this.node.at([...path]);
    // Read actual participating node state, not the parent's still-propagating
    // copy during a child's commit. A preserved absent value remains meaningful.
    return cloneAny(node ? node.value : read(this.node.value, path));
  }

  async #settle() {
    // A root input may settle before a pending descendant. Wait for the actual
    // participating nodes, and release waits when a node or its owner ends.
    while (!this.#ended) {
      const pending: FormKitNode[] = [];
      if (!this.node.isSettled) { pending.push(this.node); }
      this.node.walk(node => { if (!node.isSettled) { pending.push(node); } });
      if (!pending.length) { break; }
      await Promise.all(pending.map(node => {
        let receipt: string;
        const removed = new Promise<void>(resolve => { receipt = node.on('destroying', () => resolve()); });
        return Promise.race([node.settled, removed, this.#stopped]).finally(() => node.off(receipt));
      }));
    }
    await Promise.resolve();
  }

  async #reconcile() {
    let completed: number;
    do {
      await this.#settle();
      if (this.#ended) { return; }
      completed = this.#wakeRevision;
      const options = this.#pendingOptions;
      const staged = this.#staged;
      this.#staged = new Map();
      // A preflighted DAG, not a membership fixed-point loop. Every conditional
      // producer completes before downstream consumers in either declaration order.
      for (const entry of this.#entries) {
        if (this.#ended) { return; }
        const { definition, region } = entry;
        const declared = Object.fromEntries(Object.entries(definition.when?.dependencies ?? {})
          .map(([key, path]) => [key, freeze(this.#committed(path))]));
        const values = new Proxy(Object.freeze(declared), { get(target, key) {
          if (typeof key === 'string' && !Object.hasOwn(target, key)) {
            throw new Error(`Undeclared composition dependency: ${key}`);
          }
          return Reflect.get(target, key);
        } });
        const desired = definition.when ? definition.when.test(values) : true;
        if (typeof desired !== 'boolean') { throw new Error(`Composition conditions must return Boolean: ${definition.key}`); }
        if (entry.field && (entry.field.isDestroyed() || region.currentView !== entry.field)) {
          throw new Error(`Composition field placement was changed externally: ${definition.region}`);
        }
        if (region.isDestroyed() || (!entry.field && region.hasView())) {
          throw new Error(`Composition field placement was changed externally: ${definition.region}`);
        }
        if (desired && !entry.field) {
          const parent = definition.path.length === 1 ? this.node : this.node.at(definition.path.slice(0, -1));
          if (!parent || parent.type !== 'group' || parent.root !== this.node) {
            throw new Error(`Composition requires a live owned group parent: ${definition.key}`);
          }
          // Ordinary FieldView uses a version-pinned partial-removal adapter
          // beneath preserved ancestors. This prototype still defers that policy.
          for (let ancestor: FormKitNode | null = parent; ancestor; ancestor = ancestor.parent) {
            if (definition.retention === 'clear' && undefine(ancestor.props.preserve)) {
              throw new Error(`Prototype clear retention beneath a preserved group is deferred: ${definition.key}`);
            }
          }
          const field = new FieldView({ form: this, parent, name: definition.path.at(-1)!,
            removal: definition.retention, input: definition.input });
          const key = pathKey(definition.path);
          this.updateComposition(() => {
            region.show(field); entry.field = field;
            if (staged.has(key)) { void field.node.input(cloneAny(staged.get(key)), false); }
          }, options);
          await this.#settle();
        } else if (!desired && entry.field) {
          this.updateComposition(() => { region.empty(); entry.field = undefined; }, options);
          await this.#settle();
        } else if (!desired && definition.retention === 'clear') {
          this.updateComposition(() => this.clearAbsentField([...definition.path]), options);
          await this.#settle();
        }
      }
    } while (!this.#ended && completed !== this.#wakeRevision);
  }

  async settledComposition() {
    if (!this.isRendered() && !this.#ended) { this.render(); }
    await Promise.resolve();
    while (!this.#ended && (this.#queued || this.#running)) {
      // Awaiting undefined also yields to a queued reconciliation that has not
      // assigned its running promise yet.
      await this.#running;
    }
    if (this.#failure) { throw this.#failure; }
  }

  setValues(values: Record<string, unknown>, options: ValueUpdateOptions = {}) {
    super.setValues(values, options);
    for (const definition of this.#manifest) {
      if (has(values, definition.path)) {
        const key = pathKey(definition.path);
        if (!this.node.at([...definition.path]) && !has(this.node.value, definition.path)) {
          this.#staged.set(key, cloneAny(read(values, definition.path)));
        } else { this.#staged.delete(key); }
      }
    }
    this.#schedule(options);
    return this;
  }

  resetForm() {
    this.#staged.clear();
    super.resetForm(); this.#schedule(); return this;
  }

  protected settleSubmission() { return this.settledComposition(); }
}

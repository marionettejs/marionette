import Container, {type ChildViewContainer} from '../tmp/typed-core/src/modules/child-view-container.js';

interface Child {
  cid: string;
  model?: { id: number };
  name: string;
  amount: number;
  describe(prefix: string): string;
  clear(): void;
}
declare const child: Child;
const children = new Container<Child>();
children._add(child);
const count: number = children.length;
const context = { prefix: 'Item', threshold: 2 };
const same: typeof children = children.each(function(view, index) {
  const text: string = view.describe(this.prefix);
  const position: number = index;
}, context);
const extended = Object.assign(children, {label: 'children'});
const sameExtended: typeof extended = extended.each(() => {});
const mapped: string[] = children.map((view, index) => `${index}:${view.name}`);
const mappedContext: string[] = children.map(function(view, index) { return `${this.prefix}:${index}:${view.name}`; }, context);
const reduced: Child = children.reduce((previous, view, index) => previous.amount > index ? previous : view);
const total: number = children.reduce((sum, view, index) => sum + view.amount + index, 0);
const named: string = children.reduce(function(text, view, index) { return text + this.prefix + view.name + index; }, '', context);
const explicitUndefined: undefined = children.reduce((value, view) => value, undefined);
const found: Child | undefined = children.find(view => view.amount);
const foundContext: Child | undefined = children.find(function(view, index) { return view.amount > this.threshold + index; }, context);
const filtered: Child[] = children.filter(view => view.amount);
const rejected: Child[] = children.reject(function(view) { return view.amount < this.threshold; }, context);
const every: boolean = children.every((view, index) => view.amount > index);
const some: boolean = children.some(function(view) { return view.name.startsWith(this.prefix); }, context);
const contains: boolean = children.contains(child);
children.contains(child.model);
children.contains(null);
children.without({unrelated: true});
children.findIndexByView(undefined);
children.hasView({cid: child.cid});
const invoked: string[] = children.invoke('describe', 'Item');
const cleared: void[] = children.invoke('clear');
const copy: Child[] = children.toArray();
const first: Child | undefined = children.first();
const firstUndefined: Child | undefined = children.first(undefined);
const firstCount: Child[] = children.first(2);
const last: Child | undefined = children.last();
const lastCount: Child[] = children.last(2);
declare const optionalCount: number | undefined;
const union: Child | Child[] | undefined = children.last(optionalCount);
const initial: Child[] = children.initial();
const rest: Child[] = children.rest(1);
const without: Child[] = children.without(child);
const empty: boolean = children.isEmpty();
const names: string[] = children.pluck('name');
const models: ({id: number} | undefined)[] = children.pluck('model');
const absent: unknown[] = children.pluck('absent');
const partitioned: [Child[], Child[]] = children.partition(function(view, index) { return view.amount > this.threshold + index; }, context);
const modelFound: Child | undefined = children.findByModel(child.model);
const keyFound: Child | undefined = children.findByKey({ id: 1 });
const indexFound: Child | undefined = children.findByIndex(1);
const position: number = children.findIndexByView(child);
const cidFound: Child | undefined = children.findByCid('child');
const hasView: boolean = children.hasView(child);
for (const view of children) { const name: string = view.name; }
const iterator: IteratorResult<Child, undefined> = children[Symbol.iterator]().next();
children._sort(view => view.name);
children._sort((left, right) => left.amount - right.amount);
children._sort(function(view) { return this.prefix + view.name; }, context);
children._sort('name');
const structural = new Container<{cid: symbol; custom: boolean}>();
structural._add({cid: Symbol(), custom: true});
const custom: boolean | undefined = structural.first()?.custom;
const provider = {key(model: {id: number}) {return model.id;}, get(model: {id: number}, key: 'id') {return model[key];}, has(model: {id: number}, key: string) {return key === 'id';}};
new Container<Child>(provider);
declare const reachable: ChildViewContainer<Child>;
const reachableName: string | undefined = reachable.findByCid('child')?.name;

// @ts-expect-error Child identity requires cid, not View inheritance.
new Container<{name: string}>();
// @ts-expect-error Stored children retain their actual required fields.
children._add({cid: 'incomplete'});
// @ts-expect-error Callbacks must be functions.
children.map('name');
// @ts-expect-error Traversal passes Child, not its model.
children.each((model: {id: number}) => {});
// @ts-expect-error Traversal passes only child and index, no third collection argument.
children.each((view: Child, index: number, collection: Child[]) => {});
// @ts-expect-error Callback receiver requires the supplied matching context.
children.map(function(this: {prefix: number}, view) {return this.prefix;}, context);
// @ts-expect-error Omitted context cannot satisfy an explicit required receiver.
children.map(function(this: {prefix: string}, view) {return this.prefix;});
// @ts-expect-error Reducer results must match the chosen accumulator.
children.reduce((sum: number, view) => view.name, 0);
// @ts-expect-error Reduce without an initializer begins with a Child accumulator.
children.reduce((sum: number, view) => sum + view.amount);
// @ts-expect-error Dynamic predicates still preserve child return identity.
const wrongFilter: number[] = children.filter(() => true);
// @ts-expect-error Invoke arguments match the selected method.
children.invoke('describe', 2);
// @ts-expect-error A known noncallable field cannot be invoked.
children.invoke('name');
// @ts-expect-error Invoke preserves the selected method result.
const wrongInvoke: number[] = children.invoke('describe', 'Item');
// @ts-expect-error An omitted-count lookup may be empty.
const definite: Child = children.first();
// @ts-expect-error Count form returns an array.
const wrongCount: Child = children.last(1);
// @ts-expect-error Counts use numbers.
children.first('1');
// @ts-expect-error Indexed lookups may be missing.
const definiteLookup: Child = children.findByIndex(0);
// @ts-expect-error A known property keeps its value type.
const wrongPluck: number[] = children.pluck('name');
// @ts-expect-error Missing dynamic properties have no promised value type.
const wrongAbsent: string[] = children.pluck('absent');
// @ts-expect-error Partition returns a pair of arrays, not a flat array.
const wrongPartition: Child[] = children.partition(() => true);

interface ReceiverChild {
  cid: string;
  name: string;
  read(this: {name: string}): string;
  ignoreReceiver(this: void): number;
  incompatible(this: {missing: string}): string;
  requiresUndefined(this: undefined): string;
}
const receivers = new Container<ReceiverChild>();
const receiverNames: string[] = receivers.invoke('read');
const ignoredReceivers: number[] = receivers.invoke('ignoreReceiver');
// @ts-expect-error Invoke always supplies the child as receiver.
receivers.invoke('incompatible');
// @ts-expect-error An explicitly undefined receiver cannot be supplied by invoke.
receivers.invoke('requiresUndefined');

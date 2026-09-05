import MnObject from '../tmp/typed-core/src/modules/object.js';

const Worker = MnObject.extend({
  initialize(options: { label: string }) {
    const label: string = this.options.label;
    this.on({ completed: this.complete }, this);
    this.listenTo(this, 'progress', (value: number) => { value.toFixed(); });
    const channel = this.getChannel();
    channel?.reply('label', () => label);
    this.Radio.on('worker', 'completed', () => {});
    this.Radio.on('worker', { completed: () => {} }, this);
    this.Radio.setDebug(false);
    this.trigger({ progress: 1 });
    this.bindEvents(this, { done: 'complete' });
    this.unbindEvents(this);
    const normalized = this.normalizeMethods({ done: 'complete' });
    normalized.done();
    const absent: undefined = this.normalizeMethods();
    this.mergeOptions(options, ['label']);
    // @ts-expect-error Options retain their type.
    const wrong: number = this.options.label;
  },
  complete() { return true; },
  createState() { return { ready: false }; },
}, { category: 'worker' as const });
const worker = new Worker({ label: 'Example' });
const completed: boolean = worker.complete();
const ready: boolean = worker.getState().ready;
const category: 'worker' = Worker.category;
const same: typeof worker = worker.destroy();
// @ts-expect-error Unknown instance members do not become any.
worker.missing();
// @ts-expect-error Constructor options retain their type.
new Worker({ label: 1 });
// @ts-expect-error Native MnObject has no request method.
worker.request('label');

const supplied = { enabled: true };
const suppliedOwner = new MnObject({ state: supplied });
const enabled: boolean = suppliedOwner.getState().enabled;
// @ts-expect-error Supplied state does not acquire arbitrary properties.
suppliedOwner.getState().missing;
const nullOwner = new MnObject({ state: null });
const nullState: null = nullOwner.getState();
const defaultOwner = new MnObject({ state: undefined });
const defaultState: object = defaultOwner.getState();

Worker.setStateApi({
  subscribe(source: { ready: boolean }, name, callback, context) {
    callback.call(context, source, name);
    return () => {};
  }
});
// @ts-expect-error State subscriptions must return a cleanup function.
Worker.setStateApi({ subscribe() { return 123; } });
const Next = Worker.extend({ next() { return this.complete(); } });
const next = new Next({ label: 'Next' });
const inherited: boolean = next.next();
const Unchanged = Next.extend();
const unchanged: boolean = new Unchanged({ label: 'Same' }).next();
class NativeWorker extends Worker {
  native() { return this.complete(); }
}
const native: boolean = new NativeWorker({ label: 'Native' }).native();

const Named = MnObject.extend({
  label: '',
  constructor: function(label: string, count: number) {
    MnObject.apply(this, arguments);
    MnObject.call(this, { label });
    this.label = `${label}:${count}`;
  },
  read() { return this.label; }
});
const named: string = new Named('Example', 2).read();
// @ts-expect-error Custom constructor arguments retain their types.
new Named(2, 'Example');
const suppliedWorker = new Worker({ label: 'Example', state: { other: true } });
const other: boolean = suppliedWorker.getState().other;
// @ts-expect-error Constructor-supplied state replaces the factory result.
suppliedWorker.getState().ready;

const Borrowed = MnObject.extend({ state: { borrowed: true } });
const WithFactory = Borrowed.extend({ createState() { return { owned: true }; } });
const borrowed: boolean = new WithFactory().getState().borrowed;
// @ts-expect-error An inherited borrowed source still takes precedence over a factory.
new WithFactory().getState().owned;
const WithoutBorrowed = WithFactory.extend({ state: undefined });
const owned: boolean = new WithoutBorrowed().getState().owned;
const DefaultState = Borrowed.extend({ state: undefined });
const empty: object = new DefaultState().getState();
// @ts-expect-error Undefined removes the inherited borrowed state.
new DefaultState().getState().borrowed;

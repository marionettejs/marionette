# Practical TypeScript

Marionette and the companion packages ship declarations with their public entrypoints. Use strict TypeScript checking and the DOM library for browser code. Your bundler's module-resolution settings still apply; see [consumer tooling](../tooling.md) for a checked project setup.

## Constructors, instances, options, and state

`View` is a constructor value. A constructor created with `View.extend` keeps the options declared by its `initialize` method, custom methods, and the state returned by `createState`. Use `typeof` for the constructor and `InstanceType` for its instance. Broader public types such as `ViewInstance` are useful at boundaries that only need core methods; they do not describe your custom methods.

```ts
import { View } from 'marionette';

type CounterOptions = { label: string };
const CounterView = View.extend({
  tagName: 'button',
  template: false,
  initialize(options: CounterOptions) {
    this.el.textContent = options.label;
  },
  createState() { return { count: 0 }; },
  events: { click: 'increment' },
  increment() { this.getState().count++; },
  label() { return this.options.label; }
});

type CounterConstructor = typeof CounterView;
type Counter = InstanceType<CounterConstructor>;
const counter: Counter = new CounterView({ label: 'Count' });
const label: string = counter.label();
const count: number = counter.getState().count;
```

Here `new CounterView()` and a numeric `label` are type errors. A typed `initialize` signature can declare the constructor options even when its body needs no setup, as in the later examples. Custom options remain in `this.options`; Marionette does not copy every option onto the instance. Read them there or with `getOption`. Each `createState` call creates this View's own state. Constructor-supplied `state` is borrowed and replaces the factory state; see [state ownership](../api/shared/state.md).

A native `class` can extend `CounterView` and inherit these types. Native class fields run after `super`, including Marionette initialization: avoid using them to replace configuration needed during construction or values assigned by `initialize`. Preserve parent lifecycle behavior when overriding methods. The [View reference](../api/view.md#typescript) lists the public instance and constructor types.

## Local DOM interactions

DOM event targets and UI matches need runtime narrowing. With the native delegator, `delegateTarget` is the element matched by the selector; `target` can be a nested element. This example uses the native delegator; a custom delegator must provide the matched-element behavior this handler relies on. `getUI` can return `undefined`, and its default public query type is `ArrayLike<Element>`, so index it rather than assuming NodeList or jQuery methods.

This local editor owns a plain state object. It uses a class-scoped Lit adapter to insert text safely and a delegated DOM handler to update state. Lit updates the preview while retaining the input and its caret.

```ts
import { View, type DelegatedEvent } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';

const EditorView = View.extend({
  template: ({ title }: { title: string }) => html`
    <label>Title <input class="title" .value=${live(title)}></label>
    <p class="preview">${title}</p>
  `,
  templateContext() { return this.getState(); },
  ui: { title: '.title' },
  createState() { return { title: 'Untitled' }; },
  events: { 'input @ui.title': 'editTitle' },
  editTitle(event: DelegatedEvent) {
    const input = event.delegateTarget;
    if (!(input instanceof HTMLInputElement)) { return; }
    this.getState().title = input.value;
    this.render();
  },
  focusTitle() {
    const input = this.getUI('title')?.[0];
    if (input instanceof HTMLInputElement) { input.focus(); }
  }
});
EditorView.setDomApi(LitDomApi);
const editor = new EditorView().render();
document.body.append(editor.el);
editor.focusTitle();
```

The element checks establish what the code uses: `value` and `focus`. They also handle missing UI bindings. These types do not guarantee the selector exists in every template. Event maps use string names; TypeScript does not verify that a method annotation matches every event payload. Interaction tests verify that delivery. No Application is needed for this View's local interaction. Use [local editing](local-editing.md) when a borrowed Model supplies the data.

## Readiness results and lifecycle completion

An Application's `prepareStart` returns data required before activation. `onStart` receives that resolved result as its third argument. The public `start`, `stop`, and `restart` operations return `Promise<boolean>`: their boolean reports lifecycle completion, rather than the preparation data. A rejection remains an error to handle.

TypeScript does not validate a server response. Treat parsed JSON as `unknown`, validate the fields your feature needs, and only then return a typed result. This example validates one title field; use your application's API schema validation for larger responses.

```ts
import { Application, View, type LifecycleContext } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

type Summary = { title: string };
const SummaryView = View.extend({
  initialize(_options: Summary) {},
  templateContext() { return { title: this.options.title }; },
  template: ({ title }: Summary) => html`<h1>${title}</h1>`
});
SummaryView.setDomApi(LitDomApi);

const SummaryApplication = Application.extend({
  async prepareStart(_options: unknown, { signal }: LifecycleContext): Promise<Summary> {
    const response = await fetch('/summary.json', { signal });
    if (!response.ok) { throw new Error('Could not load summary'); }
    const value: unknown = await response.json();
    if (typeof value !== 'object' || value === null ||
        !('title' in value) || typeof value.title !== 'string') {
      throw new Error('Invalid summary response');
    }
    return { title: value.title };
  },
  onStart(_application: unknown, _options: unknown, summary: Summary) {
    this.setView(new SummaryView(summary));
    this.showView();
  }
});

const mount = document.createElement('main');
document.body.append(mount);
const app = new SummaryApplication({ region: { el: mount } });
const activation: Promise<boolean> = app.start();
const activated: boolean = await activation;
```

The Application owns readiness and the displayed View. Pass the lifecycle signal to transport; Stopping or destroying during pending preparation prevents that startup from activating and aborts its signal. An active refresh needs a separate operation and request policy; see [retained refresh](retained-refresh.md). Reuse the same `Summary` type in preparation and the explicitly annotated completion hook. Keep concrete application types when hooks or subclasses rely on an inherited preparation-result contract; the general `ApplicationInstance` type defaults that result to `unknown`.

## Typed data and provider boundaries

Marionette's `model` and `collection` properties are `unknown` at the general View boundary because data providers are replaceable. Registering `DataApi` does not narrow those properties. For a feature using native Models, declare the source in initializer options and access the typed option directly. The option and the View's `model` refer to the same borrowed source in this example.

```ts
import { View } from 'marionette';
import { Model, DataApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

type TitleAttributes = { title: string };
type TitleOptions = { model: Model<TitleAttributes> };
const TitleView = View.extend({
  initialize(_options: TitleOptions) {},
  templateContext() {
    return { title: this.options.model.get('title') ?? 'Untitled' };
  },
  template: ({ title }: { title: string }) => html`<h1>${title}</h1>`,
  modelEvents: { 'change:title': 'render' }
});
TitleView.setDataApi(DataApi);
TitleView.setDomApi(LitDomApi);
const model = new Model<TitleAttributes>({ title: 'Overview' });
const title = new TitleView({ model }).render();
const current: string | undefined = model.get('title');
```

`Model.get` can return `undefined` even with typed attributes: Models accept partial attributes and fields can be removed. A View borrows its Model; destroying the View releases its subscription without destroying that source.

`@mnjs/data` is optional and incomplete. It provides local Models, Collections, and adapters, with no native `fetch`, `save`, or server synchronization. It may sit behind an API layer or be replaced with another data solution. Define and validate types at that solution's boundary; choose a compatible [data provider](../api/providers/data.md) for Marionette. Type annotations establish shape, while providers and ownership establish runtime behavior.

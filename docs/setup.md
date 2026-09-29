# Setup and data

Use the packages installed by the [quick start](quick-start.md), including `@mnjs/data`. This page configures Lit rendering and observable data; those are independent integration choices. Core framework methods are covered in the [API reference](api.md).

## Configure once

Import a setup module before constructing Applications or Views:

```js
// setup.js
import { setDataApi, setDomApi, setRenderer, setStateApi } from 'marionette';
import { DataApi, StateApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';

setDataApi(DataApi);
setStateApi(StateApi);
setDomApi(LitDomApi);
setRenderer((template, data) => template(data));
```

These setters configure the default class family. Use [runtime configuration](api/runtime.md) for class-specific or isolated setup, and the [provider references](api/data-providers.md) when connecting a different data solution. `DataApi` connects Models and Collections to Views; `StateApi` connects observable state to Applications and Views. The renderer calls a template function with its data, and the Lit DOM adapter places the result in the View's element.

```js
import './setup.js';
import { View } from 'marionette';
import { html } from 'lit-html';

export const DetailView = View.extend({
  template: ({ title, description }) => html`
    <h3>${title}</h3>
    <p>${description}</p>
  `,
});
```

Ordinary Lit interpolation renders these values as text, including characters such as `<`. No HTML escaping helper is needed. A View supplied with a Model receives its attributes as template data.

## Observable data and API access

`@mnjs/data` is a workable but incomplete observable data layer. Use it alongside an API layer for fetching and persistence, or replace it with another data solution and the corresponding Marionette integration. Models and Collections do not provide an HTTP client, server synchronization, or a complete application data architecture.

For initial feature data, an Application can import its API module directly, await the request in `prepareStart`, and return a Collection built from the response attributes. The successful result reaches `onStart`. If the API layer already supplies a compatible observable source, use it directly.

### Model

```js
import { Model, Collection } from '@mnjs/data';

const record = new Model({ id: 'alpha', title: 'First record' });
record.get('title');                  // 'First record'
record.set('title', 'Updated record');
record.set({ title: 'Another title' });
record.id;                           // 'alpha'
```

`set` updates supplied attributes and emits `change:attribute` and `change` events when values change. Unmentioned attributes remain. `id` reflects the `id` attribute by default. `reset(attributes)` replaces the attribute set, including any Model defaults, and removes attributes absent from the replacement.

An Application can create its own state:

```js
createState() {
  return new Model({ selectedId: null });
}
```

Read it with `this.getState()` and update it with `set`. With this StateApi configured, Marionette disposes state created by `createState` when its owner is destroyed. Passing `{ state }` to a child borrows the same state; the child does not own its disposal.

### Collection

```js
const records = new Collection([
  { id: 'alpha', title: 'First record' },
]);
records.get('alpha'); // Model, or undefined when absent
records.length;      // 1
```

A Collection turns attribute objects into Models; supplied Model instances retain their identity. `get` accepts an ID, client ID, or a contained Model.

`records.reset(nextRecords)` replaces membership and emits `reset`. Raw attributes become new Models; this is not a merge into existing Models by ID. There is no `Collection.set` merge API. Update an existing record with `records.get(id).set(attributes)`, or use `add` and `remove` to change membership.

`Model.destroy()` and `Collection.destroy()` perform local event teardown, not HTTP deletion. Collection destruction does not destroy its Models. Effect-free local data needs no manual destruction once it becomes unreachable; dispose data explicitly when its ownership includes subscriptions or other resources that must end.

# Setup and data

Continue from the [quick start](../quick-start.md). This page adds `@mnjs/data` for observable data and retains the Lit rendering configuration; those are independent integration choices. Core framework methods are covered in the [API reference](../api.md).

## Add observable data

From the example project, install the data tarball produced alongside the other candidate packages:

```sh
npm install --ignore-scripts --save-exact ../marionette-v5-artifacts/mnjs-data-5.0.0-rc.2.tgz
```

Use a different source with its compatible provider when it better fits your application. Views using plain template data do not require this package.

## Configure once

Import a setup module before constructing Applications or Views:

```js
// setup.js
import { setDataApi, setDomApi, setStateApi } from 'marionette';
import { DataApi, StateApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';

setDataApi(DataApi);
setStateApi(StateApi);
setDomApi(LitDomApi);
```

These setters configure the default class family. Use [runtime configuration](../api/runtime.md) for class-specific or isolated setup, and the [provider references](../api/providers/data.md) when connecting a different data solution. `DataApi` connects Models and Collections to Views; `StateApi` connects observable state to [state owners](../api/runtime.md#choose-a-configuration-scope). The renderer calls a template function with its data, and the Lit DOM adapter places the result in the View's element.

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

For [initial feature data](../api/application.md#prepare-before-showing-ui), an Application can import its API module directly, await the request in `prepareStart`, and return a Collection built from the response attributes. The successful result reaches `onStart`. If the API layer already supplies a compatible observable source, use it directly.

```js
import { Model, Collection } from '@mnjs/data';

const item = new Model({ id: 'alpha', title: 'First item' });
const items = new Collection([item]);
item.set('title', 'Updated item');
```

Use [Model and Collection](../packages/data.md) for attribute updates, membership, identity, events, and local disposal. A View can observe Model changes through `modelEvents`; CollectionView observes membership changes through DataApi. Reading data into a template alone does not subscribe to later attribute changes.

Use [state ownership](../api/shared/state.md) when an Application or View needs its own observable state. With StateApi configured, `createState` can return a Model whose disposal belongs to the owner. Passing `{ state }` borrows an existing source instead.

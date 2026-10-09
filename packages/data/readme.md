# @mnjs/data

Observable `Model` and ordered `Collection` sources for Marionette v5. This
package depends only on `@mnjs/utils` and works without Marionette core or a DOM.
This README describes the rebuilt `5.0.0-rc.2` candidate; a registry package
with the same version has not been verified to contain this documentation.

It is a workable but incomplete application data layer. Supply fetching,
persistence, validation, and server synchronization through an API layer, or use
another data solution with a compatible Marionette provider. Models and
Collections do not include `fetch`, `save`, or HTTP deletion methods.

## Standalone use

Place the supplied `@mnjs/data` and `@mnjs/utils` candidate tarballs in an
`artifacts` directory in your project, then install them together:

```sh
npm install --ignore-scripts --save-exact ./artifacts/*.tgz
```

```js
import { Collection, Model } from '@mnjs/data';

const item = new Model({ id: 'a', title: 'First item' });
const items = new Collection([item]);

item.on('change:title', (model, title) => console.log(title));
item.set('title', 'Updated item');
items.add({ id: 'b', title: 'Second item' });
items.toArray(); // Shallow attribute copies for serialization.
```

Attribute mutations publish synchronous change events. Collection membership and
order changes publish structural events. Existing Models retain their identity;
raw attribute objects construct Models. `reset` replaces membership, while
`add`, `remove`, `move`, and updates to existing Models preserve retained members.

`destroy()` ends the local event lifetime. Destroying a Collection releases its
subscriptions without destroying its Models. Removing an item from a Collection
also leaves the Model alive.

## Marionette integration

Add the matching `marionette` and `@mnjs/radio` candidate tarballs to the same
`artifacts` directory and rerun the installation command above for the full set.

Configure providers before constructing consumers:

```js
import { setDataApi, setStateApi } from 'marionette';
import { DataApi, StateApi } from '@mnjs/data';

setDataApi(DataApi);
setStateApi(StateApi);
```

DataApi connects Models and Collections to Views and CollectionViews. StateApi
connects observable state and its ownership lifecycle. Rendering is configured
separately. Views borrow their data; state returned by `createState` is owned.

## Version-matched reference

The matching `marionette` candidate includes the canonical reference. If you
have installed it, open these files from your project directory:

- `node_modules/marionette/docs/packages/data.md`: all Model/Collection methods,
  configuration, events, identity, disposal, and exported TypeScript types.
- `node_modules/marionette/docs/integrations/setup.md`: renderer and provider setup.
- `node_modules/marionette/docs/api/providers/data.md`: integration contracts for
  native and alternative data solutions.

These paths describe the candidate's installed files, not a verified registry
release. Standalone use of `@mnjs/data` does not require core. General project
information is available on the [Marionette website](https://marionettejs.com/).

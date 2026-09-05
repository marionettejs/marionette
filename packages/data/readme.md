# @marionette/data

Dependency-light observable `Model` and ordered `Collection` sources for
Marionette v5. Install both packages and configure the runtime before creating
owners:

```sh
npm install marionette @marionette/data
```

```js
import { createMarionette } from 'marionette';
import { Collection, DataApi, Model, StateApi } from '@marionette/data';

const Marionette = createMarionette();
Marionette.setDataApi(DataApi);
Marionette.setStateApi(StateApi);

const state = new Model({ selectedId: null });
const collection = new Collection([{ id: 1, label: 'one' }]);
const view = new Marionette.CollectionView({ collection, state });
```

`Collection` reports synchronous `kind: 'update'`, `kind: 'reorder'`, and
`kind: 'reset'` records through `DataApi.observeCollection()`. `Model` and
`Collection` expose `on()`, `once()`, `off()`, `trigger()`, and
`triggerMethod()` for Marionette entity event maps.
`DataApi.models(collection)` returns the current ordered model snapshot.

`Model` provides `get`, `has`, `set`, `unset`, `clear`, `reset`, `toJSON`, and
`destroy`. `Collection` provides ordered `at`, `get`, `indexOf`, iteration,
`forEach`, `map`, `add`, `remove`, `reset`, `replace`, `touch`, `move`, `swap`,
`sort`, `toJSON`, and `destroy` operations. Pass `{ silent: true }` to a
structural mutation to suppress its normalized record and entity events.
`destroy()` is the exception and always emits its destruction event.

Define subclass `defaults` on the prototype, for example with `Model.extend`, a
prototype method, or a prototype getter. Native class fields initialize after
`super()` returns, so a `defaults = { ... }` field cannot seed construction.

Model identity is stable while a Model belongs to a Collection. Duplicate
instances or ids are rejected before a reset or replacement changes the ordered
model snapshot; `add` ignores an instance or id that is already present. The
package does not provide persistence, REST synchronization, validation, or
implicit Backbone compatibility.

## TypeScript

The package includes ESM and CommonJS declarations and a TypeScript 4.6-compatible
entry. `Model.extend` and `Collection.extend` retain added methods, descendants,
static replacements, and their normal attribute/model constructor inference.
Event registration accepts typed callbacks and maps; event names do not validate
payload types. A borrowed `triggerMethod` requires a receiver with a callable
`trigger` method.

A custom constructor must initialize the receiver itself. An explicit object
return describes a replacement instance; an unknown result stays unknown. To
return the initialized receiver while preserving methods added by descendants,
state that contract explicitly:

```ts
const Named = Model.extend({
  constructor: function<Receiver extends Model>(
    this: Receiver, attributes: { label: string }
  ): Receiver {
    Model.call(this, attributes);
    return this;
  },
  label() { return String(this.get('label')); }
});
```

The same form works with `Collection`. A constructor declared to return `void`
or a primitive declares ordinary construction; the caller is responsible for
honoring that declaration. TypeScript's `void` return erasure can hide an object
return, so the declarations cannot prove that contract from arbitrary constructor
implementations. An inferred fixed receiver return does not promise methods
added by later descendants.

Direct native subclasses remain supported. Calling their inherited `.extend()`
without an explicit constructor is rejected because that path calls the parent
with `apply`, which cannot invoke a native class. An explicit constructor skips
that forwarding path and owns its initialization or replacement result.

TypeScript 4.6 narrows `instanceof` checks for the root constructors and ordinary
method-only extensions. Its callable-intersection limitation prevents that
narrowing on extensions with custom statics; directly constructed instances and
those static members remain typed.

A `Collection.extend({ model: ModelClass })` configuration can convert input
instances into that model class, and constructor `options.model` can replace the
configuration. These configured collections conservatively expose the union of
the configured class and the inferred input or option model. Narrow an item with
`instanceof ModelClass` before using methods specific to that class. The instance
`model` constructor has the same conservative result. Collections without a
prototype `model` override retain their ordinary input and option inference.

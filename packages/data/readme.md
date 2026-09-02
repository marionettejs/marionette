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
instances or ids are rejected before a reset or replacement changes the
ordered snapshot; `add` ignores an instance or id that is already present. The
package does not provide persistence, REST synchronization, validation, or
implicit Backbone compatibility.

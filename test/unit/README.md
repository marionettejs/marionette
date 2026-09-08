# Unit tests

Run all unit tests with `npm test`, or invoke Vitest directly for a focused run:

```sh
npx vitest run test/unit/region-lifecycle.spec.js
npx vitest run --project=node
npx vitest run --project=dom -t 'preserves focus'
npx vitest run --coverage
npx vitest run --sequence.shuffle --sequence.seed=1234
```

The Node project covers pure utilities, events, Radio, and data contracts without a
DOM. The DOM project uses jsdom. Real browser contracts live in `test/browser`.
Coverage includes every production module. Reviewed defensive-path exceptions
are capped per file in `config/coverage-exceptions.json`; never manufacture private
states or exclude code for a score. The HTML report is `coverage/library/index.html`.
See the [test guide](../README.md) for commands, reports, and release validation.

## Public contracts

Exercise the published API and assert observable outcomes: return values, public
state, events, rendered DOM, identity, focus, and released subscriptions. Never
call, assert, spy on, or stub private library functions or inspect private fields.
Do not add production exports merely to make implementation details testable.
The boundary checker enforces direct access/import restrictions. A public refactor should not fail because a private helper changed.

Group tests by the contract they protect. Prefer a shallow `describe` hierarchy
and descriptive outcomes over one test per implementation method. Keep each
regression readable and independently runnable.

## Native Vitest APIs

Import the APIs you use directly. There are no global test functions, Mocha
`this` contexts, Sinon sandboxes, or custom wrappers. Use `vi.fn`, `vi.spyOn`,
native mock assertions, `it.each`, and native fixtures when useful.

```js
import { expect, it, vi } from 'vitest';
import { createMarionette } from 'marionette';

it('delivers a public event once', () => {
  const { MnObject } = createMarionette();
  const owner = new MnObject();
  const onChange = vi.fn();
  owner.on('change', onChange);

  owner.trigger('change', 'saved');

  expect(onChange).toHaveBeenCalledExactlyOnceWith('saved');
  owner.destroy();
});
```

Create an isolated runtime with `createMarionette()` when changing configuration.
The real default exports retain the neutral plain-object/array DataApi. Backbone
integration specs explicitly import `test/setup/backbone.js`; core tests must not
inherit that configuration. Import Backbone, Underscore, and jQuery only where
needed.

DOM specs that need a mounted fixture can import `setFixtures` from
`test/setup/fixtures.js`. It creates a fixture root and removes its contents after
each test. Tests are responsible for destroying the instances they create. The
shared setup restores `vi.spyOn` replacements after every test; it does not
silently destroy library objects or repair library state.

For receiver or DOM identity, use identity assertions against recorded mock calls
or contexts. Deep equality can treat distinct DOM nodes as equivalent. Assert
call order only when order is part of the public contract.

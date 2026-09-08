# TypeScript in an application

Use the declarations shipped by the installed `marionette` package. Core does
not need `@types/backbone` or an additional Marionette type package. Install type
packages for an optional integration only when your application imports it; see
[installation](./installation.md#peer-dependencies).

## Match the compiler to the runtime

For a browser application whose existing bundler emits JavaScript, a minimal
starting configuration is:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": false
  },
  "include": ["src"]
}
```

Run the application's installed compiler with `npx tsc --noEmit`, then run its
normal bundler. This example assumes a toolchain supporting that target; it does
not supply browser polyfills. Preserve the application's existing target when it
is constrained by its supported browsers.

For modules executed directly by Node, use `module: "NodeNext"` and
`moduleResolution: "NodeNext"`. Mark ESM using `"type": "module"` in package.json
or `.mts` files. Use `.cts` for explicit CommonJS. Select resolution according to
the program that loads the emitted modules, as described in the
[TypeScript compiler guide](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options).

Marionette's declarations are checked with TypeScript 6 and 7 in the repository.
The [installed consumer fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/core-types/consumer.mts) covers
strict ESM, CommonJS, and bundler resolution. A successful source-only compiler run
is not a substitute for checking the package your application actually installs.

## Give application options a type

Annotate `initialize` when using `.extend`. The constructor and `this.options`
then share that application option contract. Use public methods to expose
application values rather than writing ad hoc properties through a cast.

```ts
import { Region, View } from 'marionette';

const MessageView = View.extend({
  template: () => '<p></p>',
  initialize(options: { message: string }) {
    // The annotation defines required application options.
    void options;
  },
  onRender() {
    const paragraph = this.el.querySelector('p');
    if (!paragraph) throw new Error('Message template requires a paragraph');
    paragraph.textContent = this.options.message;
  },
  message(): string {
    return this.options.message;
  }
});

const mount = document.createElement('main');
document.body.append(mount);
const region = new Region({ el: mount });
region.show(new MessageView({ message: 'Ready' }));
// On feature removal: region.destroy(); mount.remove();
```

`new MessageView()` and `new MessageView({ message: 42 })` are compile errors.
Return-type annotations are useful on application methods that reference other
inferred methods. Prefer one inheritance style within a View family. `.extend`
uses a callable parent by default; blindly calling inherited `.extend()` on a
native JavaScript class is not equivalent to ordinary `class extends`.
The [implementation notes](https://github.com/marionettejs/marionette/blob/master/docs/maintainers/types.md) document advanced constructor
and mixed-inheritance boundaries for library authors.

## Narrow the DOM at its use site

A selector does not prove that a template contains a particular element type.
Check nullable query results. Native DOM event `target` can be a nested element;
Marionette's `delegateTarget` is the matched delegated element.

This complete View narrows the matched element at the event boundary:

```ts
import { View } from 'marionette';
import type { DelegatedEvent } from 'marionette';

export const SearchView = View.extend({
  template: () => '<label>Search <input name="query" type="search"></label><p></p>',
  events: { 'input input': 'showQuery' },
  showQuery(event: DelegatedEvent) {
    const input = event.delegateTarget;
    const output = this.el.querySelector('p');
    if (!(input instanceof HTMLInputElement) || !output) {
      throw new Error('Search template is incomplete');
    }
    output.textContent = input.value;
  }
});
```

The example checks the matched control rather than asserting that an arbitrary
event target is an input. For elements from another window, use that element's
owner-document constructors or a suitable structural check. Do not use a broad
`any` cast to hide a package-version mismatch.

## Keep lifecycle result types distinct

`View#destroy()` and `Region#destroy()` are synchronous. Application lifecycle
operations return promises; await `app.start()`, `app.stop()`, and `app.destroy()`
when later work depends on their completion. A `true` result means the requested state was reached, including an already-running
`start()` or repeated `destroy()`. A superseded transition resolves `false`;
starting a destroyed application also resolves `false`. Rejection reports a
failed transition. See [Application](./marionette.application.md) for exact states.

Types do not establish data validity at a network boundary, protect against stale
asynchronous results, or demonstrate focus retention. Validate external data in
the application and test runtime behavior alongside the compiler.

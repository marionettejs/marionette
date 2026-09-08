# TypeScript implementation notes

All authored production modules use canonical `.ts` files, including the data and
adapter packages. The strict configuration has no JavaScript allowance. The build checks them with
TypeScript 6.0.3, then the existing Babel and Rollup pipeline removes annotations
and produces the distributions. Source linting uses typescript-eslint 8.69.0,
which supports this compiler and the repository's ESLint version. Keep runtime
construction and prototype composition unchanged when adding types.

`npm run check:types` checks core and optional-package source. `npm run build:types`
emits core declarations; `build:utils`, `build:radio`, `build:data`, and
`build:adapters` emit declarations alongside those packages' distributions.
On a clean checkout, run `npm run build` from the repository root to build all
packages in dependency order. Data declarations resolve the built utils package;
adapter declarations resolve core through `dist/types/esm/index.d.ts`. Run `npm run build:utils` before `build:data`; run the root `npm run build:types`
after its utils/radio dependencies and before `build:adapters`. Every package has generated ESM
and CommonJS declaration scopes. Adapter CommonJS declarations use export
assignments because their runtime exports the adapter directly. `npm run test:types` checks ESM and CommonJS consumers against actual public
package exports in a separate temporary consumer. It runs during `npm run build`.
`npm test` runs focused unit contracts without a hidden type/build pretest. Coverage and diagnostic discovery include TypeScript source files.

The conversion covers all six public classes, the isolated runtime factory,
`MarionetteError`, `extend`, `Events`, `Requests`, `Radio`, and their shared mixins
and helpers.
`Events` owns its contract types;
the compiler checks its registry and listening implementation against each
overload. The mixin's composed receiver, schema-free callback arguments, and
dynamic `triggerMethod` lookup remain explicit typing boundaries. The checked
`triggerMethod` helper requires a callable `trigger` and preserves forwarding of
the original arguments. `Requests` owns the reply and request contracts; its
registry, constant replies, and dispatch implementation are checked. Request
payloads and results remain unknown without a schema, and the request-map result
is typed at the composition boundary. Dynamic prototype composition retains
local assertions where the compiler cannot follow the runtime assignment.

`Radio` owns its channel and top-level contracts. Forwarded signatures reuse the
Events and Requests methods, retaining their current overloads and channel returns.
The dynamic method selection and completed prototype composition are explicit
typing boundaries.

Common owns the checked constructor option setup and reuses its helper signatures.
Its private `_setOptions` method takes the option list supplied by each constructor;
resolved option values remain unknown. Its event methods are described at the
fixed composition boundary after assignment.

The binding helpers own their checked signatures; receivers require only the
methods called, while method-reference values are validated dynamically.
Normalization preserves the existing function check, which does not guarantee
that a handler can be invoked successfully with arbitrary arguments.

The option helpers own checked signatures for defined-option precedence,
undefined fallback, and conditional copying. Broad or primitive options and
ambiguous numeric property aliases return unknown rather than claiming fallback.
Borrowing these helpers through `Function.call` loses `getOption` result precision
and `mergeOptions`' optional keys for nullish input; ordinary method calls retain
those signatures. Dynamic property reads remain local assertion boundaries in
both helper groups. The checked `getValue` helper keeps dynamic property,
fallback, and callable results unknown; its property-key coercion remains a
local assertion boundary.

`MarionetteError` checks its fixed constructor and prototype while preserving the
existing native Error copying and stack behavior. Copied metadata, including
name and message, remains unknown because supplied values are retained verbatim.
Its known constructor composition has one local assertion; this does not make
standalone `extend` generically constructible.
The declaration for generated `src/version.js` lets source checks run before
Rollup creates that module from the package version.

The package root exports the public values and their type-only contracts.
Installed-package fixtures check ESM, CommonJS and bundler resolution with strict
library checking. Core and utils fixtures check TypeScript 6 and 7; the data and
adapter type fixtures currently use TypeScript 7. Keep shared
contracts at their implementations and reuse them across classes. Application's
asynchronous `destroy` remains distinct from MnObject's synchronous return type.

Class `.extend` and standalone `extend.call` are exercised by these fixtures.
Standalone calls reuse a known callable MnObject constructor's type parameters
through an optional, private symbol key. No metadata property or symbol is
created at runtime. The exported `MarionetteExtend` interface specializes its
`call` signature without installing a runtime wrapper. Arbitrary parents and
native classes keep the conservative `Function` result; native classes do not
satisfy the callable-parent contract even when they inherit type metadata.
Standalone specialization for other constructor families remains separate.

Native subclasses can override root methods and methods preserved through
additive `.extend` calls. Shared visual fluent methods retain their receiver and
method declarations even after overlapping prototype configuration. Other mixed
`.extend`/native overrides can still encounter TypeScript's mapped method/property
distinction, particularly with prototype `options` factories. Define those
overrides through `.extend`, or start the native subclass from the public base.
The types do not claim unrestricted mixing of both inheritance forms.

The default `.extend` constructor forwards through `parent.apply`, so it requires
a callable parent. A native class can be constructed directly, but its inherited
`.extend` needs an explicit constructor to avoid that forwarding path. The
declarations reject default forwarding from native classes and preserve the
explicit-constructor form.

Custom constructors retain their argument types through inherited `initialize`
overrides. Known object returns replace the constructed instance type, including
for forwarding descendants. Ambiguous inferred or unknown returns remain unknown;
unannotated `return this` cannot be distinguished from conditional replacement.
A receiver-preserving constructor can declare its checked identity contract:

```ts
constructor: function<Receiver extends object>(
  this: Receiver, options: {label: string}
): Receiver {
  MnObject.call(this, options);
  return this;
}
```

This retains added descendant methods without changing runtime construction.
Authors remain responsible for calling the parent when initialization is needed.
Void and primitive return signatures declare ordinary, non-replacement
construction. TypeScript can erase a returned value through a void annotation;
that annotation is a caller contract, not proof that the function cannot return
an object. The rule does not recover erased return information or change native
class/mapped-method representation. Direct call/apply result typing remains
separate from the `new` result contract.

StateApi and DataApi registration checks method shapes while keeping configured
source inputs opaque. Narrow native, Backbone and actor adapters remain valid;
registration does not prove that a mutable provider matches a class's current
or future sources. Inferred `getState()` results remain separate from the
mutable `State` slot. Configured methods are optional because an explicit
undefined overlay can remove a capability. Direct calls through a configured
provider need an explicit local source contract; directly imported adapters retain their concrete types.
The normalized collection-change protocols are owned by the optional package
implementations and appear in their generated declarations. Installed-package
fixtures check composition with core without duplicating protocol definitions.

The checked DOM contracts keep native exports concrete and configured queries
array-like. `DomApi<Query, Content>` can express an explicit application
adapter contract; mutable setters do not establish that contract for existing
aliases. Partial overlays can remove capabilities with undefined. Native DOM
attribute assertions describe property lookup and browser string coercion,
including the browser's nullable `contains` argument. Event delegation narrows
nodes only after the existing node-type check. These boundaries add no runtime
conversion or guard. Renderer registration preserves narrow callbacks without
promising their template/data/receiver match; its omitted argument still clears
the renderer. Public package exports remain separate.

Application owns its checked lifecycle operations, deferred results, readiness
contexts, child ownership and root-view coordination. Readiness callbacks receive
a concrete AbortSignal; lifecycle options and dynamic event results remain unknown.
Its asynchronous destroy returns Promise<boolean> and replaces the synchronous
DestroyMixin method during prototype composition. Child listings are name-keyed
objects, lookups may be absent, and showView returns the supplied view synchronously.
The private readiness and operation types describe existing sequencing; they add
no cancellation guard, Promise wrapper, or mutable provider correlation.

Region, View, Behavior, and their shared presentation mixins now own checked source
contracts. Foreign child views and Behavior hosts require the lifecycle and query
capabilities the implementation actually calls, without acquiring MnObject's
Radio API. Behavior construction still requires its host even when an initializer
only declares options. Region lookups, detachment, and empty additions retain their
possible undefined results.

View query types describe an explicitly configured base class. Native
queries expose Elements through an array-like result; applications using the jQuery
adapter can declare a ViewConstructor with a JQuery query type and declare an
application-owned `$el` field when needed. Calling
a mutable adapter setter does not infer that contract through every existing alias.
Presentation fixtures cover fluent chains, ordinary native lifecycle overrides
and replacement methods. Inherited fluent signatures are removed when a method is
replaced, so an override cannot accidentally retain the previous return type.
The mixed-inheritance limitation described above remains a compiler boundary;
these declarations do not change prototype assignment or lifecycle timing.

Return to the [maintainer guide](./readme.md).

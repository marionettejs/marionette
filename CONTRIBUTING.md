# Contributing to Marionette

Marionette is community-maintained. Focused bug reports, contract tests,
documentation corrections, and implementation pull requests are welcome.

The governing direction and stable-v5 release gates are in
[`ROADMAP.md`](ROADMAP.md). Stable-v5 work must be reproducible from public artifacts
and must state its production runtime-cost boundary.

## Set up the repository

1. Fork and clone `marionettejs/marionette`.
2. Create a focused branch from `master`.
3. Select the exact Node and npm versions in the
   [source and release profile](docs/release-profile.md).
4. Run `npm run check:release-profile` to verify the source toolchain.
5. Install the pinned dependency graph with `npm ci`.
6. Run the relevant validation commands before opening a pull request.

```sh
npm run check:release-profile
npm run check:release-promotion
npm ci
npm test
npm run lint:ci
npm run coverage
npm run test:fixtures
npm run size
npm run performance:timing
```

`npm ci` builds the packages and checks the core distributions through `prepare`.
Generated `dist/` directories and `src/version.js` are ignored by Git; edit source files
and their co-located TypeScript contracts. Declarations are generated for all five
packages; do not maintain separate handwritten copies. After source edits, run
`npm run build` before distribution or browser checks. The fixture runner builds
once before packing local packages; supplying an artifact directory or all five tarballs skips rebuilding. `npm pack` and npm Git installs
run `prepare` automatically; installing a published tarball uses its compiled files.
If npm uses `strict-allow-scripts`, approve Marionette's `prepare` lifecycle for a
Git dependency. Tarball consumers can deny scripts because the package is prebuilt.

`npm run size` reports bundle sizes and checks production artifacts and module
graphs. Size growth and new adapters do not require budget approval during v5
development. `npm run performance:timing` records informative hosted timings.
See [performance measurements](docs/performance-baselines.md) for reproducibility
and the checks that still fail on broken artifacts.

The full coverage and fixture commands take longer than a focused test. Run the
smallest useful test while developing, then run the checks required by the linked
issue before requesting review.

## Repository layout

Core production source lives under `src/`:

- `src/modules/` owns framework classes and module-level contracts, including
  `MarionetteError`;
- `src/mixins/` owns capabilities composed into those classes;
- `src/runtime/` owns configurable runtime protocols and defaults;
- `src/utils/` owns small shared implementation helpers;
- `src/create-marionette.ts` and `src/runtime-id.ts` own runtime construction and
  private identity. Runtime identity is not a configurable adapter.

Separately published packages keep their production source under
`packages/<name>/src/`. Data/state integrations live in
`packages/adapters/src/data/`; DOM integrations live in `src/dom/` within that
package. Public imports are defined by the package exports, independently of the
internal source folders. Unit specs remain under `test/unit/` because Marionette tests
usually exercise lifecycle, ownership, and composition contracts across several source
files. Browser, package-fixture, performance, documentation, source, and release tests
remain in their named `test/` suites. Do not introduce a second adjacent-test convention
or restore obsolete root-level source paths.

## TypeScript source

All authored production modules use canonical `.ts` files, including the data and
adapter packages. The strict configuration has no JavaScript allowance. The build checks them with
TypeScript 6.0.3, then the existing Babel and Rollup pipeline removes annotations
and produces the distributions. Source linting uses typescript-eslint 8.69.0,
which supports this compiler and the repository's ESLint version. Keep runtime
construction and prototype composition unchanged when adding types.

`npm run check:types` checks core and optional-package source. `npm run build:types`
emits core declarations; `build:data` and `build:adapters` emit their packages
from source after the core declaration build. On a clean checkout, run
`npm run build` from the repository root to build all packages in order. Before
running an optional package build on its own, run `npm run build:types` from the
root first: the data package's declaration check resolves `marionette` through
`dist/types/esm/index.d.ts`. Every package has generated ESM
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
library checking. Core declarations support TypeScript 6 and 7; optional-package
fixtures also retain their existing TypeScript 4.6 entry checks. Keep shared
contracts at their implementations and reuse them across classes. Application's
asynchronous `destroy` remains distinct from MnObject's synchronous return type.

Class `.extend` and standalone `extend.call` are exercised by these fixtures.
Standalone calls reuse a known callable MnObject constructor's type parameters
through an optional, private symbol key. No metadata property or symbol is
created at runtime. An ambient declaration specializes the inherited
`Function.call` signature without installing a wrapper. Arbitrary parents and
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
array-like. `DomApi<Query, Wrapped, Content>` can express an explicit application
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

View query and wrapper types describe an explicitly configured base class. Native
queries expose Elements through an array-like result; applications using the jQuery
adapter can declare a ViewConstructor with JQuery query and wrapper types. Calling
a mutable adapter setter does not infer that contract through every existing alias.
Presentation fixtures cover fluent chains, ordinary native lifecycle overrides
and replacement methods. Inherited fluent signatures are removed when a method is
replaced, so an override cannot accidentally retain the previous return type.
The mixed-inheritance limitation described above remains a compiler boundary;
these declarations do not change prototype assignment or lifecycle timing.


## Report a bug

Use the [bug report form](https://github.com/marionettejs/marionette/issues/new/choose)
and include:

- the Marionette version or commit;
- Node, package-manager, bundler, and browser versions when relevant;
- a minimal public reproduction;
- expected and actual behavior;
- whether the behavior differs from a previous Marionette version.

Do not include private application code, customer data, or credentials.

## Propose a change

Use the repository issue forms before implementing a public API, lifecycle,
architecture, or stable-v5 change. A ready issue identifies:

- the observed failure or ambiguity;
- the canonical public behavior;
- allowed and excluded scope;
- static, development/test, production, or opt-in runtime cost;
- acceptance criteria and exact evidence;
- documentation, diagnostic, type, and package impact;
- rollback or deprecation conditions.

## Open a pull request

Base pull requests on `master` and use the repository pull request template. Keep one
logical behavior per pull request and remove obsolete tests, docs, or paths when a new
behavior becomes canonical.

Pull requests should:

- link the focused issue;
- include tests for behavior changes and edge cases;
- list the commands actually run;
- measure bundle, hot-path, allocation, and retention impact when required;
- keep development, test, lint, and benchmark modules out of production entrypoints;
- avoid compatibility aliases or dual paths without a verified consumer and removal
  condition.

## Code and test style

Follow the existing file style and ESLint configuration. Tests and fixtures must
use public APIs only: no private reads, calls, overrides, spies, stubs, or assertions.
Use observable outcomes and supported package entrypoints. See [the test guide](test/README.md)
and [AGENTS.md](AGENTS.md) for commands, suite organization, and reports.

Every production file defaults to full coverage. Reviewed unreachable defensive
paths have explicit absolute uncovered limits in `config/coverage-exceptions.json`;
reports retain those gaps. Tooling has a separate complete source inventory and
coverage report. New public subpaths require consumer and package fixtures.

## Review

Maintainers review correctness, public contracts, runtime cost, tests, documentation,
and release evidence. Automated review is supporting evidence, not a substitute for
the issue contract or maintainer judgment.

## Runtime checks and types

Trust documented argument shapes in library code. Express callbacks, arrays,
configuration objects, and adapter methods in the public and internal types;
avoid repeating those shape checks on every invocation. When a private contract
is known, tighten its type instead of accepting `unknown` and silently skipping
invalid values. Runtime dispatch between supported alternatives still belongs in
code, such as a View constructor versus a function that returns one.

Keep checks for facts types cannot establish: ownership conflicts, duplicate or
changing keys, unresolved named handlers, missing DOM lookup results, and a data
source incompatible with its configured adapter. Platform feature detection and
idempotent cleanup also serve runtime behavior. A friendly error alone is not a
reason to retain a shape check. Unsupported JavaScript arguments have no promised
error type or recovery behavior.

When removing a shape diagnostic, retire its catalog code, remove tests that
promise that diagnostic, and cover the contract with TypeScript consumer tests.
Keep behavioral tests for valid inputs and runtime invariants. Do not add guards
solely to protect against hypothetical mistakes made by agents.

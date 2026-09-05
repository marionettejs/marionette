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
and the handwritten declarations in `packages/*/types/`. After source edits, run
`npm run build` before distribution or browser checks. The fixture runner builds
once before packing local packages; supplying all three tarballs skips rebuilding. `npm pack` and npm Git installs
run `prepare` automatically; installing a published tarball uses its compiled files.
If npm uses `strict-allow-scripts`, approve Marionette's `prepare` lifecycle for a
Git dependency. Tarball consumers can deny scripts because the package is prebuilt.

`npm run size` enforces the deterministic Phase 0 size and production-module-graph
contract. `npm run performance:timing` records informative timing on ordinary
development or hosted machines; it is not a release timing gate. See the
[performance baseline contract](docs/performance-baselines.md) for the controlled
runner boundary and reproducibility requirements.

The full coverage and fixture commands take longer than a focused test. Run the
smallest useful test while developing, then run the checks required by the linked
issue before requesting review.

## Repository layout

Core production source lives under `src/`:

- `src/modules/` owns framework classes and module-level contracts, including
  `MarionetteError`;
- `src/mixins/` owns capabilities composed into those classes;
- `src/runtime/` owns configurable runtime protocols and defaults;
- `src/utils/` owns small shared implementation helpers.

Separately published packages keep their production source under
`packages/<name>/src/`. Unit specs remain under `test/unit/` because Marionette tests
usually exercise lifecycle, ownership, and composition contracts across several source
files. Browser, package-fixture, performance, documentation, source, and release tests
remain in their named `test/` suites. Do not introduce a second adjacent-test convention
or restore obsolete root-level source paths.

## TypeScript source

Converted modules use one canonical `.ts` file. The build checks them with
TypeScript 6.0.3, then the existing Babel and Rollup pipeline removes annotations
and produces the distributions. Source linting uses typescript-eslint 8.69.0,
which supports this compiler and the repository's ESLint version. Keep runtime
construction and prototype composition unchanged when adding types.

`npm run check:types` checks converted source. `npm run test:types` emits private
declarations into the ignored `test/tmp/typed-core/` directory and checks ESM and
CommonJS consumers against them. Both checks run during `npm run build` and
`npm test`. Coverage and diagnostic discovery include TypeScript source files.

The conversion covers `MnObject`, `MarionetteError`, `extend`, `Events`, `Requests`, and the ID,
cleanup, event, option, Radio debug, and entity-binding helpers they use.
`Events` owns its contract types;
the compiler checks its registry and listening implementation against each
overload. The mixin's composed receiver, schema-free callback arguments, and
dynamic `triggerMethod` lookup remain explicit typing boundaries. The checked
`triggerMethod` helper requires a callable `trigger` and preserves forwarding of
the original arguments. `Requests` owns the reply and request contracts; its
registry, constant replies, and dispatch implementation are checked. Request
payloads and results remain unknown without a schema, and the request-map result
is typed at the composition boundary. Other JavaScript mixins remain unchecked,
with their methods typed at the composition boundary. The binding helpers own
their checked signatures; receivers require only the methods called, while
method-reference values are validated dynamically. Their string/property reads
and JavaScript MarionetteError construction remain local assertion boundaries.
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
standalone `extend` generically constructible or publish a complete error type.
The declaration for generated `src/version.js` lets source checks run before
Rollup creates that module from the package version.

These declarations are not a complete core typing contract and are not published.
Continue typing shared mixins at their implementations, then reuse those types
across classes. Application's asynchronous `destroy` must remain distinct from
MnObject's synchronous return type. Optional-package consumer fixtures retain
their separate TypeScript 7 compiler pins.

Class `.extend` is exercised by these fixtures. The standalone `extend` export
still has a conservative `Function` return type in the private declarations; its
public constructor typing remains unfinished.

Native subclasses can override methods newly declared by `.extend` when the
prototype has no `options` key. Methods inherited through another `.extend` and
prototypes with `options` still pass through mapped types that lose TypeScript
method declarations, so those overrides remain unsupported by these private
types. Function-valued properties remain distinct from methods.

The StateApi setter checks a provider against the class's declared state. It does
not track later configuration changes or ensure that constructor-supplied state
matches that provider. For example, a class whose factory produces `{ ready: true }`
can still receive `{ state: { label: 'Example' } }`; an adapter expecting `ready`
may then fail. The private declarations do not validate this combination.

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

Follow the existing file style and ESLint configuration. Prefer public APIs in tests
and fixtures. Do not make assertions against private framework fields when the behavior
requires a public contract.

The project maintains full line and branch coverage for the configured production
source set. New production, development, and test subpaths must be added to the
appropriate coverage and package fixtures.

## Review

Maintainers review correctness, public contracts, runtime cost, tests, documentation,
and release evidence. Automated review is supporting evidence, not a substitute for
the issue contract or maintainer judgment.

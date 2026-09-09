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
6. Choose the [checks for your change](docs/maintainers/readme.md#select-the-smallest-valid-check)
   before opening a pull request.

```sh
npm run check:release-profile
npm ci
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

- `src/modules/` owns framework classes and their module-level contracts;
- `src/mixins/` owns capabilities composed into those classes;
- `src/runtime/` owns configurable runtime protocols and defaults;
- `src/utils/` owns small shared implementation helpers;
- `src/create-marionette.ts` and `src/runtime-id.ts` own runtime construction and
  private identity. Runtime identity is not a configurable adapter.

Separately published packages keep their production source under
`packages/<name>/src/`. Data/state integrations live in
`packages/adapters/src/data/`; DOM integrations live in `src/dom/` within that
package. Shared helpers, Events, and `MarionetteError` live in
`packages/utils/src/`; Radio and Requests live in `packages/radio/src/`.
Public imports are defined by the package exports, independently of the
internal source folders. Unit specs remain under `test/unit/` because Marionette tests
usually exercise lifecycle, ownership, and composition contracts across several source
files. Browser, package-fixture, performance, documentation, source, and release tests
remain in their named `test/` suites. Do not introduce a second adjacent-test convention
or restore obsolete root-level source paths.

## Working on the library

Use the [maintainer guide](docs/maintainers/readme.md) to find the source,
public contract, and validation for your task. It is shared by human contributors
and coding agents. [TypeScript implementation notes](docs/maintainers/types.md)
cover declaration generation, composition, and the current compiler boundaries.

## Report a bug

For suspected vulnerabilities, follow the private [security reporting policy](SECURITY.md).

Use the [bug report form](https://github.com/marionettejs/marionette/issues/new/choose)
and include:

- the Marionette version or commit;
- Node, package-manager, bundler, and browser versions when relevant;
- a minimal public reproduction;
- expected and actual behavior;
- whether the behavior differs from a previous Marionette version.

Do not include private application code, customer data, or credentials.

## Propose a change

Use the bug report or feature request form to describe the problem, desired
behavior, and any alternatives. Discuss public API, lifecycle, or architecture
changes before implementing them.

Maintainers use the detailed v5 task form to define architecture and stable-release
work. Those tasks identify:

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

- link the focused issue when applicable;
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

Use the [synchronous failure boundary](docs/view.lifecycle.md#synchronous-failures)
when proposing tests or reviewing lifecycle changes. Registration, constructor,
render, and teardown exceptions abort the synchronous operation; valid adapters and
working cleanup callbacks are required. Coverage, retention checks, public API usage,
and mutation survivors do not create a recovery requirement. Do not add constructor
or partial-registration rollback, cleanup that attempts every callback and rethrows
the first error, per-instance recovery bookkeeping, or hot-path guards for unsupported
callback mutation without an explicit maintainer decision. Present any new consumer
case with its complexity and performance tradeoff before implementing it. Existing
ownership/idempotence guards and documented asynchronous Application cancellation and
restart remain supported.

Include this instruction in human and automated reviewer prompts:

> Review against the documented lifecycle and failure contracts. Separate a defect in
> a supported workflow from a proposed synchronous recovery feature. Do not request
> rollback, attempt-all cleanup, recovery bookkeeping, or unsupported reentrant
> mutation guards solely to make a test or mutant pass. Explain any real consumer
> case and runtime cost so the maintainer can decide before implementation.

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

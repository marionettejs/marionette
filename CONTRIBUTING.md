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
npm ci
npm test
npm run lint:ci
npm run coverage
npm run test:fixtures
npm run size
```

The full coverage and fixture commands take longer than a focused test. Run the
smallest useful test while developing, then run the checks required by the linked
issue before requesting review.

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

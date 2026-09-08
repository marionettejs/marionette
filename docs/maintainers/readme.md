# Maintaining Marionette

This guide is the operating procedure for changing the library. It gives agents
and human contributors the same route from a task to a public contract and useful
evidence. Application authors should use the [consumer guide](../agents.md).

## Orient once

Read the requested change and inspect the current branch and worktree. Record the
source revision when evidence depends on it. Use the toolchain in the
[release profile](../release-profile.md) and the setup in
[CONTRIBUTING.md](../../CONTRIBUTING.md).

Classify the work as documentation/static, development/test, an existing production
path, or an opt-in runtime path. Identify the affected contract: lifecycle,
ownership, data/state, DOM, diagnostics, types, or distribution. Consult the relevant
part of [ROADMAP.md](../../ROADMAP.md) when changing architecture or release scope.
Its planned tooling is not an available API.

Proceed with routine implementation choices supported by the existing contract.
If the requested change leaves a material public behavior undecided, state the
specific decision and continue independent work while it is resolved.

## Find the contract and its implementation

Paths below are starting points, not instructions to read every file. Search for
the affected public symbol and inspect its direct collaborators and tests.

| Task | Public contract | Implementation and evidence |
| --- | --- | --- |
| View rendering, DOM events, or cleanup | [View](../marionette.view.md), [rendering](../view.rendering.md), [lifecycle](../view.lifecycle.md) | `src/modules/view.ts`, `src/mixins/`, `src/modules/common/`; `test/unit/view*.spec.js`, `test/unit/destroying-views.spec.js`, relevant `test/browser/` case |
| Region display, detachment, or ownership | [Region](../marionette.region.md) | `src/modules/region.ts`; `test/unit/region*.spec.js`, `test/unit/view-ownership.spec.js` |
| Application readiness or child ownership | [Application](../marionette.application.md) | `src/modules/application.ts`; `test/unit/application*.spec.js` |
| Collection reconciliation or child identity | [CollectionView](../marionette.collectionview.md), [DataApi](../data.api.md) | `src/modules/collection-view.ts`, `src/modules/child-view-container.ts`; `test/unit/collection-view/` |
| State or data integration | [State](../marionette.state.md), [DataApi](../data.api.md), [integration choices](../choosing-integrations.md) | `src/runtime/state-api.ts`, `src/runtime/data-api.ts`, `src/mixins/state.ts`, `packages/data/src/`, `packages/adapters/src/data/`; `test/unit/state-owner.spec.js`, `test/unit/data-package/`, adapter specs |
| DOM integration or isolated configuration | [DomApi](../dom.api.md), [runtime isolation](../runtime-isolation.md) | `src/runtime/`, `src/create-marionette.ts`, `packages/adapters/src/dom/`; `test/unit/create-marionette.spec.js`, `test/unit/dom-adapters.spec.js`, DOM browser cases |
| Events, requests, or Radio | [events](../events.md), [Radio](../radio.md) | `packages/utils/src/`, `packages/radio/src/`, `src/mixins/radio.ts`; `test/unit/events*.spec.js`, `test/unit/requests.spec.js`, `test/unit/radio*.spec.js` |
| Public types | The relevant API page and [type notes](./types.md) | Types beside their implementations; `test/types/`, installed consumers in `test/fixtures/` |
| Framework diagnostic | [diagnostic catalog](../diagnostic-catalog.md) | `config/diagnostics/catalog.json`, `packages/utils/src/error.ts`, `scripts/diagnostics/`; invariant tests at the owning class |
| Documentation or distribution | [editorial rules](./documentation.md), [documentation index](../readme.md), [release profile](../release-profile.md), [release promotion](../release-promotion.md) | `docs/`, `scripts/docs/`, `docs-site/`, package manifests, `test/docs/`, `test/fixtures/`, `test/dist/` |

## Make and verify the change

1. Describe the expected observable behavior. For a bug, reproduce the failing
   behavior through the public API before relying on a proposed fix.
2. Change the owner of the contract. Update types, diagnostics, examples, and tests
   that encode the same behavior. Remove superseded paths rather than retaining
   speculative compatibility.
3. Validate the behavior and its relevant boundaries. For lifecycle changes, test
   ownership and teardown; for asynchronous work, test supersession and rejection;
   for data reconciliation, test surviving child identity and editable state.
4. Review the diff for unrelated edits and accidental production dependencies.
   Report the changed contract, commands actually run, outcomes, and limitations.

Use stable diagnostic codes when testing framework invariants. Error prose can
change. Public tooling and public fixtures must use documented APIs rather than
private fields. Keep reproduction data public and neutral; no customer data or
private repository is needed to establish a library contract.

### Select the smallest valid check

Run commands from the repository root after setup. These are choices based on the
change, not a mandatory sequence for every edit.

| Change | Starting command | When to broaden |
| --- | --- | --- |
| One Region behavior | `npm test -- test/unit/region-lifecycle.spec.js` | Add the relevant ownership, View, or Application suites when their composition changes. Replace the path for another unit task. |
| Authored types or runtime source | `npm run check:types` and the affected unit test | Run `npm run test:types` for the public type contract; use `npm run build` for generated declarations and distributions. |
| Documentation prose or links | `npm run docs:check` | An executable marker check does not execute the example. Changed behavior in an example also needs its actual fixture or behavioral test. |
| Public package export or installed example | `npm run test:fixtures` | This runner builds and packs all five packages and runs the fixture suite; it currently has no fixture-name filter. Validate ESM/CJS/bundler cases affected by the contract. |
| Browser-specific behavior | `npm run build`, then the relevant `node test/browser/<case>.mjs` | Use `npm run test:browser` when shared DOM or browser integration changes span cases. Run only a real filename from `test/browser/`. |
| Diagnostic catalog | `npm run check:diagnostics` and the owning invariant test | Add type consumers when removing a shape diagnostic; keep tests for runtime invariants. |
| Source style | `npm run lint:ci` | This checks the repository without rewriting files. |
| Production cost or package graph | `npm run size` | Use `npm run performance:timing` when timing is relevant; follow the [measurement rules](../performance-baselines.md). |
| Release tooling | `npm run test:release-promotion` | Follow the [release procedure](../release-promotion.md) for artifact checks; tests do not authorize publication. |

`npm test -- <path>` runs the repository's type prechecks before the selected
Vitest file. `npm run build` also runs declaration consumer checks. Report those
checks accurately instead of describing a focused command as the entire suite.
Coverage requirements and review expectations remain in
[CONTRIBUTING.md](../../CONTRIBUTING.md#code-and-test-style).

For browser, focus, or editable-state work, assert the actual interaction and the
resulting state. A generated declaration, lint pass, snapshot, or matching marker
cannot establish that behavior.

## Keep evidence proportional

A passing documentation fixture establishes its assertions for the tested package
and environment. It does not establish that agents choose the right pattern, that
all examples work, or that a release gate is complete.

Use the [agent benchmark contract](../../benchmarks/agent/README.md) for measured
agent outcomes. A small retrieval or implementation trial can find documentation
problems, but must state its task, source revision, environment, and untested scope.
Do not call that trial the full benchmark or a proven improvement.

Keep agent services and developer tools outside the production import graph. A
new MCP service, inspector, or runtime hook needs an observed problem and an
explicit cost boundary; documentation work alone does not justify one.

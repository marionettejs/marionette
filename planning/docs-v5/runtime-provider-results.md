# Runtime and provider reference results

2026-09-29. Scope: runtime configuration and Renderer, DomApi, EventDelegator, DataApi and StateApi authoring contracts for `5.0.0-rc.2`. No runtime changes. Earlier staged docs deletions and source cleanup changes are preserved.

## Delivered

- [Runtime configuration](../../docs/api/runtime.md): default versus isolated families, affected classes, setter returns and inheritance, exports, defaults and composition limits.
- [Rendering/DOM providers](../../docs/api/providers/dom.md): renderer/output flow, all 15 DomApi methods, event delegation and cleanup, and type boundaries.
- [Data/state providers](../../docs/api/providers/data.md): reading/serialization, stable keys, exact collection notification shapes, source subscriptions and owned-state disposal.
- Updated API/discovery entrypoints and shared references; setup remains a small concrete recipe.

The reference distinguishes the built-in plain-data defaults from optional `@mnjs/data`. Native data remains incomplete for API/persistence needs. No additional helpers or application layers were introduced into the records example.

## Six quality dimensions

| Dimension | Evidence and limit |
| --- | --- |
| Coverage | [Runtime/DOM audit](evidence/runtime-dom-reference-audit.md) and [data/state audit](evidence/data-provider-reference-audit.md) inventory exports, providers, types and integration limits. Companion-package APIs and dedicated integration guides remain separate gaps. |
| Accuracy | Runtime/DOM audit: 88 passing tests in 8 files. Data/state audit: 151 passing tests in 12 files. Installed-package checks below verify examples and relevant declarations. |
| Findability | Setup and API index link to the three references. Author lookup questions below have explicit answers; independent lookup performance remains unmeasured. |
| Architecture | Runtime configuration is separate from Application lifetime. Renderer evaluation, DOM insertion, data observation and state ownership are separate contracts. Source fixtures establish behavior, not ideal application architecture. |
| Usability | Two small independent TypeScript examples compile and execute against installed packages. No controlled reader or peer implementation trial ran. |
| Maintainability | Existing snippet/discovery probes are extended. Provider contracts are linked from the shared class pages; technical gaps remain visible rather than being hidden behind examples. |

## Author lookup checks

| Reader question | Path from API index | Answer |
| --- | --- | --- |
| Do I need an isolated runtime for an ordinary app? | Runtime introduction / Choose a configuration scope | Configure the default family once; use isolation when independent configurations must coexist. |
| Which classes does a setter affect, and what does it return? | Runtime → scope tables | Facade setters return undefined; class setters return the class. Affected classes differ by provider. |
| Does changing an exported DataApi object reflect current class configuration? | Runtime → Defaults and exports | Exported initial provider objects do not track setter-created overlays; class prototype slots hold configuration. |
| Can I share a Region or View across families? | Runtime → Isolation and composition | Owned Regions and child Applications require matching runtime; Region.show supports a foreign View lifecycle. |
| Where does a renderer's return value go? | DOM providers → Renderer | Every output reaches attachElContent; default insertion uses Dom.setContents. No async renderer wait or implicit undefined skip. |
| What must collection observers send? | Data providers → Collection identity and observation | Subsequent coherent reset/reorder/update notifications after source changes, with actual model references and stable keys. |
| Does an immutable replacement keep the row with the same key? | Data providers → Collection identity and observation | No; a distinct model object replaces its child. A same-object update can retain the child. |
| Who disposes source state? | Data providers → StateApi / shared State | Only createState-owned state is disposed through the configured provider. Model/collection and supplied state sources are borrowed. |
| Do registration types validate an integration? | TypeScript sections | No; provider slots are opaque, runtime identities unbranded, collection change callback unknown, and matched consumer/output behavior must be verified. |

## Verification

Exact source commands and scope are recorded in the two audits. They cover 239 passing tests across 20 files; some overlap earlier milestones and must not be added to them as unique cases. The data audit also records a direct source probe confirming that synchronous initial collection notifications fail during first-render setup. This is a current provider obligation; runtime behavior was not changed.

```sh
node planning/docs-v5/probes/package-discovery.mjs
node planning/docs-v5/probes/reference-contracts.mjs
npx eslint planning/docs-v5/probes/reference-examples.mjs --max-warnings=0
```

[Installed-package report](evidence/runtime-provider-package.json): passed. Five candidate packages, 19 documentation pages, 12 executed reference examples (seven TypeScript) and 16 existing declaration fixtures. Both production builds and all 51 existing browser checks passed: 48 records and 3 quick-start across Chromium, Firefox and WebKit. [The existing contract probe](evidence/runtime-provider-contract-checks.json) also passed. The newly added fixtures are facade, DOM and provider contracts in ESM/CommonJS form.

New installed assertions verify Model observation/borrowed lifetime, fresh runtime defaults after singleton configuration, independent Radio channels, provider-overlay identity/returns, foreign Region rejection and foreign View hosting. A test-only collection source exercises reorder, same-object update, immutable replacement, removal, reset and observer cleanup. DOM checks verify literal text output, fixed root, forwarding undefined renderer output, nearest matched event target, repeated subscription cleanup, live provider reconfiguration, and monitoring-disabled notification behavior. Exact assertions, fixture hashes and documentation hashes are in the report.

The final local Markdown scan passed 600 links. ESLint and `git diff --check` passed, and staged-reset/runtime-diff hashes match the start of this slice. Current documentation, snippet-harness and all declaration-fixture hashes match the final passing installed snapshot. The candidate kit was refreshed with those five tested tarballs and their quick-start instructions.

The new snippets use JSDOM, while browser suites remain the existing examples. This is a local transformed candidate; registry delivery and the production docs publisher remain unverified. Full unit suite was not rerun; previously recorded retired-docs missing-file failures still require migration. No teaching-effectiveness claim follows from these passing checks.

## Peer and independent review

[Vue and React structural comparison](peer-comparison.md#runtime-and-provider-reference-check) supports separating ordinary setup from detailed integration contracts and placing cleanup/return values alongside API usage. Framework semantics come from Marionette, and no peer runtime or agent-outcome comparison ran.

Subagent review corrected the package's named-only factory export, cross-runtime Region error codes, detach notification timing, and data/default terminology. It verified the initial-observer restriction against source behavior. All corrections preceded the first installed-package run.

[Claude review](evidence/runtime-provider-claude-review.json) received the three pages, source audits, full coverage inventory, draft results and completed first package evidence. Verdict: approve with changes, pending an EventDelegator-isolation check. The factory already assigns an independent delegator to View, CollectionView and Behavior; no runtime fix was needed. The final installed assertions cover both directions of default/isolated configuration, including default class setters, plus a later default renderer change.

Review prompted clearer live-instance reconfiguration consequences, explicit per-class setter availability, reset destruction, native Collection disposal limits, normalized native collection event vocabulary, and falsy renderer data. The DOM reference connects disabled monitoring to renderer connection behavior. The View page now states the standalone monitor installer's argument, return and structural contract. An installed assertion checks monitored/unmonitored attachment notifications; another checks a live instance using its new inherited provider.

The initial-observer TypeError is now a [tracked runtime decision](coverage.md#runtime-decision-requiring-follow-up), with source reproduction and possible diagnostic/support directions. Two declaration-fixture comments were corrected: TypeScript rejects null delegators, while the JavaScript setter does not validate shape. The final package run recompiles those fixtures. No runtime validation or backward-compatibility path was added.

The proposed omission of native query typing details was not adopted: those details explain a public declaration difference needed by provider authors, and stay in the TypeScript section. Other low-value duplication and equal-NaN detail were removed. The stored review describes its submitted snapshot; subsequent edits and assertions are checked in the final package report.

## Strengths, limitations, and next priority

Strengths: the framework configuration choices can now be understood independently of the records setup. Every provider method has a defined responsibility, subscriptions have explicit cleanup, and collection identity/notification obligations are testable. The default/native data distinction and transport boundary are clear.

Limitations: provider authoring is inherently technical and spans multiple pages. The current core callback type cannot validate the collection change schema. Dedicated adapter/companion guides and independent reader evidence remain incomplete. Documentation cannot repair runtime validation/type limitations by promising stronger guarantees.

Next: a standalone concepts guide covering class boundaries, ownership, readiness, retained refresh and event coordination. Follow the [coverage inventory](coverage.md) for remaining API/task work and freeze the later reader trial before execution.

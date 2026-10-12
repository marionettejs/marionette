# Compatibility and verification boundary

Current canonical ownership, normal commands and new-owner measurements are
recorded in [OWNERSHIP.md](OWNERSHIP.md). The research baseline and earlier
acceptance below retain their historical scope.

Research baseline: FormKit **2.1.2**, Pro **0.130.0**, Marionette checkout
**89adc915** (5.0.0-rc.2). Canonical `marionettejs/marionette` v5.0.0
**0f2284ad4bbfe8c82ce82714471697a68c2acaeb** was fetched read-only. Used View,
Region and lifecycle APIs in `src/modules/view.ts`, `src/mixins/view.ts`,
`src/mixins/view-events.ts` and `src/index.ts` match the checkout. No upgrade,
repository-setting change, publication or deployment is part of this work.

The composed-Views iteration additionally compared the Region, child container,
common View/Region helpers and CollectionView source against that exact v5.0.0
object. Nine of ten relevant files match byte for byte. CollectionView differs
only because stable v5 additionally copies the `RegionClass` constructor option;
the example and adapter use the existing default Region APIs. This is a used-API
compatibility inspection, not wholesale stable-v5 certification.

## Package facts

Registry manifests and licenses were inspected directly. Runtime dependencies
are exact 2.1.2 MIT packages: `@formkit/core`, `validation`, `rules`, `i18n`,
`inputs`, `themes`, `utils`, and `observer`. `@formkit/addons` 2.1.2 is an MIT
consumer plugin dependency used by tests and the advanced example. Vue and React
bindings are MIT references, not runtime dependencies of this package.
`@formkit/schema` and `@formkit/common` returned registry 404 responses and are not
assumed to exist. Pro is neither bundled nor a package/example dependency.

## Implemented contracts

| Area | Scope and evidence |
| --- | --- |
| Native controls | Official schemas for text variants, dates, number/range/color, textarea, radio, boolean/group checkboxes, single/multiple select, file, button, submit, group, list, meta. Matrix/edit tests; browser file and keyboard checks recorded separately. |
| Values | Grouped values, defaults/reset, partial external snapshots, preserved opaque references in snapshots, source/notification suppression, synced nested lists and stable matching by `itemKey` or deep equality. |
| Validation | Official rules, visibility modes, cross-field dependencies, localized/custom messages, sync/async custom rules, rejecting/stale/replaced/removed rules, settlement before submit. |
| Form features | Native submit/reset, incomplete messages, submit hooks and callbacks, live/disabled async submit, server field/root errors, retry, cancellation and stale completion suppression. |
| Schema | Core compiler/sugar, DOM/text/conditions/bindings/raw attrs, array/object/numeric loops, keys, transparent groups, native factories, schema replacement, scoped named slots and subscribed `$get`. |
| Framework context | Native value/state/messages/ui/classes/fns/handlers; deep plain object/array mutations, mounted events, list UIDs, dynamic props and schemas. Frozen and opaque values retain their contracts. |
| Themes/sections | Official section DOM, class generation/overrides, trusted SVG icons, section extensions and custom native definitions. Explicit remote themes/loaders are consumer policy. |
| MIT addons | Integration tests use actual multi-step, local storage, floating labels and length countdown plugins; auto-height is exercised in the advanced browser example. No universal independent-resource cleanup claim for third-party plugins. |
| Ownership | Every View-created node, including ignored controls, is released. Composed fields accept only live owned groups; form/group destruction ends detached descendant Views. Registry lookups and actors are borrowed. Retained generated elements lose owned listeners at teardown. |
| Delivery | ESM/CJS and generated declarations; installed-package ESM/CJS edit/submit/reset/cleanup fixture, source tests, local Vite examples and Chromium tests. Release-set certification and other browser engines are separate stages. |

The schema path is an explicit native integration, not Vue/React API parity.
Framework-specific components require native factories or a consumer bridge.
Schema application data updates are explicit. No universal third-party plugin,
theme, compound-control accessibility or paid-control compatibility is claimed.
The repository coverage policy remains unchanged; check executed reports before
making an acceptance claim.

Independent review added public regressions for keyed sibling/schema replacement,
initial select values, component-to-HTML cleanup, adopted form reuse, render timing,
submission error policy, delayed/no-op/native change origins, stopped propagation,
native submit callback arguments, error-description IDs and detach/re-show drafts.
Chromium retry regressions also verify the edited DOM value, public value snapshot,
user change origin and cleared server errors before resubmission. Browser event
listeners can have microtask checkpoints between capture and target phases; input
ownership uses a weak event reference and error clearing runs in the control handler.
An explicitly empty schema is still schema mode. Supplied form contents are
cleared at construction, before Marionette classifies adopted DOM as rendered.
The review checkpoint records failure against the earlier implementation and
isolated assertion-sensitivity probes; passing line coverage alone is not acceptance.

## Composed authoring boundary

`fields` is now shorthand for official schemas; the duplicate static control renderer
has been removed. `template` and `FieldView` add ordinary Marionette Region composition
through the same native input factory. Explicit `preserve`/`clear` removal, group parents,
field snapshot replacement, shallow input prop updates, source/notification suppression,
reset baselines and detached descendant cleanup are covered by public regression tests.
Group structure is independent of DOM layout. `RowView` now borrows a keyed group
from an owned list for ordinary CollectionView composition. Three nested-object
rows, native edits, reorder, add/remove, remount and explicit reset rebuilding
have public and independent replay coverage. The [row contract](rows.md) bounds
immutable string keys, named list paths and temporary versus terminal removal.
Two levels of owned arrays are covered when every ancestor list is crossed through
its owned RowView group. Inner keys are local to each outer key; full ancestor-key
lineage governs reorder, defaults, exclusions, removal and reset. The frozen
nested oracle and native journey exercise this bounded scope. Arbitrary depth,
raw unowned array ancestors and direct Core graph mutation remain uncertified;
existing official schema lists are a separate route. See the
[row contract](rows.md) and new-owner verification for
current measurements; the archived totals below retain their historical identity.

The bounded custom-layout evaluation added a correction for schema reset after
keyed reordering, including nested keyed/keyless permutations. Restored values,
reset-event construction order, order-sensitive normalization and clean state are
checked. A stricter independent case still fails surviving-control identity when
reset restores a removed initial predecessor. Membership-changing reset can
recreate/repurpose controls; stable widget identity/focus in that case is outside
this iteration's guarantee. The exact failure is preserved. Public alternatives
that replay list input or reorder the reset payload were rejected because they
change normalizer dispatches or observable reset semantics.

Official controls own input timing and DOM sections in all modes. Shorthand checkbox
and select controls use the official native `input` event; text edits may settle after
FormKit's configured delay. Error/help IDs, classes and absent ARIA attributes follow
those sections. Consumers should use actual browser input events and await `node.settled`
and the `validating` ledger before asserting settled state. This is an unpublished API
iteration, not a compatibility alias for the removed static renderer.

A separate private consumer spike was developed from an actual, pinned, actor-owned
follow-up feature. Its source and domain data remain outside this public package.
The pilot reuses the real feature machine and checks retained drafts, conditional controls,
read-only changes, debounced edits, actor-authoritative calculations and cleanup. It is
bounded evidence for the authoring API, not a completed customer application migration.
Native select/date controls in that pilot are explicitly degraded stand-ins for existing
Pro controls. The package does not copy its domain reducers or add an XState/Vue dependency.
Full customer application checks, parent persistence/submission integration and paid
control parity are unverified. No generic actor adapter or control builder was added.

A later isolated test explicitly permits Vue under Marionette ownership. Actual
Vue mounting, interaction and owner teardown pass; an owner lifetime guard is
needed for callbacks retained through detached DOM. Genuine Pro registration
remains failed and unskipped because that isolated process has no available
authorized runnable licensed bootstrap. Actual Pro dropdown/date-picker mounting,
interaction and teardown were not reached. This says nothing about the customer's
license status. The native package still has no Vue/Pro dependency.

## Pro 0.130.0: concrete execution blockers

The user authorized unmodified private localhost development under the vendor's
published permission. [FormKit Pro](https://formkit.com/pro) states localhost
works without a key. Pro 0.130.0 was installed only in private `/tmp` probes.
No private key, account registration, purchase, license bypass, vendor patch,
proprietary code copy into this repository or public issue submission occurred.

The official [React installation recipe](https://github.com/formkit/docs-content/blob/master/_install/pro-react.md)
imports controls and `createProPlugin` from the root `@formkit/pro` entrypoint.
That exact published version resolves ESM to `index.mjs`, CommonJS to `index.cjs`;
its only other export is `@formkit/pro/genesis` CSS. Its declared peers are
core/inputs/utils ^2.0.0, and dependencies are tempo and drag-and-drop.

A clean installation of Pro/core/inputs/utils fails a Node ESM root import:
`ERR_MODULE_NOT_FOUND: Cannot find package '@formkit/vue' imported from
.../@formkit/pro/index.mjs`. Inspection found a bare side-effect
`import "@formkit/vue"` with no named binding. The Vue package is undeclared in
Pro's manifest. Vite likewise fails resolution; after installing Vue solely in
the private harness, the development browser bundle includes Vue runtime code.
A separate production build with Vue privately installed succeeds but retains
FormKit Vue bindings/defaultConfig and Vue shared/reactivity/runtime-core modules.
The same-installed-package React baseline without Pro retains no Vue modules.
No import alias or vendor patch was used for that comparison.
The same root import fails in a clean `@formkit/react` 2.1.2 installation with
React/ReactDOM 19.2.0 and Pro 0.130.0. Its lockfile contains neither Vue nor
`@formkit/vue`; a production Vite build also fails resolving that import before
configuration or plugin creation. The official React recipe does not prescribe
a Vue dependency, alias or alternate Pro entry. No public framework-neutral
alternate export was found. These observations concern the published package,
not a demonstrated defect in any particular Pro control.

Published entry imports were checked without inspecting proprietary control
implementation. The earliest verified affected release is **0.114.0**, published
2023-08-11; adjacent **0.113.0**, published 2023-07-20, lacks the Vue import in both
ESM and CommonJS. All sampled later releases through 0.130.0 include it. This
locates an observed release boundary, not its source commit or every intervening
version.

The MIT Vue module's `defaultConfig()` installs its FormKit bindings and calls
the error-decoder registration function when invoked. A bare module import does
not invoke that function. In a controlled load, FormKit error 107 remains `E107`,
a new core text node receives no definition or context, and Vue runtime globals
are added. A positive control explicitly invokes defaultConfig and applies its
five plugins: error 107 is decoded and a new text node gets a definition and
bindings context. Thus no shared input registration or binding installation was
observed from the bare import. The upstream development workspace includes both
Vue and React, which could mask an undeclared import; that is an inference, not
proof of how this import originated. Whether it is accidental build carryover or
an intentional runtime dependency requires upstream confirmation. It was not
removed or aliased. A supported neutral entry or corrected package export, with
clean React/native installation checks, is needed.

With dependencies resolved in a separate final harness without import aliases, unchanged
`createProPlugin()`, `createProPlugin(undefined, { rating })`, and
`createProPlugin('', { rating })` at `http://localhost:5190/keyless.html`
(browser `location.hostname === 'localhost'`) throw during plugin creation:
“A FormKit API key is required, please visit https://formkit.com/pro”. No actual
Pro control mounted. The discrepancy with advertised keyless localhost behavior
needs a vendor-supported setup or authorized key. The published TypeScript
signature requires a string key; the React recipe supplies a project key and
does not document a no-key invocation. Arbitrary substitute keys were not tried. This is a concrete runtime blocker, not a generic license objection.

All 14 Pro controls remain unverified: autocomplete, dropdown, taglist,
datepicker, colorpicker, currency, mask, unit, slider, rating, repeater, toggle,
togglebuttons and transferlist. Their formatting, async options, pointer/keyboard
behavior, popovers, compound ARIA, reset and repeated teardown require actual
authorized browser execution. Native bindings alone do not establish compatibility.

The published [Pro license](https://cdn.jsdelivr.net/npm/@formkit/pro@0.130.0/LICENSE.md)
and [terms](https://formkit.com/terms) apply to those private probes. This package's
MIT code does not redistribute Pro. A later public demonstration or proprietary
control redistribution requires its own permitted setup.

## Remaining acceptance stages

The MIT native package is verified within the scope above without Pro. Paid-control
parity requires resolving Pro's published import and localhost-key setup, then
running actual Pro controls. Broaden browser coverage beyond Chromium and verify chosen themes and
plugins against representative customer forms. The existing release artifact
workflow covers its established package set; this local package needs separate
release integration and certification before publication. The inspected TCM
follow-up pilot exercises the public group-composition API with the saved feature
machine, synthetic data, and native substitutes for Pro select/date controls.
Later private checks connect native values to the actual full form engine,
submission builder and mocked host, and exercise actual application consumer
protocols. These remain bounded source integration checks. Full application
migration, production persistence, Social Work UI and actual Pro interactions
remain separate acceptance stages.

Primary references: [architecture](https://formkit.com/essentials/architecture),
[core API](https://formkit.com/api-reference/formkit-core),
[validation API](https://formkit.com/api-reference/formkit-validation),
[schema](https://formkit.com/essentials/schema),
[custom inputs](https://formkit.com/essentials/custom-inputs),
[MIT source/license](https://github.com/formkit/formkit),
[Pro manifest](https://registry.npmjs.org/@formkit/pro/0.130.0).

### Confirmed Core File replacement limit

Core2.1.2 treats distinct Files with identical name, size, type and lastModified as
equal and retains the old value, even with different contents. This fails through
FieldView, bare public Core input and genuine Vue2.1.2 model updates. Snapshot
copying preserves opaque references; it does not bypass Core input equality.
The strict failing regression is preserved in the local acceptance evidence and
was not counted as fixed. No vendor or value-metadata workaround was introduced.

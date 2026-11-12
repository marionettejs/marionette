# Isolated React-pattern FormKit experiment

This is an unpublished experimental adapter, not a replacement for the current `@mnjs/formkit` work. Prior small hand-built renderer checkpoints remain in `checkpoints/`.

## Current architecture

- `upstream-bindings.mjs` extracts the complete published React2.5.0 reactive store and bindings context, with the React hook removed. This includes upstream handlers, state, messages, validity/visibility, props, class observer caching and lazy aggregate snapshots. There is no React runtime import. `node core/extract-bindings.mjs` verifies byte-for-byte reproduction from the locked published module plus explicit adaptations.
- Adaptations are observer ownership cleanup, explicit class-cache refresh, terminal context guards, and membership-checked store dispatch. MIT copyright/license retained in `LICENSE.formkit`.
- `section-renderer.mjs` renders the actual official `inputs.text` definition's generated section schema. It does not substitute a hard-coded input. Wrapper, inner, label, input, help and message-loop structure comes from that schema. Each expression uses official `compile/provide`, tracks its token values and patches its own DOM binding. Context bag entries are compared shallowly for in-place changes when notified.
- Context notifications still scan that field's registered bindings. This is not property-level subscription dispatch or constant total work. Counters distinguish context notifications, token checks, expression evaluations, DOM writes and structural changes. They exclude uninstrumented Core, snapshot and observer work.
- `index.mjs` provides real Marionette View/Region ownership and official FormKit library form/text features. The official form definition schema now renders root attributes/classes, default-slot placement, loading state and incomplete/error messages on the existing Marionette form element. The root default slot is an owned field outlet. Actions remain false; nested FormKit components are not yet rendered. Each text definition has an extra adapter-owned field host around its actual section tree.

## Interface and contract

`mount({host,count,fields,values,classes,config,formProps,onSubmit,onSubmitInvalid,onSubmitRaw})` returns `{form,node,metrics,setFields,reset,submit,destroy}`. Fields use `{name,label,validation,validationVisibility,disabled,help,attrs,type:'text'}`; section-class props accepted at initial mount through the Core props. Defaults for explicit declarations: upstream optional validation and absent values, live visibility, no actions. The count convenience fixture explicitly requests required text fields. `submit()` dispatches real DOM submission to the official form handler. The default submission callback is a no-op, preventing accidental native navigation.

Automatic updates follow notified upstream context/Core changes. Silent closure mutation does not itself notify. `form.render()` explicitly refreshes class caches and section bindings while preserving stable controls. Submission uses the official callback behavior; user callback errors/rejections remain observable. No early-submit cancellation protocol is added. Destruction removes subscriptions, DOM listeners and owned Core nodes.

`schema.mjs` is a separate narrow schema controller, not a general FormKitSchema replacement. See `SCHEMA.md` for its explicit subset.

## Limits

No full arbitrary schema/component renderer, slots, icons/raw HTML, nested groups/lists, Pro controls, arbitrary input types or complete API compatibility is claimed. Raw icon HTML and unsupported section nodes throw. Official text sections are consumed, but not every upstream section override or binding shape is implemented. Dynamic replacement of arbitrary props and class definitions is not fully covered. Root form action components and custom root section slots remain unsupported. The ordinary official form/default/message sections are implemented. Upstream full context is retained, but this does not establish complete semantics across all inputs.

The upstream context's lazy aggregate value snapshots remain unchanged; renderer counters are not proof that all snapshot or Core work scales linearly. Existing copies for submit payloads also remain official behavior. The simple `createStore` test helper is separate from the actual extracted context store, which has its own lifetime regressions.

## Verification

Run `node core/{test,regressions,submit-test,submit-completion-test,schema-test,sections-test}.mjs` individually. Section tests cover actual official nested markup, upstream blur visibility, help/error ID references, mutable bags on notified refresh, valid/complete state, retained input, and destruction of real context-store subscribers/class accessors. Shared harnesses compare the same fixtures across adapters.

JSDOM checks and renderer counters are not browser timing, layout, genuine-keyboard or complete accessibility evidence. No performance superiority or browser readiness is claimed without the separate real-browser protocol passing.

## Root-form milestone counters

Core counters count observed node creation/destruction and local input/commit/message events across root and fields. `classRootEvaluations` counts configured root-class callback executions, not every observer callback. Renderer counters now include the root form. Snapshot copying, observer internals and all Core operations are still not exhaustively instrumented; none of these counters is a whole-path timing or memory measurement. `root-schema-test.mjs` validates actual root schema attributes, incomplete-message ID/type, async loading, reset and teardown. The 200/400 field counter evidence is in `evidence/root-schema-counters-*.json`.

## Nested-group and scoped-slot milestone

Field declarations additionally accept `{type:'group',name,children:[...]}`. Each group uses the official library group definition, Core parentage, and its fragment/default-slot schema. Nested text fields remain ordinary official text nodes. Sibling names must be unique; this is not keyed list support. Removing a declaration destroys its owned descendants and removes their Core values using upstream behavior; reset delegates to Core.

Text declarations may provide `children:{label: schema,help: schema}`. This `children` named-slot shorthand is an explicit limited Marionette adapter API, NOT accepted upstream FormKitSchema syntax. The equivalent Vue/React comparison uses component slots. These slots are evaluated with the field's upstream context (`$label`, `$id`, etc.). The supplied `$values` data points at the root form's value and is tracked through the official Core observer. It is not an upstream reserved variable. A cross-field slot therefore responds to notified root commits without rebuilding its text control. This broad root-value observation is not fine-grained path subscriptions. Slot schemas support the existing limited DOM/condition/text bindings; unsupported components, loops and dynamic tags reject before topology changes. A small adapter span hosts each slot.

No general `$cmp` renderer, arbitrary external components, keyed repeated lists, new input types or general FormKitSchema support is added. Existing `schema.mjs` controller still has its earlier flat subset. Changing a text declaration's named-slot object replaces only its presentation subtree, preserving the existing Core node, input DOM and edited value. Adding/removing supported slot overrides is also supported. Expressions precompile before topology changes; failed new renderer construction cleans its resources and new sibling construction is staged before old siblings are removed. This does not promise rollback of arbitrary user callback side effects or a fully atomic multi-field batch. Existing-field type replacement is explicitly rejected. Tests in `nested-slot-test.mjs` cover the concrete nested/contact fixture and lifecycle, not all upstream compositions.

## Callback contract correction

The experimental terminal-safe observer helper, five class guards and early-submit sentinel were removed after upstream contract review. Class evaluation uses actual `observer.watch`; destructive callback recovery is not an acceptance requirement. Historical probes are retained under `checkpoints/exploratory-callback-recovery` as exploratory evidence, not runnable current acceptance tests. Normal owned cleanup, notified classes and explicit refresh remain. `submit-completion-test.mjs` verifies normal synchronous/async submit-driven owner destruction, destruction while a returned promise settles, and original user errors. No rollback or attempt-all cleanup guarantee is inferred from synchronous callback failures.

## Focus-preserving sibling order

When reconciling retained fields, the host containing `document.activeElement` is an ordering pivot. The adapter moves siblings before/after it rather than detaching that focused subtree. This also applies to a containing group. No focus restoration call or synthetic focus event is introduced. Already-positioned siblings retain the existing no-op check; removal still destroys a removed focused control normally. The regression suite checks all 24 permutations for each of four focused controls plus nested group order and selection direction. JSDOM passing does not substitute for the separately requested real-browser validation. This is sibling declaration ordering, not keyed-loop support.

## Single native-checkbox slice

Declarations now accept `type:'checkbox'` without `options`. They use the official checkbox definition and `toggleChecked` feature, including boolean defaults and optional scalar `onValue`/`offValue` supplied at construction. The renderer patches the DOM `checked` property, not only a checked attribute. Conditional attribute branches recursively evaluate expressions, including the official nested checkbox help `aria-describedby`.

Explicit declarations no longer invent `validation:'required'` or empty-string initial values. Omitted values are passed through to upstream Core (an optional checkbox remains undefined, unchecked, including after reset). The `count` convenience fixture still explicitly declares required text fields. Consent fixtures use `accepted`; upstream `required` alone treats false as a supplied nonempty value. Error/help association follows the official definition; this does not claim every checkbox error becomes an input error IDREF.

This is **native-checkbox behavior only**, not Genesis/theme visual parity: no theme/decorator SVG plugin or arbitrary raw HTML is introduced. Checkbox option arrays, radio/select/file, general components and keyed lists remain unsupported. Custom scalar on/off values update through notified Core props when declarations change; the current value is not coerced or reset. Removing an override normalizes that prop to the creation default true/false as an explicit adapter policy. Upstream2.5 bindings diverge on removal (Vue clears to undefined; React retains old overrides), so this normalization is not presented as cross-binding parity. The test uses JSDOM native click, external input, disabled click, nested values, validation, reset and removal/re-add. Real keyboard Space and browser visual/behavior evidence remain separate required checks before a browser-parity claim.

# Isolated React-pattern FormKit experiment

This is an unpublished experimental adapter, not a replacement for the current `@mnjs/formkit` work. Prior small hand-built renderer checkpoints remain in `checkpoints/`.

## Current architecture

- `upstream-bindings.mjs` extracts the complete published React2.5.0 reactive store and bindings context, with the React hook removed. This includes upstream handlers, state, messages, validity/visibility, props, class observer caching and lazy aggregate snapshots. There is no React runtime import. `node core/extract-bindings.mjs` verifies byte-for-byte reproduction from the locked published module plus explicit adaptations.
- Adaptations are observer ownership cleanup, explicit class-cache refresh, terminal context guards, and membership-checked store dispatch. MIT copyright/license retained in `LICENSE.formkit`.
- `section-renderer.mjs` renders the actual official text, textarea, single-checkbox, single-select, group and form definitions' generated section schemas. It does not substitute a hard-coded input. Wrapper, inner, label, input, help and message-loop structure comes from that schema. Each expression uses official `compile/provide`, tracks its token values and patches its own DOM binding. Context bag entries are compared shallowly for in-place changes when notified.
- Context notifications still scan that field's registered bindings. This is not property-level subscription dispatch or constant total work. Counters distinguish context notifications, token checks, expression evaluations, DOM writes and structural changes. They exclude uninstrumented Core, snapshot and observer work.
- `index.mjs` provides real Marionette View/Region ownership and official FormKit library form and supported input features. The official form definition schema now renders root attributes/classes, default-slot placement, loading state and incomplete/error messages on the existing Marionette form element. The root default slot is an owned field outlet. Actions remain false; nested groups use their official default-slot schema, not a general component renderer. Each field definition has an extra adapter-owned field host around its actual section tree.

## Interface and contract

`mount({host,count,fields,values,classes,config,formProps,onSubmit,onSubmitInvalid,onSubmitRaw})` returns `{form,node,metrics,setFields,reset,submit,destroy}`. Input fields use `{name,label,validation,validationVisibility,disabled,help,attrs,type}` with text, textarea, single checkbox and bounded single select; groups use `{type:'group',name,children}`; section-class props accepted at initial mount through the Core props. Defaults for explicit declarations: upstream optional validation and absent values, live visibility, no actions. The count convenience fixture explicitly requests required text fields. `submit()` dispatches real DOM submission to the official form handler. The default submission callback is a no-op, preventing accidental native navigation.

Automatic updates follow notified upstream context/Core changes. Silent closure mutation does not itself notify. `form.render()` explicitly refreshes class caches and section bindings while preserving stable controls. Submission uses the official callback behavior; user callback errors/rejections remain observable. No early-submit cancellation protocol is added. Destruction removes subscriptions, DOM listeners and owned Core nodes.

`schema.mjs` is a separate narrow schema controller, not a general FormKitSchema replacement. See `SCHEMA.md` for its explicit subset.

## Limits

No full arbitrary schema/component renderer, general slots, icons/raw HTML, lists, Pro controls, arbitrary input types or complete API compatibility is claimed. Nested groups and limited label/help slots are supported as described below. Raw icon HTML and unsupported section nodes throw. Official text sections are consumed, but not every upstream section override or binding shape is implemented. Dynamic replacement of arbitrary props and class definitions is not fully covered. Root form action components and custom root section slots remain unsupported. The ordinary official form/default/message sections are implemented. Upstream full context is retained, but this does not establish complete semantics across all inputs.

The upstream context's lazy aggregate value snapshots remain unchanged; renderer counters are not proof that all snapshot or Core work scales linearly. Existing copies for submit payloads also remain official behavior. The obsolete standalone `createStore` helper has been removed; lifetime tests target the actual extracted context store.

## Verification

Run `node core/{test,regressions,submit-test,submit-completion-test,schema-test,sections-test}.mjs` individually. Section tests cover actual official nested markup, upstream blur visibility, help/error ID references, mutable bags on notified refresh, valid/complete state, retained input, and destruction of real context-store subscribers/class accessors. Shared harnesses compare the same fixtures across adapters.

JSDOM checks and renderer counters are not browser timing, layout, genuine-keyboard or complete accessibility evidence. No performance superiority or browser readiness is claimed without the separate real-browser protocol passing.

## Root-form milestone counters

Core counters count observed node creation/destruction and local input/commit/message events across root and fields. `classRootEvaluations` counts configured root-class callback executions, not every observer callback. Renderer counters now include the root form. Snapshot copying, observer internals and all Core operations are still not exhaustively instrumented; none of these counters is a whole-path timing or memory measurement. `root-schema-test.mjs` validates actual root schema attributes, incomplete-message ID/type, async loading, reset and teardown. The 200/400 field counter evidence is in `evidence/root-schema-counters-*.json`.

## Nested-group and scoped-slot milestone

Field declarations additionally accept `{type:'group',name,children:[...]}`. Each group uses the official library group definition, Core parentage, and its fragment/default-slot schema. Nested text fields remain ordinary official text nodes. Sibling names must be unique; this is not keyed list support. Removing a declaration destroys its owned descendants and removes their Core values using upstream behavior; reset delegates to Core.

Text declarations may provide `children:{label: schema,help: schema}`. This `children` named-slot shorthand is an explicit limited Marionette adapter API, NOT accepted upstream FormKitSchema syntax. The equivalent Vue/React comparison uses component slots. These slots are evaluated with the field's upstream context (`$label`, `$id`, etc.). The supplied `$values` data points at the root form's value and is tracked through the official Core observer. It is not an upstream reserved variable. A cross-field slot therefore responds to notified root commits without rebuilding its text control. This broad root-value observation is not fine-grained path subscriptions. Slot schemas support the existing limited DOM/condition/text bindings; unsupported components, loops and dynamic tags reject before topology changes. A small adapter span hosts each slot.

No general `$cmp` renderer, arbitrary external components, keyed repeated lists, new input types or general FormKitSchema support is added. The separate `schema.mjs` controller now supports bounded nested native-input/group schemas and notified expression props; see SCHEMA.md. Changing a text declaration's named-slot object replaces only its presentation subtree, preserving the existing Core node, input DOM and edited value. Adding/removing supported slot overrides is also supported. Expressions precompile before topology changes; failed new renderer construction cleans its resources but updates do not stage a transaction across sibling fields. A failed field construction releases that field's resources; earlier successful removals or additions in the same call remain applied. There is no rollback of arbitrary user callbacks or a multi-field transaction. Existing-field type replacement is explicitly rejected. Tests in `nested-slot-test.mjs` cover the concrete nested/contact fixture and lifecycle, not all upstream compositions.

## Callback contract correction

The experimental terminal-safe observer helper, five class guards and early-submit sentinel were removed after upstream contract review. Class evaluation uses actual `observer.watch`; destructive callback recovery is not an acceptance requirement. Historical probes are retained under `checkpoints/exploratory-callback-recovery` as exploratory evidence, not runnable current acceptance tests. Normal owned cleanup, notified classes and explicit refresh remain. `submit-completion-test.mjs` verifies normal synchronous/async submit-driven owner destruction, destruction while a returned promise settles, and original user errors. No rollback or attempt-all cleanup guarantee is inferred from synchronous callback failures.

## Focus-preserving sibling order

When reconciling retained fields, the host containing `document.activeElement` is an ordering pivot. The adapter moves siblings before/after it rather than detaching that focused subtree. This also applies to a containing group. No focus restoration call or synthetic focus event is introduced. Already-positioned siblings retain the existing no-op check; removal still destroys a removed focused control normally. The regression suite checks all 24 permutations for each of four focused controls plus nested group order and selection direction. JSDOM passing does not substitute for the separately requested real-browser validation. This is sibling declaration ordering, not keyed-loop support.

## Single native-checkbox slice

Declarations now accept `type:'checkbox'` without `options`. They use the official checkbox definition and `toggleChecked` feature, including boolean defaults and optional scalar `onValue`/`offValue` supplied at construction. The renderer patches the DOM `checked` property, not only a checked attribute. Conditional attribute branches recursively evaluate expressions, including the official nested checkbox help `aria-describedby`.

Explicit declarations no longer invent `validation:'required'` or empty-string initial values. Omitted values are passed through to upstream Core (an optional checkbox remains undefined, unchecked, including after reset). The `count` convenience fixture still explicitly declares required text fields. Consent fixtures use `accepted`; upstream `required` alone treats false as a supplied nonempty value. Error/help association follows the official definition; this does not claim every checkbox error becomes an input error IDREF.

This is **native-checkbox behavior only**, not Genesis/theme visual parity: no theme/decorator SVG plugin or arbitrary raw HTML is introduced. Checkbox option arrays, radio/file, multiple selects, general components and keyed lists remain unsupported. Bounded single selects and textareas are supported by the later slices below. Custom scalar on/off values update through notified Core props when declarations change; the current value is not coerced or reset. Removing an override normalizes that prop to the creation default true/false as an explicit adapter policy. Upstream2.5 bindings diverge on removal (Vue clears to undefined; React retains old overrides), so this normalization is not presented as cross-binding parity. The test uses JSDOM native click, external input, disabled click, nested values, validation, reset and removal/re-add. Real keyboard Space and browser visual/behavior evidence remain separate required checks before a browser-parity claim.

## Native single-select slice

`type:'select'` now uses the official input definition/features, flat synchronous options (arrays or label maps), optional construction-time placeholder, and upstream typed-value normalization. Initial definition props, including options, enter through attrs and are promoted by official addProps after feature hooks are installed; subsequent option updates use the official prop hook. No self-assignment normalization plugin is used. The renderer updates option `selected` properties. Existing field/select identity and Core value survive supported option-array updates. Multiple, optgroups, async loaders and custom select slots reject before mutation; live placeholder changes explicitly reject rather than silently diverge. Theme select-arrow/decorator parity is not claimed.

Bound functions can read Core state inside a stable function object. Expressions with function-valued tokens therefore re-evaluate on their owning context notification, even if token identities match. This is a generic conservative local dependency policy, not a special selected-result check or whole-form rerender. Other expressions retain token comparisons; DOM writes still require changed properties/attributes. It may do extra local expression work and does not establish whole-path scaling.

`select-test.mjs` covers typed external/input updates, placeholder/default behavior, option updates, reset, unsupported inputs and cleanup. `select-parity.mjs vue|react|experiment` runs the same intended scalar fixture in each binding. All three pass JSDOM checks; genuine native keyboard and real-browser behavior remain separate gates. This bounded slice is not full parity with the original adapter.

## Native textarea slice

`type:'textarea'` uses the official input definition, context handlers and section renderer, including multiline value property updates. The adapter's `attrs` bag supplies rows/cols/maxlength and supports notified bag replacement on retained textareas; disabled and validation use normal node props. Labels/help/error IDs follow the official schema. This adds no new rendering language or custom control.

`textarea-parity.mjs vue|react|experiment` checks an identical intended nested group/text/textarea fixture, multiline input/external value, validation, IDs, attributes, retained identity, reset and cleanup. Upstream component attributes are passed as top-level component props; this adapter's declaration API uses `attrs`. The shared fixture explicitly starts with `disabled:false`: bounded semantic polling passes the intended fixture. The absent-disabled probe exposes a React 2.5 re-enable divergence: after adding disabled and then omitting it, the control does not return to enabled within the bounded wait. Earlier fixed-delay runs also intermittently observed the disabling assertion before React had updated; that timing failure is not treated as a stable semantic difference. This difference is not represented as matched behavior. The fixture now uses bounded semantic waits rather than fixed sleeps; the previous fixture/failure evidence is retained separately. Browser keyboard/IME, layout and theme parity are not established by JSDOM tests. Select source before this milestone is preserved in `checkpoints/select-frozen`.

## Scoped value/state facade

`form.getValues()` returns a detached FormKit `cloneAny` snapshot; `setValues(partial,{notify,source})` recursively merges plain objects and replaces other supplied values. `notify:false` suppresses `form:change`, not Core updates or `form:state`. `getFormState()` reports submitted/loading context, blocking-ledger validity and root error messages; server errors alone need not invalidate the blocking ledger. `setErrors` delegates Core clearing/mapping. These are Marionette adapter conveniences, not upstream FormKit component APIs.

Value snapshots are produced on explicit reads or delivered value events, shared between listeners but detached from Core. State-only notifications allocate no aggregate snapshot. Reset additionally takes one comparison snapshot because Core pauses/replays reset events after mutation; this is counted separately. Delayed native input carries its source to its own commit. No-op writes and reverted uncommitted scalar edits do not emit a value change. Listener detection currently depends on pinned Marionette 5 `_rdEvents` storage plus `onFormChange`; this pinned private dependency is an accepted experimental caveat, not a stable cross-version API guarantee. Equality checks may traverse values and are not constant-time work. Field topology is batched during adapter setFields; arbitrary external Core structural manipulation is not an established facade contract.

Official submission remains unchanged. Original adapter SubmitResult/AbortSignal/SubmissionError compatibility is NOT implemented by this milestone. The scoped facade passed independent review with these caveats; it is not full original-adapter parity.


## Supported-contract simplification

Instrumentation is opt-in (`mount({instrument:true,...})` / View option); default operation installs no Core counter listeners or root-class counting wrapper. Renderer/facade counters remain zero when disabled. Diagnostic test counters do not substitute for uninstrumented browser timing.

Terminal destruction disposes presentation and facade subscriptions, destroys the Core form first, then explicitly destroys owned descendant nodes parent-first. Each node deregisters exactly once. Destroyed-parent ledger zero, ledger-promise settlement and propagated descendant events are not promises; live field removal retains ordinary upstream parent updates. Root DOM is cleared once after resource disposal.

Reconciliation uses a Set for removal membership instead of repeated scans. Ordinary notified slot updates compare dependencies; only explicit render forces reevaluation. Explicit render refreshes existing controls without reapplying declarations. Repeated in-flight destruction fences and staged batch rollback are removed; public calls after terminal destruction remain inert. Destruction from arbitrary class/before-render callbacks is not an added recovery contract. The manual `_isRendered` assignment remains consistent with the installed Marionette View lifecycle implementation until a supported replacement is available.

## Two-phase initial construction candidate

Initial field construction prepares the complete Core node tree before rendering field sections/classes. Later siblings (including nested descendants) are available to first-time class callbacks. Initial render therefore omits the former second forced refresh of every field; root classes still refresh after topology exists. Subsequent explicit `form.render()` retains its force-refresh escape hatch. Live reconciliation remains a separate, unchanged path.

Unclaimed prepared nodes are disposed if construction fails; already rendered fields are not rolled back. There is no general transaction or destructive-callback recovery guarantee. Diagnostic 200/400-field probes reduced root-class callback evaluations from 2802/5602 to 1402/2802, with identical observed Core event counts. These are JSDOM counters, not browser timings, full subscription counts or a performance-ranking claim. Independent review and browser remeasurement are required.


## Upstream delay, supported props and facade methods

Production input delay now inherits the upstream 20 ms default. Explicit caller `config:{delay:0}` still works; historical benchmark fixtures that explicitly requested zero retain their original meaning. This is not a retroactive production-default performance claim. The existing explicit-declaration live-validation visibility convention remains separate and is not claimed to match every upstream default.

Supported initial definition props use official addProps promotion/normalization. Ordinary native attrs are copied, updated and removed consistently for retained text, textarea, checkbox and select controls; runtime metadata is routed to node props rather than DOM attrs. Explicit supported declaration props take precedence over conflicting attrs. Deep mutation of the same caller attrs object is not an update contract. Live select placeholder changes remain unsupported.

Value/state facade methods now live on the View prototype and delegate to its owned service. setFields/resetForm explicitly use that service's batching boundary instead of replacing instance methods. Source labels, lazy snapshots, return values and existing compatibility behavior remain; pinned listener detection is still a documented limitation.

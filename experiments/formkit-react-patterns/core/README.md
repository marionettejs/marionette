# Isolated React-pattern FormKit experiment

This is an unpublished experimental adapter, not a replacement for the current `@mnjs/formkit` work. Prior small hand-built renderer checkpoints remain in `checkpoints/`.

## Current architecture

- `upstream-bindings.mjs` extracts the complete published React2.5.0 reactive store and bindings context, with the React hook removed. This includes upstream handlers, state, messages, validity/visibility, props, class observer caching and lazy aggregate snapshots. There is no React runtime import. `node core/extract-bindings.mjs` verifies byte-for-byte reproduction from the locked published module plus explicit adaptations.
- Adaptations are observer ownership cleanup, explicit class-cache refresh, terminal context guards, and membership-checked store dispatch. MIT copyright/license retained in `LICENSE.formkit`.
- `section-renderer.mjs` renders the actual official `inputs.text` definition's generated section schema. It does not substitute a hard-coded input. Wrapper, inner, label, input, help and message-loop structure comes from that schema. Each expression uses official `compile/provide`, tracks its token values and patches its own DOM binding. Context bag entries are compared shallowly for in-place changes when notified.
- Context notifications still scan that field's registered bindings. This is not property-level subscription dispatch or constant total work. Counters distinguish context notifications, token checks, expression evaluations, DOM writes and structural changes. They exclude uninstrumented Core, snapshot and observer work.
- `index.mjs` provides real Marionette View/Region ownership and official FormKit library form/text features. The root form shell and incomplete-message list remain adapter-owned, not a complete rendering of the form definition's schema. Each text definition has an extra adapter-owned field host around its actual section tree.

## Interface and contract

`mount({host,count,fields,values,classes,config,formProps,onSubmit,onSubmitInvalid,onSubmitRaw})` returns `{form,node,metrics,setFields,reset,submit,destroy}`. Fields use `{name,label,validation,validationVisibility,disabled,help,attrs,type:'text'}`; section-class props accepted at initial mount through the Core props. Defaults: required validation, live visibility, empty text value, no actions. `submit()` dispatches real DOM submission to the official form handler. The default submission callback is a no-op, preventing accidental native navigation.

Automatic updates follow notified upstream context/Core changes. Silent closure mutation does not itself notify. `form.render()` explicitly refreshes class caches and section bindings while preserving stable controls. Terminal submission cancellation uses a private sentinel only; user callback errors/rejections remain observable. Destruction removes subscriptions, DOM listeners and owned Core nodes.

`schema.mjs` is a separate narrow schema controller, not a general FormKitSchema replacement. See `SCHEMA.md` for its explicit subset.

## Limits

No full arbitrary schema/component renderer, slots, icons/raw HTML, nested groups/lists, Pro controls, arbitrary input types or complete API compatibility is claimed. Raw icon HTML and unsupported section nodes throw. Official text sections are consumed, but not every upstream section override or binding shape is implemented. Dynamic replacement of arbitrary props and class definitions is not fully covered. Root form actions and full form sections remain unimplemented. Upstream full context is retained, but this does not establish complete semantics across all inputs.

The upstream context's lazy aggregate value snapshots remain unchanged; renderer counters are not proof that all snapshot or Core work scales linearly. Existing copies for submit payloads also remain official behavior. The simple `createStore` test helper is separate from the actual extracted context store, which has its own lifetime regressions.

## Verification

Run `node core/{test,regressions,submit-test,submit-terminal-test,schema-test,sections-test}.mjs` individually. Section tests cover actual official nested markup, upstream blur visibility, help/error ID references, mutable bags on notified refresh, valid/complete state, retained input, and destruction of real context-store subscribers/class accessors. Shared harnesses compare the same fixtures across adapters.

JSDOM checks and renderer counters are not browser timing, layout, genuine-keyboard or complete accessibility evidence. No performance superiority or browser readiness is claimed without the separate real-browser protocol passing.

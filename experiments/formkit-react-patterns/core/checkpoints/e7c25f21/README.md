# React-pattern experiment: intentionally narrow core

This is a private experiment, not `@mnjs/formkit`, a complete schema renderer, or an upstream parity claim. It does not modify the current adapter.

## Interface

`mount({host, count, fields, values, classes, config})` returns `{form,node,metrics,setFields,reset,destroy}`. `form` is an actual Marionette View mounted through a Region. `node` is a FormKit Core group with real child Core inputs and official validation/rules/English i18n plugins. Fields are flat text declarations `{name,label,validation,disabled}`. Default names are `field0` through `fieldN-1`.

## Update contract

Input, commit, message and supported prop notifications schedule a local field paint through a microtask-batched versioned store. Section classes use official `createObserver` reads and `createClasses`/`generateClassList`; only notified dependencies invalidate those caches. Silent closure mutation does not itself notify. `form.render()` explicitly rebuilds class observers and repaints retained controls, without replacing their input DOM nodes. This is an experiment-only contract, not a change to the existing adapter.

## Provenance

Store batching/subscription and per-section observer class caching adapt the patterns in published `@formkit/react` 2.5.0 `dist/index.mjs` (source modules `reactiveStore.ts`, `bindings.ts`), under MIT. Copyright (c) 2021–2026 FormKit, Inc.; complete license retained in `LICENSE.formkit`. Upstream source: https://github.com/formkit/formkit/tree/v2.5.0/packages/react . Dependency versions are pinned in the experiment root lockfile. No React rendering code is used by this core: the direct DOM and Marionette lifecycle integration are new, much narrower code.

## Verification

`node core/test.mjs` uses JSDOM for structural/behavioral smoke checks. JSDOM is not a browser performance test, layout/accessibility audit, or evidence of paint timing.

## Missing and deliberately unsupported

No FormKit Schema expression interpreter, nested groups/lists, arbitrary upstream input definitions, select/radio/checkbox/Pro controls, slots/components, submit handling, FormKit input-feature hooks, summary/icon UI, blur/dirty validation visibility, or full config/prop parity. `setFields` is explicit topology input, not automatic conditional schema interpretation. Live visible validation is the only visibility mode. Messages are rebuilt locally; input nodes are retained. The root is a Core group rather than the upstream form input definition. Thus it cannot yet be a performance winner on equivalent full-form behavior; first compare the same limited slice and label it as such.

There is one observer cleanup path per field and a single destroy owner; replacing/removing fields kills observers, event receipts and DOM listeners before destroying the child Core node. Pending store paints are canceled on destroy.

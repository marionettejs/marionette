# React-pattern experiment: intentionally narrow core

This is a private experiment, not `@mnjs/formkit`, a complete schema renderer, or an upstream parity claim. It does not modify the current adapter.

## Interface

`mount({host, count, fields, values, classes, config, formProps, onSubmit, onSubmitInvalid, onSubmitRaw})` returns `{form,node,metrics,setFields,reset,submit,destroy}`. `submit()` dispatches a real cancelable DOM form submit and returns its feature-handler promise. The default onSubmit is a no-op to prevent accidental native page submission in this experiment. `form` is an actual Marionette View mounted through a Region. `node` is a FormKit Core node defined by the official inputs-library `form` definition, with official `text` child definitions and validation/rules/English i18n plugins. The library form feature installs its real submit handler, blocking validation, callbacks and reset state. A deliberately minimal feature context supplies handlers and blocking/error ledgers; it is not the full React context plugin. Fields are flat text declarations `{name,label,validation,disabled}`. Default names are `field0` through `fieldN-1`.

## Update contract

Input, commit, message and supported prop notifications schedule a local field paint through a microtask-batched versioned store. Section classes use official `createObserver` reads and `createClasses`/`generateClassList`; only notified dependencies invalidate those caches. Silent closure mutation does not itself notify. `form.render()` explicitly rebuilds class observers and repaints retained controls, without replacing their input DOM nodes. This is an experiment-only contract, not a change to the existing adapter.

## Provenance

Store batching/subscription and per-section observer class caching adapt the patterns in published `@formkit/react` 2.5.0 `dist/index.mjs` (source modules `reactiveStore.ts`, `bindings.ts`), under MIT. Copyright (c) 2021–2026 FormKit, Inc.; complete license retained in `LICENSE.formkit`. Upstream source: https://github.com/formkit/formkit/tree/v2.5.0/packages/react . Dependency versions are pinned in the experiment root lockfile. No React rendering code is used by this core: the direct DOM and Marionette lifecycle integration are new, much narrower code.

## Verification

`node core/test.mjs` uses JSDOM for structural/behavioral smoke checks. JSDOM is not a browser performance test, layout/accessibility audit, or evidence of paint timing.

## Missing and deliberately unsupported

No FormKit Schema expression interpreter, nested groups/lists, arbitrary upstream input definitions, select/radio/checkbox/Pro controls, slots/components, FormKit input-feature hooks, summary/icon UI, blur/dirty validation visibility, or full config/prop parity. `setFields` is explicit topology input, not automatic conditional schema interpretation. Live visible validation is the only visibility mode. Messages are rebuilt locally; input nodes are retained. The root now uses the upstream form definition, but its schema is not rendered wholesale: actions are deliberately false; only fields and root incomplete/error messages are rendered. Thus it cannot yet be a performance winner on equivalent full-form behavior; first compare the same limited slice and label it as such.

There is one observer cleanup path per field and a single destroy owner; replacing/removing fields kills observers, event receipts and DOM listeners before destroying the child Core node. Pending store paints are canceled on destroy.

## Tested submit milestone

`node core/submit-test.mjs` verifies actual official form/text features, invalid/valid/raw callbacks, submitted flags, incomplete UI, detached submit payload and reset to explicitly supplied initial values. `node harness/submit.mjs experiment 3` also passes the same DOM-submit case as Vue, React and the current adapter.

Supported field declaration props are precisely `name`, `label`, `validation`, `disabled`, and `type` restricted to text; arbitrary `attrs`, `help`, `options`, `number`, icons, sectionsSchema and custom slots are not rendered. `config` passes to Core but only `classes` plus listed features are bound to DOM. `formProps` pass to Core features, with `type=form`, `actions=false` and submit callbacks controlled by mount options. This pass-through is not a promise that every prop has rendered UI support. Async callbacks use upstream behavior but destruction races, non-live visibility and full upstream context state are not yet established.

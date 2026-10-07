# Errors and diagnostics

Marionette reports invalid framework configuration with `MarionetteError`. Inspect the error's `code` to identify the contract, then read the matching diagnostic from the installed version. Application failures, such as a rejected API request, can remain ordinary errors handled by the application that owns that work.

## MarionetteError

Import `MarionetteError` from `marionette` or `@mnjs/utils`; within the same module format they export the same constructor. Use `new MarionetteError(options)`. Each call creates a native `Error` instance with a stack; `instanceof Error` and `instanceof MarionetteError` both work. Calling it as a plain function is unsupported.

```js
import { MarionetteError } from 'marionette';

const error = new MarionetteError({
  code: 'MN0019',
  message: 'The configured handler must resolve to a function.'
});
const diagnosticCode = error.code;
const description = error.toString();
```

The example constructs an error for inspection. Framework operations create their own errors; do not use Marionette's `MN` codes for unrelated application failures.

| Field or method | Contract |
| --- | --- |
| `message`, `name` | Supplied values override native Error values. With no supplied name, the inherited name is `Error`. |
| `code` | A string code selects `https://marionettejs.com/errors/<encoded-code>/`, overriding an explicitly supplied `url`. |
| `url` | Without a string code, the supplied suffix (default `''`) is appended to `urlRoot`, whose default is `https://marionettejs.com/docs/`. |
| `description`, `fileName`, `lineNumber`, `number` | Optional metadata copied from the options object. |
| `toString()` | Returns `name: message See: url`. |
| `captureStackTrace(fallbackError)` | Captures a native stack when supported; otherwise copies `fallbackError.stack`. Construction already calls it. |

Only the listed metadata fields (`code`, `description`, `fileName`, `lineNumber`, `name`, `message`, `number`, `url`) are copied from options. They become ordinary own fields; other option fields are ignored. Values are preserved rather than validated or coerced. Construction and formatting are synchronous, with no ownership or cleanup lifecycle. Extend the constructor with native `class extends` when a distinct application error type is useful.

## Find a diagnostic

Use the package's [local documentation helper](../agents.md#local-contract-lookup) from the application's directory. Replace `<skill>` with the installed or copied `skills/marionette` directory:

```sh
node <skill>/scripts/docs.mjs --diagnostic MN0019
```

The result includes the installed version, code status, affected objects, remediation, diagnostic URL, and `docsSection`. Read that section with `--section` to stay inside the installed documentation. Retired codes remain discoverable, but are no longer emitted by that release. Follow the installed contract before changing code: the website can describe a different release. Unknown codes are not evidence of a framework bug; first check which package/version produced the error.

Diagnostics identify invalid inputs and configuration. They do not replace application error handling, and they do not catch every possible misuse. Synchronous callback exceptions propagate through dispatch. An Application's asynchronous preparation rejection is part of its [start lifecycle](application.md); handle failure at the owning workflow boundary.

<!-- diagnostics:start -->

## MN0001

view-el-must-be-dom-element. Status: **retired**. Applies to CollectionView, View.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0002

region-el-type-invalid. Status: **retired**. Applies to Region.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0003

view-already-owned. Status: **active**. Applies to Application, CollectionView, Region, View.

Use the owning Application to display its prepared root. Detach a displayed view from its Region or CollectionView before adopting it elsewhere, or create a new view instance.

## MN0004

region-el-required. Status: **active**. Applies to Region.

Configure the Region with an el selector or DOM element before using it.

## MN0005

region-el-not-found. Status: **active**. Applies to Region.

Render the parent View before direct selector-backed Region operations, ensure the selector resolves within its parent element, or explicitly allow a missing element where supported.

## MN0006

region-view-required. Status: **retired**. Applies to Region.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0007

region-view-destroyed. Status: **active**. Applies to Application, Region, View.

Create a new View instance instead of attempting to show a destroyed view.

## MN0008

region-definition-invalid. Status: **retired**. Applies to Application, Region, View.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0009

event-bindings-invalid. Status: **retired**. Applies to Application, Behavior, CollectionView, MnObject, Region, View.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0010

request-bindings-invalid. Status: **retired**. Applies to Application, Behavior, CollectionView, MnObject, Region, View.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0011

collection-view-child-view-required. Status: **active**. Applies to CollectionView.

Configure childView with a View class or a function that returns a View class.

## MN0012

collection-view-child-view-invalid. Status: **retired**. Applies to CollectionView.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0013

collection-view-container-not-found. Status: **active**. Applies to CollectionView.

Ensure childViewContainer resolves to an element within the rendered CollectionView.

## MN0014

collection-view-filter-invalid. Status: **retired**. Applies to CollectionView.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0015

collection-view-swap-non-children. Status: **active**. Applies to CollectionView.

Pass two views currently owned by the CollectionView to swapChildViews.

## MN0016

behavior-definition-invalid. Status: **retired**. Applies to Behavior, CollectionView, View.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0017

radio-channel-name-required. Status: **active**. Applies to Radio.

Pass a non-empty channel name when creating or accessing a Radio channel.

## MN0018

ui-reference-invalid. Status: **active**. Applies to Behavior, CollectionView, View.

Use @ui.<name> with a non-empty own key whose value is a string selector, or replace the reference with a literal selector.

## MN0019

handler-not-callable. Status: **active**. Applies to Application, Behavior, CollectionView, MnObject, Region, View.

Provide a function or the string name of a callable method on the binding context.

## MN0020

named-region-not-found. Status: **active**. Applies to View.

Define the named Region before using child-View or Region-removal operations, or use getRegion or hasRegion for optional lookup.

## MN0021

radio-channel-not-found. Status: **active**. Applies to Radio.

Create the named channel with Radio.channel(name) before resetting it, or call Radio.reset() with no arguments to reset all existing channels.

## MN0022

collection-view-empty-view-invalid. Status: **retired**. Applies to CollectionView.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0023

ui-elements-unavailable. Status: **active**. Applies to Behavior, CollectionView, View.

Declare a ui map, then render the View or explicitly bind its UI elements before calling getUI; bind them again before calling getUI after unbinding.

## MN0024

child-container-argument-invalid. Status: **active**. Applies to CollectionView.

Pass nonnegative integer counts. Reducing an empty child container requires an initial value.

## MN0025

child-container-method-not-callable. Status: **retired**. Applies to CollectionView.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0026

entity-event-name-unsafe. Status: **active**. Applies to Application, Behavior, CollectionView, MnObject, Region, View.

Rename an own __proto__ entry in an entity-event map before binding or selectively unbinding it.

## MN0027

feature-name-invalid. Status: **retired**. Applies to Behavior, CollectionView, View.

The v5 feature registry is removed. Configure child event prefixes per View, trigger behavior per trigger, and application values through State or explicit configuration.

## MN0028

region-destroyed-operation. Status: **retired**. Applies to Region.

Calls to show, empty, or reset after Region destruction are lifecycle-safe no-ops. Use a live Region when the operation must take effect.

## MN0029

view-destroyed-set-element. Status: **retired**. Applies to CollectionView, View.

Calls to setElement after View or CollectionView destruction begins are lifecycle-safe no-ops. Use a live instance when element replacement must take effect.

## MN0030

region-registration-conflict. Status: **active**. Applies to Region, View.

Register a live, unowned Region under an unused name; remove an existing named Region before replacing it and use a fresh Region instance for a different owner.

## MN0031

application-registration-conflict. Status: **active**. Applies to Application.

Register a live, unowned Application instance under an unused non-empty string name; use hasChildApp before constructing a dynamic child when allocation must be avoided.

## MN0032

region-name-invalid. Status: **active**. Applies to View.

Pass a non-empty string name to a named Region operation.

## MN0033

merge-options-keys-invalid. Status: **retired**. Applies to Application, Behavior, CollectionView, MnObject, Region, View.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0034

state-key-invalid. Status: **retired**. Applies to StateApi.

The concrete v5 alpha State key validation is removed. Use the selected source's native key contract.

## MN0035

state-ownership-conflict. Status: **retired**. Applies to Behavior, CollectionView, MnObject, View.

The concrete v5 alpha State ownership rule is removed. Supplied sources are borrowed and may be shared by multiple owners; createState results are owned and disposed by their owner.

## MN0036

event-delegator-contract-invalid. Status: **retired**. Applies to Behavior, CollectionView, View.

Use the documented argument types. Marionette no longer emits a dedicated runtime diagnostic for this unsupported input shape.

## MN0037

adapter-observation-unsupported. Status: **active**. Applies to Application, Behavior, CollectionView, MnObject, View.

Configure a StateApi or DataApi that can observe the selected source, or remove the declarative event map.

## MN0038

adapter-cleanup-invalid. Status: **retired**. Applies to Application, Behavior, CollectionView, MnObject, View.

DataApi and StateApi adapters must return cleanup functions. Core no longer wraps or validates cleanup on each registration.

## MN0039

collection-data-contract-invalid. Status: **active**. Applies to CollectionView.

Return an ordered array with unique stable keys and emit a valid reorder, reset, or update structural record.

## MN0040

private-framework-member-access. Status: **active**. Applies to Application, Behavior, CollectionView, MnObject, Region, View.

Use the documented public Marionette API instead of reading or calling this private framework member.

<!-- diagnostics:end -->
